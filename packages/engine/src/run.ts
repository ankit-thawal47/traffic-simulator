import { STEP_SECONDS, VEHICLE_CLASS_ASSUMPTIONS, type VehicleClassAssumptions } from "./assumptions";
import { roadLengthM } from "./geometry";
import { createRandomStream, exponential, type RandomStream } from "./random";
import type { Results, Road, Run, RunInput, Snapshot, VehicleClass } from "./types";

interface RoadState {
  road: Road;
  lengthM: number;
  /** Vehicles on this road; sorted front first at the start of each step. */
  vehicles: Vehicle[];
}

interface Vehicle {
  id: number;
  vehicleClass: VehicleClass;
  assumptions: VehicleClassAssumptions;
  road: RoadState;
  /** Front bumper, metres from the start of the road. */
  positionM: number;
  lateralM: number;
  speedMps: number;
  stationary: boolean;
  /** Decided in the decide phase, used in the apply phase. */
  nextPositionM: number;
  nextSpeedMps: number;
}

interface FlowState {
  entryRoad: RoadState;
  meanHeadwayS: number;
  random: RandomStream;
  nextArrivalS: number;
  waiting: number;
}

/** Floor on the gap used by the following rule, so a touching vehicle brakes hard instead of dividing by zero. */
const MIN_GAP_M = 0.01;

function frontFirst(a: Vehicle, b: Vehicle): number {
  return b.positionM - a.positionM || a.id - b.id;
}

/** Clear distance from a vehicle's front bumper to the rear bumper of the vehicle ahead. */
function gapTo(vehicle: Vehicle, leader: Vehicle): number {
  return leader.positionM - leader.assumptions.lengthM - vehicle.positionM;
}

export function createRun(input: RunInput): Run {
  const roads = new Map<string, RoadState>();
  if (input.network.formatVersion !== 1) {
    throw new Error(`Unsupported network format version: ${String(input.network.formatVersion)}`);
  }
  for (const road of input.network.roads) {
    if (roads.has(road.id)) throw new Error(`The network has two roads with the id "${road.id}"`);
    if (!(road.widthM > 0) || !(road.speedLimitMps > 0) || !(roadLengthM(road) > 0)) {
      throw new Error(`Road "${road.id}" needs a positive length, width and speed limit`);
    }
    roads.set(road.id, { road, lengthM: roadLengthM(road), vehicles: [] });
  }

  const flows: FlowState[] = [];
  input.demand.flows.forEach((flow, index) => {
    const entryRoad = roads.get(flow.entryRoadId);
    if (!entryRoad) throw new Error(`Demand names an entry road that is not in the network: "${flow.entryRoadId}"`);
    if (!roads.has(flow.exitRoadId)) {
      throw new Error(`Demand names an exit road that is not in the network: "${flow.exitRoadId}"`);
    }
    if (flow.exitRoadId !== flow.entryRoadId) {
      // Routes across junctions arrive with the junction tickets; until then a route is one road.
      throw new Error(`There is no route from road "${flow.entryRoadId}" to road "${flow.exitRoadId}"`);
    }
    if (!(flow.vehiclesPerHour >= 0)) throw new Error(`Demand for road "${flow.entryRoadId}" has an invalid rate`);
    if (flow.vehiclesPerHour === 0) return;
    const meanHeadwayS = 3600 / flow.vehiclesPerHour;
    const random = createRandomStream(input.seed, `demand:${index}`);
    flows.push({ entryRoad, meanHeadwayS, random, nextArrivalS: exponential(random, meanHeadwayS), waiting: 0 });
  });

  let stepCount = 0;
  let nextVehicleId = 1;
  let vehiclesEntered = 0;
  let vehiclesThrough = 0;

  function placeVehicle(road: RoadState, vehicleClass: VehicleClass, positionM: number, speedMps: number): Vehicle {
    const vehicle: Vehicle = {
      id: nextVehicleId++,
      vehicleClass,
      assumptions: VEHICLE_CLASS_ASSUMPTIONS[vehicleClass],
      road,
      positionM,
      lateralM: road.road.widthM / 2,
      speedMps,
      stationary: false,
      nextPositionM: positionM,
      nextSpeedMps: speedMps,
    };
    road.vehicles.push(vehicle);
    vehiclesEntered++;
    return vehicle;
  }

  for (const initial of input.initialVehicles ?? []) {
    const road = roads.get(initial.roadId);
    if (!road) throw new Error(`An initial vehicle is on a road that is not in the network: "${initial.roadId}"`);
    const vehicleClass = initial.vehicleClass ?? "car";
    const lengthM = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass].lengthM;
    if (initial.positionM < lengthM || initial.positionM > road.lengthM) {
      throw new Error(`An initial vehicle at ${initial.positionM} m does not fit on road "${initial.roadId}"`);
    }
    if (initial.speedMps < 0) throw new Error("An initial vehicle has a negative speed");
    const vehicle = placeVehicle(road, vehicleClass, initial.positionM, initial.stationary ? 0 : initial.speedMps);
    vehicle.stationary = initial.stationary === true;
  }

  /**
   * Put a waiting vehicle at the start of a road if there is room: its rear bumper
   * at the start, and at least its desired following gap to the last vehicle on the road.
   */
  function tryToEnter(road: RoadState, vehicleClass: VehicleClass): boolean {
    const assumptions = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass];
    let speedMps = Math.min(assumptions.desiredSpeedMps, road.road.speedLimitMps);
    let last: Vehicle | undefined;
    for (const vehicle of road.vehicles) {
      if (!last || vehicle.positionM - vehicle.assumptions.lengthM < last.positionM - last.assumptions.lengthM) last = vehicle;
    }
    if (last) {
      speedMps = Math.min(speedMps, last.speedMps);
      const gapM = last.positionM - last.assumptions.lengthM - assumptions.lengthM;
      if (gapM < assumptions.standstillGapM + speedMps * assumptions.timeGapS) return false;
    }
    placeVehicle(road, vehicleClass, assumptions.lengthM, speedMps);
    return true;
  }

  function desiredSpeedMps(vehicle: Vehicle): number {
    return Math.min(vehicle.assumptions.desiredSpeedMps, vehicle.road.road.speedLimitMps);
  }

  /**
   * The following rule: the Intelligent Driver Model (Treiber, Hennecke and Helbing 2000).
   * dv/dt = a [1 - (v/v0)^4 - (sd/s)^2], where s is the gap to the leader and
   * the desired gap is sd = s0 + v T + v dv / (2 sqrt(a b)), dv being the approach rate.
   */
  function acceleration(vehicle: Vehicle, leader: Vehicle | undefined): number {
    const { maxAccelerationMps2: a, comfortableDecelerationMps2: b, timeGapS, standstillGapM } = vehicle.assumptions;
    const v = vehicle.speedMps;
    const ratio = v / desiredSpeedMps(vehicle);
    let interaction = 0;
    if (leader) {
      const gapM = Math.max(gapTo(vehicle, leader), MIN_GAP_M);
      const approachRate = v - leader.speedMps;
      const desiredGapM = standstillGapM + Math.max(0, v * timeGapS + (v * approachRate) / (2 * Math.sqrt(a * b)));
      interaction = (desiredGapM / gapM) * (desiredGapM / gapM);
    }
    return a * (1 - ratio * ratio * ratio * ratio - interaction);
  }

  /** Decide a vehicle's next position and speed from the current state of everything else. */
  function decide(vehicle: Vehicle, leader: Vehicle | undefined): void {
    if (vehicle.stationary) return;
    const a = acceleration(vehicle, leader);
    const v = vehicle.speedMps;
    const dt = STEP_SECONDS;
    let nextSpeed = v + a * dt;
    let advance: number;
    if (nextSpeed < 0) {
      // The vehicle comes to rest part-way through the step; it never reverses.
      advance = a < 0 ? (v * v) / (-2 * a) : 0;
      nextSpeed = 0;
    } else {
      advance = v * dt + 0.5 * a * dt * dt;
    }
    if (leader) {
      // Safety net (ours, not part of the published rule): a vehicle never advances
      // further in one step than the clear gap it started the step with. The leader
      // only moves forward, so this holds whatever the leader does, and it depends
      // only on the state at the start of the step.
      const clearM = Math.max(0, gapTo(vehicle, leader));
      if (advance > clearM) {
        advance = clearM;
        nextSpeed = Math.min(nextSpeed, advance / dt);
      }
    }
    vehicle.nextSpeedMps = nextSpeed;
    vehicle.nextPositionM = vehicle.positionM + advance;
  }

  function step(): void {
    // Decide: every vehicle decides from the same state.
    for (const road of roads.values()) {
      road.vehicles.sort(frontFirst);
      for (let i = 0; i < road.vehicles.length; i++) decide(road.vehicles[i]!, road.vehicles[i - 1]);
    }

    // Apply: all moves happen together.

    for (const road of roads.values()) {
      for (const vehicle of road.vehicles) {
        vehicle.positionM = vehicle.nextPositionM;
        vehicle.speedMps = vehicle.nextSpeedMps;
      }
      const remaining = road.vehicles.filter((vehicle) => vehicle.positionM < road.lengthM);
      vehiclesThrough += road.vehicles.length - remaining.length;
      road.vehicles = remaining;
    }

    stepCount++;
    const timeS = stepCount * STEP_SECONDS;

    for (const flow of flows) {
      while (flow.nextArrivalS <= timeS) {
        flow.waiting++;
        flow.nextArrivalS += exponential(flow.random, flow.meanHeadwayS);
      }
      if (flow.waiting > 0 && tryToEnter(flow.entryRoad, "car")) flow.waiting--;
    }
  }

  function snapshot(): Snapshot {
    const vehicles = [];
    for (const road of roads.values()) {
      for (const vehicle of road.vehicles) {
        vehicles.push({
          id: vehicle.id,
          vehicleClass: vehicle.vehicleClass,
          roadId: road.road.id,
          positionM: vehicle.positionM,
          lateralM: vehicle.lateralM,
          speedMps: vehicle.speedMps,
          lengthM: vehicle.assumptions.lengthM,
          widthM: vehicle.assumptions.widthM,
        });
      }
    }
    vehicles.sort((a, b) => a.id - b.id);
    return { timeS: stepCount * STEP_SECONDS, vehicles };
  }

  function results(): Results {
    let vehiclesOnNetwork = 0;
    for (const road of roads.values()) vehiclesOnNetwork += road.vehicles.length;
    let vehiclesWaitingToEnter = 0;
    for (const flow of flows) vehiclesWaitingToEnter += flow.waiting;
    return { timeS: stepCount * STEP_SECONDS, vehiclesEntered, vehiclesThrough, vehiclesOnNetwork, vehiclesWaitingToEnter };
  }

  return {
    get timeS() {
      return stepCount * STEP_SECONDS;
    },
    step,
    snapshot,
    results,
  };
}
