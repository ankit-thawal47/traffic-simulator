import {
  JUNCTION_ASSUMPTIONS,
  SIDEWAYS_ASSUMPTIONS,
  STANDARD_LANE_WIDTH_M,
  STEP_SECONDS,
  STRIP_WIDTH_M,
  stripsOccupied,
  VEHICLE_CLASSES,
  VEHICLE_CLASS_ASSUMPTIONS,
  type VehicleClassAssumptions,
} from "./assumptions";
import { bandPieces, findCrossings, NO_CROSSING } from "./crossings";
import { roadLengthM } from "./geometry";
import {
  createTurningPath,
  curveDistanceM,
  curveParameter,
  signalAspect,
  turningCurve,
  type SignalAspect,
  type TurningCurve,
  type TurningPath,
} from "./junction-geometry";
import { createRandomStream, exponential, type RandomStream } from "./random";
import type {
  ApproachQueue,
  Junction,
  Results,
  Road,
  Run,
  RunInput,
  Snapshot,
  VehicleClass,
  VehicleClassDelay,
  VehicleState,
} from "./types";

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

  /** The junction this road is an approach of, and its connections from here by the id of the road they lead to. */
  endsAt: JunctionState | undefined;
  connections: Map<string, ConnectionState>;
  /** Whether a junction's connections lead onto this road. */
  startsAtJunction: boolean;
  /** For a road that starts at a junction: the rearmost vehicle in each strip at the start of the step. */
  lastInStrip: (Vehicle | undefined)[];
  /** For an approach: what its signal shows at the start of the step. */
  aspect: SignalAspect;
  /** For an approach: the longest queue it has had so far. */
  longestQueue: ApproachQueue;
}

/**
 * A connection through a junction, as the engine uses it: a band of strips
 * from the approach to the next road. It has as many strips as the narrower of
 * the two roads. Its strips line up with the left of both roads for a left turn
 * or straight on, and with the right of both for a right turn (left-hand
 * traffic: the left turn is the near-side turn). A vehicle keeps its strips all
 * the way through, so strip i of the connection is strip i + fromShift of the
 * approach and strip i + toShift of the next road.
 */
interface ConnectionState {
  index: number;
  junction: JunctionState;
  from: RoadState;
  to: RoadState;
  path: TurningPath;
  stripCount: number;
  fromShift: number;
  toShift: number;
}

interface JunctionState {
  junction: Junction;
  connections: ConnectionState[];
  approaches: RoadState[];
  /**
   * Vehicles that have been let into the junction and have not left it yet,
   * in the order they were let in. They may still be on the approach.
   */
  admitted: Vehicle[];
  /**
   * Where the junction's connections cross: for connections a and b, the table
   * of findCrossings() at [a.index * connections.length + b.index], or
   * undefined where the two nowhere overlap (and for a connection with itself).
   */
  crossings: (Int16Array | undefined)[];
}

const STEPS_PER_MINUTE = Math.round(60 / STEP_SECONDS);

/** Where a vehicle is relative to a junction on its route. */
const ON_ROAD = 0;
/** Front bumper inside the junction. The vehicle's position is still measured on the approach, past its end. */
const FRONT_IN_JUNCTION = 1;
/** Front bumper on the next road, rear bumper still inside the junction. */
const REAR_IN_JUNCTION = 2;

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

  /** When the demand produced the vehicle, and where its front bumper was when it was placed (or 0 on a later road of its route). */
  arrivedAtS: number;
  entryPositionM: number;
  /** Time the roads and junctions already left behind take at the vehicle's desired speed. */
  freeTimeBeforeS: number;

  /** The roads of the vehicle's route, and which of them it is on. */
  route: RoadState[];
  routeIndex: number;
  /** The connection the route takes at the end of the vehicle's road, if the route goes on. */
  ahead: ConnectionState | undefined;
  /** ON_ROAD, FRONT_IN_JUNCTION or REAR_IN_JUNCTION. */
  place: number;
  /** While any part of the vehicle is in a junction: the connection it is on. */
  turning: ConnectionState | undefined;
  /** Whether the vehicle has been let into the junction ahead, and its place in the order of those let in. */
  admitted: boolean;
  order: number;
  /** From being let in until leaving the junction: the line the vehicle's centre follows through it. */
  curve: TurningCurve | undefined;

  // Working values of one step.
  index: number;
  /** The speed the vehicle aims for this step: its desired speed, or less when slowing for a turn. */
  speedCapMps: number;
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
  route: RoadState[];
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
  if (formatVersion !== 1 && formatVersion !== 2 && formatVersion !== 3) {
    throw new Error(`Unsupported network format version: ${String(formatVersion)}`);
  }
  if (formatVersion < 3 && (input.network.junctions?.length ?? 0) > 0) {
    throw new Error("A network with junctions needs format version 3");
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
      endsAt: undefined,
      connections: new Map(),
      startsAtJunction: false,
      lastInStrip: [],
      aspect: { state: "green", remainingS: Infinity },
      longestQueue: { lengthM: 0, vehicles: 0, eachMinute: [] },
    });
  }

  const junctions: JunctionState[] = [];
  const junctionIds = new Set<string>();
  const fedByJunction = new Map<RoadState, string>();
  for (const junction of input.network.junctions ?? []) {
    if (junctionIds.has(junction.id)) throw new Error(`The network has two junctions with the id "${junction.id}"`);
    junctionIds.add(junction.id);
    if (junction.control !== "signal") {
      throw new Error(`Junction "${junction.id}" is of a kind this version does not know: "${String(junction.control)}"`);
    }
    const state: JunctionState = { junction, connections: [], approaches: [], admitted: [], crossings: [] };
    for (const connection of junction.connections) {
      const from = roads.get(connection.fromRoadId);
      const to = roads.get(connection.toRoadId);
      if (!from || !to) {
        const missing = from ? connection.toRoadId : connection.fromRoadId;
        throw new Error(`Junction "${junction.id}" connects a road that is not in the network: "${missing}"`);
      }
      if (from === to) throw new Error(`Junction "${junction.id}" connects road "${from.road.id}" to itself`);
      if (from.endsAt && from.endsAt !== state) {
        throw new Error(`Road "${from.road.id}" ends at two junctions: "${from.endsAt.junction.id}" and "${junction.id}"`);
      }
      const feeder = fedByJunction.get(to);
      if (feeder !== undefined && feeder !== junction.id) {
        throw new Error(`Road "${to.road.id}" starts at two junctions: "${feeder}" and "${junction.id}"`);
      }
      if (from.connections.has(to.road.id)) {
        throw new Error(`Junction "${junction.id}" connects road "${from.road.id}" to road "${to.road.id}" twice`);
      }
      const path = createTurningPath(junction.id, from.road, to.road);
      const stripCount = Math.min(from.stripCount, to.stripCount);
      const alignRight = path.direction === "right";
      const connectionState: ConnectionState = {
        index: state.connections.length,
        junction: state,
        from,
        to,
        path,
        stripCount,
        fromShift: alignRight ? from.stripCount - stripCount : 0,
        toShift: alignRight ? to.stripCount - stripCount : 0,
      };
      state.connections.push(connectionState);
      if (!from.endsAt) state.approaches.push(from);
      from.endsAt = state;
      from.connections.set(to.road.id, connectionState);
      fedByJunction.set(to, junction.id);
      to.startsAtJunction = true;
    }

    // Crossing paths: found once, here, for every pair of the junction's connections.
    const bands = state.connections.map((connection) =>
      bandPieces({
        path: connection.path,
        stripCount: connection.stripCount,
        fromLeftM: connection.from.stripOffsetM + connection.fromShift * connection.from.stripWidthM,
        fromStripWidthM: connection.from.stripWidthM,
        toLeftM: connection.to.stripOffsetM + connection.toShift * connection.to.stripWidthM,
        toStripWidthM: connection.to.stripWidthM,
      }),
    );
    for (const a of state.connections) {
      for (const b of state.connections) {
        state.crossings.push(a === b ? undefined : findCrossings(bands[a.index]!, bands[b.index]!));
      }
    }

    const plan = junction.signalPlan;
    const name = `The signal plan of junction "${junction.id}"`;
    if (!plan || !Array.isArray(plan.phases) || plan.phases.length === 0) throw new Error(`${name} needs at least one phase`);
    if (!(plan.amberS >= 0) || !Number.isFinite(plan.amberS)) throw new Error(`${name} has an invalid amber time`);
    if (!(plan.allRedS >= 0) || !Number.isFinite(plan.allRedS)) throw new Error(`${name} has an invalid all-red time`);
    const withGreen = new Set<string>();
    for (const phase of plan.phases) {
      if (!(phase.greenS > 0) || !Number.isFinite(phase.greenS)) throw new Error(`${name} has a phase without a green time above zero`);
      for (const roadId of phase.greenRoadIds) {
        if (roads.get(roadId)?.endsAt !== state) {
          throw new Error(`${name} gives green to a road that is not an approach of the junction: "${roadId}"`);
        }
        withGreen.add(roadId);
      }
    }
    for (const approach of state.approaches) {
      if (!withGreen.has(approach.road.id)) {
        throw new Error(`Approach "${approach.road.id}" of junction "${junction.id}" never has green`);
      }
    }
    junctions.push(state);
  }

  /** How far a vehicle's centre is from the left edge of a road, given the strips it occupies. */
  function lateralOnRoad(road: RoadState, strip: number, strips: number): number {
    return road.stripOffsetM + (strip + strips / 2) * road.stripWidthM;
  }

  /**
   * The line through a connection for a vehicle occupying `strips` strips from
   * strip `strip` of the approach, or undefined when the connection has no room
   * for the vehicle in those strips.
   */
  function curveThrough(connection: ConnectionState, strip: number, strips: number): TurningCurve | undefined {
    const own = strip - connection.fromShift;
    if (own < 0 || own + strips > connection.stripCount) return undefined;
    return turningCurve(
      connection.path,
      lateralOnRoad(connection.from, strip, strips),
      lateralOnRoad(connection.to, own + connection.toShift, strips),
    );
  }

  /**
   * The route between two roads: the fastest path on empty roads (spec: Engine
   * behaviour, Routes), found once when the run is created. A connection counts
   * as the straight line between its two roads, at the speed limit of the road left.
   */
  function routeBetween(entry: RoadState, exit: RoadState): RoadState[] | undefined {
    const timeTo = new Map<RoadState, number>([[entry, 0]]);
    const cameFrom = new Map<RoadState, RoadState>();
    const done = new Set<RoadState>();
    for (;;) {
      let nearest: RoadState | undefined;
      // Roads in the network's order, so equal times always settle the same way.
      for (const road of roads.values()) {
        const time = timeTo.get(road);
        if (time === undefined || done.has(road)) continue;
        if (!nearest || time < timeTo.get(nearest)!) nearest = road;
      }
      if (!nearest) return undefined;
      if (nearest === exit) break;
      done.add(nearest);
      const leaveAt = timeTo.get(nearest)! + nearest.lengthM / nearest.road.speedLimitMps;
      for (const connection of nearest.connections.values()) {
        const [start, , , end] = connection.path.control;
        const time = leaveAt + Math.hypot(end.x - start.x, end.y - start.y) / nearest.road.speedLimitMps;
        const known = timeTo.get(connection.to);
        if (known === undefined || time < known) {
          timeTo.set(connection.to, time);
          cameFrom.set(connection.to, nearest);
        }
      }
    }
    const route = [exit];
    while (route[0] !== entry) route.unshift(cameFrom.get(route[0]!)!);
    return route;
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

  /** The route between two roads; throws when there is none, or when it would end at a junction. */
  function routeFor(entry: RoadState, exit: RoadState): RoadState[] {
    const route = routeBetween(entry, exit);
    if (!route) throw new Error(`There is no route from road "${entry.road.id}" to road "${exit.road.id}"`);
    if (exit.endsAt) {
      throw new Error(`A route cannot end on road "${exit.road.id}": it ends at junction "${exit.endsAt.junction.id}"`);
    }
    return route;
  }

  /** Throws when a road or a turn of a route has no room for a vehicle class. */
  function checkRouteTakes(route: RoadState[], vehicleClass: VehicleClass): void {
    const lengthM = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass].lengthM;
    for (let i = 0; i < route.length; i++) {
      const road = route[i]!;
      const strips = stripsNeeded(road, vehicleClass);
      const next = route[i + 1];
      if (!next) continue;
      const connection = road.connections.get(next.road.id)!;
      // The shortest line through the connection is the one nearest the inside of the turn.
      const inside = connection.path.direction === "right" ? road.stripCount - strips : connection.fromShift;
      const shortest = curveThrough(connection, inside, stripsNeeded(next, vehicleClass));
      if (!shortest || shortest.lengthM < lengthM) {
        throw new Error(
          `The turn from road "${road.road.id}" to road "${next.road.id}" is too short for a ${vehicleClass}: ` +
            "a turning path must be at least as long as the vehicle",
        );
      }
    }
  }

  const flows: FlowState[] = [];
  input.demand.flows.forEach((flow, index) => {
    const entryRoad = roads.get(flow.entryRoadId);
    if (!entryRoad) throw new Error(`Demand names an entry road that is not in the network: "${flow.entryRoadId}"`);
    if (!roads.has(flow.exitRoadId)) {
      throw new Error(`Demand names an exit road that is not in the network: "${flow.exitRoadId}"`);
    }
    const route = routeFor(entryRoad, roads.get(flow.exitRoadId)!);
    if (entryRoad.startsAtJunction) {
      throw new Error(`Demand cannot enter on road "${flow.entryRoadId}": it starts at a junction`);
    }
    if (!(flow.vehiclesPerHour >= 0)) throw new Error(`Demand for road "${flow.entryRoadId}" has an invalid rate`);
    if (flow.vehiclesPerHour === 0) return;
    for (const vehicleClass of classesInMix) checkRouteTakes(route, vehicleClass);
    const meanHeadwayS = 3600 / flow.vehiclesPerHour;
    const random = createRandomStream(input.seed, `demand:${index}`);
    flows.push({
      entryRoad,
      route,
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
    route: RoadState[],
  ): Vehicle {
    const assumptions = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass];
    const next = route[1];
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
      freeTimeBeforeS: 0,
      route,
      routeIndex: 0,
      ahead: next && road.connections.get(next.road.id),
      place: ON_ROAD,
      turning: undefined,
      admitted: false,
      order: 0,
      curve: undefined,
      index: 0,
      speedCapMps: Math.min(assumptions.desiredSpeedMps, road.road.speedLimitMps),
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
    let route = [road];
    if (!initial.stationary) {
      const exit = initial.exitRoadId === undefined ? road : roads.get(initial.exitRoadId);
      if (!exit) throw new Error(`An initial vehicle has an exit road that is not in the network: "${initial.exitRoadId}"`);
      if (initial.exitRoadId === undefined && road.endsAt) {
        throw new Error(`An initial vehicle on road "${initial.roadId}" needs an exit road: its road ends at a junction`);
      }
      route = routeFor(road, exit);
      checkRouteTakes(route, vehicleClass);
    }
    const vehicle = placeVehicle(road, vehicleClass, initial.positionM, speedMps, strip, 0, route);
    vehicle.stationary = initial.stationary === true;
  }

  /**
   * Put a waiting vehicle at the start of a road if there is room: its rear bumper at
   * the start, in strips where it has at least its desired following gap to the
   * nearest vehicle. Of the places with room it takes the one with the longest clear
   * road ahead, and of equals the one nearest the middle of the road.
   */
  function tryToEnter(road: RoadState, route: RoadState[], waiting: WaitingVehicle): boolean {
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
    const next = route[1];
    const ahead = next && road.connections.get(next.road.id);
    for (let strip = 0; strip + strips <= road.stripCount; strip++) {
      // Where the road it turns onto is narrower, it enters in strips that lead onto it.
      if (ahead && !curveThrough(ahead, strip, strips)) continue;
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
    placeVehicle(road, waiting.vehicleClass, assumptions.lengthM, bestSpeedMps, bestStrip, waiting.arrivedAtS, route);
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
    const ratio = v / vehicle.speedCapMps;
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
      // A vehicle that has wholly left the road for the junction is nobody's neighbour on the road.
      if (rearM(vehicle) >= road.lengthM) continue;
      for (let s = lowStrip(vehicle); s <= highStrip(vehicle); s++) nearest[s] = i;
    }
    if (!behindToo) return;
    nearest.fill(-1);
    for (let i = vehicles.length - 1; i >= 0; i--) {
      road.behindOf.set(nearest, i * stripCount);
      const vehicle = vehicles[i]!;
      if (rearM(vehicle) >= road.lengthM) continue;
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
    // A vehicle keeps its strips from being let into a junction until it has left it.
    if (vehicle.admitted || vehicle.place !== ON_ROAD) return;
    if (vehicle.shiftDirection !== 0) {
      // Already shifting: it keeps heading for the strips it set out for, unless
      // a vehicle since let into the junction is just behind one of them.
      if (vehicle.road.endsAt && letInBehind(vehicle, vehicle.reservedLow, vehicle.reservedHigh)) {
        vehicle.reservedHigh = vehicle.reservedLow - 1;
        return;
      }
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
    const held = vehicle.ahead !== undefined && stopLineHolds(vehicle);
    const fitsTurn = vehicle.ahead !== undefined && curveThrough(vehicle.ahead, vehicle.strip, vehicle.strips) !== undefined;
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
        // It does not leave the strips that lead onto its turn for strips that do not.
        if (fitsTurn && !curveThrough(vehicle.ahead!, strip, vehicle.strips)) break;
        // Not in front of a vehicle already let into the junction: those let in go in the order they were let in.
        if (road.endsAt && letInBehind(vehicle, entered, entered)) break;

        let there = accelerationBehind(vehicle, leaderIn(vehicle, strip, strip + vehicle.strips - 1));
        // A stop line that holds the vehicle holds it in every strip, except, on green,
        // in strips from which the junction and the road beyond have room for it.
        const couldGo =
          held &&
          road.aspect.state === "green" &&
          curveThrough(vehicle.ahead!, strip, vehicle.strips) !== undefined &&
          roomBeyond(vehicle, vehicle.ahead!, strip);
        if (held && !couldGo) there = Math.min(there, acceleration(vehicle, road.lengthM - vehicle.positionM, 0));
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

  let nextOrder = 1;

  /**
   * The speed a vehicle can hold on a line through a junction: the speed at
   * which the turn's sideways acceleration is the assumed one. The radius is
   * taken as the line's length over the angle it turns through.
   */
  function turnSpeedMps(curve: TurningCurve): number {
    const turnRad = Math.abs(curve.path.turnRad);
    if (turnRad < 0.1) return Infinity;
    return Math.sqrt((JUNCTION_ASSUMPTIONS.turnAccelerationMps2.value * curve.lengthM) / turnRad);
  }

  /**
   * Set the speed a vehicle aims for this step. Approaching a turn it is the
   * speed from which the vehicle can still slow to the turn's speed by the stop
   * line at half its comfortable deceleration, so the following rule, which
   * aims for this speed, brings it down gently.
   */
  function setSpeedCap(vehicle: Vehicle): void {
    let cap = vehicle.desiredSpeedMps;
    const connection = vehicle.ahead;
    if (connection && vehicle.place !== REAR_IN_JUNCTION && !vehicle.stationary) {
      const curve = vehicle.curve ?? curveThrough(connection, vehicle.strip, vehicle.strips);
      const turnMps = curve ? turnSpeedMps(curve) : Infinity;
      if (turnMps < cap) {
        const toStopLineM = Math.max(0, vehicle.road.lengthM - vehicle.positionM);
        const slowing = vehicle.assumptions.comfortableDecelerationMps2 / 2;
        cap = Math.min(cap, Math.sqrt(turnMps * turnMps + 2 * slowing * toStopLineM));
      }
    }
    vehicle.speedCapMps = cap;
  }

  /** For a road that starts at a junction: the rearmost vehicle in each strip. */
  function findLastInStrips(road: RoadState): void {
    const last = road.lastInStrip;
    last.length = road.stripCount;
    last.fill(undefined);
    for (const vehicle of road.vehicles) {
      const rear = rearM(vehicle);
      for (let s = lowStrip(vehicle); s <= highStrip(vehicle); s++) {
        const other = last[s];
        if (!other || rear < rearM(other)) last[s] = vehicle;
      }
    }
  }

  /** How far a vehicle's rear bumper is along the connection it is let into: negative while still on the approach. */
  function rearAlongTurnM(vehicle: Vehicle): number {
    if (vehicle.place === REAR_IN_JUNCTION) return vehicle.curve!.lengthM + rearM(vehicle);
    return rearM(vehicle) - vehicle.road.lengthM;
  }

  /** Whether two vehicles on the same connection, or from the same approach, share a strip. */
  function shareStrips(a: Vehicle, b: Vehicle): boolean {
    const lowA = a.place === REAR_IN_JUNCTION ? a.strip - a.turning!.toShift + a.turning!.fromShift : a.strip;
    const lowB = b.place === REAR_IN_JUNCTION ? b.strip - b.turning!.toShift + b.turning!.fromShift : b.strip;
    return lowA < lowB + b.strips && lowB < lowA + a.strips;
  }

  /**
   * The distance from the stop line within which a vehicle asks to be let into
   * the junction: the gap the following rule wants to a stopped vehicle at its
   * speed, so one that is refused can still stop comfortably.
   */
  function askingDistanceM(vehicle: Vehicle): number {
    const { maxAccelerationMps2: a, comfortableDecelerationMps2: b, timeGapS, standstillGapM } = vehicle.assumptions;
    const v = vehicle.speedMps;
    return standstillGapM + v * timeGapS + (v * v) / (2 * Math.sqrt(a * b)) + v * STEP_SECONDS;
  }

  /**
   * Whether the stop line ahead holds a vehicle that has not been let into the
   * junction (spec: restrictions as leaders). It then acts as a stopped vehicle
   * across the whole width of the approach.
   */
  function stopLineHolds(vehicle: Vehicle): boolean {
    const road = vehicle.road;
    // Red or amber holds every vehicle not yet let in. On green, a vehicle near
    // enough to have asked and not been let in is held as well.
    if (road.aspect.state !== "green") return true;
    return road.lengthM - vehicle.positionM <= askingDistanceM(vehicle);
  }

  /**
   * The soonest a vehicle can cover a distance: speeding up at its full
   * acceleration (or slowing at its comfortable deceleration) to a speed and
   * holding it. Used to tell when a vehicle will be at a place in the junction.
   */
  function soonestS(vehicle: Vehicle, distanceM: number, cruiseMps: number): number {
    if (distanceM <= 0) return 0;
    const v = vehicle.speedMps;
    const faster = cruiseMps >= v;
    const rate = faster ? vehicle.assumptions.maxAccelerationMps2 : -vehicle.assumptions.comfortableDecelerationMps2;
    // Distance covered while changing speed from v to the cruising speed.
    const changingM = (cruiseMps * cruiseMps - v * v) / (2 * rate);
    if (distanceM >= changingM) return (cruiseMps - v) / rate + (distanceM - changingM) / cruiseMps;
    return (Math.sqrt(Math.max(0, v * v + 2 * rate * distanceM)) - v) / rate;
  }

  /**
   * Let vehicles into a junction. A vehicle near the stop line asks; those that
   * ask are taken nearest the stop line first (of equals, the lower id), and
   * each is let in or refused from the state at the start of the step and the
   * vehicles let in before it. A vehicle is let in only after every vehicle
   * ahead of it in its strips, so the order of letting in is the order of going.
   */
  function letIn(junction: JunctionState): void {
    const asking: Vehicle[] = [];
    const amberS = junction.junction.signalPlan.amberS;
    for (const road of junction.approaches) {
      // Nobody is let in on amber or red.
      if (road.aspect.state !== "green") continue;
      for (const vehicle of road.vehicles) {
        if (vehicle.place !== ON_ROAD || vehicle.admitted || vehicle.stationary || vehicle.shiftDirection !== 0) continue;
        if (!vehicle.ahead) continue;
        const toStopLineM = road.lengthM - vehicle.positionM;
        if (toStopLineM > askingDistanceM(vehicle)) continue;
        // It must be able to reach the stop line before the amber ends.
        if (soonestS(vehicle, toStopLineM, vehicle.speedCapMps) > road.aspect.remainingS + amberS) continue;
        asking.push(vehicle);
      }
    }
    asking.sort(
      (a, b) => a.road.lengthM - a.positionM - (b.road.lengthM - b.positionM) || a.id - b.id,
    );
    for (const vehicle of asking) {
      const connection = vehicle.ahead!;
      const curve = curveThrough(connection, vehicle.strip, vehicle.strips);
      if (!curve) continue;
      if (!leadersLetIn(vehicle)) continue;
      if (!roomBeyond(vehicle, connection, vehicle.strip)) continue;
      vehicle.turning = connection;
      vehicle.curve = curve;
      if (!crossingsWillBeFree(vehicle)) {
        vehicle.turning = undefined;
        vehicle.curve = undefined;
        continue;
      }
      vehicle.admitted = true;
      vehicle.order = nextOrder++;
      junction.admitted.push(vehicle);
    }
  }

  /** Whether every vehicle just ahead of this one in its strips, and still short of the stop line, has been let in. */
  function leadersLetIn(vehicle: Vehicle): boolean {
    const road = vehicle.road;
    const base = vehicle.index * road.stripCount;
    for (let s = lowStrip(vehicle); s <= highStrip(vehicle); s++) {
      const j = road.aheadOf[base + s]!;
      if (j < 0) continue;
      const other = road.vehicles[j]!;
      if (other.place === ON_ROAD && !other.admitted) return false;
    }
    return true;
  }

  // The nearest thing ahead found by lookAhead: the gap to it and its speed.
  let aheadGapM = Infinity;
  let aheadSpeedMps = 0;
  function consider(gapM: number, speedMps: number): void {
    if (gapM < aheadGapM) {
      aheadGapM = gapM;
      aheadSpeedMps = speedMps;
    }
  }

  /**
   * Find what a vehicle follows or stops for, from the state at the start of the
   * step: the nearest of its leader on the road, the stop line if it holds the
   * vehicle, and, once it is let into a junction, what is ahead of it there.
   */
  function lookAhead(vehicle: Vehicle): void {
    aheadGapM = Infinity;
    aheadSpeedMps = 0;
    if (vehicle.place !== FRONT_IN_JUNCTION) {
      const leader = leaderIn(vehicle, lowStrip(vehicle), highStrip(vehicle));
      if (leader) consider(rearM(leader) - vehicle.positionM, leader.speedMps);
    }
    if (!vehicle.ahead) return;
    const beyondStopLineM = vehicle.positionM - vehicle.road.lengthM;
    // A vehicle whose rear is still in the last junction has not asked to be let into this one.
    if (!vehicle.admitted || vehicle.place === REAR_IN_JUNCTION) {
      if (stopLineHolds(vehicle)) consider(-beyondStopLineM, 0);
      return;
    }
    lookThroughJunction(vehicle, beyondStopLineM);
  }

  /**
   * What is ahead of a vehicle that has been let into a junction, measured along
   * its own line through it (`alongM` is where its front bumper is: negative
   * before the stop line).
   */
  function lookThroughJunction(vehicle: Vehicle, alongM: number): void {
    const connection = vehicle.turning!;
    const curve = vehicle.curve!;
    // The rearmost vehicle in its strips on the road it is heading for.
    const exitStrip = vehicle.strip - connection.fromShift + connection.toShift;
    for (let s = exitStrip; s < exitStrip + vehicle.strips; s++) {
      const last = connection.to.lastInStrip[s];
      if (last) consider(curve.lengthM - alongM + rearM(last), last.speedMps);
    }
    // Vehicles let in before it.
    for (const other of connection.junction.admitted) {
      if (other.order >= vehicle.order) break;
      const otherConnection = other.turning!;
      const otherRearM = rearAlongTurnM(other);
      if (otherConnection === connection) {
        // Same connection: follow it if they share a strip, as on a road.
        if (!shareStrips(vehicle, other)) continue;
        const rearOnMyLineM =
          otherRearM <= 0 ? otherRearM : curveDistanceM(curve, curveParameter(other.curve!, otherRearM));
        consider(rearOnMyLineM - alongM, other.speedMps);
        continue;
      }
      // Another connection: the vehicle let in first goes first. This one may go
      // as far as the first place where its strips cross ground the other may
      // still cover, and no further until the other's rear bumper has passed.
      const first = firstCrossingPiece(vehicle, other, otherRearM);
      if (first === NO_CROSSING) continue;
      // A vehicle ahead in its own strips that takes another way is followed as
      // a moving vehicle; any other is a place to stop short of.
      const followed = otherConnection.from === connection.from && shareStrips(vehicle, other);
      consider(curveDistanceM(curve, first / connection.path.pieces) - alongM, followed ? other.speedMps : 0);
    }
  }

  /** The leftmost strip of its connection that a vehicle let into a junction occupies. */
  function ownStrip(vehicle: Vehicle): number {
    const connection = vehicle.turning!;
    return vehicle.strip - (vehicle.place === REAR_IN_JUNCTION ? connection.toShift : connection.fromShift);
  }

  /** The piece of the other vehicle's connection that its rear bumper is in. */
  function rearPiece(other: Vehicle, otherRearM: number): number {
    if (otherRearM <= 0) return 0;
    const pieces = other.turning!.path.pieces;
    return Math.min(pieces - 1, Math.floor(curveParameter(other.curve!, otherRearM) * pieces));
  }

  /**
   * The first piece of `vehicle`'s connection where its strips cross ground that
   * `other`, on another connection with its rear bumper at `otherRearM`, may
   * still cover; NO_CROSSING when there is none.
   */
  function firstCrossingPiece(vehicle: Vehicle, other: Vehicle, otherRearM: number): number {
    const a = vehicle.turning!;
    const b = other.turning!;
    const table = a.junction.crossings[a.index * a.junction.connections.length + b.index];
    if (!table) return NO_CROSSING;
    const piecesB = b.path.pieces;
    const k = rearPiece(other, otherRearM);
    const mine = ownStrip(vehicle);
    const its = ownStrip(other);
    let first = NO_CROSSING;
    for (let i = mine; i < mine + vehicle.strips; i++) {
      for (let j = its; j < its + other.strips; j++) {
        const piece = table[(i * b.stripCount + j) * piecesB + k]!;
        if (piece < first) first = piece;
      }
    }
    return first;
  }

  /** The last piece of `other`'s connection where its strips cross `vehicle`'s. Call only when they do cross. */
  function lastCrossingPiece(vehicle: Vehicle, other: Vehicle): number {
    const a = vehicle.turning!;
    const b = other.turning!;
    const table = a.junction.crossings[a.index * a.junction.connections.length + b.index]!;
    const piecesB = b.path.pieces;
    const mine = ownStrip(vehicle);
    const its = ownStrip(other);
    for (let k = piecesB - 1; k > 0; k--) {
      for (let i = mine; i < mine + vehicle.strips; i++) {
        for (let j = its; j < its + other.strips; j++) {
          if (table[(i * b.stripCount + j) * piecesB + k]! !== NO_CROSSING) return k;
        }
      }
    }
    return 0;
  }

  /**
   * Whether a vehicle asking to be let in will find every crossing free (spec:
   * a vehicle reserves its time at each crossing before entering). Those let in
   * before it go first at every place where their strips cross its own. It is
   * let in only if, for each of them, the soonest it can reach the first such
   * place is later, by a margin, than the time by which the other's rear bumper
   * should have passed the last.
   */
  function crossingsWillBeFree(vehicle: Vehicle): boolean {
    const connection = vehicle.turning!;
    const curve = vehicle.curve!;
    const toStopLineM = vehicle.road.lengthM - vehicle.positionM;
    const fastestMps = Math.max(vehicle.speedMps, Math.min(vehicle.desiredSpeedMps, turnSpeedMps(curve)));
    const marginS = JUNCTION_ASSUMPTIONS.crossingMarginS.value;
    for (const other of connection.junction.admitted) {
      const otherConnection = other.turning!;
      // Vehicles it follows, on its own connection or out of its own strips, need no free crossing.
      if (otherConnection === connection) continue;
      if (otherConnection.from === connection.from && shareStrips(vehicle, other)) continue;
      const otherRearM = rearAlongTurnM(other);
      const first = firstCrossingPiece(vehicle, other, otherRearM);
      if (first === NO_CROSSING) continue;
      const arriveS = (toStopLineM + curveDistanceM(curve, first / connection.path.pieces)) / fastestMps;
      const last = lastCrossingPiece(vehicle, other);
      const toClearM = curveDistanceM(other.curve!, (last + 1) / otherConnection.path.pieces) - otherRearM;
      const cruiseMps = Math.min(other.desiredSpeedMps, turnSpeedMps(other.curve!));
      if (arriveS < soonestS(other, toClearM, cruiseMps) + marginS) return false;
    }
    return true;
  }

  /**
   * Keep clear: whether the road beyond the junction has room for a vehicle that
   * enters from strip `strip` of its approach (spec: a vehicle does not enter
   * unless it can clear the junction). The room is what is left behind the
   * rearmost vehicle in its strips on that road, allowing for the distance that
   * vehicle still covers if it brakes comfortably to a stop, less the room the
   * vehicles already let in and heading for those strips will take up.
   */
  function roomBeyond(vehicle: Vehicle, connection: ConnectionState, strip: number): boolean {
    const exitStrip = strip - connection.fromShift + connection.toShift;
    const to = connection.to;
    let roomM = Infinity;
    for (let s = exitStrip; s < exitStrip + vehicle.strips; s++) {
      const last = to.lastInStrip[s];
      if (!last) continue;
      const stopsAtM = rearM(last) + (last.speedMps * last.speedMps) / (2 * last.assumptions.comfortableDecelerationMps2);
      if (stopsAtM < roomM) roomM = stopsAtM;
    }
    if (roomM === Infinity) return true;
    for (const other of connection.junction.admitted) {
      if (other === vehicle || other.place === REAR_IN_JUNCTION || other.turning!.to !== to) continue;
      const otherExitStrip = other.strip - other.turning!.fromShift + other.turning!.toShift;
      if (otherExitStrip < exitStrip + vehicle.strips && exitStrip < otherExitStrip + other.strips) {
        roomM -= other.assumptions.lengthM + other.assumptions.standstillGapM;
      }
    }
    const { lengthM, standstillGapM } = vehicle.assumptions;
    return roomM >= lengthM + standstillGapM + JUNCTION_ASSUMPTIONS.keepClearSlackM.value;
  }

  /** Whether a vehicle that has been let into the junction is just behind the vehicle in any of the strips low..high. */
  function letInBehind(vehicle: Vehicle, low: number, high: number): boolean {
    const road = vehicle.road;
    const base = vehicle.index * road.stripCount;
    for (let s = low; s <= high; s++) {
      const j = road.behindOf[base + s]!;
      if (j >= 0 && road.vehicles[j]!.admitted) return true;
    }
    return false;
  }

  /** Decide a vehicle's next position and speed along the road. */
  function decide(vehicle: Vehicle): void {
    if (vehicle.stationary) return;
    lookAhead(vehicle);
    const hasLeader = aheadGapM < Infinity;
    const a = acceleration(vehicle, hasLeader ? aheadGapM : undefined, aheadSpeedMps);
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
    if (hasLeader) {
      // Safety net (ours, not part of the published rule): a vehicle never advances
      // further in one step than the clear gap it started the step with. What is
      // ahead only moves forward, so this holds whatever it does, and it depends
      // only on the state at the start of the step.
      const clearM = Math.max(0, aheadGapM);
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
    const freeTimeS = vehicle.freeTimeBeforeS + (positionM - vehicle.entryPositionM) / vehicle.desiredSpeedMps;
    return timeS - vehicle.arrivedAtS - freeTimeS;
  }

  /** Measure the queue on an approach as it is now, and keep it if it is the longest so far (see ApproachQueue). */
  function measureQueue(approach: RoadState): void {
    const queueSpeedMps = JUNCTION_ASSUMPTIONS.queueSpeedMps.value;
    const breakM = JUNCTION_ASSUMPTIONS.queueBreakM.value;
    approach.vehicles.sort(frontFirst);
    let backM = approach.lengthM;
    let vehicles = 0;
    for (const vehicle of approach.vehicles) {
      if (vehicle.place !== ON_ROAD || vehicle.stationary || vehicle.speedMps >= queueSpeedMps) continue;
      if (backM - vehicle.positionM > breakM) break;
      backM = Math.min(backM, rearM(vehicle));
      vehicles++;
    }
    const lengthM = approach.lengthM - backM;
    const longest = approach.longestQueue;
    if (lengthM > longest.lengthM) {
      longest.lengthM = lengthM;
      longest.vehicles = vehicles;
    }
    // Counted in steps, so a minute ends on the same step whatever the rounding of run time.
    const minute = Math.floor((stepCount - 1) / STEPS_PER_MINUTE);
    while (longest.eachMinute.length <= minute) longest.eachMinute.push({ lengthM: 0, vehicles: 0 });
    const thisMinute = longest.eachMinute[minute]!;
    if (lengthM > thisMinute.lengthM) {
      thisMinute.lengthM = lengthM;
      thisMinute.vehicles = vehicles;
    }
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
      for (let i = 0; i < vehicles.length; i++) {
        vehicles[i]!.index = i;
        setSpeedCap(vehicles[i]!);
      }
      findNeighbours(road, true);
      if (road.startsAtJunction) findLastInStrips(road);
      if (road.endsAt) road.aspect = signalAspect(road.endsAt.junction.signalPlan, road.road.id, stepCount * STEP_SECONDS);
    }
    for (const junction of junctions) letIn(junction);

    for (const road of roads.values()) {
      const vehicles = road.vehicles;
      for (const vehicle of vehicles) {
        lookAhead(vehicle);
        vehicle.currentAcceleration = acceleration(vehicle, aheadGapM < Infinity ? aheadGapM : undefined, aheadSpeedMps);
      }
      for (const vehicle of vehicles) claimSpace(vehicle);
      settleClaims(road);
    }
    // Along the road only after every road's claims are settled: a vehicle in a
    // junction follows vehicles on the road it is heading for.
    for (const road of roads.values()) {
      findNeighbours(road, false);
      if (road.startsAtJunction) findLastInStrips(road);
    }
    for (const road of roads.values()) {
      for (const vehicle of road.vehicles) decide(vehicle);
    }

    // Apply: all moves happen together.
    const timeS = (stepCount + 1) * STEP_SECONDS;
    const movedOn: Vehicle[] = [];
    let someLeftJunction = false;
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
        if (vehicle.place === REAR_IN_JUNCTION && rearM(vehicle) >= 0) {
          // The rear bumper has left the junction.
          vehicle.place = ON_ROAD;
          vehicle.turning = undefined;
          vehicle.curve = undefined;
          vehicle.admitted = false;
          someLeftJunction = true;
        }
        if (vehicle.positionM < road.lengthM) {
          remaining.push(vehicle);
          continue;
        }
        if (vehicle.ahead) {
          // Into, or on through, the junction at the end of the road.
          if (!vehicle.admitted || vehicle.place === REAR_IN_JUNCTION) {
            throw new Error(`Vehicle ${vehicle.id} crossed a stop line without being let in`);
          }
          vehicle.place = FRONT_IN_JUNCTION;
          const curve = vehicle.curve!;
          const beyondM = vehicle.positionM - road.lengthM - curve.lengthM;
          if (beyondM < 0) {
            remaining.push(vehicle);
            continue;
          }
          // The front bumper is on the next road of the route.
          const connection = vehicle.ahead;
          vehicle.freeTimeBeforeS += (road.lengthM - vehicle.entryPositionM + curve.lengthM) / vehicle.desiredSpeedMps;
          vehicle.entryPositionM = 0;
          vehicle.strip += connection.toShift - connection.fromShift;
          vehicle.road = connection.to;
          vehicle.routeIndex++;
          const next = vehicle.route[vehicle.routeIndex + 1];
          vehicle.ahead = next && connection.to.connections.get(next.road.id);
          vehicle.desiredSpeedMps = Math.min(vehicle.assumptions.desiredSpeedMps, connection.to.road.speedLimitMps);
          vehicle.positionM = beyondM;
          vehicle.place = REAR_IN_JUNCTION;
          movedOn.push(vehicle);
          continue;
        }
        vehiclesThrough++;
        if (vehicle.admitted) {
          vehicle.admitted = false;
          someLeftJunction = true;
        }
        // The moment within the step at which the front bumper reached the end of the road.
        const overshootS = vehicle.speedMps > 0 ? Math.min(STEP_SECONDS, (vehicle.positionM - road.lengthM) / vehicle.speedMps) : 0;
        const through = throughByClass.get(vehicle.vehicleClass)!;
        through.count++;
        through.delayS += delayS(vehicle, timeS - overshootS, road.lengthM);
      }
      road.vehicles = remaining;
    }
    for (const vehicle of movedOn) vehicle.road.vehicles.push(vehicle);
    if (someLeftJunction) {
      for (const junction of junctions) junction.admitted = junction.admitted.filter((vehicle) => vehicle.admitted);
    }

    stepCount++;
    for (const junction of junctions) {
      for (const approach of junction.approaches) measureQueue(approach);
    }

    for (const flow of flows) {
      while (flow.nextArrivalS <= timeS) {
        flow.waiting.push({ vehicleClass: drawVehicleClass(flow.classRandom), arrivedAtS: flow.nextArrivalS });
        flow.nextArrivalS += exponential(flow.random, flow.meanHeadwayS);
      }
      // First come, first in: a vehicle with no room holds back those that arrived after it.
      while (flow.waiting.length > 0 && tryToEnter(flow.entryRoad, flow.route, flow.waiting[0]!)) flow.waiting.shift();
    }
  }

  function snapshot(): Snapshot {
    const vehicles: VehicleState[] = [];
    for (const road of roads.values()) {
      for (const vehicle of road.vehicles) {
        const state: VehicleState = {
          id: vehicle.id,
          vehicleClass: vehicle.vehicleClass,
          roadId: road.road.id,
          positionM: vehicle.positionM,
          lateralM: lateralM(vehicle),
          speedMps: vehicle.speedMps,
          lengthM: vehicle.assumptions.lengthM,
          widthM: vehicle.assumptions.widthM,
        };
        if (vehicle.place !== ON_ROAD) {
          const connection = vehicle.turning!;
          state.turn = {
            junctionId: connection.junction.junction.id,
            fromRoadId: connection.from.road.id,
            toRoadId: connection.to.road.id,
            fromLateralM: vehicle.curve!.fromLateralM,
            toLateralM: vehicle.curve!.toLateralM,
          };
        }
        vehicles.push(state);
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
      const totalDelayS = through.delayS + still.delayS;
      delayByVehicleClass[vehicleClass] = {
        vehicles,
        vehiclesThrough: through.count,
        meanDelayS: vehicles > 0 ? totalDelayS / vehicles : null,
        totalDelayS,
      };
    }
    const longestQueueByApproach: Record<string, ApproachQueue> = {};
    for (const road of roads.values()) {
      if (!road.endsAt) continue;
      const { lengthM, vehicles, eachMinute } = road.longestQueue;
      longestQueueByApproach[road.road.id] = { lengthM, vehicles, eachMinute: eachMinute.map((minute) => ({ ...minute })) };
    }
    return {
      timeS,
      vehiclesEntered,
      vehiclesThrough,
      vehiclesOnNetwork,
      vehiclesWaitingToEnter,
      delayByVehicleClass,
      longestQueueByApproach,
    };
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
