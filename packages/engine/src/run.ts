import { STEP_SECONDS, VEHICLE_CLASS_ASSUMPTIONS, type VehicleClassAssumptions } from "./assumptions";
import { roadLengthM } from "./geometry";
import { createRandomStream, exponential, type RandomStream } from "./random";
import type { Results, Road, Run, RunInput, Snapshot, VehicleClass } from "./types";

interface RoadState {
  road: Road;
  lengthM: number;
  /** Vehicles on this road, in no particular order. */
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

export function createRun(input: RunInput): Run {
  const roads = new Map<string, RoadState>();
  for (const road of input.network.roads) {
    roads.set(road.id, { road, lengthM: roadLengthM(road), vehicles: [] });
  }

  const flows: FlowState[] = [];
  input.demand.flows.forEach((flow, index) => {
    const entryRoad = roads.get(flow.entryRoadId);
    if (!entryRoad) throw new Error(`Demand names an entry road that is not in the network: "${flow.entryRoadId}"`);
    if (flow.vehiclesPerHour <= 0) return;
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

  function desiredSpeedMps(vehicle: Vehicle): number {
    return Math.min(vehicle.assumptions.desiredSpeedMps, vehicle.road.road.speedLimitMps);
  }

  /** The following rule (Intelligent Driver Model), free-road part only for now. */
  function acceleration(vehicle: Vehicle): number {
    const ratio = vehicle.speedMps / desiredSpeedMps(vehicle);
    return vehicle.assumptions.maxAccelerationMps2 * (1 - ratio * ratio * ratio * ratio);
  }

  function decide(vehicle: Vehicle): void {
    const a = acceleration(vehicle);
    const v = vehicle.speedMps;
    const dt = STEP_SECONDS;
    vehicle.nextSpeedMps = v + a * dt;
    vehicle.nextPositionM = vehicle.positionM + v * dt + 0.5 * a * dt * dt;
  }

  function step(): void {
    for (const road of roads.values()) for (const vehicle of road.vehicles) decide(vehicle);

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
      if (flow.waiting > 0) {
        const car = VEHICLE_CLASS_ASSUMPTIONS.car;
        placeVehicle(flow.entryRoad, "car", car.lengthM, Math.min(car.desiredSpeedMps, flow.entryRoad.road.speedLimitMps));
        flow.waiting--;
      }
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
