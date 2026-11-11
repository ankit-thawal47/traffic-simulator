import {
  SIDEWAYS_ASSUMPTIONS,
  STANDARD_LANE_WIDTH_M,
  STEP_SECONDS,
  STRIP_WIDTH_M,
  stripsOccupied,
  VEHICLE_CLASSES,
  VEHICLE_CLASS_ASSUMPTIONS,
  type VehicleClassAssumptions,
} from "./assumptions";
import { roadLengthM } from "./geometry";
import { createRandomStream, exponential, type RandomStream } from "./random";
import type { Results, Road, Run, RunInput, Snapshot, VehicleClass, VehicleClassDelay, VehicleState } from "./types";

/**
 * How vehicles share a road's width.
 *
 * The width is divided into strips. In mixed traffic a strip is narrow and a
 * vehicle occupies as many as its width plus side clearance needs. With lane
 * discipline on, a strip is a whole lane and a vehicle occupies exactly one.
 * Everything else (leader, sideways shifts, same-space conflicts) is the same
 * rule set working on strips, so one engine does both.
 */
interface RoadState {
  road: Road;
  lengthM: number;
  stripWidthM: number;
  stripCount: number;
  /** Distance from the road's left edge to the left edge of strip 0. */
  stripOffsetM: number;
  /** Vehicles on this road; sorted front first at the start of each step. */
  vehicles: Vehicle[];
  /**
   * For the vehicle at index i of the sorted list and strip s, at [i * stripCount + s]:
   * the index of the nearest vehicle sorted ahead of it (aheadOf) or behind it (behindOf)
   * that occupies strip s, or -1.
   */
  aheadOf: Int32Array;
  behindOf: Int32Array;
}

interface Vehicle {
  id: number;
  vehicleClass: VehicleClass;
  assumptions: VehicleClassAssumptions;
  road: RoadState;
  /** Front bumper, metres from the start of the road. */
  positionM: number;
  speedMps: number;
  stationary: boolean;
  desiredSpeedMps: number;

  /** Leftmost strip occupied when not shifting; during a shift, the leftmost strip it is leaving from. */
  strip: number;
  /** How many strips the vehicle occupies when not shifting. */
  strips: number;
  /** -1 while shifting one strip to the left, +1 to the right, 0 when not shifting. */
  shiftDirection: number;
  shiftStepsDone: number;
  shiftSteps: number;
  /**
   * Strips beyond the one being entered that the vehicle is heading for (inclusive range).
   * Empty (reservedLow > reservedHigh) when it is heading for none.
   */
  reservedLow: number;
  reservedHigh: number;

  /** When the demand produced the vehicle, and where its front bumper was when it was placed. */
  arrivedAtS: number;
  entryPositionM: number;

  // Working values of one step.
  index: number;
  /** Acceleration the following rule gives from the state at the start of the step. */
  currentAcceleration: number;
  /** A sideways claim made this step: direction (0 for none) and the strips it would newly occupy. */
  claimDirection: number;
  claimLow: number;
  claimHigh: number;
  nextPositionM: number;
  nextSpeedMps: number;
}

interface WaitingVehicle {
  vehicleClass: VehicleClass;
  arrivedAtS: number;
}

interface FlowState {
  entryRoad: RoadState;
  meanHeadwayS: number;
  random: RandomStream;
  classRandom: RandomStream;
  nextArrivalS: number;
  /** Vehicles the demand has produced that have not found room to enter yet, first come first. */
  waiting: WaitingVehicle[];
}

/** Floor on the gap used by the following rule, so a touching vehicle brakes hard instead of dividing by zero. */
const MIN_GAP_M = 0.01;
/** Slack for comparing accelerations and widths that should be equal. */
const EPSILON = 1e-9;

const LONGEST_VEHICLE_M = Math.max(...VEHICLE_CLASSES.map((vehicleClass) => VEHICLE_CLASS_ASSUMPTIONS[vehicleClass].lengthM));

function frontFirst(a: Vehicle, b: Vehicle): number {
  return b.positionM - a.positionM || a.id - b.id;
}

function rearM(vehicle: Vehicle): number {
  return vehicle.positionM - vehicle.assumptions.lengthM;
}

/** Lowest and highest strip a vehicle occupies; while shifting it occupies the strips it leaves and the one it enters. */
function lowStrip(vehicle: Vehicle): number {
  return vehicle.shiftDirection < 0 ? vehicle.strip - 1 : vehicle.strip;
}
function highStrip(vehicle: Vehicle): number {
  return vehicle.strip + vehicle.strips - 1 + (vehicle.shiftDirection > 0 ? 1 : 0);
}

function lateralM(vehicle: Vehicle): number {
  const road = vehicle.road;
  const shifted = vehicle.shiftDirection === 0 ? 0 : (vehicle.shiftDirection * vehicle.shiftStepsDone) / vehicle.shiftSteps;
  return road.stripOffsetM + (vehicle.strip + vehicle.strips / 2 + shifted) * road.stripWidthM;
}

export function createRun(input: RunInput): Run {
  const laneDiscipline = input.laneDiscipline === true;
  const formatVersion = input.network.formatVersion;
  if (formatVersion !== 1 && formatVersion !== 2) {
    throw new Error(`Unsupported network format version: ${String(formatVersion)}`);
  }

  const roads = new Map<string, RoadState>();
  for (const road of input.network.roads) {
    if (roads.has(road.id)) throw new Error(`The network has two roads with the id "${road.id}"`);
    if (!(road.widthM > 0) || !(road.speedLimitMps > 0) || !(roadLengthM(road) > 0)) {
      throw new Error(`Road "${road.id}" needs a positive length, width and speed limit`);
    }
    let lanes = road.lanes;
    if (lanes === undefined) {
      if (formatVersion >= 2) throw new Error(`Road "${road.id}" needs a lane count`);
      lanes = Math.max(1, Math.floor(road.widthM / STANDARD_LANE_WIDTH_M + EPSILON));
    }
    if (!Number.isInteger(lanes) || lanes < 1) throw new Error(`Road "${road.id}" needs a lane count of 1 or more`);

    const stripCount = laneDiscipline ? lanes : Math.floor(road.widthM / STRIP_WIDTH_M + EPSILON);
    const stripWidthM = laneDiscipline ? road.widthM / lanes : STRIP_WIDTH_M;
    roads.set(road.id, {
      road,
      lengthM: roadLengthM(road),
      stripWidthM,
      stripCount,
      stripOffsetM: (road.widthM - stripCount * stripWidthM) / 2,
      vehicles: [],
      aheadOf: new Int32Array(0),
      behindOf: new Int32Array(0),
    });
  }

  /** How many strips a vehicle class occupies on a road; throws when the road cannot take it. */
  function stripsNeeded(road: RoadState, vehicleClass: VehicleClass): number {
    const assumptions = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass];
    if (laneDiscipline) {
      if (assumptions.widthM > road.stripWidthM + EPSILON) {
        throw new Error(`The lanes of road "${road.road.id}" are too narrow for a ${vehicleClass}`);
      }
      return 1;
    }
    const strips = stripsOccupied(vehicleClass);
    if (strips > road.stripCount) throw new Error(`Road "${road.road.id}" is too narrow for a ${vehicleClass}`);
    return strips;
  }

  // The vehicle mix, as cumulative shares in the fixed order of vehicle classes.
  let cumulativeShares: number[] | undefined;
  const classesInMix: VehicleClass[] = [];
  if (input.demand.vehicleMix) {
    let total = 0;
    cumulativeShares = [];
    for (const vehicleClass of VEHICLE_CLASSES) {
      const share = input.demand.vehicleMix[vehicleClass] ?? 0;
      if (!(share >= 0) || !Number.isFinite(share)) throw new Error(`The vehicle mix has an invalid share for ${vehicleClass}`);
      if (share > 0) classesInMix.push(vehicleClass);
      total += share;
      cumulativeShares.push(total);
    }
    if (!(total > 0)) throw new Error("The vehicle mix needs a share above zero for at least one vehicle class");
    cumulativeShares = cumulativeShares.map((share) => share / total);
  } else {
    classesInMix.push("car");
  }

  function drawVehicleClass(random: RandomStream): VehicleClass {
    if (!cumulativeShares) return "car";
    const u = random.next();
    for (let i = 0; i < VEHICLE_CLASSES.length; i++) {
      if (u < cumulativeShares[i]!) return VEHICLE_CLASSES[i]!;
    }
    return classesInMix[classesInMix.length - 1]!;
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
    for (const vehicleClass of classesInMix) stripsNeeded(entryRoad, vehicleClass);
    const meanHeadwayS = 3600 / flow.vehiclesPerHour;
    const random = createRandomStream(input.seed, `demand:${index}`);
    flows.push({
      entryRoad,
      meanHeadwayS,
      random,
      // Its own stream, so the vehicle mix does not disturb when vehicles arrive.
      classRandom: createRandomStream(input.seed, `vehicle-class:${index}`),
      nextArrivalS: exponential(random, meanHeadwayS),
      waiting: [],
    });
  });

  let stepCount = 0;
  let nextVehicleId = 1;
  let vehiclesEntered = 0;
  let vehiclesThrough = 0;
  const throughByClass = new Map<VehicleClass, { count: number; delayS: number }>();
  for (const vehicleClass of VEHICLE_CLASSES) throughByClass.set(vehicleClass, { count: 0, delayS: 0 });

  function placeVehicle(
    road: RoadState,
    vehicleClass: VehicleClass,
    positionM: number,
    speedMps: number,
    strip: number,
    arrivedAtS: number,
  ): Vehicle {
    const assumptions = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass];
    const vehicle: Vehicle = {
      id: nextVehicleId++,
      vehicleClass,
      assumptions,
      road,
      positionM,
      speedMps,
      stationary: false,
      desiredSpeedMps: Math.min(assumptions.desiredSpeedMps, road.road.speedLimitMps),
      strip,
      strips: stripsNeeded(road, vehicleClass),
      shiftDirection: 0,
      shiftStepsDone: 0,
      // Sideways speed is capped: a shift of one strip is spread over enough steps to stay under the cap.
      shiftSteps: Math.max(1, Math.ceil(road.stripWidthM / (assumptions.maxSidewaysSpeedMps * STEP_SECONDS) - EPSILON)),
      reservedLow: 0,
      reservedHigh: -1,
      arrivedAtS,
      entryPositionM: positionM,
      index: 0,
      currentAcceleration: 0,
      claimDirection: 0,
      claimLow: 0,
      claimHigh: -1,
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
    const strips = stripsNeeded(road, vehicleClass);
    const room = road.stripCount - strips;
    let strip = Math.floor(room / 2);
    if (initial.lateralM !== undefined) {
      strip = Math.round((initial.lateralM - road.stripOffsetM) / road.stripWidthM - strips / 2);
      strip = Math.min(room, Math.max(0, strip));
    }
    const speedMps = initial.stationary ? 0 : initial.speedMps;
    const vehicle = placeVehicle(road, vehicleClass, initial.positionM, speedMps, strip, 0);
    vehicle.stationary = initial.stationary === true;
  }

  /**
   * Put a waiting vehicle at the start of a road if there is room: its rear bumper at
   * the start, in strips where it has at least its desired following gap to the
   * nearest vehicle. Of the places with room it takes the one with the longest clear
   * road ahead, and of equals the one nearest the middle of the road.
   */
  function tryToEnter(road: RoadState, waiting: WaitingVehicle): boolean {
    const assumptions = VEHICLE_CLASS_ASSUMPTIONS[waiting.vehicleClass];
    const strips = stripsNeeded(road, waiting.vehicleClass);
    const desired = Math.min(assumptions.desiredSpeedMps, road.road.speedLimitMps);

    // The rearmost vehicle in each strip.
    const last: (Vehicle | undefined)[] = new Array(road.stripCount).fill(undefined);
    for (const vehicle of road.vehicles) {
      const rear = rearM(vehicle);
      for (let s = lowStrip(vehicle); s <= highStrip(vehicle); s++) {
        const other = last[s];
        if (!other || rear < rearM(other)) last[s] = vehicle;
      }
    }

    const middle = (road.stripCount - strips) / 2;
    let bestStrip = -1;
    let bestGapM = 0;
    let bestSpeedMps = 0;
    for (let strip = 0; strip + strips <= road.stripCount; strip++) {
      let nearest: Vehicle | undefined;
      for (let s = strip; s < strip + strips; s++) {
        const other = last[s];
        if (other && (!nearest || rearM(other) < rearM(nearest))) nearest = other;
      }
      const gapM = nearest ? rearM(nearest) - assumptions.lengthM : Infinity;
      const speedMps = nearest ? Math.min(desired, nearest.speedMps) : desired;
      if (gapM < assumptions.standstillGapM + speedMps * assumptions.timeGapS) continue;
      const better =
        bestStrip < 0 ||
        gapM > bestGapM ||
        (gapM === bestGapM && Math.abs(strip - middle) < Math.abs(bestStrip - middle));
      if (better) {
        bestStrip = strip;
        bestGapM = gapM;
        bestSpeedMps = speedMps;
      }
    }
    if (bestStrip < 0) return false;
    placeVehicle(road, waiting.vehicleClass, assumptions.lengthM, bestSpeedMps, bestStrip, waiting.arrivedAtS);
    return true;
  }

  /**
   * The following rule: the Intelligent Driver Model (Treiber, Hennecke and Helbing 2000).
   * dv/dt = a [1 - (v/v0)^4 - (sd/s)^2], where s is the gap to the leader and
   * the desired gap is sd = s0 + v T + v dv / (2 sqrt(a b)), dv being the approach rate.
   * `gapM` is undefined when there is no leader.
   */
  function acceleration(vehicle: Vehicle, gapM: number | undefined, leaderSpeedMps: number): number {
    const { maxAccelerationMps2: a, comfortableDecelerationMps2: b, timeGapS, standstillGapM } = vehicle.assumptions;
    const v = vehicle.speedMps;
    const ratio = v / vehicle.desiredSpeedMps;
    let interaction = 0;
    if (gapM !== undefined) {
      const gap = Math.max(gapM, MIN_GAP_M);
      const approachRate = v - leaderSpeedMps;
      const desiredGapM = standstillGapM + Math.max(0, v * timeGapS + (v * approachRate) / (2 * Math.sqrt(a * b)));
      interaction = (desiredGapM / gap) * (desiredGapM / gap);
    }
    return a * (1 - ratio * ratio * ratio * ratio - interaction);
  }

  function accelerationBehind(vehicle: Vehicle, leader: Vehicle | undefined): number {
    if (!leader) return acceleration(vehicle, undefined, 0);
    return acceleration(vehicle, rearM(leader) - vehicle.positionM, leader.speedMps);
  }

  /** For every vehicle on a road and every strip, find the nearest vehicle ahead (and, if asked, behind) in that strip. */
  function findNeighbours(road: RoadState, behindToo: boolean): void {
    const { vehicles, stripCount } = road;
    const size = vehicles.length * stripCount;
    if (road.aheadOf.length < size) {
      road.aheadOf = new Int32Array(size * 2);
      road.behindOf = new Int32Array(size * 2);
    }
    const nearest = new Int32Array(stripCount).fill(-1);
    for (let i = 0; i < vehicles.length; i++) {
      road.aheadOf.set(nearest, i * stripCount);
      const vehicle = vehicles[i]!;
      for (let s = lowStrip(vehicle); s <= highStrip(vehicle); s++) nearest[s] = i;
    }
    if (!behindToo) return;
    nearest.fill(-1);
    for (let i = vehicles.length - 1; i >= 0; i--) {
      road.behindOf.set(nearest, i * stripCount);
      const vehicle = vehicles[i]!;
      for (let s = lowStrip(vehicle); s <= highStrip(vehicle); s++) nearest[s] = i;
    }
  }

  /**
   * The leader a vehicle would have in the strips low..high: the nearest vehicle
   * ahead that overlaps those strips. Vehicles sharing a strip never overlap
   * along the road, so in each strip the nearest one sorted ahead is the nearest.
   */
  function leaderIn(vehicle: Vehicle, low: number, high: number): Vehicle | undefined {
    const road = vehicle.road;
    const base = vehicle.index * road.stripCount;
    let leader: Vehicle | undefined;
    for (let s = low; s <= high; s++) {
      const j = road.aheadOf[base + s]!;
      if (j < 0) continue;
      const other = road.vehicles[j]!;
      if (!leader || rearM(other) < rearM(leader)) leader = other;
    }
    return leader;
  }

  /** The nearest vehicle behind that overlaps the strips low..high. */
  function followerIn(vehicle: Vehicle, low: number, high: number): Vehicle | undefined {
    const road = vehicle.road;
    const base = vehicle.index * road.stripCount;
    let follower: Vehicle | undefined;
    for (let s = low; s <= high; s++) {
      const j = road.behindOf[base + s]!;
      if (j < 0) continue;
      const other = road.vehicles[j]!;
      if (!follower || other.positionM > follower.positionM) follower = other;
    }
    return follower;
  }

  /** Whether a strip the vehicle does not occupy has another vehicle alongside the vehicle. */
  function stripTakenAlongside(vehicle: Vehicle, strip: number): boolean {
    const road = vehicle.road;
    const base = vehicle.index * road.stripCount;
    const ahead = road.aheadOf[base + strip]!;
    if (ahead >= 0 && rearM(road.vehicles[ahead]!) < vehicle.positionM) return true;
    const behind = road.behindOf[base + strip]!;
    return behind >= 0 && road.vehicles[behind]!.positionM > rearM(vehicle);
  }

  /**
   * Sideways movement (spec: Engine behaviour). A vehicle held back by its leader
   * looks at the places to its left and right, one strip further at a time, as far
   * as the way there is free alongside it, no worse than where it is, and does not
   * make the vehicle behind brake hard. It heads for the place with the largest gain
   * in the following rule's acceleration, less the braking it causes the vehicle
   * behind weighted by politeness, if that gain is over the threshold (the incentive
   * and safety tests of MOBIL, Kesting, Treiber and Helbing 2007, applied to strips
   * as in the rule set synthesised from Mathew et al. and Kanagaraj and Treiber 2018).
   *
   * The result is a claim: a direction, and the strips the vehicle would newly occupy
   * on the way to that place. Claims are settled by settleClaims.
   */
  function claimSpace(vehicle: Vehicle): void {
    vehicle.claimDirection = 0;
    if (vehicle.stationary) return;
    if (vehicle.shiftDirection !== 0) {
      // Already shifting: it keeps heading for the strips it set out for.
      if (vehicle.reservedLow <= vehicle.reservedHigh) {
        vehicle.claimDirection = vehicle.shiftDirection;
        vehicle.claimLow = vehicle.reservedLow;
        vehicle.claimHigh = vehicle.reservedHigh;
      }
      return;
    }
    const threshold = SIDEWAYS_ASSUMPTIONS.gainThresholdMps2.value;
    const current = vehicle.currentAcceleration;
    // No place can give more than an open road does.
    if (acceleration(vehicle, undefined, 0) - current <= threshold) return;

    const road = vehicle.road;
    const politeness = SIDEWAYS_ASSUMPTIONS.politeness.value;
    const safeBraking = SIDEWAYS_ASSUMPTIONS.safeBrakingMps2.value;
    let bestGain = threshold;
    let bestDistance = 0;
    for (const direction of [-1, 1]) {
      for (let distance = 1; ; distance++) {
        const strip = vehicle.strip + direction * distance;
        if (strip < 0 || strip + vehicle.strips > road.stripCount) break;
        const entered = direction < 0 ? strip : strip + vehicle.strips - 1;
        if (stripTakenAlongside(vehicle, entered)) break;

        const there = accelerationBehind(vehicle, leaderIn(vehicle, strip, strip + vehicle.strips - 1));
        if (there < current - EPSILON) break;

        let braking = 0;
        const follower = followerIn(vehicle, strip, strip + vehicle.strips - 1);
        if (follower && !follower.stationary) {
          const behindMe = acceleration(follower, rearM(vehicle) - follower.positionM, vehicle.speedMps);
          if (behindMe < follower.currentAcceleration) {
            if (behindMe < -safeBraking) break;
            braking = follower.currentAcceleration - behindMe;
          }
        }

        const gain = there - current - politeness * braking;
        // Of equal gains the nearer place wins, and of equally near places the left one (tried first).
        if (gain > bestGain + EPSILON || (bestDistance !== 0 && gain > bestGain - EPSILON && distance < Math.abs(bestDistance))) {
          bestGain = gain;
          bestDistance = direction * distance;
        }
      }
    }
    if (bestDistance === 0) return;
    vehicle.claimDirection = Math.sign(bestDistance);
    if (bestDistance < 0) {
      vehicle.claimLow = vehicle.strip + bestDistance;
      vehicle.claimHigh = vehicle.strip - 1;
    } else {
      vehicle.claimLow = vehicle.strip + vehicle.strips;
      vehicle.claimHigh = vehicle.strip + vehicle.strips - 1 + bestDistance;
    }
  }

  /**
   * Same-space conflicts (spec: Engine behaviour; this rule is ours, not published).
   * Two claims are for the same space when they share a strip and the two vehicles
   * are alongside each other. The vehicle further ahead gets it (of two exactly level,
   * the one with the lower id); the other does not start its shift this step, or, if
   * it was already shifting, finishes entering its strip and gives up the strips beyond.
   *
   * A vehicle that gets its claim occupies the strip it enters from this step on, so
   * vehicles behind it in that strip follow it at once.
   */
  function settleClaims(road: RoadState): void {
    const granted: Vehicle[] = [];
    // Sorted front first, so every vehicle met earlier is further ahead.
    for (const vehicle of road.vehicles) {
      if (vehicle.claimDirection === 0) continue;
      let wins = true;
      for (let g = granted.length - 1; g >= 0; g--) {
        const other = granted[g]!;
        // Those further ahead than the longest vehicle cannot be alongside.
        if (other.positionM - LONGEST_VEHICLE_M >= vehicle.positionM) break;
        if (rearM(other) < vehicle.positionM && other.claimLow <= vehicle.claimHigh && vehicle.claimLow <= other.claimHigh) {
          wins = false;
          break;
        }
      }
      if (!wins) {
        vehicle.claimDirection = 0;
        vehicle.reservedHigh = vehicle.reservedLow - 1;
        continue;
      }
      granted.push(vehicle);
      if (vehicle.shiftDirection !== 0) continue;
      // Start the shift: one strip now; the strips beyond stay reserved while it lasts.
      vehicle.shiftDirection = vehicle.claimDirection;
      vehicle.shiftStepsDone = 0;
      if (vehicle.claimDirection < 0) {
        vehicle.reservedLow = vehicle.claimLow;
        vehicle.reservedHigh = vehicle.claimHigh - 1;
      } else {
        vehicle.reservedLow = vehicle.claimLow + 1;
        vehicle.reservedHigh = vehicle.claimHigh;
      }
    }
  }

  /** Decide a vehicle's next position and speed along the road. */
  function decide(vehicle: Vehicle, leader: Vehicle | undefined): void {
    if (vehicle.stationary) return;
    const a = accelerationBehind(vehicle, leader);
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
      const clearM = Math.max(0, rearM(leader) - vehicle.positionM);
      if (advance > clearM) {
        advance = clearM;
        nextSpeed = Math.min(nextSpeed, advance / dt);
      }
    }
    vehicle.nextSpeedMps = nextSpeed;
    vehicle.nextPositionM = vehicle.positionM + advance;
  }

  /** A vehicle's delay so far: time since the demand produced it, less the time its distance takes at its desired speed. */
  function delayS(vehicle: Vehicle, timeS: number, positionM: number): number {
    return timeS - vehicle.arrivedAtS - (positionM - vehicle.entryPositionM) / vehicle.desiredSpeedMps;
  }

  /**
   * One step. Every vehicle decides from the same state, in two rounds, and then all
   * moves are applied together, so results do not depend on processing order:
   *   1. sideways: every vehicle makes its claim from the state at the start of the
   *      step, and the claims are settled by the same-space rule;
   *   2. along the road: every vehicle applies the following rule to its leader, from
   *      the positions and speeds at the start of the step and the settled claims.
   */
  function step(): void {
    for (const road of roads.values()) {
      const vehicles = road.vehicles;
      vehicles.sort(frontFirst);
      for (let i = 0; i < vehicles.length; i++) vehicles[i]!.index = i;

      findNeighbours(road, true);
      for (const vehicle of vehicles) {
        vehicle.currentAcceleration = accelerationBehind(vehicle, leaderIn(vehicle, lowStrip(vehicle), highStrip(vehicle)));
      }
      for (const vehicle of vehicles) claimSpace(vehicle);
      settleClaims(road);

      findNeighbours(road, false);
      for (const vehicle of vehicles) decide(vehicle, leaderIn(vehicle, lowStrip(vehicle), highStrip(vehicle)));
    }

    // Apply: all moves happen together.
    const timeS = (stepCount + 1) * STEP_SECONDS;
    for (const road of roads.values()) {
      const remaining: Vehicle[] = [];
      for (const vehicle of road.vehicles) {
        vehicle.positionM = vehicle.nextPositionM;
        vehicle.speedMps = vehicle.nextSpeedMps;
        if (vehicle.shiftDirection !== 0 && ++vehicle.shiftStepsDone >= vehicle.shiftSteps) {
          vehicle.strip += vehicle.shiftDirection;
          vehicle.shiftDirection = 0;
          vehicle.shiftStepsDone = 0;
          vehicle.reservedHigh = vehicle.reservedLow - 1;
        }
        if (vehicle.positionM < road.lengthM) {
          remaining.push(vehicle);
          continue;
        }
        vehiclesThrough++;
        // The moment within the step at which the front bumper reached the end of the road.
        const overshootS = vehicle.speedMps > 0 ? Math.min(STEP_SECONDS, (vehicle.positionM - road.lengthM) / vehicle.speedMps) : 0;
        const through = throughByClass.get(vehicle.vehicleClass)!;
        through.count++;
        through.delayS += delayS(vehicle, timeS - overshootS, road.lengthM);
      }
      road.vehicles = remaining;
    }

    stepCount++;

    for (const flow of flows) {
      while (flow.nextArrivalS <= timeS) {
        flow.waiting.push({ vehicleClass: drawVehicleClass(flow.classRandom), arrivedAtS: flow.nextArrivalS });
        flow.nextArrivalS += exponential(flow.random, flow.meanHeadwayS);
      }
      // First come, first in: a vehicle with no room holds back those that arrived after it.
      while (flow.waiting.length > 0 && tryToEnter(flow.entryRoad, flow.waiting[0]!)) flow.waiting.shift();
    }
  }

  function snapshot(): Snapshot {
    const vehicles: VehicleState[] = [];
    for (const road of roads.values()) {
      for (const vehicle of road.vehicles) {
        vehicles.push({
          id: vehicle.id,
          vehicleClass: vehicle.vehicleClass,
          roadId: road.road.id,
          positionM: vehicle.positionM,
          lateralM: lateralM(vehicle),
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
    const timeS = stepCount * STEP_SECONDS;
    const unfinished = new Map<VehicleClass, { count: number; delayS: number }>();
    for (const vehicleClass of VEHICLE_CLASSES) unfinished.set(vehicleClass, { count: 0, delayS: 0 });

    let vehiclesOnNetwork = 0;
    for (const road of roads.values()) {
      vehiclesOnNetwork += road.vehicles.length;
      for (const vehicle of road.vehicles) {
        if (vehicle.stationary) continue;
        const sum = unfinished.get(vehicle.vehicleClass)!;
        sum.count++;
        sum.delayS += delayS(vehicle, timeS, vehicle.positionM);
      }
    }
    let vehiclesWaitingToEnter = 0;
    for (const flow of flows) {
      vehiclesWaitingToEnter += flow.waiting.length;
      for (const waiting of flow.waiting) {
        const sum = unfinished.get(waiting.vehicleClass)!;
        sum.count++;
        sum.delayS += timeS - waiting.arrivedAtS;
      }
    }

    const delayByVehicleClass = {} as Record<VehicleClass, VehicleClassDelay>;
    for (const vehicleClass of VEHICLE_CLASSES) {
      const through = throughByClass.get(vehicleClass)!;
      const still = unfinished.get(vehicleClass)!;
      const vehicles = through.count + still.count;
      delayByVehicleClass[vehicleClass] = {
        vehicles,
        vehiclesThrough: through.count,
        meanDelayS: vehicles > 0 ? (through.delayS + still.delayS) / vehicles : null,
      };
    }
    return { timeS, vehiclesEntered, vehiclesThrough, vehiclesOnNetwork, vehiclesWaitingToEnter, delayByVehicleClass };
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
