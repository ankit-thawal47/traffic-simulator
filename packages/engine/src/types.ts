/**
 * The engine's inputs and outputs. Everything here is plain data (JSON-safe),
 * so it can cross a worker boundary, be written to a file, or be compared.
 * Vocabulary follows GLOSSARY.md.
 */

/**
 * A point, in metres. x grows east, y grows north. `z` is its height above
 * the ground (from format version 4); without it the point is on the ground.
 */
export interface Point {
  x: number;
  y: number;
  z?: number;
}

/**
 * One carriageway carrying traffic in one direction, from its first point to its last.
 *
 * A road whose points have heights is raised: a flyover is such a road, rising
 * on a ramp, crossing over what is beneath and coming down again. It shares no
 * junction with what it crosses over, and its vehicles and those beneath never
 * react to each other. Heights are for drawing and for the consistency checks;
 * lengths and distances are measured on the plan, so a ramp is as long as its
 * shadow on the ground.
 */
export interface Road {
  id: string;
  /** Centreline, in the direction of travel. At least two points. */
  points: Point[];
  /** Usable width across the road, in metres. */
  widthM: number;
  /**
   * Number of marked lanes, sharing the width equally. Required from format
   * version 2. A version 1 road has none; it is given as many lanes of the
   * standard lane width as fit its width (at least one).
   */
  lanes?: number;
  speedLimitMps: number;
}

/** A way through a junction: from the end of one road to the start of another. */
export interface Connection {
  fromRoadId: string;
  toRoadId: string;
}

/** One part of a signal plan: these approaches have green together, for this long. */
export interface SignalPhase {
  /** The approaches (roads arriving at the junction) that have green. Every movement from them may go. */
  greenRoadIds: string[];
  greenS: number;
}

/**
 * A fixed-time signal plan. The phases run in order and repeat. After each
 * phase's green its approaches have amber for `amberS`, then every approach
 * has red for `allRedS` before the next phase's green.
 */
export interface SignalPlan {
  phases: SignalPhase[];
  amberS: number;
  allRedS: number;
  /** Seconds into the cycle at the start of the run. Without it the first phase's green starts at time 0. */
  offsetS?: number;
}

/**
 * A place where roads meet. The roads that end at it are its approaches; a
 * vehicle can go from an approach to another road only along a connection.
 * The path of each connection is worked out from where the two roads end and
 * start. `control` says what decides who may go; later versions add other kinds.
 */
export type Junction = SignalJunction | DividingJunction;

/** A junction where a fixed, repeating signal plan decides which movements may go. */
export interface SignalJunction {
  id: string;
  control: "signal";
  connections: Connection[];
  signalPlan: SignalPlan;
}

/**
 * A junction with no signal, where a road divides into roads lying side by
 * side (a diverge) or roads lying side by side join into one (a merge): where
 * a flyover leaves the main road and where it comes back to it. From format
 * version 4.
 *
 * Each connection runs straight on, between the part of the wider road's
 * width that the narrower road lines up with: a road that starts across the
 * right half of the road before it is reached from that half only. Roads
 * that join side by side onto a road wide enough for both never share
 * space, so nothing has to decide who goes. Where two approaches lead onto
 * the same part of a road, vehicles are let in first come, first served, each
 * waiting until the one let in before it is clear (see merge-diverge.ts).
 */
export interface DividingJunction {
  id: string;
  control: "none";
  connections: Connection[];
}

/**
 * The roads, junctions and flyovers a scenario runs on.
 *
 * Format versions: 1 is a road with a centreline, width and speed limit;
 * 2 adds each road's lane count; 3 adds junctions, with the connections
 * through them and their signal plans; 4 adds heights to a road's points
 * (flyovers) and junctions with no signal where roads divide or join. The
 * engine reads all four.
 */
export interface Network {
  formatVersion: 1 | 2 | 3 | 4;
  roads: Road[];
  /** From format version 3; junctions with no signal from version 4. */
  junctions?: Junction[];
}

export type VehicleClass = "two-wheeler" | "car" | "auto-rickshaw" | "bus";

/** The share of each vehicle class in a demand. Shares need not add up to 1; they are used in proportion. */
export type VehicleMix = Partial<Record<VehicleClass, number>>;

/** Traffic sent into the network from one entry road to one exit road. */
export interface DemandFlow {
  entryRoadId: string;
  exitRoadId: string;
  vehiclesPerHour: number;
}

export interface Demand {
  flows: DemandFlow[];
  /** Without a vehicle mix, every vehicle is a car. */
  vehicleMix?: VehicleMix;
}

/** A vehicle already on the network when the run starts. */
export interface InitialVehicle {
  roadId: string;
  /** Distance of the front bumper from the start of the road, in metres. */
  positionM: number;
  speedMps: number;
  vehicleClass?: VehicleClass;
  /**
   * Distance of the vehicle's centre from the left edge of the road, in metres.
   * The vehicle is put at the nearest place the road's strips (or lanes) allow.
   * Without it, the vehicle is put as near the middle of the road as they allow.
   */
  lateralM?: number;
  /** A stationary vehicle (for example a breakdown) never moves during the run. */
  stationary?: boolean;
  /**
   * The road where the vehicle's route ends. Needed when its road ends at a
   * junction (unless the vehicle is stationary); without it the route ends
   * at the end of its own road.
   */
  exitRoadId?: string;
}

export interface RunInput {
  network: Network;
  demand: Demand;
  /** Any integer. The same input and seed always give the same run. */
  seed: number;
  /**
   * Lane discipline. On: vehicles keep to the road's lanes. Off (the default):
   * the road carries mixed traffic, with vehicles sharing its width strip by strip.
   */
  laneDiscipline?: boolean;
  initialVehicles?: InitialVehicle[];
}

export interface VehicleState {
  /** Unique within a run and never reused. */
  id: number;
  vehicleClass: VehicleClass;
  roadId: string;
  /** Distance of the front bumper from the start of the road, in metres. */
  positionM: number;
  /** Distance of the vehicle's centre from the left edge of the road (facing the direction of travel), in metres. */
  lateralM: number;
  speedMps: number;
  lengthM: number;
  widthM: number;
  /**
   * Set while any part of the vehicle is inside a junction. See VehicleTurn
   * for what roadId, positionM and lateralM mean then.
   */
  turn?: VehicleTurn;
}

/**
 * The turning path a vehicle is taking through a junction: the path of one
 * connection, at the vehicle's own place across it. Its shape comes from
 * turningCurve() (junction-geometry.ts).
 *
 * While the front bumper is inside the junction, the vehicle's roadId is still
 * the road it came from, positionM is that road's length plus the distance
 * covered along the turning path, and lateralM is as on that road. Once the
 * front bumper is on the road it is heading for, roadId, positionM and lateralM
 * are that road's; the rear bumper is still on the turning path, so positionM
 * is less than the vehicle's length.
 */
export interface VehicleTurn {
  junctionId: string;
  fromRoadId: string;
  toRoadId: string;
  /** The vehicle's centre across the road it came from and across the road it is heading for, each from that road's left edge. */
  fromLateralM: number;
  toLateralM: number;
}

/** Where every vehicle on the network is at one moment of a run. */
export interface Snapshot {
  timeS: number;
  vehicles: VehicleState[];
}

/** The estimates a run has produced so far. */
export interface Results {
  timeS: number;
  /** Vehicles that have been placed on the network, including initial vehicles. */
  vehiclesEntered: number;
  /** Vehicles that reached the end of their route and left the network. */
  vehiclesThrough: number;
  vehiclesOnNetwork: number;
  /** Vehicles the demand has produced that are still waiting for space to enter. */
  vehiclesWaitingToEnter: number;
  /**
   * Stuck vehicles: vehicles the run released by force because they locked
   * with others so that none could move (stuck-vehicles.ts). A released vehicle
   * is taken off the network and is not counted through, so vehicles entered is
   * vehicles through, plus those on the network, plus stuck vehicles. Above zero,
   * the run locked up and its other results are less reliable.
   */
  stuckVehicles: number;
  /** Delay for each vehicle class. */
  delayByVehicleClass: Record<VehicleClass, VehicleClassDelay>;
  /**
   * The longest queue so far on each approach, by the id of the approach's
   * road, in the network's order of roads. Empty for a network with no junction.
   */
  longestQueueByApproach: Record<string, ApproachQueue>;
}

/**
 * The longest queue an approach has had so far in a run.
 *
 * A vehicle is queued when it is on the approach, short of the stop line, and
 * slower than the queue speed (5 km/h). The queue at a moment runs from the
 * stop line back to the rear bumper of the last queued vehicle, counting back
 * from the stop line and stopping at the first break of more than 10 m with no
 * queued vehicle in it. Stationary vehicles (breakdowns) are not counted. The
 * queue is measured after every step; this is the longest of those, with the
 * number of vehicles that were in it. A queue cannot be longer than the
 * approach: vehicles still waiting to enter the network are not in it.
 * A turn slowed for by a single vehicle is not a queue: a turning vehicle
 * stays above the queue speed.
 */
export interface ApproachQueue extends QueueLength {
  /**
   * The longest queue within each minute of the run so far, the first minute
   * first. A longest queue cannot be had for part of a run from the longest
   * queues of two longer parts, so results carry it minute by minute:
   * resultsExcludingWarmUp() takes the longest of the minutes after the warm-up.
   */
  eachMinute: QueueLength[];
}

/** A queue at one moment: its length, and the number of vehicles in it. */
export interface QueueLength {
  lengthM: number;
  vehicles: number;
}

/**
 * Delay of one vehicle class so far in a run.
 *
 * A vehicle's delay is the time it has taken since the demand produced it,
 * minus the time the distance it has covered would take at its desired speed
 * (its vehicle class's desired speed or the speed limit, whichever is lower).
 * For a vehicle that has left the network that is its actual travel time minus
 * its travel time at desired speed. Time spent waiting to enter counts.
 *
 * The mean is over every vehicle of the class the demand has produced: those
 * through, and those still on the network or waiting to enter, with their delay
 * so far. Stationary vehicles are left out.
 */
export interface VehicleClassDelay {
  /** Vehicles the mean is over. */
  vehicles: number;
  /** How many of them have left the network. */
  vehiclesThrough: number;
  /**
   * How many of them were released as stuck vehicles: taken off the network, not
   * through. Each is in the mean with its delay up to the moment it was released.
   */
  stuckVehicles: number;
  /** In seconds; null when there are no vehicles of this class. */
  meanDelayS: number | null;
  /**
   * The delays of those vehicles added up, in seconds: the mean times the
   * number of vehicles. Unlike the mean, it can be subtracted: the total at one
   * moment less the total at an earlier one is the delay added in between,
   * which is how a warm-up is left out (resultsExcludingWarmUp).
   */
  totalDelayS: number;
}

/** One execution of a scenario. Advance it with step(); read it with snapshot() and results(). */
export interface Run {
  /** Simulated seconds since the start of the run. */
  readonly timeS: number;
  /** Advance the run by one fixed step of STEP_SECONDS. */
  step(): void;
  snapshot(): Snapshot;
  results(): Results;
}
