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
  speedLimitMps: number;
}

/** The roads a scenario runs on. Later versions add junctions and flyovers. */
export interface Network {
  formatVersion: 1;
  roads: Road[];
}

export type VehicleClass = "car";

/** Traffic sent into the network from one entry road to one exit road. */
export interface DemandFlow {
  entryRoadId: string;
  exitRoadId: string;
  vehiclesPerHour: number;
}

export interface Demand {
  flows: DemandFlow[];
}

/** A vehicle already on the network when the run starts. */
export interface InitialVehicle {
  roadId: string;
  /** Distance of the front bumper from the start of the road, in metres. */
  positionM: number;
  speedMps: number;
  vehicleClass?: VehicleClass;
  /** A stationary vehicle (for example a breakdown) never moves during the run. */
  stationary?: boolean;
}

export interface RunInput {
  network: Network;
  demand: Demand;
  /** Any integer. The same input and seed always give the same run. */
  seed: number;
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
