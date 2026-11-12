/**
 * Tier 2 of the benchmark standard: one junction, cars only, lane discipline on.
 *
 *  T2.1 queue discharge at a signal, one lane: saturation flow against SUMO and the IDM-implied headway.
 *  T2.2 fixed-time signal, demand 30% to 100% of capacity: mean delay against Webster's formula and SUMO.
 *  T2.3 priority junction: minor-road capacity as major-road flow rises (needs ticket 08 in the engine).
 *  T2.4 four-way junction, all approaches saturated, 30 minutes: stuck vehicles and teleports.
 */
import { listAssumptions, type Network, type RunInput, type Snapshot } from "@traffic-simulator/engine";
import { checkDepartures, engineDepartures } from "./demand-replay";
import { runNetwork, stopLineCrossings } from "./network-run";
import { allMovements, crossRoads, fastestRoute, signalNetwork, writeRouteFile, type CrossOptions } from "./networks";
import { integratePlatoon, integrateSignalQueue } from "./reference";
import { CAR, STEP_S } from "./scenario";
import { forEachFcdRow, readTripinfo, runSumoNetwork, writeSumoNetwork, type SumoNetworkRunSummary } from "./sumo-network";

/** What is reported about SUMO's side of every run (fairness rule 7). */
export interface SumoSide {
  teleports: number;
  collisions: number;
  emergencyBraking: number;
  warningCount: number;
  warnings: string[];
  wallClockS: number;
}

export function sumoSide(summary: SumoNetworkRunSummary): SumoSide {
  return {
    teleports: summary.teleports,
    collisions: summary.collisions,
    emergencyBraking: summary.emergencyBraking,
    warningCount: summary.warningCount,
    warnings: summary.warnings,
    wallClockS: summary.wallClockS,
  };
}

/** What is reported about our engine's side of every run (fairness rule 7). */
export interface EngineSide {
  stuckVehicles: number;
  conservationViolations: number;
  wallClockS: number;
}

// ---------------------------------------------------------------------------------------------
// T2.1 Queue discharge at a signal, one lane.

export const T21 = {
  queueLength: 30,
  /** The cars start at rest this far apart (front to front) and close up to the red under each engine's own rules. */
  startSpacingM: 12,
  armLengthM: 500,
  halfGapM: 10,
  /** The cross street has green first, so the queue forms at a red and stands until the main road's green. */
  plan: {
    phases: [
      { greenRoadIds: ["west-in"], greenS: 85 },
      { greenRoadIds: ["south-in"], greenS: 90 },
    ],
    amberS: 3,
    allRedS: 2,
  },
  /** The main road's green starts at 85 + 3 + 2 s. */
  greenStartS: 90,
  durationS: 190,
  /** Headways counted from this vehicle in the queue (1 = the first) to the last: the usual convention. */
  firstCountedVehicle: 5,
};

function t21Network(): Network {
  const options: CrossOptions = {
    lanes: 1,
    laneWidthM: 3.5,
    armLengthM: T21.armLengthM,
    halfGapM: T21.halfGapM,
    speedLimitMps: CAR.desiredSpeedMps,
    arms: ["south", "north", "west", "east"],
  };
  const roads = crossRoads(options).filter((road) => ["south-in", "north-out", "west-in", "east-out"].includes(road.id));
  return signalNetwork(
    roads,
    [
      { fromRoadId: "south-in", toRoadId: "north-out" },
      { fromRoadId: "west-in", toRoadId: "east-out" },
    ],
    T21.plan,
  );
}

/** Front bumpers of the cars at the start: the first its standstill gap short of the stop line, the rest spread out behind. */
function t21Start(): number[] {
  return Array.from({ length: T21.queueLength }, (_, k) => T21.armLengthM - CAR.standstillGapM - k * T21.startSpacingM);
}

/** The reference's standing queue: the first car its standstill gap short of the stop line, the rest at their standstill gaps. */
function t21Queue(): number[] {
  return Array.from({ length: T21.queueLength }, (_, k) => T21.armLengthM - CAR.standstillGapM - k * (CAR.lengthM + CAR.standstillGapM));
}

export interface DischargeMeasure {
  /** Moments the front bumpers crossed the stop line, seconds after the green started, queue order. */
  crossingsS: number[];
  /** Mean headway from the counted vehicle to the last, s. */
  saturationHeadwayS: number;
  saturationFlowPerHour: number;
  /** Mean headway of the last ten vehicles, s. */
  lastTenHeadwayS: number;
  /** Start-up lost time: the first counted crossing time less (its place in the queue) x headway, s. */
  startUpLostS: number;
}

export function dischargeMeasure(crossingsS: number[]): DischargeMeasure {
  const first = T21.firstCountedVehicle - 1;
  const n = crossingsS.length;
  const headway = (crossingsS[n - 1]! - crossingsS[first - 1]!) / (n - first);
  const lastTen = (crossingsS[n - 1]! - crossingsS[n - 11]!) / 10;
  return {
    crossingsS,
    saturationHeadwayS: headway,
    saturationFlowPerHour: 3600 / headway,
    lastTenHeadwayS: lastTen,
    // HCM-style: the time the first `first` vehicles took beyond `first` saturation headways.
    startUpLostS: crossingsS[first - 1]! - first * headway,
  };
}

export interface T21Result {
  /** The IDM integrated at 0.001 s through the same red and green, from the same starting positions. */
  reference: DischargeMeasure;
  /** For information: the IDM from a queue standing at exactly the standstill gap (what a long red tends to). */
  referenceIdealQueue: DischargeMeasure;
  ours: (DischargeMeasure & EngineSide) | null;
  sumo: (DischargeMeasure & SumoSide & { internalLaneLengthM: number }) | null;
  junctionPathM: number;
  oursNote: string | null;
}

/** The IDM reference: the same cars from the same places, through the same red and green, at 0.001 s. */
export function t21Reference(): DischargeMeasure {
  return dischargeMeasure(integrateSignalQueue(CAR, t21Start(), T21.armLengthM, T21.greenStartS, T21.durationS));
}

/** The IDM from a queue standing at exactly its standstill gaps, from the moment of green. */
export function t21IdealQueueReference(): DischargeMeasure {
  const fronts = t21Queue();
  const sample = 0.01;
  const reference = integratePlatoon(
    CAR,
    fronts.map((frontM) => ({ frontM, speedMps: 0 })),
    80,
    sample,
  );
  const crossings = reference.frontM.map((series) => {
    for (let k = 1; k < series.length; k++) {
      if (series[k]! >= T21.armLengthM) {
        const fraction = (T21.armLengthM - series[k - 1]!) / (series[k]! - series[k - 1]!);
        return (k - 1 + fraction) * sample;
      }
    }
    return NaN;
  });
  return dischargeMeasure(crossings);
}

export function runT21(context: { workDir: string; sumo: boolean }): T21Result {
  const network = t21Network();
  const fronts = t21Start();
  const input: RunInput = {
    network,
    demand: { flows: [] },
    seed: 1,
    laneDiscipline: true,
    initialVehicles: fronts.map((positionM) => ({ roadId: "south-in", positionM, speedMps: 0, vehicleClass: "car", exitRoadId: "north-out" })),
  };
  const crossing = stopLineCrossings("south-in", T21.armLengthM);
  const run = runNetwork(input, { durationS: T21.durationS, observe: (snapshot) => crossing.observe(snapshot) });
  const ids = fronts.map((_, index) => index + 1);
  let ours: T21Result["ours"] = null;
  let oursNote: string | null = null;
  if (ids.every((id) => crossing.crossings.has(id))) {
    ours = {
      ...dischargeMeasure(ids.map((id) => crossing.crossings.get(id)! - T21.greenStartS)),
      stuckVehicles: run.stuckVehicles,
      conservationViolations: run.conservationViolations,
      wallClockS: run.wallClockS,
    };
  } else {
    oursNote = `${ids.filter((id) => crossing.crossings.has(id)).length} of ${ids.length} cars crossed the stop line in ${T21.durationS} s`;
  }

  let sumo: T21Result["sumo"] = null;
  if (context.sumo) {
    const net = writeSumoNetwork(network, context.workDir, { laneDiscipline: true });
    const route = fastestRoute(network, "south-in", "north-out");
    const routesFile = writeRouteFile(context.workDir, {
      network,
      departures: [],
      classes: ["car"],
      sublane: false,
      placed: fronts.map((frontM, index) => ({ id: `q${index}`, route, lane: 0, frontM, speedMps: 0, vehicleClass: "car" })),
    });
    const summary = runSumoNetwork(net, { routesFile, durationS: T21.durationS, seed: 1, fcd: { attributes: "id,speed,pos,lane" } });
    const edgeLength = net.edgeLengthM.get("south-in")!;
    const last = new Map<string, { timeS: number; pos: number }>();
    const crossed = new Map<string, number>();
    forEachFcdRow(summary.fcdFile!, (row) => {
      const id = row.id!;
      if (crossed.has(id)) return;
      const timeS = Number(row.time);
      const pos = Number(row.pos);
      if (row.lane === "south-in_0") {
        last.set(id, { timeS, pos });
      } else {
        const before = last.get(id);
        if (!before) return;
        const onInternal = row.lane!.startsWith(":");
        const travelled = edgeLength - before.pos + (onInternal ? pos : (net.connectionLengthM.get("south-in>north-out") ?? 0) + pos);
        crossed.set(id, before.timeS + ((edgeLength - before.pos) / travelled) * (timeS - before.timeS));
      }
    });
    const times = fronts.map((_, index) => crossed.get(`q${index}`));
    if (times.every((time) => time !== undefined)) {
      sumo = {
        ...dischargeMeasure(times.map((time) => time! - T21.greenStartS)),
        ...sumoSide(summary),
        internalLaneLengthM: net.connectionLengthM.get("south-in>north-out") ?? NaN,
      };
    }
  }
  return { reference: t21Reference(), referenceIdealQueue: t21IdealQueueReference(), ours, sumo, junctionPathM: 2 * T21.halfGapM, oursNote };
}

// ---------------------------------------------------------------------------------------------
// T2.2 Fixed-time signal, demand from 30% to 100% of capacity: Webster's delay.

export const T22 = {
  plan: {
    phases: [
      { greenRoadIds: ["south-in"], greenS: 30 },
      { greenRoadIds: ["west-in"], greenS: 30 },
    ],
    amberS: 3,
    allRedS: 2,
  },
  armLengthM: 500,
  warmUpS: 600,
  measureS: 3600,
  /** After the measured hour, time for the vehicles produced in it to get through. */
  drainS: 900,
  shares: [0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0],
};

export const T22_CYCLE_S = T22.plan.phases.reduce((sum, phase) => sum + phase.greenS + T22.plan.amberS + T22.plan.allRedS, 0);

/**
 * The reference's capacity of the main approach: saturation flow and start-up lost time from the
 * IDM reference of T2.1; effective green = green + amber - start-up lost time (the amber is taken
 * as used to its end, as both engines let a car that can reach the stop line in time go on).
 */
let t21ReferenceCache: DischargeMeasure | undefined;

export function t22Capacity(): { saturationFlowPerHour: number; effectiveGreenS: number; cycleS: number; capacityPerHour: number } {
  const reference = (t21ReferenceCache ??= t21Reference());
  const effectiveGreenS = T22.plan.phases[0]!.greenS + T22.plan.amberS - reference.startUpLostS;
  return {
    saturationFlowPerHour: reference.saturationFlowPerHour,
    effectiveGreenS,
    cycleS: T22_CYCLE_S,
    capacityPerHour: (reference.saturationFlowPerHour * effectiveGreenS) / T22_CYCLE_S,
  };
}

/** Webster's (1958) mean delay per vehicle at a fixed-time signal with random arrivals, s. */
export function websterDelayS(cycleS: number, effectiveGreenS: number, flowPerHour: number, saturationFlowPerHour: number): number {
  const lambda = effectiveGreenS / cycleS;
  const q = flowPerHour / 3600;
  const s = saturationFlowPerHour / 3600;
  const x = q / (lambda * s);
  if (x >= 1) return Infinity;
  return (
    (cycleS * (1 - lambda) ** 2) / (2 * (1 - lambda * x)) +
    (x * x) / (2 * q * (1 - x)) -
    0.65 * Math.cbrt(cycleS / (q * q)) * Math.pow(x, 2 + 5 * lambda)
  );
}

export interface DelayMeasure {
  /** Vehicles that left the end of the road beyond the junction during the measured hour, per hour. */
  throughPerHour: number;
  /** Vehicles the demand produced in the measured hour. */
  vehicles: number;
  /** Of them, those that had not left the network by the end of the run (their delay so far is used). */
  unfinished: number;
  meanDelayS: number;
}

export interface T22Result {
  share: number;
  seed: number;
  flowPerHour: number;
  ours: DelayMeasure & EngineSide;
  sumo: (DelayMeasure & SumoSide) | null;
}

function t22Network(): Network {
  const roads = crossRoads({ lanes: 1, laneWidthM: 3.5, armLengthM: T22.armLengthM, halfGapM: 10, speedLimitMps: CAR.desiredSpeedMps }).filter(
    (road) => ["south-in", "north-out", "west-in", "east-out"].includes(road.id),
  );
  return signalNetwork(
    roads,
    [
      { fromRoadId: "south-in", toRoadId: "north-out" },
      { fromRoadId: "west-in", toRoadId: "east-out" },
    ],
    T22.plan,
  );
}

export function runT22(job: { share: number; seed: number }, context: { workDir: string; sumo: boolean }): T22Result {
  const network = t22Network();
  const flowPerHour = job.share * t22Capacity().capacityPerHour;
  const input: RunInput = {
    network,
    demand: { flows: [{ entryRoadId: "south-in", exitRoadId: "north-out", vehiclesPerHour: flowPerHour }] },
    seed: job.seed,
    laneDiscipline: true,
  };
  const durationS = T22.warmUpS + T22.measureS + T22.drainS;
  const departures = engineDepartures(input, durationS);
  const from = T22.warmUpS;
  const to = T22.warmUpS + T22.measureS;
  const desired = Math.min(CAR.desiredSpeedMps, network.roads[0]!.speedLimitMps);

  // Our engine: one flow, no initial vehicles, so the k-th departure is vehicle k. A vehicle's delay
  // is the time it waited to enter, plus, for every step on the network, the step's length times
  // (1 - speed / desired speed): the same quantity as SUMO's departDelay + timeLoss.
  const delay = new Map<number, number>();
  const left = new Set<number>();
  let previous = new Set<number>();
  let throughInHour = 0;
  const run = runNetwork(input, {
    durationS,
    observe: (snapshot: Snapshot, results) => {
      if (Math.abs(snapshot.timeS - from) < STEP_S / 2) throughInHour -= results.vehiclesThrough;
      if (Math.abs(snapshot.timeS - to) < STEP_S / 2) throughInHour += results.vehiclesThrough;
      const now = new Set<number>();
      for (const vehicle of snapshot.vehicles) {
        now.add(vehicle.id);
        const known = delay.get(vehicle.id);
        if (known === undefined) {
          delay.set(vehicle.id, snapshot.timeS - departures[vehicle.id - 1]!.timeS);
        } else {
          delay.set(vehicle.id, known + STEP_S * (1 - vehicle.speedMps / desired));
        }
      }
      for (const id of previous) if (!now.has(id)) left.add(id);
      previous = now;
      if (Math.abs(snapshot.timeS - durationS) < STEP_S / 2) checkDepartures(departures, results);
    },
  });
  let total = 0;
  let count = 0;
  let unfinished = 0;
  departures.forEach((departure, index) => {
    if (departure.timeS < from || departure.timeS >= to) return;
    const id = index + 1;
    count++;
    const d = delay.get(id);
    if (d === undefined) {
      // Still waiting to enter at the end.
      total += durationS - departure.timeS;
      unfinished++;
    } else {
      total += d;
      if (!left.has(id)) unfinished++;
    }
  });
  const ours = {
    throughPerHour: (throughInHour * 3600) / T22.measureS,
    vehicles: count,
    unfinished,
    meanDelayS: total / count,
    stuckVehicles: run.stuckVehicles,
    conservationViolations: run.conservationViolations,
    wallClockS: run.wallClockS,
  };

  let sumo: T22Result["sumo"] = null;
  if (context.sumo) {
    const net = writeSumoNetwork(network, context.workDir, { laneDiscipline: true });
    const routesFile = writeRouteFile(context.workDir, { network, departures, classes: ["car"], sublane: false });
    const summary = runSumoNetwork(net, { routesFile, durationS, seed: job.seed });
    const tripList = readTripinfo(summary.tripinfoFile);
    const trips = new Map(tripList.map((trip) => [trip.id, trip]));
    const sumoThrough = tripList.filter((trip) => trip.finished && trip.arrival > from && trip.arrival <= to).length;
    let sumoTotal = 0;
    let sumoCount = 0;
    let sumoUnfinished = 0;
    departures.forEach((departure, index) => {
      if (departure.timeS < from || departure.timeS >= to) return;
      sumoCount++;
      const trip = trips.get(`v${index}`);
      if (!trip) {
        // Never inserted and not written: it waited from its departure to the end.
        sumoTotal += durationS - departure.timeS;
        sumoUnfinished++;
        return;
      }
      sumoTotal += trip.departDelay + trip.timeLoss;
      if (!trip.finished) sumoUnfinished++;
    });
    sumo = { throughPerHour: (sumoThrough * 3600) / T22.measureS, vehicles: sumoCount, unfinished: sumoUnfinished, meanDelayS: sumoTotal / sumoCount, ...sumoSide(summary) };
  }
  return { share: job.share, seed: job.seed, flowPerHour, ours, sumo };
}

// ---------------------------------------------------------------------------------------------
// T2.3 Priority junction: minor-road capacity as major-road flow rises.

export const T23 = {
  /** Main-road flow, both directions together, split equally between them. */
  majorFlows: [200, 400, 600, 800, 1000, 1200],
  /** The side road's demand, more than it can take at any of the major flows; half turn each way. */
  minorDemandPerHour: 2000,
  armLengthM: 200,
  halfGapM: 15,
  warmUpS: 300,
  measureS: 3600,
  /**
   * The follow-up time of the gap-acceptance formula, as a share of the critical gap. Neither the
   * standard nor the engine gives one (the engine lets each side-road car in on its own gap); 0.6
   * is a common rule of thumb, used here only to draw the formula's curve. See the proposed amendment.
   */
  followUpShareOfCriticalGap: 0.6,
};

/**
 * Siegloch's gap-acceptance capacity of a minor stream (veh/h), for a conflicting flow q_p
 * (veh/h), critical gap tc and follow-up time tf (s): c = q_p e^(-q_p (tc - tf / 2)) / (1 - e^(-q_p tf)).
 */
export function gapAcceptanceCapacity(conflictingPerHour: number, criticalGapS: number, followUpS: number): number {
  const q = conflictingPerHour / 3600;
  return (3600 * q * Math.exp(-q * (criticalGapS - followUpS / 2))) / (1 - Math.exp(-q * followUpS));
}

/** The car's accepted gap from the engine's assumptions table (ticket 08). */
export function carCriticalGapS(): number {
  const found = listAssumptions().flatMap((group) => group.assumptions).find((a) => a.id === "priority.car.acceptedGapS");
  if (!found || found.value === null) throw new Error("The engine has no accepted gap for a car at a priority junction");
  return found.value;
}

export interface T23Result {
  majorFlowPerHour: number;
  seed: number;
  /** Side-road vehicles through the junction per hour over the measured time. */
  ours: ({ minorThroughPerHour: number } & EngineSide) | null;
  oursNotRunnable: string | null;
  sumo: ({ minorThroughPerHour: number; teleportsYield: number } & SumoSide) | null;
}

/**
 * A T-junction in left-hand traffic, as the engine's own tests build it: the main road runs
 * east-west, one lane each way, and the side road comes from the south, half its traffic turning
 * each way. Network format 5, `control: "priority"` with the main road's approaches named.
 */
function t23Network(): Network {
  const roads = crossRoads({
    lanes: 1,
    laneWidthM: 3.5,
    armLengthM: T23.armLengthM,
    halfGapM: T23.halfGapM,
    speedLimitMps: CAR.desiredSpeedMps,
    arms: ["south", "east", "west"],
  });
  return {
    formatVersion: 5,
    roads,
    junctions: [{ id: "tee", control: "priority", mainRoadIds: ["west-in", "east-in"], connections: allMovements(roads) }],
  };
}

export function runT23(job: { majorFlowPerHour: number; seed: number }, context: { workDir: string; sumo: boolean }): T23Result {
  const network = t23Network();
  const input: RunInput = {
    network,
    demand: {
      flows: [
        { entryRoadId: "west-in", exitRoadId: "east-out", vehiclesPerHour: job.majorFlowPerHour / 2 },
        { entryRoadId: "east-in", exitRoadId: "west-out", vehiclesPerHour: job.majorFlowPerHour / 2 },
        { entryRoadId: "south-in", exitRoadId: "west-out", vehiclesPerHour: T23.minorDemandPerHour / 2 },
        { entryRoadId: "south-in", exitRoadId: "east-out", vehiclesPerHour: T23.minorDemandPerHour / 2 },
      ],
    },
    seed: job.seed,
    laneDiscipline: true,
  };
  const durationS = T23.warmUpS + T23.measureS;
  const departures = engineDepartures(input, durationS);
  const inWindow = (time: number) => time > T23.warmUpS && time <= durationS;

  let ours: T23Result["ours"] = null;
  let oursNotRunnable: string | null = null;
  try {
    const minorThrough = stopLineCrossings("south-in", T23.armLengthM);
    const run = runNetwork(input, {
      durationS,
      observe: (snapshot, results) => {
        minorThrough.observe(snapshot);
        if (Math.abs(snapshot.timeS - durationS) < STEP_S / 2) checkDepartures(departures, results);
      },
    });
    let through = 0;
    for (const time of minorThrough.crossings.values()) if (inWindow(time)) through++;
    ours = { minorThroughPerHour: (through * 3600) / T23.measureS, stuckVehicles: run.stuckVehicles, conservationViolations: run.conservationViolations, wallClockS: run.wallClockS };
  } catch (error) {
    oursNotRunnable = (error as Error).message;
  }

  let sumo: T23Result["sumo"] = null;
  if (context.sumo) {
    // SUMO: a priority node, the main road's edges ranked above the side road's, so the side road yields
    // (SUMO's junction model with its default gap acceptance).
    const sumoNetwork: Network = {
      formatVersion: 4,
      roads: network.roads,
      junctions: network.junctions!.map((junction) => ({ id: junction.id, control: "none" as const, connections: junction.connections })),
    };
    const net = writeSumoNetwork(sumoNetwork, context.workDir, { laneDiscipline: true, priorityRoads: { tee: ["west-in", "east-in", "west-out", "east-out"] } });
    const routesFile = writeRouteFile(context.workDir, { network: sumoNetwork, departures, classes: ["car"], sublane: false });
    const summary = runSumoNetwork(net, { routesFile, durationS, seed: job.seed, fcd: { attributes: "id,speed,pos,lane", beginS: T23.warmUpS - 5 } });
    // The moment a side-road vehicle's front crosses the stop line: when it is first seen past the side road's edge.
    const onSide = new Set<string>();
    const through = new Set<string>();
    forEachFcdRow(summary.fcdFile!, (row) => {
      const id = row.id!;
      if (row.lane === "south-in_0") onSide.add(id);
      else if (onSide.has(id) && !through.has(id) && inWindow(Number(row.time))) through.add(id);
    });
    sumo = { minorThroughPerHour: (through.size * 3600) / T23.measureS, teleportsYield: summary.teleportsYield, ...sumoSide(summary) };
  }
  return { majorFlowPerHour: job.majorFlowPerHour, seed: job.seed, ours, oursNotRunnable, sumo };
}


// ---------------------------------------------------------------------------------------------
// T2.4 Four-way junction, all approaches saturated, 30 minutes.

export const T24 = {
  lanes: 2,
  laneWidthM: 3.5,
  armLengthM: 200,
  halfGapM: 15,
  /** Opposite approaches share a green, so turns across oncoming traffic meet it. */
  plan: {
    phases: [
      { greenRoadIds: ["south-in", "north-in"], greenS: 30 },
      { greenRoadIds: ["west-in", "east-in"], greenS: 30 },
    ],
    amberS: 3,
    allRedS: 2,
  },
  /** Per approach: 20% turning left, 60% straight on, 20% turning right; well above what the approach can take. */
  perApproachPerHour: 1500,
  durationS: 1800,
};

export interface T24Result {
  seed: number;
  ours: EngineSide & { through: number; entered: number; waitingToEnter: number };
  sumo: (SumoSide & { through: number; inserted: number; waiting: number; teleportsJam: number; teleportsYield: number; teleportsWrongLane: number }) | null;
}

function t24Input(seed: number): RunInput {
  const roads = crossRoads({ lanes: T24.lanes, laneWidthM: T24.laneWidthM, armLengthM: T24.armLengthM, halfGapM: T24.halfGapM, speedLimitMps: CAR.desiredSpeedMps });
  const network = signalNetwork(roads, allMovements(roads), T24.plan);
  // Left and right in left-hand traffic, for a vehicle on each approach.
  const turns: Record<string, { left: string; straight: string; right: string }> = {
    "south-in": { left: "west-out", straight: "north-out", right: "east-out" },
    "north-in": { left: "east-out", straight: "south-out", right: "west-out" },
    "west-in": { left: "north-out", straight: "east-out", right: "south-out" },
    "east-in": { left: "south-out", straight: "west-out", right: "north-out" },
  };
  const flows = Object.entries(turns).flatMap(([entry, exits]) => [
    { entryRoadId: entry, exitRoadId: exits.left, vehiclesPerHour: 0.2 * T24.perApproachPerHour },
    { entryRoadId: entry, exitRoadId: exits.straight, vehiclesPerHour: 0.6 * T24.perApproachPerHour },
    { entryRoadId: entry, exitRoadId: exits.right, vehiclesPerHour: 0.2 * T24.perApproachPerHour },
  ]);
  return { network, demand: { flows }, seed, laneDiscipline: true };
}

export function runT24(job: { seed: number }, context: { workDir: string; sumo: boolean }): T24Result {
  const input = t24Input(job.seed);
  const departures = engineDepartures(input, T24.durationS);
  const run = runNetwork(input, {
    durationS: T24.durationS,
    observe: (snapshot, results) => {
      if (Math.abs(snapshot.timeS - T24.durationS) < STEP_S / 2) checkDepartures(departures, results);
    },
  });
  const ours = {
    stuckVehicles: run.stuckVehicles,
    conservationViolations: run.conservationViolations,
    wallClockS: run.wallClockS,
    through: run.finalResults.vehiclesThrough,
    entered: run.finalResults.vehiclesEntered,
    waitingToEnter: run.finalResults.vehiclesWaitingToEnter,
  };
  let sumo: T24Result["sumo"] = null;
  if (context.sumo) {
    const net = writeSumoNetwork(input.network, context.workDir, { laneDiscipline: true });
    const routesFile = writeRouteFile(context.workDir, { network: input.network, departures, classes: ["car"], sublane: false });
    const summary = runSumoNetwork(net, { routesFile, durationS: T24.durationS, seed: job.seed });
    sumo = {
      ...sumoSide(summary),
      through: summary.inserted - summary.running,
      inserted: summary.inserted,
      waiting: summary.waiting,
      teleportsJam: summary.teleportsJam,
      teleportsYield: summary.teleportsYield,
      teleportsWrongLane: summary.teleportsWrongLane,
    };
  }
  return { seed: job.seed, ours, sumo };
}
