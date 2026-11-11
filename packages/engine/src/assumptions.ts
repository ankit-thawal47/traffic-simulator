import type { VehicleClass, VehicleMix } from "./types";

/**
 * Assumptions: values the engine takes as given, each with its source.
 * This table is the single place they live, so that what is shown to the
 * planner is what the engine uses.
 *
 * None of these values has been re-read against its source yet; each is marked
 * unconfirmed until it has been.
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
  /** Room kept at the vehicle's sides in mixed traffic, both sides together; added to its width to give the strips it occupies. */
  sideClearanceM: number;
  /** Cap on the speed of a sideways shift. */
  maxSidewaysSpeedMps: number;
  source: string;
  /** Whether the values have been re-read against the source. */
  confirmed: boolean;
}

const SIZES = "Size: Chennai measurements (Agrawal et al. 2026, arXiv 2608.00602, medians) as rounded in the v1 spec. ";
const FOLLOWING =
  "Following values (time gap, standstill gap, acceleration, deceleration): Kanagaraj and Treiber 2018 " +
  "(Physica A 509, arXiv 1805.05076), calibrated on a Chennai arterial. ";
const SIDEWAYS =
  "Side clearance: our choice within the 0.15 to 0.30 m sideways scales of Kanagaraj and Treiber 2018. " +
  "Sideways speed cap: our choice; the research suggests about 1 m/s for two-wheelers " +
  "(Chennai two-wheelers reach about 2 m/s sideways, Agrawal et al. 2026), and we scaled larger classes down. ";

export const VEHICLE_CLASS_ASSUMPTIONS: Record<VehicleClass, VehicleClassAssumptions> = {
  "two-wheeler": {
    lengthM: 2.0,
    widthM: 0.7,
    desiredSpeedMps: 18,
    timeGapS: 0.3,
    standstillGapM: 0.5,
    maxAccelerationMps2: 2.0,
    comfortableDecelerationMps2: 2.0,
    sideClearanceM: 0.2,
    maxSidewaysSpeedMps: 1.0,
    source:
      SIZES +
      FOLLOWING +
      "Desired speed: the lower end of their printed 18 to 25 m/s range, which may be a misprint. " +
      SIDEWAYS,
    confirmed: false,
  },
  car: {
    lengthM: 4.4,
    widthM: 1.9,
    desiredSpeedMps: 15,
    timeGapS: 0.8,
    standstillGapM: 2.0,
    maxAccelerationMps2: 1.0,
    comfortableDecelerationMps2: 1.0,
    sideClearanceM: 0.3,
    maxSidewaysSpeedMps: 0.6,
    source: SIZES + FOLLOWING + "Desired speed: the middle of their 12 to 18 m/s range. " + SIDEWAYS,
    confirmed: false,
  },
  "auto-rickshaw": {
    lengthM: 2.9,
    widthM: 1.4,
    desiredSpeedMps: 11,
    timeGapS: 1.0,
    standstillGapM: 2.0,
    maxAccelerationMps2: 1.0,
    comfortableDecelerationMps2: 1.0,
    sideClearanceM: 0.25,
    maxSidewaysSpeedMps: 0.8,
    source:
      SIZES +
      FOLLOWING +
      "Their auto-rickshaw width (0.9 m) and desired speed (5 to 6 m/s) look misprinted and are not used: " +
      "the width is the measured one, and the desired speed of 11 m/s (40 km/h) is our choice, " +
      "just under the 12.25 m/s fastest auto-rickshaw seen in Chennai congestion (Agrawal et al. 2026). " +
      SIDEWAYS,
    confirmed: false,
  },
  bus: {
    lengthM: 10.1,
    widthM: 2.43,
    desiredSpeedMps: 12,
    timeGapS: 1.0,
    standstillGapM: 2.0,
    maxAccelerationMps2: 1.0,
    comfortableDecelerationMps2: 1.0,
    sideClearanceM: 0.4,
    maxSidewaysSpeedMps: 0.4,
    source:
      "Size: Chandra and Kumar 2003 (J. Transp. Eng. 129(2)), bus 10.10 x 2.43 m; sources disagree " +
      "(10.3 x 2.1 m in Kanagaraj and Treiber 2018; 11.97 x 2.92 m for all heavy vehicles in Agrawal et al. 2026). " +
      FOLLOWING +
      "Desired speed: the middle of their 10 to 14 m/s range. " +
      SIDEWAYS,
    confirmed: false,
  },
};

/** The vehicle classes in a fixed order, used wherever the order must not vary (drawing from the vehicle mix, reporting). */
export const VEHICLE_CLASSES: readonly VehicleClass[] = ["two-wheeler", "car", "auto-rickshaw", "bus"];

/** One assumption that is not tied to a vehicle class. */
export interface Assumption {
  value: number;
  unit: string;
  source: string;
  /** Whether the value has been re-read against the source. */
  confirmed: boolean;
}

/** Assumptions about how vehicles share the road's width and shift sideways. */
export const SIDEWAYS_ASSUMPTIONS = {
  stripWidthM: {
    value: 0.5,
    unit: "m",
    source: "v1 spec; no wider than the narrowest vehicle, after the strip approach of Mathew, Munigety and Bajpai.",
    confirmed: false,
  },
  standardLaneWidthM: {
    value: 3.5,
    unit: "m",
    source:
      "Usual Indian urban lane width (Indian Roads Congress practice), quoted from memory. " +
      "Used only to give lanes to a network of format version 1, which has no lane counts.",
    confirmed: false,
  },
  gainThresholdMps2: {
    value: 0.1,
    unit: "m/s2",
    source:
      "Gain in acceleration a sideways shift must give: the changing threshold of MOBIL " +
      "(Kesting, Treiber and Helbing 2007), quoted from memory.",
    confirmed: false,
  },
  politeness: {
    value: 0.2,
    unit: "",
    source:
      "Weight given to the braking a shift causes the vehicle behind: politeness of Kanagaraj and Treiber 2018, " +
      "calibrated on a Chennai arterial.",
    confirmed: false,
  },
  safeBrakingMps2: {
    value: 4.0,
    unit: "m/s2",
    source:
      "Hardest braking a shift may cause the vehicle behind: the safe braking limit of MOBIL " +
      "(Kesting, Treiber and Helbing 2007), quoted from memory.",
    confirmed: false,
  },
} satisfies Record<string, Assumption>;

/** Assumptions about how vehicles behave at junctions. All are our own choices; none comes from a measurement. */
export const JUNCTION_ASSUMPTIONS = {
  turnAccelerationMps2: {
    value: 2.5,
    unit: "m/s2",
    source:
      "Sideways acceleration a vehicle accepts in a turn; with the turn's radius it gives the speed of the turn " +
      "(speed squared over radius). Our choice: about 18 km/h on a 10 m radius. Not from a measurement.",
    confirmed: false,
  },
  crossingMarginS: {
    value: 1,
    unit: "s",
    source:
      "Time a vehicle leaves between a crossing vehicle clearing a place where their paths cross and its own arrival there, " +
      "when it asks to be let into a junction. Our choice. Not from a measurement.",
    confirmed: false,
  },
  keepClearSlackM: {
    value: 0.5,
    unit: "m",
    source:
      "Room a vehicle wants on the road beyond a junction, over its own length and standstill gap, before it enters. " +
      "Our choice. Not from a measurement.",
    confirmed: false,
  },
} satisfies Record<string, Assumption>;

/** Width of a strip, in metres (spec: Engine behaviour, Strips). */
export const STRIP_WIDTH_M = SIDEWAYS_ASSUMPTIONS.stripWidthM.value;

/**
 * How many strips a vehicle class occupies in mixed traffic: as many as its width plus side clearance needs.
 * A road must have at least this many strips to take the vehicle class.
 */
export function stripsOccupied(vehicleClass: VehicleClass): number {
  const { widthM, sideClearanceM } = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass];
  return Math.ceil((widthM + sideClearanceM) / STRIP_WIDTH_M - 1e-9);
}
export const STANDARD_LANE_WIDTH_M = SIDEWAYS_ASSUMPTIONS.standardLaneWidthM.value;

/**
 * A vehicle mix for a Bengaluru arterial, for scenarios that want one.
 * Source: classified count at Silk Board junction, 2019 peak hour (DataCorp Traffic,
 * as reported by Traffic Infratech): two-wheelers 65.2%, cars 22.3%, auto-rickshaws 5.4%,
 * buses 4.1%; the other 3% (goods vehicles and unreported) are left out. Unconfirmed.
 */
export const BENGALURU_VEHICLE_MIX: VehicleMix = {
  "two-wheeler": 0.65,
  car: 0.22,
  "auto-rickshaw": 0.055,
  bus: 0.04,
};

/** Fixed step of the engine, in simulated seconds (spec: Engine behaviour, Time). */
export const STEP_SECONDS = 0.2;
