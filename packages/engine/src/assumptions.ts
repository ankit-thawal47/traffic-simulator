import type { VehicleClass, VehicleMix } from "./types";

/**
 * Assumptions: values the engine takes as given, each with its source.
 * This table is the single place they live, so that what is shown to the
 * planner (listAssumptions) is what the engine uses.
 *
 * Every value carries a state saying how far it has been checked against its
 * source. "Confirmed" means only that the figure was read in the source named;
 * it does not mean the engine has been calibrated or validated against traffic.
 */

/**
 * How far an assumption has been checked:
 *  - confirmed: the figure was read in the primary source (paper, preprint or standard), at the place given;
 *  - secondary-source: the figure was found only where someone else quotes or reports it;
 *  - our-choice: the figure comes from no source; we chose it;
 *  - unconfirmed: a source is named but could not be opened, so the figure has not been checked.
 */
export type AssumptionState = "confirmed" | "secondary-source" | "our-choice" | "unconfirmed";

/** Where an assumption comes from. */
export interface Evidence {
  state: AssumptionState;
  /** The citation and where in it the figure is; for our own choices, that it is ours and why this value. */
  source: string;
  /** What the source measured it on, and what other sources say. */
  note?: string;
}

/** The values the engine takes as given for one vehicle class. */
export interface VehicleClassValues {
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
}

export interface VehicleClassAssumptions extends VehicleClassValues {
  /** Where each value comes from. */
  evidence: Record<keyof VehicleClassValues, Evidence>;
}

// The sources, as opened and read on 11 November 2026.

const CHENNAI_2026 =
  "Agrawal, Asaithambi, Kanagaraj, Treiber, Okhrin and Kumar, \"Beyond Lanes: Traffic Flow Dynamics in Disordered " +
  "Conditions Based on High-Resolution Trajectory Data\", preprint arXiv:2608.00602v1 (2026)";
const CHENNAI_2026_SITE =
  "Measured from drone video of Anna Salai at Saidapet, Chennai (a six-lane divided arterial, about 550 m, away from " +
  "junctions), 26 June 2023, 09:30 to 10:30, 36 minutes, about 5,891 vehicles, mostly congested traffic.";

const CHENNAI_2018 =
  "Kanagaraj and Treiber, \"Self-Driven Particle Model for Mixed Traffic and Other Disordered Flows\", " +
  "preprint arXiv:1805.05076v1 (2018)";
const CHENNAI_2018_SITE =
  "Fitted by its authors to video of a 250 m section of a divided urban road in Chennai (12 m wide each way; the " +
  "year of the video is not given): the fit matched five overall figures of one 20-second case of medium traffic and " +
  "was checked on one congested case. The values were fitted for the authors' own two-dimensional model and a variant " +
  "of the following rule, not for this engine, which reuses the numbers as they are. Only the preprint was read; the " +
  "published version (Physica A, 2018) is paywalled.";

const MOBIL =
  "Kesting, Treiber and Helbing, \"MOBIL: General Lane-Changing Model for Car-Following Models\" " +
  "(Transportation Research Record 1999, 2007), authors' copy at mtreiber.de";

function measuredSize(what: string, median: string, mean: string, alsoPrinted: string): Evidence {
  return {
    state: "confirmed",
    source: `${CHENNAI_2026}, Table 3: median ${what} ${median} m (mean ${mean} m), rounded here to 0.1 m.`,
    note: `${CHENNAI_2026_SITE} ${alsoPrinted}`,
  };
}

function fitted2018(what: string, printed: string, measured2026: string): Evidence {
  return {
    state: "confirmed",
    source: `${CHENNAI_2018}, Table 1: ${what} ${printed}.`,
    note: `${CHENNAI_2018_SITE} ${measured2026}`,
  };
}

function sideClearance(why: string): Evidence {
  return {
    state: "our-choice",
    source:
      "Our choice; no source gives this value. " +
      why +
      " The nearest published figures are the sideways distances of 0.15 to 0.30 m at which vehicles react to each " +
      `other in the model of ${CHENNAI_2018}, Table 2, which are values of that model and not measurements.`,
  };
}

function sidewaysCap(why: string, observed: string): Evidence {
  return {
    state: "our-choice",
    source: `Our choice; no source gives this value. ${why}`,
    note: `Observed sideways speeds, for comparison (${CHENNAI_2026}, Table 4): ${observed} ${CHENNAI_2026_SITE}`,
  };
}

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
    evidence: {
      lengthM: measuredSize("length", "2.010", "2.018", `${CHENNAI_2018}, Table 1, prints 1.8 m for a motorcycle.`),
      widthM: measuredSize("width", "0.733", "0.736", `${CHENNAI_2018}, Table 1, prints 0.6 m for a motorcycle.`),
      desiredSpeedMps: {
        state: "our-choice",
        source:
          `Our choice: the lower end of the range of 18 to 25 m/s (printed "25-18") that ${CHENNAI_2018}, Table 1, ` +
          "gives for motorcycles. We took the lower end because 25 m/s (90 km/h) is high for a city road.",
        note:
          "The range is printed in the same form as the car and bus ranges, so we have no sign that it is a misprint. " +
          "The paper says the ranges are approximate and were read off video. " +
          `The fastest two-wheeler in the 2023 Chennai video moved at 14.84 m/s, in congestion (${CHENNAI_2026}, Table 4).`,
      },
      timeGapS: fitted2018(
        "time gap T for motorcycles",
        "0.3 s",
        `Measured in 2023, the median time gap of two-wheelers following steadily was 0.488 s (mean 0.674 s, 510 pairs; ${CHENNAI_2026}, Table 2). The two sources disagree; the engine uses the 2018 value.`,
      ),
      standstillGapM: fitted2018(
        "standstill gap s0 for motorcycles",
        "0.5 m",
        `Measured in 2023, the median gap of stopped two-wheelers was 0.547 m (mean 0.728 m, 450 pairs; ${CHENNAI_2026}, Table 2).`,
      ),
      maxAccelerationMps2: fitted2018("acceleration a for motorcycles", "2.0 m/s2", ""),
      comfortableDecelerationMps2: fitted2018("deceleration b for motorcycles", "2.0 m/s2", ""),
      sideClearanceM: sideClearance("The smallest of the four, as two-wheelers pass closest to other vehicles."),
      maxSidewaysSpeedMps: sidewaysCap(
        "At this cap a two-wheeler takes 0.6 s to move one strip sideways.",
        "two-wheelers, 9 in 10 readings below 0.30 m/s, fastest 2.15 m/s.",
      ),
    },
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
    evidence: {
      lengthM: measuredSize("length", "4.418", "4.457", `${CHENNAI_2018}, Table 1, prints 4.2 m for a car.`),
      widthM: measuredSize(
        "width",
        "1.850",
        "1.848",
        `The median is exactly half-way and was rounded up. ${CHENNAI_2018}, Table 1, prints 1.7 m for a car.`,
      ),
      desiredSpeedMps: {
        state: "our-choice",
        source: `Our choice: the middle of the range of 12 to 18 m/s (printed "18-12") that ${CHENNAI_2018}, Table 1, gives for cars.`,
        note:
          "The paper says the ranges are approximate and were read off video. " +
          `The fastest car in the 2023 Chennai video moved at 14.81 m/s, in congestion (${CHENNAI_2026}, Table 4).`,
      },
      timeGapS: fitted2018(
        "time gap T for cars",
        "0.8 s",
        `Measured in 2023, the median time gap of cars following steadily was 1.213 s (mean 1.339 s, 553 pairs; ${CHENNAI_2026}, Table 2). The two sources disagree; the engine uses the 2018 value.`,
      ),
      standstillGapM: fitted2018(
        "standstill gap s0 for cars",
        "2.0 m",
        `Measured in 2023, the median gap of stopped cars was 1.324 m (mean 1.464 m, 552 pairs; ${CHENNAI_2026}, Table 2). The two sources disagree; the engine uses the 2018 value.`,
      ),
      maxAccelerationMps2: fitted2018("acceleration a for cars", "1.0 m/s2", ""),
      comfortableDecelerationMps2: fitted2018("deceleration b for cars", "1.0 m/s2", ""),
      sideClearanceM: sideClearance("Larger than a two-wheeler's, as a larger vehicle is steered less exactly."),
      maxSidewaysSpeedMps: sidewaysCap(
        "At this cap a car takes 1.0 s to move one strip sideways.",
        "cars, 9 in 10 readings below 0.09 m/s, fastest 1.86 m/s.",
      ),
    },
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
    evidence: {
      lengthM: measuredSize("length", "2.915", "2.922", `${CHENNAI_2018}, Table 1, prints 2.6 m for an auto-rickshaw.`),
      widthM: measuredSize(
        "width",
        "1.350",
        "1.354",
        `The median is exactly half-way and was rounded up. ${CHENNAI_2018}, Table 1, prints 0.9 m for an auto-rickshaw, ` +
          "which is narrower than any measured one and is not used.",
      ),
      desiredSpeedMps: {
        state: "our-choice",
        source:
          "Our choice: 11 m/s (40 km/h), just under the fastest auto-rickshaw in the 2023 Chennai video, 12.25 m/s, " +
          `in congestion (${CHENNAI_2026}, Table 4).`,
        note:
          `${CHENNAI_2018}, Table 1, prints a range of 5 to 6 m/s (about 20 km/h) for auto-rickshaws. That is what the ` +
          "preprint says; we could not open the published version to see whether it is a misprint. We do not use it, " +
          "because auto-rickshaws were measured moving twice as fast.",
      },
      timeGapS: fitted2018(
        "time gap T for auto-rickshaws",
        "1.0 s",
        `Measured in 2023, the median time gap of auto-rickshaws following steadily was 0.811 s (mean 0.916 s, 118 pairs; ${CHENNAI_2026}, Table 2). The two sources disagree; the engine uses the 2018 value.`,
      ),
      standstillGapM: fitted2018(
        "standstill gap s0 for auto-rickshaws",
        "2.0 m",
        `Measured in 2023, the median gap of stopped auto-rickshaws was 0.834 m (mean 1.043 m, 91 pairs; ${CHENNAI_2026}, Table 2). The two sources disagree; the engine uses the 2018 value.`,
      ),
      maxAccelerationMps2: fitted2018("acceleration a for auto-rickshaws", "1.0 m/s2", ""),
      comfortableDecelerationMps2: fitted2018("deceleration b for auto-rickshaws", "1.0 m/s2", ""),
      sideClearanceM: sideClearance("Between a two-wheeler's and a car's."),
      maxSidewaysSpeedMps: sidewaysCap(
        "At this cap an auto-rickshaw takes 0.8 s to move one strip sideways.",
        "auto-rickshaws, 9 in 10 readings below 0.17 m/s, fastest 1.84 m/s.",
      ),
    },
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
    evidence: {
      lengthM: busSize("length", "10.3 m", "11.972 m"),
      widthM: busSize("width", "2.1 m", "2.923 m"),
      desiredSpeedMps: {
        state: "our-choice",
        source: `Our choice: the middle of the range of 10 to 14 m/s (printed "14-10") that ${CHENNAI_2018}, Table 1, gives for buses.`,
        note:
          "The paper says the ranges are approximate and were read off video. " +
          `The fastest heavy vehicle in the 2023 Chennai video moved at 9.62 m/s, in congestion (${CHENNAI_2026}, Table 4).`,
      },
      timeGapS: fitted2018(
        "time gap T for buses",
        "1.0 s",
        `Measured in 2023, the median time gap of heavy vehicles (buses and trucks together) following steadily was 1.570 s (mean 1.856 s, only 13 pairs; ${CHENNAI_2026}, Table 2).`,
      ),
      standstillGapM: fitted2018(
        "standstill gap s0 for buses",
        "2.0 m",
        `Measured in 2023, the median gap of stopped heavy vehicles (buses and trucks together) was 0.713 m (mean 0.833 m, only 11 pairs; ${CHENNAI_2026}, Table 2).`,
      ),
      maxAccelerationMps2: fitted2018("acceleration a for buses", "1.0 m/s2", ""),
      comfortableDecelerationMps2: fitted2018("deceleration b for buses", "1.0 m/s2", ""),
      sideClearanceM: sideClearance("The largest of the four, as a bus is steered least exactly."),
      maxSidewaysSpeedMps: sidewaysCap(
        "At this cap a bus takes 1.4 s to move one strip sideways.",
        "heavy vehicles, 9 in 10 readings below 0.13 m/s, fastest 0.89 m/s.",
      ),
    },
  },
};

function busSize(what: string, printed2018: string, measured2026: string): Evidence {
  return {
    state: "secondary-source",
    source:
      "A bus of 10.10 x 2.43 m, as given in the table for \"Chandra's method\" in NPTEL course 105101008, Module 2 " +
      "(Traffic Measurement Procedures), Lecture 5, \"Measurement at a Point\". The page names no paper; the method " +
      "is that of Chandra and Kumar (Journal of Transportation Engineering 129(2), 2003), which is paywalled and was not read.",
    note:
      `Sources disagree. ${CHENNAI_2018}, Table 1, prints a bus ${what} of ${printed2018}, read off video. ` +
      `${CHENNAI_2026}, Table 3, measured a median ${what} of ${measured2026} for heavy vehicles, buses and trucks together. ` +
      "The engine uses the figure that is for buses alone and lies between the other two.",
  };
}

/** The vehicle classes in a fixed order, used wherever the order must not vary (drawing from the vehicle mix, reporting). */
export const VEHICLE_CLASSES: readonly VehicleClass[] = ["two-wheeler", "car", "auto-rickshaw", "bus"];

/** One assumption that is not tied to a vehicle class. */
export interface Assumption extends Evidence {
  value: number;
  unit: string;
}

/** The fixed step of the engine. */
export const TIME_ASSUMPTIONS = {
  stepS: {
    value: 0.2,
    unit: "s",
    state: "our-choice",
    source:
      "Our choice, fixed in the v1 spec. It is shorter than the shortest following time gap of any vehicle class (0.3 s).",
  },
} satisfies Record<string, Assumption>;

/** Assumptions about how vehicles share the road's width and shift sideways. */
export const SIDEWAYS_ASSUMPTIONS = {
  stripWidthM: {
    value: 0.5,
    unit: "m",
    state: "our-choice",
    source:
      "Our choice, fixed in the v1 spec: no wider than the narrowest vehicle class (0.7 m), so that a two-wheeler " +
      "fits between larger vehicles.",
    note:
      "Dividing the road into strips follows Mathew, Munigety and Bajpai, \"Strip-based approach for the simulation of " +
      "mixed traffic conditions\" (Journal of Computing in Civil Engineering, 2015), which is paywalled and was not " +
      "read; we do not know what strip width it uses.",
  },
  standardLaneWidthM: {
    value: 3.5,
    unit: "m",
    state: "confirmed",
    source:
      "Indian Roads Congress, IRC:86-1983, \"Geometric Design Standards for Urban Roads in Plains\", clause 6.2.4, " +
      "Table 5 (page 7): a single lane is 3.50 m wide, two lanes without kerbs 7.0 m.",
    note:
      "Used only to give a lane count to a network saved before lane counts were recorded. A design standard, not a " +
      "measurement; the 2018 edition of the standard was not read.",
  },
  gainThresholdMps2: {
    value: 0.1,
    unit: "m/s2",
    state: "confirmed",
    source: `${MOBIL}, Table 1 (page 10): changing threshold 0.1 m/s2.`,
    note:
      "The gain in acceleration a sideways shift must give before a vehicle makes it. The authors chose the value for " +
      "simulations of lane changing on a two-lane motorway; it was not measured, and not chosen for Indian roads.",
  },
  politeness: {
    value: 0.2,
    unit: "",
    state: "confirmed",
    source: `${CHENNAI_2018}, Table 2: politeness factor p 0.2.`,
    note: `The weight a vehicle gives to the braking its sideways shift causes the vehicle behind. ${CHENNAI_2018_SITE}`,
  },
  safeBrakingMps2: {
    value: 4.0,
    unit: "m/s2",
    state: "confirmed",
    source: `${MOBIL}, Table 1 (page 10): maximum safe deceleration 4 m/s2.`,
    note:
      "The hardest braking a sideways shift may cause the vehicle behind. The authors chose the value for simulations " +
      "of lane changing on a two-lane motorway; it was not measured, and not chosen for Indian roads.",
  },
} satisfies Record<string, Assumption>;

/** Assumptions about how vehicles behave at junctions. All are our own choices; none comes from a measurement. */
export const JUNCTION_ASSUMPTIONS = {
  turnAccelerationMps2: {
    value: 2.5,
    unit: "m/s2",
    state: "our-choice",
    source:
      "Our choice; not from a measurement. With the turn's radius it gives the speed of the turn (speed squared " +
      "over radius): about 18 km/h on a 10 m radius.",
  },
  crossingMarginS: {
    value: 1,
    unit: "s",
    state: "our-choice",
    source: "Our choice; not from a measurement. Applied when a vehicle asks to be let into a junction.",
  },
  queueSpeedMps: {
    value: 1.4,
    unit: "m/s",
    state: "our-choice",
    source: "Our choice; not from a measurement. It is 5 km/h, a slow walking pace.",
  },
  queueBreakM: {
    value: 10,
    unit: "m",
    state: "our-choice",
    source: "Our choice; not from a measurement. About two car lengths.",
  },
  keepClearSlackM: {
    value: 0.5,
    unit: "m",
    state: "our-choice",
    source:
      "Our choice; not from a measurement. A vehicle stops a little short of its standstill gap, so it needs slightly more room than that.",
  },
} satisfies Record<string, Assumption>;

const JUNCTION_NAMES: Record<keyof typeof JUNCTION_ASSUMPTIONS, string> = {
  turnAccelerationMps2: "Sideways acceleration a vehicle accepts in a turn, which sets how far it slows for the turn",
  crossingMarginS: "Time left between a crossing vehicle clearing a place where paths cross and a vehicle's own arrival there",
  queueSpeedMps: "Queue speed: a vehicle on an approach slower than this is counted as queued",
  queueBreakM: "Queue break: a queue is counted back from the stop line to the first stretch this long with no queued vehicle",
  keepClearSlackM: "Room on the road beyond a junction, over its length and standstill gap, that a vehicle wants before it enters",
};

/**
 * Assumptions about how through traffic chooses between a flyover and the
 * junction beneath it (ADR 0006; route-choice.ts). All are our own choices.
 */
export const ROUTE_CHOICE_ASSUMPTIONS = {
  travelTimePower: {
    value: 4,
    unit: "",
    state: "our-choice",
    source:
      "Our choice; not from a measurement. A route's share is in proportion to its measured travel time to the power " +
      "minus 4: equal times give equal shares, a route a quarter slower gets about 30% of the traffic, and one twice " +
      "as slow about 6% (before the smallest share is added). High enough that most drivers take the clearly faster route, low enough that the split does " +
      "not swing from one route to the other when the times are close.",
    note:
      "No study of how drivers in Indian cities choose between a flyover and the road beneath it was found. The " +
      "form (shares in proportion to a power of travel time) is the textbook Kirchhoff split.",
  },
  smallestShare: {
    value: 0.05,
    unit: "of the vehicles choosing",
    state: "our-choice",
    source:
      "Our choice; not from a measurement. Every route keeps at least this share however slow it is, so the choice " +
      "is never all-or-nothing, and a route that was jammed goes on being tried: its travel time is measured from " +
      "the vehicles that use it, so without them it could never be seen to have cleared.",
  },
  measuredOverS: {
    value: 60,
    unit: "s",
    state: "our-choice",
    source:
      "Our choice; not from a measurement. A route's measured travel time is the mean over the vehicles that " +
      "completed it in the last 60 s (or the time so far of the vehicle longest on it, if that is more). A minute is " +
      "short enough to follow a jam as it builds and clears, and on a busy route long enough that one slow bus does " +
      "not tip the choice.",
    note:
      "If no vehicle completed the route in that time, the last one to complete it is used; before any has, the " +
      "route's travel time on empty roads at the speed limits.",
  },
} satisfies Record<string, Assumption>;

const ROUTE_CHOICE_NAMES: Record<keyof typeof ROUTE_CHOICE_ASSUMPTIONS, string> = {
  travelTimePower: "How strongly the faster route is preferred: a route's share falls with its measured travel time to this power",
  smallestShare: "Smallest share of through traffic a route gets, however slow it is",
  measuredOverS: "Time a route's measured travel time is averaged over: the vehicles that completed it in this long",
};

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
 * The engine does not use it by itself: a scenario's demand carries its own vehicle mix.
 */
export const BENGALURU_VEHICLE_MIX: VehicleMix = {
  "two-wheeler": 0.65,
  car: 0.22,
  "auto-rickshaw": 0.055,
  bus: 0.04,
};

const SILK_BOARD_COUNTS: Record<VehicleClass, string> = {
  "two-wheeler": "10,113 two-wheelers (65.2%)",
  car: "3,454 cars (22.3%)",
  "auto-rickshaw": "845 auto-rickshaws (5.4%)",
  bus: "632 buses (4.1%)",
};

/** Where the Bengaluru vehicle mix comes from. */
export function vehicleMixEvidence(vehicleClass: VehicleClass): Evidence {
  return {
    state: "secondary-source",
    source:
      "R. M. Alagappan (DataCorp Traffic), \"Urban Mobility in Pandemic times: A Case Study of Silk Board Junction, " +
      "Bengaluru\", TrafficInfraTech magazine, 6 June 2020: of 15,507 vehicles counted, " +
      `${SILK_BOARD_COUNTS[vehicleClass]}. A trade magazine article by the firm that made the count; the count itself ` +
      "is not published.",
    note:
      "One junction (Silk Board, Bengaluru), one morning peak hour (09:30 to 10:30) on one working day in March 2019. " +
      "The other 3% of vehicles (goods vehicles and others, not broken down in the article) are left out, so the " +
      "shares do not add up to 1; the engine scales them so that they do.",
  };
}

/** Fixed step of the engine, in simulated seconds (spec: Engine behaviour, Time). */
export const STEP_SECONDS = TIME_ASSUMPTIONS.stepS.value;

/** A rule the engine follows, shown to the planner beside the values. */
export interface Rule extends Evidence {
  id: string;
  name: string;
}

/**
 * The rules the engine follows, in plain words. A rule is listed here when it is
 * ours (no source gives it) or when it decides how the values above are used.
 */
export const RULES: readonly Rule[] = [
  {
    id: "rule.following",
    name: "Following: every vehicle class follows the vehicle ahead by the Intelligent Driver Model, with acceleration exponent 4",
    state: "confirmed",
    source:
      "Treiber, Hennecke and Helbing, \"Congested Traffic States in Empirical Observations and Microscopic " +
      "Simulations\", preprint arXiv:cond-mat/0002177v2 (2000), Section II B: the model's equation, and " +
      "\"Throughout this paper we will use δ = 4\".",
    note: "The paper applies the rule to traffic keeping to lanes on German motorways; here it is applied to every vehicle class.",
  },
  {
    id: "rule.strips",
    name: "Strips: a vehicle's leader is the nearest vehicle ahead that overlaps the strips it occupies",
    state: "secondary-source",
    source:
      "After the strip approach of Mathew, Munigety and Bajpai (Journal of Computing in Civil Engineering, 2015), " +
      "known to us only from summaries; the paper is paywalled and was not read. What the engine does is our own " +
      "reading of the idea.",
  },
  {
    id: "rule.sideways",
    name: "Sideways shifts: a vehicle held back by its leader shifts to where it gains enough acceleration, unless the vehicle behind there would have to brake too hard",
    state: "our-choice",
    source:
      `Ours: the two tests of ${MOBIL} (enough gain; safe braking behind), which were written for changing between ` +
      "lanes, applied by us to strips. No source gives this combination, and no published program was available to compare it with.",
  },
  {
    id: "rule.same-space",
    name: "Same space: when two vehicles alongside each other want the same strips in one step, the one further ahead gets them",
    state: "our-choice",
    source:
      "Ours; no source gives it. Some rule is needed, because every vehicle decides from the same state. We chose " +
      "the vehicle further ahead because the driver behind is the one who can see the other.",
  },
  {
    id: "rule.advance-limit",
    name: "Limit on advancing: in one step a vehicle never moves further than the clear gap to its leader at the start of the step",
    state: "our-choice",
    source:
      "Ours; not part of the published following rule. It is a safety limit that makes it impossible for two " +
      "vehicles to overlap, whatever the following rule gives.",
  },
  {
    id: "rule.gap-floor",
    name: "Smallest gap: a gap of less than 1 cm counts as 1 cm in the following rule",
    state: "our-choice",
    source: "Ours; no source gives it. It makes a vehicle that touches its leader brake hard, where the rule would otherwise divide by zero.",
  },
  {
    id: "rule.entry",
    name: "Entering: a vehicle enters a road only where it has at least its desired following gap, and waits outside the network until then",
    state: "our-choice",
    source: "Ours; no source gives it. It keeps a full road from being overfilled; the vehicles left waiting are counted and shown with the results.",
  },
  {
    id: "rule.signal",
    name: "Signals: a signal that is not green acts as a stopped vehicle at the stop line across the whole approach; a vehicle is let in only on green, and only if it can reach the stop line before the amber ends",
    state: "our-choice",
    source:
      "Ours. Treating a red signal as a stopped vehicle is common practice in simulators; when a vehicle asks " +
      "(as near the stop line as the gap the following rule wants to a stopped vehicle) and the amber test are our own.",
    note: "A vehicle let in late and then slowed by the vehicle ahead can cross a moment after the red begins.",
  },
  {
    id: "rule.let-in-order",
    name: "Order in a junction: vehicles are let in one after another, each only after the vehicles ahead of it in its strips, and where the paths of two cross the one let in first goes first",
    state: "our-choice",
    source:
      "Ours; no source gives it. One order for the whole junction means vehicles inside it cannot end up waiting for each other in a ring.",
    note: "A turn across oncoming traffic therefore waits for a longer gap than a driver would take.",
  },
  {
    id: "rule.crossing-paths",
    name: "Crossing paths: where the strips of two connections cross is found when the network loads; a vehicle is let in only if each such place will be free when it gets there, and stops short of one that is not",
    state: "our-choice",
    source:
      "Ours. Reserving a time at each point where paths cross is the general idea of conflict-point junction models; " +
      "doing it strip by strip, and how times are estimated, are our own. No other simulator's code was used.",
  },
  {
    id: "rule.keep-clear",
    name: "Keep clear: a vehicle enters a junction only if the road beyond has room for it, allowing for the vehicles already let in and for the distance the last vehicle there covers if it brakes comfortably to a stop",
    state: "our-choice",
    source: "Ours; no source gives it. If the vehicle ahead brakes harder than comfortably, a vehicle can be left standing in the junction for a moment.",
  },
  {
    id: "rule.turning",
    name: "Turning: inside a junction a vehicle keeps the strips it entered in and follows its turning path; it enters the network in strips that lead onto its turn",
    state: "our-choice",
    source:
      "Ours; no source gives it. Vehicles do not sort themselves by turn before the stop line, so a vehicle turning " +
      "right from the left of an approach waits for the traffic beside it.",
  },
  {
    id: "rule.levels",
    name: "Flyovers: a flyover is a road of its own that shares no junction with what it passes over; a vehicle looks for neighbours only on its own road and in the junction it is in, so traffic on a flyover and traffic beneath it never react to each other",
    state: "our-choice",
    source:
      "Ours, fixed in the v1 spec. Heights are used for drawing and for checking that vehicles do not overlap; a ramp's " +
      "slope does not slow vehicles, and its length is measured on the plan.",
  },
  {
    id: "rule.diverge-and-merge",
    name: "Diverge and merge: where a flyover leaves the main road and where it rejoins it, the road divides or joins by position across it, with no signal; a vehicle enters the network in the strips that lead onto its route and keeps to them up to the diverge",
    state: "our-choice",
    source:
      "Ours; no source gives it. Roads that join onto a road wide enough for both arrive side by side and share no " +
      "space. Where two roads join onto the same strips, vehicles go first come, first served: each is let in when the " +
      "road beyond has room and the one let in before it is clear. No road has priority, and vehicles do not sort " +
      "themselves for the diverge on the way to it: they are sorted from where they enter.",
  },
  {
    id: "rule.route-choice",
    name: "Route choice: through traffic that can take a flyover or the junction beneath chooses once, when it comes to enter the network, as a probability from each route's measured travel time at that moment; all other traffic takes the fastest path on empty roads",
    state: "our-choice",
    source:
      "Ours (ADR 0006); no source gives it. A route's measured travel time is the mean over the last vehicles of the " +
      "same demand flow to complete it in the last minute, from entering the network to leaving it, or the time so far of the vehicle " +
      "longest on it if that is more; before any vehicle has completed it, its time on empty roads, which knows " +
      "nothing of signals. A vehicle never changes its route afterwards. Equilibrium routing and induced demand are " +
      "not modelled.",
  },
];

/** One assumption as shown to the planner. */
export interface ListedAssumption extends Evidence {
  id: string;
  name: string;
  /** The value the engine uses; a rule has none. */
  value: number | null;
  unit: string;
}

/** Assumptions that belong together: one vehicle class, those shared, the vehicle mix, the rules. */
export interface AssumptionGroup {
  id: string;
  title: string;
  about?: string;
  assumptions: ListedAssumption[];
}

const VEHICLE_CLASS_VALUE_NAMES: Record<keyof VehicleClassValues, { name: string; unit: string }> = {
  lengthM: { name: "Length", unit: "m" },
  widthM: { name: "Width", unit: "m" },
  desiredSpeedMps: { name: "Desired speed on an open road (the road's speed limit caps it)", unit: "m/s" },
  timeGapS: { name: "Following time gap", unit: "s" },
  standstillGapM: { name: "Gap to the vehicle ahead when stopped", unit: "m" },
  maxAccelerationMps2: { name: "Greatest acceleration", unit: "m/s2" },
  comfortableDecelerationMps2: { name: "Comfortable braking", unit: "m/s2" },
  sideClearanceM: { name: "Side clearance in mixed traffic (both sides together)", unit: "m" },
  maxSidewaysSpeedMps: { name: "Greatest sideways speed", unit: "m/s" },
};

const VEHICLE_CLASS_TITLES: Record<VehicleClass, string> = {
  "two-wheeler": "Two-wheeler",
  car: "Car",
  "auto-rickshaw": "Auto-rickshaw",
  bus: "Bus",
};

const SHARED_NAMES: Record<keyof typeof TIME_ASSUMPTIONS | keyof typeof SIDEWAYS_ASSUMPTIONS, string> = {
  stepS: "Step: the engine moves every vehicle once in this much simulated time",
  stripWidthM: "Width of a strip",
  standardLaneWidthM: "Standard lane width",
  gainThresholdMps2: "Gain in acceleration needed for a sideways shift",
  politeness: "Weight given to the braking a sideways shift causes the vehicle behind (0 = none, 1 = as much as one's own gain)",
  safeBrakingMps2: "Hardest braking a sideways shift may cause the vehicle behind",
};

/**
 * Every assumption the engine uses, read from the tables above at the moment of
 * the call, grouped for showing to the planner: each vehicle class, the
 * assumptions all vehicle classes share, the vehicle mix, and the rules.
 */
export function listAssumptions(): AssumptionGroup[] {
  const perClass: AssumptionGroup[] = VEHICLE_CLASSES.map((vehicleClass) => {
    const assumptions = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass];
    const names = Object.keys(VEHICLE_CLASS_VALUE_NAMES) as (keyof VehicleClassValues)[];
    return {
      id: vehicleClass,
      title: VEHICLE_CLASS_TITLES[vehicleClass],
      about: `Occupies ${stripsOccupied(vehicleClass)} strips in mixed traffic (width plus side clearance, in strips of ${STRIP_WIDTH_M} m).`,
      assumptions: names.map((name) => ({
        id: `${vehicleClass}.${name}`,
        ...VEHICLE_CLASS_VALUE_NAMES[name],
        value: assumptions[name],
        ...assumptions.evidence[name],
      })),
    };
  });

  const shared: Record<string, Assumption> = { ...TIME_ASSUMPTIONS, ...SIDEWAYS_ASSUMPTIONS };
  const sharedGroup: AssumptionGroup = {
    id: "shared",
    title: "Shared by all vehicle classes",
    assumptions: (Object.keys(SHARED_NAMES) as (keyof typeof SHARED_NAMES)[]).map((name) => {
      const { value, unit, state, source, note } = shared[name]!;
      return { id: name, name: SHARED_NAMES[name], value, unit, state, source, note };
    }),
  };

  const junctionGroup: AssumptionGroup = {
    id: "junctions",
    title: "At junctions",
    about: "None of these comes from a measurement.",
    assumptions: (Object.keys(JUNCTION_NAMES) as (keyof typeof JUNCTION_NAMES)[]).map((name) => {
      const { value, unit, state, source } = JUNCTION_ASSUMPTIONS[name];
      return { id: `junction.${name}`, name: JUNCTION_NAMES[name], value, unit, state, source };
    }),
  };

  const routeChoiceGroup: AssumptionGroup = {
    id: "route-choice",
    title: "Choosing between a flyover and the junction beneath",
    about:
      "Through traffic that can take either chooses once, on entering, from each route's measured travel time at that " +
      "moment. None of these comes from a measurement.",
    assumptions: (Object.keys(ROUTE_CHOICE_NAMES) as (keyof typeof ROUTE_CHOICE_NAMES)[]).map((name) => {
      const { value, unit, state, source, note } = (ROUTE_CHOICE_ASSUMPTIONS as Record<string, Assumption>)[name]!;
      return { id: `routeChoice.${name}`, name: ROUTE_CHOICE_NAMES[name], value, unit, state, source, note };
    }),
  };

  const mixGroup: AssumptionGroup = {
    id: "vehicle-mix",
    title: "Vehicle mix for a Bengaluru arterial",
    about: "Offered as a starting point. A scenario's demand carries its own vehicle mix, and the engine uses that one.",
    assumptions: VEHICLE_CLASSES.map((vehicleClass) => ({
      id: `vehicleMix.${vehicleClass}`,
      name: `Share of vehicles: ${VEHICLE_CLASS_TITLES[vehicleClass].toLowerCase()}`,
      value: BENGALURU_VEHICLE_MIX[vehicleClass] ?? 0,
      unit: "of all vehicles",
      ...vehicleMixEvidence(vehicleClass),
    })),
  };

  const rulesGroup: AssumptionGroup = {
    id: "rules",
    title: "Rules",
    about:
      "How the engine uses the values above. The rules marked as our choice come from no publication, and nothing " +
      "published was available to compare them with.",
    assumptions: RULES.map(({ id, name, state, source, note }) => ({ id, name, value: null, unit: "", state, source, note })),
  };

  return [...perClass, sharedGroup, junctionGroup, routeChoiceGroup, mixGroup, rulesGroup];
}
