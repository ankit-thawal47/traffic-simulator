/**
 * One description of a benchmark scenario, from which the inputs of both
 * engines are made (benchmark standard, fairness rule 1: one script generates
 * the network and the demand for both engines).
 *
 * A scenario is one straight one-way road with marked lanes, cars placed on it
 * at the start, and optionally cars departing later. `engine-input.ts` turns it
 * into the engine's RunInput; `sumo-input.ts` turns the same object into a SUMO
 * network and route file.
 */
import { STEP_SECONDS, VEHICLE_CLASS_ASSUMPTIONS } from "@traffic-simulator/engine";
import type { IdmParameters } from "./reference";

/** Lane width used for every Tier 1 road, in metres (the engine's standard lane width). */
export const LANE_WIDTH_M = 3.5;

/** The step both engines run at. */
export const STEP_S = STEP_SECONDS;

const car = VEHICLE_CLASS_ASSUMPTIONS.car;

/**
 * The car's values from the engine's assumptions table. The engine reads the
 * table itself; SUMO's vehicle type and the reference are given these same values.
 */
export const CAR: IdmParameters & { widthM: number } = {
  desiredSpeedMps: car.desiredSpeedMps,
  timeGapS: car.timeGapS,
  standstillGapM: car.standstillGapM,
  maxAccelerationMps2: car.maxAccelerationMps2,
  comfortableDecelerationMps2: car.comfortableDecelerationMps2,
  lengthM: car.lengthM,
  widthM: car.widthM,
};

/** A car on the road when the run starts. */
export interface PlacedCar {
  /** Lane index, 0 being the leftmost lane facing the direction of travel (left-hand traffic: the kerb lane). */
  lane: number;
  /** Front bumper, metres from the start of the road. */
  frontM: number;
  speedMps: number;
  /** Never moves (a blocked lane, an obstacle). */
  stationary?: boolean;
  /** Vehicles of the same group are recorded step by step and reported together. */
  group?: string;
}

/** A car that enters at the start of the road at a set time. */
export interface Departure {
  timeS: number;
}

export interface Scenario {
  name: string;
  roadLengthM: number;
  lanes: number;
  /** Speed limit of the road; with the car's desired speed, whichever is lower applies. */
  speedLimitMps: number;
  cars: PlacedCar[];
  durationS: number;
  /**
   * Lanes that end part-way (a lane drop): lane `lane` carries no traffic from `fromM` to the end of the road.
   * For the engine this becomes a line of stationary cars filling the lane; for SUMO, a second edge with fewer lanes.
   */
  laneDrop?: { lane: number; fromM: number };
  /** Cars per hour entering at the start of the road. The engine draws the departure times from its seed. */
  demandPerHour?: number;
  /** Seed for the engine's demand (and passed to SUMO). */
  seed: number;
}

/** A small seeded generator for the benchmark's own random choices (mulberry32, public domain). */
export function seededRandom(seed: number): () => number {
  let state = (seed * 0x9e3779b1) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
