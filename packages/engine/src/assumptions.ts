import type { VehicleClass } from "./types";

/**
 * Assumptions: values the engine takes as given, each with its source.
 * This table is the single place they live, so that what is shown to the
 * planner is what the engine uses.
 */
export interface VehicleClassAssumptions {
  lengthM: number;
  widthM: number;
  /** Speed the vehicle class aims for on an open road; the road's speed limit caps it. */
  desiredSpeedMps: number;
  /** Following time gap T of the following rule. */
  timeGapS: number;
  /** Gap kept to the vehicle ahead when both are stopped. */
  standstillGapM: number;
  maxAccelerationMps2: number;
  comfortableDecelerationMps2: number;
  source: string;
}

export const VEHICLE_CLASS_ASSUMPTIONS: Record<VehicleClass, VehicleClassAssumptions> = {
  car: {
    lengthM: 4.4,
    widthM: 1.9,
    desiredSpeedMps: 15,
    timeGapS: 0.8,
    standstillGapM: 2.0,
    maxAccelerationMps2: 1.0,
    comfortableDecelerationMps2: 1.0,
    source:
      "Size: Chennai measurements as quoted in the v1 spec (about 4.4 x 1.9 m). " +
      "Following values: Kanagaraj and Treiber 2018 (Physica A 509), IDM calibrated on a Chennai arterial; " +
      "desired speed is the middle of their 12 to 18 m/s range. Not yet re-read against the sources.",
  },
};

/** Fixed step of the engine, in simulated seconds (spec: Engine behaviour, Time). */
export const STEP_SECONDS = 0.2;
