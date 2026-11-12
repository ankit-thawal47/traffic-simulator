/**
 * Tier 4 of the benchmark standard: Indian mixed traffic, both engines scored against field data
 * and Indian standards, mixed traffic (no lane discipline) in our engine and SUMO's sublane model.
 *
 *  T4.1-T4.4 the Chennai Saidapet section (245 m x 11.2 m), each 15-minute recording period:
 *    mean speed per class, throughput, sideways positions per class, speed-density each minute.
 *  T4.5 mid-block capacity of one carriageway of a 4-lane divided road, Bengaluru vehicle mix, in PCU/h.
 *  T4.6 saturation flow of a signal approach in mixed traffic, in PCU/h, against Indo-HCM's width formula.
 *
 * Both engines run untuned on the engine's published per-class values (fairness rule 4: no tuning,
 * so rule 5's hold-out does not arise). SUMO's side, per its sublane documentation
 * (sumo.dlr.de/docs/Simulation/SublaneModel.html, read 2026-11-12): `--lateral-resolution` no wider
 * than the narrowest vehicle (a two-wheeler, 0.7 m) and dividing the lane width evenly; SL2015; each
 * class's sideways clearance as minGapLat and its sideways speed cap as maxSpeedLat (the same
 * concepts as ours); `latAlignment="arbitrary"` (a vehicle keeps whatever place across the road it
 * has, as there are no lanes to keep to); a road is one lane as wide as the road.
 */
import { VEHICLE_CLASSES, type Network, type RunInput, type VehicleClass, type VehicleMix } from "@traffic-simulator/engine";
import { BENGALURU_VEHICLE_MIX } from "@traffic-simulator/engine";
import { CHENNAI_FILES, CHENNAI_TYPES, readChennai, type Observation } from "./chennai";
import { checkDepartures, engineDepartures } from "./demand-replay";
import { runNetwork, stopLineCrossings } from "./network-run";
import { crossRoads, signalNetwork, writeRouteFile } from "./networks";
import { STEP_S } from "./scenario";
import { forEachFcdRow, runSumoNetwork, writeSumoNetwork } from "./sumo-network";
import { sumoSide, type EngineSide, type SumoSide } from "./tier2";

const SUBLANE_ALIGNMENT = Object.fromEntries(VEHICLE_CLASSES.map((c) => [c, { latAlignment: "arbitrary" }])) as unknown as Record<VehicleClass, Record<string, string>>;

// ---------------------------------------------------------------------------------------------
// T4.1 to T4.4: the Chennai section.

export const CHENNAI = {
  lengthM: 245,
  widthM: 11.2,
  /** The stretch measured, front bumper positions: inside the stretch every vehicle in the data is tracked. */
  zoneFromM: 30,
  zoneToM: 220,
  /** Throughput is counted where front bumpers cross this line. */
  countAtM: 200,
  /** A speed limit above every class's desired speed, so that the classes' own desired speeds apply. */
  speedLimitMps: 20,
  periodS: 900,
  sampleS: 1,
  /** SUMO's sublane width: no wider than a two-wheeler and dividing 11.2 m evenly (28 sublanes). */
  lateralResolutionM: 0.4,
};

/** The measures of T4.1-T4.4, computed the same way from the field data and from either engine. */
export interface SectionMeasure {
  /** Space-mean speed per engine class in the measured stretch: distance covered / time spent, m/s. */
  meanSpeedByClass: Partial<Record<VehicleClass, number>>;
  meanSpeedAll: number;
  /** Front bumpers crossing the counting line, per hour. */
  throughputPerHour: number;
  /** Sideways positions (centre, from the left edge) in the measured stretch, per class: a histogram of 0.2 m bins. */
  lateralHistogramByClass: Partial<Record<VehicleClass, number[]>>;
  /** Each minute: vehicles per km in the stretch (time mean) and space-mean speed. */
  minutes: { densityPerKm: number; speedMps: number }[];
}

const LATERAL_BIN_M = 0.2;
const LATERAL_BINS = Math.ceil(CHENNAI.widthM / LATERAL_BIN_M);

class SectionAccumulator {
  private distance = new Map<string, number>();
  private time = new Map<string, number>();
  private lateral = new Map<VehicleClass, number[]>();
  private minuteCount: number[] = [];
  private minuteSamples: number[] = [];
  private minuteDistance: number[] = [];
  private minuteTime: number[] = [];
  crossings = 0;
  constructor(private periodS: number, private sampleS: number) {}

  /** A vehicle seen in the stretch: its speed over a span of time, its class and sideways place. */
  add(vehicleClass: VehicleClass, speedMps: number, spanS: number, lateralM: number, timeS: number): void {
    for (const key of [vehicleClass, "all"]) {
      this.distance.set(key, (this.distance.get(key) ?? 0) + speedMps * spanS);
      this.time.set(key, (this.time.get(key) ?? 0) + spanS);
    }
    const bins = this.lateral.get(vehicleClass) ?? new Array<number>(LATERAL_BINS).fill(0);
    bins[Math.min(LATERAL_BINS - 1, Math.max(0, Math.floor(lateralM / LATERAL_BIN_M)))]! += spanS;
    this.lateral.set(vehicleClass, bins);
    const minute = Math.min(Math.floor(timeS / 60), Math.floor((this.periodS - 1e-9) / 60));
    this.minuteDistance[minute] = (this.minuteDistance[minute] ?? 0) + speedMps * spanS;
    this.minuteTime[minute] = (this.minuteTime[minute] ?? 0) + spanS;
    this.minuteCount[minute] = (this.minuteCount[minute] ?? 0) + spanS;
  }

  /** A moment at which the stretch was looked at (for density), weighted by the span it stands for. */
  sampled(timeS: number, spanS: number): void {
    const minute = Math.min(Math.floor(timeS / 60), Math.floor((this.periodS - 1e-9) / 60));
    this.minuteSamples[minute] = (this.minuteSamples[minute] ?? 0) + spanS;
  }

  result(): SectionMeasure {
    const meanSpeedByClass: Partial<Record<VehicleClass, number>> = {};
    for (const vehicleClass of VEHICLE_CLASSES) {
      const time = this.time.get(vehicleClass);
      if (time) meanSpeedByClass[vehicleClass] = this.distance.get(vehicleClass)! / time;
    }
    const zoneKm = (CHENNAI.zoneToM - CHENNAI.zoneFromM) / 1000;
    const minutes = [];
    for (let m = 0; m < Math.floor(this.periodS / 60); m++) {
      minutes.push({
        densityPerKm: (this.minuteCount[m] ?? 0) / (this.minuteSamples[m] ?? 1) / zoneKm,
        speedMps: (this.minuteDistance[m] ?? 0) / (this.minuteTime[m] ?? 1),
      });
    }
    return {
      meanSpeedByClass,
      meanSpeedAll: this.distance.get("all")! / this.time.get("all")!,
      throughputPerHour: (this.crossings * 3600) / this.periodS,
      lateralHistogramByClass: Object.fromEntries(this.lateral) as Partial<Record<VehicleClass, number[]>>,
      minutes,
    };
  }
}

export interface ChennaiField {
  file: string;
  vehicles: number;
  observations: number;
  flaggedObservations: number;
  /** Vehicles by the data's own type (1 to 6). */
  vehiclesByType: Record<number, number>;
  /** Mean of the data's own speed column, all observations, by type and overall (what the paper reports). */
  speedColumnMeanByType: Record<number, number>;
  speedColumnMeanAll: number;
  /** The same per engine class, observations in the measured stretch. */
  speedColumnMeanByClass: Partial<Record<VehicleClass, number>>;
  maxFrontM: number;
  minLateralM: number;
  maxLateralM: number;
  lastTimeS: number;
  /** Speed worked out from the positions: distance between successive observations / 0.5 s, mean over all such pairs. */
  positionSpeedMeanAll: number;
  /** The measures, from positions over time (pairs of successive observations 0.5 s apart in the stretch). */
  measure: SectionMeasure;
  /** The demand given to the engines: vehicles per hour and the share of each engine class. */
  demandPerHour: number;
  mix: VehicleMix;
}

/** Field figures for one recording period, every one computed here from the downloaded data. */
export function chennaiField(file: (typeof CHENNAI_FILES)[number]): ChennaiField {
  const rows = readChennai(file);
  const byVehicle = new Map<number, Observation[]>();
  const vehiclesByType: Record<number, number> = {};
  const speedSum: Record<number, number> = {};
  const speedCount: Record<number, number> = {};
  const columnByClass = new Map<VehicleClass, [number, number]>();
  let flagged = 0;
  let maxFrontM = 0;
  let minLateralM = Infinity;
  let maxLateralM = -Infinity;
  let lastTimeS = 0;
  for (const row of rows) {
    const list = byVehicle.get(row.vehicle);
    if (list) list.push(row);
    else {
      byVehicle.set(row.vehicle, [row]);
      vehiclesByType[row.type] = (vehiclesByType[row.type] ?? 0) + 1;
    }
    speedSum[row.type] = (speedSum[row.type] ?? 0) + row.speedMps;
    speedCount[row.type] = (speedCount[row.type] ?? 0) + 1;
    if (row.frontM >= CHENNAI.zoneFromM && row.frontM <= CHENNAI.zoneToM) {
      const c = CHENNAI_TYPES[row.type]!.engineClass;
      const entry = columnByClass.get(c) ?? [0, 0];
      columnByClass.set(c, [entry[0] + row.speedMps, entry[1] + 1]);
    }
    if (row.flag !== 0) flagged++;
    maxFrontM = Math.max(maxFrontM, row.frontM);
    minLateralM = Math.min(minLateralM, row.lateralM);
    maxLateralM = Math.max(maxLateralM, row.lateralM);
    lastTimeS = Math.max(lastTimeS, row.timeS);
  }
  const acc = new SectionAccumulator(CHENNAI.periodS, 0.5);
  let positionSpeedSum = 0;
  let positionSpeedCount = 0;
  const times = new Set<number>();
  for (const list of byVehicle.values()) {
    list.sort((a, b) => a.timeS - b.timeS);
    const vehicleClass = CHENNAI_TYPES[list[0]!.type]!.engineClass;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]!;
      const b = list[i]!;
      const span = b.timeS - a.timeS;
      if (span <= 0 || span > 0.5 + 1e-9) continue;
      const speed = (b.frontM - a.frontM) / span;
      positionSpeedSum += speed;
      positionSpeedCount++;
      if (a.frontM < CHENNAI.countAtM && b.frontM >= CHENNAI.countAtM && b.timeS <= CHENNAI.periodS) acc.crossings++;
      const mid = (a.frontM + b.frontM) / 2;
      if (mid < CHENNAI.zoneFromM || mid > CHENNAI.zoneToM || a.timeS >= CHENNAI.periodS) continue;
      acc.add(vehicleClass, speed, span, (a.lateralM + b.lateralM) / 2, a.timeS);
    }
  }
  for (const row of rows) times.add(row.timeS);
  for (let t = 0; t < CHENNAI.periodS; t += 0.5) acc.sampled(t, 0.5);
  const speedColumnMeanByType: Record<number, number> = {};
  for (const type of Object.keys(speedSum)) speedColumnMeanByType[Number(type)] = speedSum[Number(type)]! / speedCount[Number(type)]!;
  const speedColumnMeanByClass: Partial<Record<VehicleClass, number>> = {};
  for (const [c, [sum, n]] of columnByClass) speedColumnMeanByClass[c] = sum / n;
  const mix: VehicleMix = {};
  for (const [type, count] of Object.entries(vehiclesByType)) {
    const c = CHENNAI_TYPES[Number(type)]!.engineClass;
    mix[c] = (mix[c] ?? 0) + count / byVehicle.size;
  }
  return {
    file,
    vehicles: byVehicle.size,
    observations: rows.length,
    flaggedObservations: flagged,
    vehiclesByType,
    speedColumnMeanByType,
    speedColumnMeanAll: Object.values(speedSum).reduce((a, b) => a + b, 0) / Object.values(speedCount).reduce((a, b) => a + b, 0),
    speedColumnMeanByClass,
    maxFrontM,
    minLateralM,
    maxLateralM,
    lastTimeS,
    positionSpeedMeanAll: positionSpeedSum / positionSpeedCount,
    measure: acc.result(),
    demandPerHour: (byVehicle.size * 3600) / CHENNAI.periodS,
    mix,
  };
}

export interface T4ChennaiResult {
  period: number;
  seed: number;
  ours: SectionMeasure & EngineSide;
  sumo: (SectionMeasure & SumoSide) | null;
}

function chennaiInput(field: Pick<ChennaiField, "demandPerHour" | "mix">, seed: number): RunInput {
  const network: Network = {
    formatVersion: 4,
    roads: [{ id: "section", points: [{ x: 0, y: 0 }, { x: CHENNAI.lengthM, y: 0 }], widthM: CHENNAI.widthM, lanes: 3, speedLimitMps: CHENNAI.speedLimitMps }],
  };
  return {
    network,
    demand: { flows: [{ entryRoadId: "section", exitRoadId: "section", vehiclesPerHour: field.demandPerHour }], vehicleMix: field.mix },
    seed,
    laneDiscipline: false,
  };
}

/**
 * One period of the Chennai section through both engines. The engine cannot be given an arrival
 * schedule, so it is given the period's observed rate and class mix as its demand (Poisson
 * arrivals); SUMO is given the identical departures.
 */
export function runT4Chennai(job: { period: number; seed: number; demandPerHour: number; mix: VehicleMix }, context: { workDir: string; sumo: boolean }): T4ChennaiResult {
  const input = chennaiInput(job, job.seed);
  const durationS = CHENNAI.periodS;
  const departures = engineDepartures(input, durationS);
  const acc = new SectionAccumulator(durationS, CHENNAI.sampleS);
  const last = new Map<number, number>();
  const sampleEvery = Math.round(CHENNAI.sampleS / STEP_S);
  let step = 0;
  const run = runNetwork(input, {
    durationS,
    observe: (snapshot, results) => {
      for (const vehicle of snapshot.vehicles) {
        const before = last.get(vehicle.id);
        if (before !== undefined && before < CHENNAI.countAtM && vehicle.positionM >= CHENNAI.countAtM) acc.crossings++;
        last.set(vehicle.id, vehicle.positionM);
      }
      if (step % sampleEvery === 0 && snapshot.timeS < durationS) {
        acc.sampled(snapshot.timeS, CHENNAI.sampleS);
        for (const vehicle of snapshot.vehicles) {
          if (vehicle.positionM < CHENNAI.zoneFromM || vehicle.positionM > CHENNAI.zoneToM) continue;
          acc.add(vehicle.vehicleClass, vehicle.speedMps, CHENNAI.sampleS, vehicle.lateralM, snapshot.timeS);
        }
      }
      if (Math.abs(snapshot.timeS - durationS) < STEP_S / 2) checkDepartures(departures, results);
      step++;
    },
  });
  const ours = { ...acc.result(), stuckVehicles: run.stuckVehicles, conservationViolations: run.conservationViolations, wallClockS: run.wallClockS };

  let sumo: T4ChennaiResult["sumo"] = null;
  if (context.sumo) {
    const net = writeSumoNetwork(input.network, context.workDir, { laneDiscipline: false });
    const classes = VEHICLE_CLASSES.filter((c) => (job.mix[c] ?? 0) > 0);
    const routesFile = writeRouteFile(context.workDir, {
      network: input.network,
      departures,
      classes,
      sublane: true,
      departLane: "0",
      departPosLat: "free",
      extraVTypeAttributes: SUBLANE_ALIGNMENT,
    });
    const summary = runSumoNetwork(net, {
      routesFile,
      durationS,
      seed: job.seed,
      lateralResolutionM: CHENNAI.lateralResolutionM,
      fcd: { attributes: "id,type,speed,pos,posLat", period: CHENNAI.sampleS },
    });
    const sumoAcc = new SectionAccumulator(durationS, CHENNAI.sampleS);
    const lastPos = new Map<string, number>();
    let sampleTime = -1;
    forEachFcdRow(summary.fcdFile!, (row) => {
      const t = Number(row.time);
      if (t >= durationS) return;
      if (t !== sampleTime) {
        sampleTime = t;
        sumoAcc.sampled(t, CHENNAI.sampleS);
      }
      const pos = Number(row.pos);
      const before = lastPos.get(row.id!);
      if (before !== undefined && before < CHENNAI.countAtM && pos >= CHENNAI.countAtM) sumoAcc.crossings++;
      lastPos.set(row.id!, pos);
      if (pos < CHENNAI.zoneFromM || pos > CHENNAI.zoneToM) return;
      // posLat is measured from the lane's centre. In a left-hand network it is positive towards the
      // right of the direction of travel: checked on this network, a vehicle given departPosLat="left"
      // runs at posLat +4.65 on the right-hand side of the road (y = -4.65 heading east).
      sumoAcc.add(row.type as VehicleClass, Number(row.speed), CHENNAI.sampleS, CHENNAI.widthM / 2 + Number(row.posLat), t);
    });
    // A vehicle that crosses the line between two samples taken a second apart is counted at the later one;
    // one that leaves the road before the next sample is counted from the trip records instead.
    sumo = { ...sumoAcc.result(), ...sumoSide(summary) };
  }
  return { period: job.period, seed: job.seed, ours, sumo };
}

/** Earth mover's (Wasserstein-1) distance between two histograms on the same bins, in metres. */
export function earthMoversM(a: number[], b: number[]): number {
  const sa = a.reduce((x, y) => x + y, 0);
  const sb = b.reduce((x, y) => x + y, 0);
  let carried = 0;
  let total = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    carried += (a[i] ?? 0) / sa - (b[i] ?? 0) / sb;
    total += Math.abs(carried) * LATERAL_BIN_M;
  }
  return total;
}

// ---------------------------------------------------------------------------------------------
// T4.5 Mid-block capacity of one carriageway of a 4-lane divided road.

export const T45 = {
  /** Indo-HCM's nominal width of one carriageway of a 4-lane divided road: 2 x 3.5 m + 2 x 0.25 m kerb shyness. */
  widthM: 7.5,
  lengthM: 500,
  countAtM: 400,
  demandPerHour: 20000,
  warmUpS: 300,
  measureS: 1800,
  speedLimitMps: 13.9,
  lateralResolutionM: 0.5,
};

/**
 * Passenger car units for urban midblocks, 4-lane divided (Indo-HCM 2017, Table 5.3, medians as
 * read by the project's research agent from a third-party copy of the manual whose table layout
 * was scrambled; column mapping flagged uncertain there). Secondary; not confirmed from the primary text.
 */
export const INDO_HCM_MIDBLOCK_PCU: Record<VehicleClass, number> = { "two-wheeler": 0.2, car: 1.0, "auto-rickshaw": 0.8, bus: 4.58 };
/** Base capacity of one direction of a 4-lane divided urban road, PCU/h (Indo-HCM 2017, Table 5.4, as read by the research agent; secondary). */
export const INDO_HCM_4LANE_CAPACITY_PER_DIRECTION = 2700;

export interface CapacityMeasure {
  vehiclesPerHour: number;
  pcuPerHour: number;
  byClassPerHour: Partial<Record<VehicleClass, number>>;
}

export interface T45Result {
  seed: number;
  ours: CapacityMeasure & EngineSide;
  sumo: (CapacityMeasure & SumoSide) | null;
}

function pcu(byClass: Partial<Record<VehicleClass, number>>, factors: Record<VehicleClass, number>): number {
  return VEHICLE_CLASSES.reduce((sum, c) => sum + (byClass[c] ?? 0) * factors[c], 0);
}

export function runT45(job: { seed: number }, context: { workDir: string; sumo: boolean }): T45Result {
  const network: Network = {
    formatVersion: 4,
    roads: [{ id: "carriageway", points: [{ x: 0, y: 0 }, { x: T45.lengthM, y: 0 }], widthM: T45.widthM, lanes: 2, speedLimitMps: T45.speedLimitMps }],
  };
  const input: RunInput = {
    network,
    demand: { flows: [{ entryRoadId: "carriageway", exitRoadId: "carriageway", vehiclesPerHour: T45.demandPerHour }], vehicleMix: BENGALURU_VEHICLE_MIX },
    seed: job.seed,
    laneDiscipline: false,
  };
  const durationS = T45.warmUpS + T45.measureS;
  const departures = engineDepartures(input, durationS);
  const counted: Partial<Record<VehicleClass, number>> = {};
  const last = new Map<number, number>();
  const run = runNetwork(input, {
    durationS,
    observe: (snapshot, results) => {
      for (const vehicle of snapshot.vehicles) {
        const before = last.get(vehicle.id);
        if (before !== undefined && before < T45.countAtM && vehicle.positionM >= T45.countAtM && snapshot.timeS > T45.warmUpS) {
          counted[vehicle.vehicleClass] = (counted[vehicle.vehicleClass] ?? 0) + 1;
        }
        last.set(vehicle.id, vehicle.positionM);
      }
      if (Math.abs(snapshot.timeS - durationS) < STEP_S / 2) checkDepartures(departures, results);
    },
  });
  const toMeasure = (byClass: Partial<Record<VehicleClass, number>>): CapacityMeasure => {
    const perHour = Object.fromEntries(Object.entries(byClass).map(([c, n]) => [c, (n! * 3600) / T45.measureS])) as Partial<Record<VehicleClass, number>>;
    return {
      vehiclesPerHour: Object.values(perHour).reduce((a, b) => a + b!, 0),
      pcuPerHour: pcu(perHour, INDO_HCM_MIDBLOCK_PCU),
      byClassPerHour: perHour,
    };
  };
  const ours = { ...toMeasure(counted), stuckVehicles: run.stuckVehicles, conservationViolations: run.conservationViolations, wallClockS: run.wallClockS };
  let sumo: T45Result["sumo"] = null;
  if (context.sumo) {
    const net = writeSumoNetwork(network, context.workDir, { laneDiscipline: false });
    const routesFile = writeRouteFile(context.workDir, {
      network,
      departures,
      classes: [...VEHICLE_CLASSES],
      sublane: true,
      departLane: "0",
      departPosLat: "free",
      extraVTypeAttributes: SUBLANE_ALIGNMENT,
    });
    const summary = runSumoNetwork(net, {
      routesFile,
      durationS,
      seed: job.seed,
      lateralResolutionM: T45.lateralResolutionM,
      fcd: { attributes: "id,type,pos", beginS: T45.warmUpS - 5 },
    });
    const sumoCounted: Partial<Record<VehicleClass, number>> = {};
    const lastPos = new Map<string, number>();
    forEachFcdRow(summary.fcdFile!, (row) => {
      const pos = Number(row.pos);
      const before = lastPos.get(row.id!);
      if (before !== undefined && before < T45.countAtM && pos >= T45.countAtM && Number(row.time) > T45.warmUpS) {
        sumoCounted[row.type as VehicleClass] = (sumoCounted[row.type as VehicleClass] ?? 0) + 1;
      }
      lastPos.set(row.id!, pos);
    });
    sumo = { ...toMeasure(sumoCounted), ...sumoSide(summary) };
  }
  return { seed: job.seed, ours, sumo };
}

// ---------------------------------------------------------------------------------------------
// T4.6 Saturation flow of a signal approach in mixed traffic.

export const T46 = {
  /** Approach width; Indo-HCM's formula holds for 7 to 10.5 m. */
  widthM: 7.0,
  armLengthM: 300,
  demandPerHour: 6000,
  plan: {
    phases: [
      { greenRoadIds: ["south-in"], greenS: 40 },
      { greenRoadIds: ["west-in"], greenS: 20 },
    ],
    amberS: 3,
    allRedS: 2,
  },
  warmUpS: 300,
  measureS: 1800,
  /** Of each green, the first seconds (start-up) are left out of the saturation flow. */
  skipGreenStartS: 6,
  lateralResolutionM: 0.5,
};

/** Passenger car units at signalised intersections (Indo-HCM 2017, Table 6.3, as read by the research agent; secondary, mapping uncertain). */
export const INDO_HCM_SIGNAL_PCU: Record<VehicleClass, number> = { "two-wheeler": 0.4, car: 1.0, "auto-rickshaw": 0.5, bus: 1.6 };

/** Indo-HCM 2017 base saturation flow of an approach W metres wide (7 <= W <= 10.5): W (1140 - 60 W) PCU/h (as the research agent read it; secondary). */
export function indoHcmSaturationFlow(widthM: number): number {
  return widthM * (1140 - 60 * widthM);
}

export interface T46Result {
  seed: number;
  /** Vehicles crossing the stop line per hour of green (the start-up seconds left out), and in PCU/h. */
  ours: CapacityMeasure & EngineSide;
  sumo: (CapacityMeasure & SumoSide) | null;
}

export function runT46(job: { seed: number }, context: { workDir: string; sumo: boolean }): T46Result {
  const roads = crossRoads({ lanes: 2, laneWidthM: T46.widthM / 2, armLengthM: T46.armLengthM, halfGapM: 15, speedLimitMps: 13.9 }).filter((road) =>
    ["south-in", "north-out", "west-in", "east-out"].includes(road.id),
  );
  const network = signalNetwork(roads, [
    { fromRoadId: "south-in", toRoadId: "north-out" },
    { fromRoadId: "west-in", toRoadId: "east-out" },
  ], T46.plan);
  const input: RunInput = {
    network,
    demand: { flows: [{ entryRoadId: "south-in", exitRoadId: "north-out", vehiclesPerHour: T46.demandPerHour }], vehicleMix: BENGALURU_VEHICLE_MIX },
    seed: job.seed,
    laneDiscipline: false,
  };
  const durationS = T46.warmUpS + T46.measureS;
  const departures = engineDepartures(input, durationS);
  const cycle = T46.plan.phases.reduce((s, p) => s + p.greenS + T46.plan.amberS + T46.plan.allRedS, 0);
  const green = T46.plan.phases[0]!.greenS;
  /** Counted: in the measured time, in the main road's green after its start-up seconds. */
  const counts = (t: number) => {
    if (t <= T46.warmUpS || t > durationS) return false;
    const into = t % cycle;
    return into >= T46.skipGreenStartS && into < green;
  };
  let countedGreenS = 0;
  for (let t = 0; t < durationS; t += STEP_S) if (counts(t + STEP_S / 2)) countedGreenS += STEP_S;
  const crossing = stopLineCrossings("south-in", T46.armLengthM);
  const classOf = new Map<number, VehicleClass>();
  const run = runNetwork(input, {
    durationS,
    observe: (snapshot, results) => {
      for (const vehicle of snapshot.vehicles) classOf.set(vehicle.id, vehicle.vehicleClass);
      crossing.observe(snapshot);
      if (Math.abs(snapshot.timeS - durationS) < STEP_S / 2) checkDepartures(departures, results);
    },
  });
  const toMeasure = (byClass: Partial<Record<VehicleClass, number>>): CapacityMeasure => {
    const perHour = Object.fromEntries(Object.entries(byClass).map(([c, n]) => [c, (n! * 3600) / countedGreenS])) as Partial<Record<VehicleClass, number>>;
    return { vehiclesPerHour: Object.values(perHour).reduce((a, b) => a + b!, 0), pcuPerHour: pcu(perHour, INDO_HCM_SIGNAL_PCU), byClassPerHour: perHour };
  };
  const counted: Partial<Record<VehicleClass, number>> = {};
  for (const [id, time] of crossing.crossings) {
    if (!counts(time)) continue;
    const c = classOf.get(id)!;
    counted[c] = (counted[c] ?? 0) + 1;
  }
  const ours = { ...toMeasure(counted), stuckVehicles: run.stuckVehicles, conservationViolations: run.conservationViolations, wallClockS: run.wallClockS };
  let sumo: T46Result["sumo"] = null;
  if (context.sumo) {
    const net = writeSumoNetwork(network, context.workDir, { laneDiscipline: false });
    const routesFile = writeRouteFile(context.workDir, {
      network,
      departures,
      classes: [...VEHICLE_CLASSES],
      sublane: true,
      departLane: "0",
      departPosLat: "free",
      extraVTypeAttributes: SUBLANE_ALIGNMENT,
    });
    const summary = runSumoNetwork(net, {
      routesFile,
      durationS,
      seed: job.seed,
      lateralResolutionM: T46.lateralResolutionM,
      fcd: { attributes: "id,type,pos,lane", beginS: T46.warmUpS - 5 },
    });
    const edgeLength = net.edgeLengthM.get("south-in")!;
    const lastSeen = new Map<string, { t: number; pos: number }>();
    const sumoCounted: Partial<Record<VehicleClass, number>> = {};
    const done = new Set<string>();
    forEachFcdRow(summary.fcdFile!, (row) => {
      const id = row.id!;
      if (done.has(id)) return;
      const t = Number(row.time);
      if (row.lane === "south-in_0") {
        lastSeen.set(id, { t, pos: Number(row.pos) });
        return;
      }
      const before = lastSeen.get(id);
      if (!before) return;
      done.add(id);
      const travelled = edgeLength - before.pos + Number(row.pos);
      const crossedAt = before.t + ((edgeLength - before.pos) / Math.max(travelled, 1e-9)) * (t - before.t);
      if (counts(crossedAt)) sumoCounted[row.type as VehicleClass] = (sumoCounted[row.type as VehicleClass] ?? 0) + 1;
    });
    sumo = { ...toMeasure(sumoCounted), ...sumoSide(summary) };
  }
  return { seed: job.seed, ours, sumo };
}
