/**
 * The engine's inputs and outputs. Everything here is plain data (JSON-safe),
 * so it can cross a worker boundary, be written to a file, or be compared.
 * Vocabulary follows GLOSSARY.md.
 */

/** A point on the ground plane, in metres. x grows east, y grows north. */
export interface Point {
  x: number;
  y: number;
}

/** One carriageway carrying traffic in one direction, from its first point to its last. */
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

/**
 * The roads a scenario runs on. Later versions add junctions and flyovers.
 *
 * Format versions: 1 is a road with a centreline, width and speed limit;
 * 2 adds each road's lane count. The engine reads both.
 */
export interface Network {
  formatVersion: 1 | 2;
  roads: Road[];
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
  /** Delay for each vehicle class. */
  delayByVehicleClass: Record<VehicleClass, VehicleClassDelay>;
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
  /** In seconds; null when there are no vehicles of this class. */
  meanDelayS: number | null;
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
