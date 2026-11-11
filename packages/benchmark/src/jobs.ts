/**
 * The benchmark's units of work. Each job runs one scenario (one test, one
 * density, one seed) through our engine, through SUMO and through the
 * reference as the test requires, and returns plain numbers. Jobs are
 * independent, so main.ts runs them in parallel processes.
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import {
  BENGALURU_VEHICLE_MIX,
  VEHICLE_CLASS_ASSUMPTIONS,
  type RunInput,
  type VehicleClass,
  type VehicleMix,
} from "@traffic-simulator/engine";
import mixedTrafficExample from "@traffic-simulator/engine/examples/mixed-traffic.json";
import oneRoadExample from "@traffic-simulator/engine/examples/one-road.json";
import { runEngine, toEngineInput, type Tier0Counts } from "./engine-run";
import { equilibrium, integratePlatoon, integrateRing, timeToReachSpeedFraction } from "./reference";
import { CAR, LANE_WIDTH_M, seededRandom, STEP_S, type Departure, type PlacedCar, type Scenario } from "./scenario";
import { writeSumoRing, type RingCar } from "./sumo-ring";
import { runSumo, writeSumoInputs, type SumoRunSummary } from "./sumo-run";

export type Job =
  | { kind: "tier0"; id: string; scenario: Tier0ScenarioName; seed: number }
  | { kind: "t1.1"; id: string }
  | { kind: "t1.2"; id: string }
  | { kind: "t1.2-partial"; id: string }
  | { kind: "ring"; id: string; lanes: number; densityPerKm: number; seed: number }
  | { kind: "t1.5"; id: string; seed: number }
  | { kind: "open-road"; id: string; mix: OpenRoadMix; lanes: number; laneWidthM: number; seed: number };

export interface JobContext {
  /** Directory for this job's SUMO files; removed afterwards unless keepWork is set. */
  workDir: string;
  /** False when SUMO is not installed: SUMO's parts are skipped and reported as not run. */
  sumo: boolean;
  keepWork: boolean;
}

/** What is reported about SUMO's side of any run. */
export interface SumoCounts {
  teleports: number;
  collisions: number;
  emergencyBraking: number;
  negativeSpeeds: number;
  warningCount: number;
  warnings: string[];
}

function sumoCounts(summary: SumoRunSummary): SumoCounts {
  return {
    teleports: summary.teleports.total,
    collisions: summary.collisions,
    emergencyBraking: summary.emergencyBraking,
    negativeSpeeds: summary.negativeSpeeds,
    warningCount: summary.warningCount,
    warnings: summary.warnings,
  };
}

/** What is reported about our engine's side of any run. */
export interface EngineCounts {
  tier0: Tier0Counts;
  stuckVehicles: number;
}

function rmse(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (a[i]! - b[i]!) * (a[i]! - b[i]!);
  return Math.sqrt(sum / n);
}

/** First time a series of (time, speed) samples reaches a speed, by linear interpolation between samples. */
function timeToReach(times: number[], speeds: number[], target: number): number | null {
  for (let i = 1; i < times.length; i++) {
    if (speeds[i]! >= target) {
      const fraction = (target - speeds[i - 1]!) / (speeds[i]! - speeds[i - 1]!);
      return times[i - 1]! + fraction * (times[i]! - times[i - 1]!);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Tier 0: internal consistency of our engine on scenarios of its own kind (mixed traffic included).

const TIER0_SCENARIOS = {
  "one-road example (cars, 1,200/h)": () => oneRoadExample as unknown as RunInput,
  "mixed-traffic example (4 classes, 6,000/h, mixed traffic)": () => mixedTrafficExample as unknown as RunInput,
  "mixed-traffic example, lane discipline on": () => ({ ...(mixedTrafficExample as unknown as RunInput), laneDiscipline: true }),
  "saturated mixed traffic (12,000/h, 500 m x 10.5 m) with a stationary car": () => saturated(false),
  "saturated, lane discipline on, with a stationary car": () => saturated(true),
  "lane closed by stationary cars (the T1.5 road)": () => toEngineInput(laneDropScenario(1)).input,
} satisfies Record<string, () => RunInput>;

export type Tier0ScenarioName = keyof typeof TIER0_SCENARIOS;
export const TIER0_SCENARIO_NAMES = Object.keys(TIER0_SCENARIOS) as Tier0ScenarioName[];
const TIER0_DURATION_S = 1800;

function saturated(laneDiscipline: boolean): RunInput {
  return {
    network: {
      formatVersion: 2,
      roads: [{ id: "main", points: [{ x: 0, y: 0 }, { x: 500, y: 0 }], widthM: 10.5, lanes: 3, speedLimitMps: 13.9 }],
    },
    demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 12000 }], vehicleMix: BENGALURU_VEHICLE_MIX },
    seed: 1,
    laneDiscipline,
    initialVehicles: [{ roadId: "main", positionM: 250, speedMps: 0, vehicleClass: "car", lateralM: 5.25, stationary: true }],
  };
}

export interface Tier0Result extends EngineCounts {
  scenario: Tier0ScenarioName;
  seed: number;
  durationS: number;
  /** T0.3: whether a second run with the same seed gave bit-identical snapshots and results at every step. */
  repeatedIdentically: boolean;
  vehiclesThrough: number;
}

function runTier0(job: Extract<Job, { kind: "tier0" }>): Tier0Result {
  const input = { ...TIER0_SCENARIOS[job.scenario](), seed: job.seed };
  // Vehicles placed as stationary are the first ids; none of these scenarios places a moving vehicle.
  const stationaryIds = new Set((input.initialVehicles ?? []).map((_, index) => index + 1));
  const first = runEngine(input, { durationS: TIER0_DURATION_S, stationaryIds, fingerprint: true });
  const second = runEngine(input, { durationS: TIER0_DURATION_S, stationaryIds, fingerprint: true });
  return {
    scenario: job.scenario,
    seed: job.seed,
    durationS: TIER0_DURATION_S,
    tier0: first.tier0,
    stuckVehicles: first.stuckVehicles,
    repeatedIdentically: first.fingerprint === second.fingerprint,
    vehiclesThrough: first.finalResults.vehiclesThrough,
  };
}

// ---------------------------------------------------------------------------------------------
// T1.1: one car accelerates from rest on an empty road.

export interface T11Result {
  targetSpeedMps: number;
  referenceS: number;
  oursS: number | null;
  sumoS: number | null;
  ours: EngineCounts;
  sumo: SumoCounts | null;
  sumoRepeatedIdentically: boolean | null;
}

function runT11(context: JobContext): T11Result {
  const scenario: Scenario = {
    name: "t1.1",
    roadLengthM: 1000,
    lanes: 1,
    speedLimitMps: CAR.desiredSpeedMps,
    cars: [{ lane: 0, frontM: CAR.lengthM, speedMps: 0, group: "car" }],
    durationS: 40,
    seed: 1,
  };
  const target = 0.95 * CAR.desiredSpeedMps;
  const { input, stationaryIds } = toEngineInput(scenario);
  const times: number[] = [];
  const speeds: number[] = [];
  const ours = runEngine(input, {
    durationS: scenario.durationS,
    stationaryIds,
    observe: (snapshot) => {
      const car = snapshot.vehicles[0];
      if (!car) return;
      times.push(snapshot.timeS);
      speeds.push(car.speedMps);
    },
  });
  let sumoS: number | null = null;
  let sumo: SumoCounts | null = null;
  let sumoRepeatedIdentically: boolean | null = null;
  if (context.sumo) {
    const inputs = writeSumoInputs(scenario, context.workDir);
    const summary = runSumo(inputs, { durationS: scenario.durationS, seed: 1 });
    const points = summary.trajectories.get("c0") ?? [];
    sumoS = timeToReach(points.map((point) => point.timeS), points.map((point) => point.speedMps), target);
    sumo = sumoCounts(summary);
    sumoRepeatedIdentically = runSumo(inputs, { durationS: scenario.durationS, seed: 1 }).trajectoryHash === summary.trajectoryHash;
  }
  return {
    targetSpeedMps: target,
    referenceS: timeToReachSpeedFraction(CAR, 0.95),
    oursS: timeToReach(times, speeds, target),
    sumoS,
    ours: { tier0: ours.tier0, stuckVehicles: ours.stuckVehicles },
    sumo,
    sumoRepeatedIdentically,
  };
}

// ---------------------------------------------------------------------------------------------
// T1.2: one car follows a leader with a fixed speed profile (cruise, brake to stop, restart).

/** The leader's prescribed speed at every step: cruise, brake to a stop, stand, restart, cruise. */
export const LEADER_PROFILE = {
  cruiseMps: 12,
  cruiseS: 30,
  brakeMps2: 1.5,
  standS: 15,
  restartMps2: 1.0,
  finalCruiseS: 25,
};

function leaderProfile(): number[] {
  const p = LEADER_PROFILE;
  const speeds: number[] = [];
  const push = (seconds: number, speedAt: (t: number) => number) => {
    const steps = Math.round(seconds / STEP_S);
    for (let k = 1; k <= steps; k++) speeds.push(speedAt(k * STEP_S));
  };
  speeds.push(p.cruiseMps);
  push(p.cruiseS, () => p.cruiseMps);
  push(p.cruiseMps / p.brakeMps2, (t) => Math.max(0, p.cruiseMps - p.brakeMps2 * t));
  push(p.standS, () => 0);
  push(p.cruiseMps / p.restartMps2, (t) => Math.min(p.cruiseMps, p.restartMps2 * t));
  push(p.finalCruiseS, () => p.cruiseMps);
  return speeds;
}

export interface FollowingResult {
  durationS: number;
  /** RMSE of the follower's speed against the reference, sampled every step, m/s. */
  speedRmseMps: number | null;
  /** Largest single difference in the follower's speed, m/s. */
  maxSpeedErrorMps: number | null;
  minGapM: number | null;
}

export interface T12Result {
  profile: typeof LEADER_PROFILE;
  referenceMinGapM: number;
  /** Our engine cannot run this test: its public interface has no vehicle with a prescribed speed. */
  ours: null;
  sumo: (FollowingResult & SumoCounts & { leaderSpeedRmseMps: number }) | null;
}

function compareFollower(
  times: number[],
  leaderFront: number[],
  followerFront: number[],
  followerSpeed: number[],
  referenceSpeed: number[],
): FollowingResult {
  let minGap = Infinity;
  let maxError = 0;
  const n = Math.min(followerSpeed.length, referenceSpeed.length);
  for (let i = 0; i < n; i++) {
    minGap = Math.min(minGap, leaderFront[i]! - CAR.lengthM - followerFront[i]!);
    maxError = Math.max(maxError, Math.abs(followerSpeed[i]! - referenceSpeed[i]!));
  }
  return {
    durationS: times[n - 1] ?? 0,
    speedRmseMps: rmse(followerSpeed, referenceSpeed),
    maxSpeedErrorMps: maxError,
    minGapM: minGap,
  };
}

function runT12(context: JobContext): T12Result {
  const profile = leaderProfile();
  const durationS = (profile.length - 1) * STEP_S;
  // The follower starts at its equilibrium gap behind the leader, at the leader's speed.
  const gap = equilibriumGap(LEADER_PROFILE.cruiseMps);
  const leaderFront = 200;
  const followerFront = leaderFront - CAR.lengthM - gap;
  const reference = integratePlatoon(
    CAR,
    [
      { frontM: leaderFront, speedMps: profile[0]!, prescribedSpeedMps: profile },
      { frontM: followerFront, speedMps: LEADER_PROFILE.cruiseMps },
    ],
    durationS,
    STEP_S,
  );
  let sumo: T12Result["sumo"] = null;
  if (context.sumo) {
    const scenario: Scenario = {
      name: "t1.2",
      roadLengthM: 3000,
      lanes: 1,
      speedLimitMps: CAR.desiredSpeedMps,
      cars: [
        { lane: 0, frontM: leaderFront, speedMps: profile[0]!, group: "leader" },
        { lane: 0, frontM: followerFront, speedMps: LEADER_PROFILE.cruiseMps, group: "follower" },
      ],
      durationS,
      seed: 1,
    };
    const inputs = writeSumoInputs(scenario, context.workDir);
    const summary = runSumo(inputs, { durationS, seed: 1, prescribed: { vehicleId: "c0", speedMps: profile } });
    const leader = summary.trajectories.get("c0") ?? [];
    const follower = summary.trajectories.get("c1") ?? [];
    sumo = {
      ...compareFollower(
        follower.map((point) => point.timeS),
        leader.map((point) => point.frontM),
        follower.map((point) => point.frontM),
        follower.map((point) => point.speedMps),
        reference.speedMps[1]!,
      ),
      ...sumoCounts(summary),
      leaderSpeedRmseMps: rmse(leader.map((point) => point.speedMps), reference.speedMps[0]!),
    };
  }
  return { profile: LEADER_PROFILE, referenceMinGapM: reference.minGapM[1]!, ours: null, sumo };
}

/** The IDM equilibrium gap at a speed: s = (s0 + v T) / sqrt(1 - (v / v0)^4). */
function equilibriumGap(speedMps: number): number {
  return (CAR.standstillGapM + speedMps * CAR.timeGapS) / Math.sqrt(1 - Math.pow(speedMps / CAR.desiredSpeedMps, 4));
}

// ---------------------------------------------------------------------------------------------
// T1.2, the part our engine can run: the leader's profile is not prescribed but produced by the
// model itself. The leader cruises at its desired speed and brakes to a stop behind a stationary
// car; the follower follows it. There is no restart: nothing in the engine's interface makes a
// stopped vehicle's obstacle go away. This is NOT the standard's T1.2 and is reported apart from it.

export interface T12PartialResult {
  durationS: number;
  reference: { leaderMinGapM: number; followerMinGapM: number };
  ours: { leader: FollowingResult; follower: FollowingResult } & EngineCounts;
  sumo: ({ leader: FollowingResult; follower: FollowingResult } & SumoCounts) | null;
}

function runT12Partial(context: JobContext): T12PartialResult {
  const durationS = 120;
  const obstacleFront = 1000;
  const leaderFront = 200;
  const followerSpeed = 14;
  const followerFront = leaderFront - CAR.lengthM - 27;
  const scenario: Scenario = {
    name: "t1.2-partial",
    roadLengthM: 1100,
    lanes: 1,
    speedLimitMps: CAR.desiredSpeedMps,
    cars: [
      { lane: 0, frontM: obstacleFront, speedMps: 0, stationary: true, group: "obstacle" },
      { lane: 0, frontM: leaderFront, speedMps: CAR.desiredSpeedMps, group: "leader" },
      { lane: 0, frontM: followerFront, speedMps: followerSpeed, group: "follower" },
    ],
    durationS,
    seed: 1,
  };
  const reference = integratePlatoon(
    CAR,
    [
      { frontM: obstacleFront, speedMps: 0, stationary: true },
      { frontM: leaderFront, speedMps: CAR.desiredSpeedMps },
      { frontM: followerFront, speedMps: followerSpeed },
    ],
    durationS,
    STEP_S,
  );
  const compare = (times: number[], fronts: number[][], speeds: number[][]) => ({
    leader: compareFollower(times, fronts[0]!, fronts[1]!, speeds[1]!, reference.speedMps[1]!),
    follower: compareFollower(times, fronts[1]!, fronts[2]!, speeds[2]!, reference.speedMps[2]!),
  });

  const { input, stationaryIds } = toEngineInput(scenario);
  const times: number[] = [];
  const fronts: number[][] = [[], [], []];
  const speeds: number[][] = [[], [], []];
  const ours = runEngine(input, {
    durationS,
    stationaryIds,
    observe: (snapshot) => {
      times.push(snapshot.timeS);
      for (const vehicle of snapshot.vehicles) {
        fronts[vehicle.id - 1]!.push(vehicle.positionM);
        speeds[vehicle.id - 1]!.push(vehicle.speedMps);
      }
    },
  });

  let sumo: T12PartialResult["sumo"] = null;
  if (context.sumo) {
    const inputs = writeSumoInputs(scenario, context.workDir);
    const summary = runSumo(inputs, { durationS, seed: 1 });
    const series = ["c0", "c1", "c2"].map((id) => summary.trajectories.get(id) ?? []);
    sumo = {
      ...compare(
        series[1]!.map((point) => point.timeS),
        series.map((list) => list.map((point) => point.frontM)),
        series.map((list) => list.map((point) => point.speedMps)),
      ),
      ...sumoCounts(summary),
    };
  }
  return {
    durationS,
    reference: { leaderMinGapM: reference.minGapM[1]!, followerMinGapM: reference.minGapM[2]! },
    ours: { ...compare(times, fronts, speeds), tier0: ours.tier0, stuckVehicles: ours.stuckVehicles },
    sumo,
  };
}

// ---------------------------------------------------------------------------------------------
// T1.3 and T1.4: a 1 km ring road at a set density.
//
// Our engine has no ring: a road's end does not join its start, and a route is one road. The
// engine's interface can still express what happens on a ring, exactly. Lay the ring's N cars per
// lane out on a long straight road and repeat that 1 km pattern many times, each copy identical.
// A car in one copy then has in front of it exactly what it would have on the ring (the copy
// ahead stands in for the ring coming round), for as long as the copy ahead still behaves as a
// ring. Only the very first copy has open road in front; because every vehicle decides from the
// state at the start of the step, that difference can travel back by at most one vehicle per
// step. With at least as many cars ahead (per lane) as the run has steps, the measured copies are
// a ring for the whole run. With more than one lane, cars also look at the vehicle behind before
// changing lane, so the same number of cars is placed behind the measured copies.
//
// Two neighbouring copies are measured; if the argument holds they give the same flow, and the
// difference is reported. SUMO is given the identical long road, and is also run on a true ring.

export const RING_LENGTH_M = 1000;
export const RING_DURATION_S = 600;
export const RING_MEASURE_FROM_S = 300;

/** The cars of one lap of the ring: evenly spaced, each moved by a random share of its spare gap, at the equilibrium speed. */
export function ringPattern(lanes: number, densityPerKm: number, seed: number): RingCar[] {
  const random = seededRandom(seed * 1009 + densityPerKm * 7 + lanes);
  const spacing = RING_LENGTH_M / densityPerKm;
  const amplitude = 0.1 * (spacing - CAR.lengthM - CAR.standstillGapM);
  const speedMps = equilibrium(CAR, densityPerKm).speedMps;
  const cars: RingCar[] = [];
  for (let lane = 0; lane < lanes; lane++) {
    // Lanes are staggered against each other by a random offset.
    const offset = lane === 0 ? 0 : random() * spacing;
    const fronts: number[] = [];
    for (let i = 0; i < densityPerKm; i++) {
      const front = (i + 0.5) * spacing + offset + (random() * 2 - 1) * amplitude;
      fronts.push(((front % RING_LENGTH_M) + RING_LENGTH_M) % RING_LENGTH_M);
    }
    fronts.sort((a, b) => a - b);
    for (const frontM of fronts) cars.push({ lane, frontM, speedMps });
  }
  return cars;
}

export function periodicRoadScenario(lanes: number, densityPerKm: number, seed: number): Scenario {
  const pattern = ringPattern(lanes, densityPerKm, seed);
  const steps = Math.round(RING_DURATION_S / STEP_S);
  const copiesAhead = Math.ceil(steps / densityPerKm) + 1;
  const copiesBehind = lanes > 1 ? copiesAhead : 0;
  const copies = copiesBehind + 2 + copiesAhead;
  const startM = 10;
  const cars: PlacedCar[] = [];
  for (let copy = 0; copy < copies; copy++) {
    const group = copy === copiesBehind ? "b" : copy === copiesBehind + 1 ? "a" : undefined;
    for (const car of pattern) {
      cars.push({ lane: car.lane, frontM: startM + copy * RING_LENGTH_M + car.frontM, speedMps: car.speedMps, group });
    }
  }
  return {
    name: `ring-${lanes}-${densityPerKm}-${seed}`,
    // Long enough that no car reaches the end during the run.
    roadLengthM: startM + copies * RING_LENGTH_M + CAR.desiredSpeedMps * RING_DURATION_S + 500,
    lanes,
    speedLimitMps: CAR.desiredSpeedMps,
    cars,
    durationS: RING_DURATION_S,
    seed,
  };
}

export interface RingEngineResult {
  /** Flow per lane from each of the two measured copies: density per lane times mean speed, vehicles/h. */
  flowPerLaneA: number;
  flowPerLaneB: number;
  /** Share of the measured cars' time spent between lanes (changing lane). */
  betweenLanesShare: number;
  minSpeedMps: number;
}

export interface RingResult {
  lanes: number;
  densityPerKm: number;
  seed: number;
  carsOnRoad: number;
  equilibriumFlowPerHour: number;
  stringStable: boolean;
  /** One lane only: the ring integrated at 0.001 s from the same starting positions. */
  reference: { flowPerHour: number; speedSpreadMps: number; minGapM: number } | null;
  ours: RingEngineResult & EngineCounts;
  sumo: (RingEngineResult & SumoCounts) | null;
  /** SUMO on a true 1 km ring with the same cars. */
  sumoTrueRing: ({ flowPerLane: number; betweenLanesShare: number } & SumoCounts) | null;
}

function runRing(job: Extract<Job, { kind: "ring" }>, context: JobContext): RingResult {
  const { lanes, densityPerKm, seed } = job;
  const scenario = periodicRoadScenario(lanes, densityPerKm, seed);
  const point = equilibrium(CAR, densityPerKm);
  const toFlow = (meanSpeedMps: number) => densityPerKm * meanSpeedMps * 3.6;

  const { input, stationaryIds, groupIds } = toEngineInput(scenario);
  const groupOf = new Int8Array(scenario.cars.length + 2);
  for (const id of groupIds.get("a") ?? []) groupOf[id] = 1;
  for (const id of groupIds.get("b") ?? []) groupOf[id] = 2;
  const sum = [0, 0, 0];
  const count = [0, 0, 0];
  let between = 0;
  let minSpeed = Infinity;
  const ours = runEngine(input, {
    durationS: scenario.durationS,
    stationaryIds,
    observe: (snapshot) => {
      if (snapshot.timeS <= RING_MEASURE_FROM_S + STEP_S / 2) return;
      for (const vehicle of snapshot.vehicles) {
        const group = groupOf[vehicle.id]!;
        if (group === 0) continue;
        sum[group]! += vehicle.speedMps;
        count[group]!++;
        if (vehicle.speedMps < minSpeed) minSpeed = vehicle.speedMps;
        const lane = vehicle.lateralM / LANE_WIDTH_M - 0.5;
        if (Math.abs(lane - Math.round(lane)) > 1e-6) between++;
      }
    },
  });

  let sumo: RingResult["sumo"] = null;
  let sumoTrueRing: RingResult["sumoTrueRing"] = null;
  if (context.sumo) {
    const inputs = writeSumoInputs(scenario, join(context.workDir, "road"));
    const summary = runSumo(inputs, { durationS: scenario.durationS, seed, recordFromS: RING_MEASURE_FROM_S });
    const measure = (ids: string[]) => {
      let total = 0;
      let samples = 0;
      let changing = 0;
      let slowest = Infinity;
      for (const id of ids) {
        let lane: string | undefined;
        for (const row of summary.trajectories.get(id) ?? []) {
          if (row.timeS <= RING_MEASURE_FROM_S + STEP_S / 2) continue;
          total += row.speedMps;
          samples++;
          if (row.speedMps < slowest) slowest = row.speedMps;
          if (lane !== undefined && row.lane !== lane) changing++;
          lane = row.lane;
        }
      }
      return { meanSpeed: total / samples, samples, changing, slowest };
    };
    const a = measure(inputs.groupIds.get("a") ?? []);
    const b = measure(inputs.groupIds.get("b") ?? []);
    sumo = {
      flowPerLaneA: toFlow(a.meanSpeed),
      flowPerLaneB: toFlow(b.meanSpeed),
      // SUMO changes lane in one step, so it has no time between lanes; this is lane changes per sample.
      betweenLanesShare: (a.changing + b.changing) / (a.samples + b.samples),
      minSpeedMps: Math.min(a.slowest, b.slowest),
      ...sumoCounts(summary),
    };

    const ring = writeSumoRing(join(context.workDir, "ring"), RING_LENGTH_M, lanes, CAR.desiredSpeedMps, ringPattern(lanes, densityPerKm, seed));
    const ringSummary = runSumo(ring, { durationS: scenario.durationS, seed, recordFromS: RING_MEASURE_FROM_S });
    let total = 0;
    let samples = 0;
    let changing = 0;
    for (const rows of ringSummary.trajectories.values()) {
      let lane: string | undefined;
      for (const row of rows) {
        if (row.timeS <= RING_MEASURE_FROM_S + STEP_S / 2) continue;
        total += row.speedMps;
        samples++;
        const laneIndex = row.lane.slice(row.lane.lastIndexOf("_"));
        if (lane !== undefined && laneIndex !== lane) changing++;
        lane = laneIndex;
      }
    }
    sumoTrueRing = { flowPerLane: toFlow(total / samples), betweenLanesShare: changing / samples, ...sumoCounts(ringSummary) };
  }

  let reference: RingResult["reference"] = null;
  if (lanes === 1) {
    const pattern = ringPattern(1, densityPerKm, seed);
    const result = integrateRing(
      CAR,
      RING_LENGTH_M,
      pattern.map((car) => car.frontM),
      pattern.map((car) => car.speedMps),
      RING_DURATION_S,
      RING_MEASURE_FROM_S,
    );
    reference = { flowPerHour: result.flowPerHour, speedSpreadMps: result.speedSpreadMps, minGapM: result.minGapM };
  }

  return {
    lanes,
    densityPerKm,
    seed,
    carsOnRoad: scenario.cars.length,
    equilibriumFlowPerHour: point.flowPerHour,
    stringStable: point.stringStable,
    reference,
    ours: {
      flowPerLaneA: toFlow(sum[1]! / count[1]!),
      flowPerLaneB: toFlow(sum[2]! / count[2]!),
      betweenLanesShare: between / (count[1]! + count[2]!),
      minSpeedMps: minSpeed,
      tier0: ours.tier0,
      stuckVehicles: ours.stuckVehicles,
    },
    sumo,
    sumoTrueRing,
  };
}

// ---------------------------------------------------------------------------------------------
// T1.5: lane drop, 3 lanes to 2, demand above capacity.

export const LANE_DROP = {
  roadLengthM: 3000,
  dropAtM: 2000,
  droppedLane: 2,
  demandPerHour: 6000,
  warmUpS: 600,
  measureS: 1800,
};

export function laneDropScenario(seed: number): Scenario {
  return {
    name: `lane-drop-${seed}`,
    roadLengthM: LANE_DROP.roadLengthM,
    lanes: 3,
    speedLimitMps: CAR.desiredSpeedMps,
    cars: [],
    durationS: LANE_DROP.warmUpS + LANE_DROP.measureS,
    laneDrop: { lane: LANE_DROP.droppedLane, fromM: LANE_DROP.dropAtM },
    demandPerHour: LANE_DROP.demandPerHour,
    seed,
  };
}

export interface LaneDropEngineResult {
  /** Cars leaving the end of the road (1 km past the drop) per hour, over the measuring time. */
  dischargePerHour: number;
  /** Cars that had entered the road by the end, and cars still waiting to enter. */
  entered: number;
  waitingToEnter: number;
}

/** Our engine's road upstream of the closure at the end of the warm-up. */
export interface LaneDropSnapshot {
  /** Cars standing still in the lane that is closed ahead. */
  standingInClosedLane: number;
  carsInOpenLanes: number;
  meanSpeedOpenLanesMps: number;
}

export interface T15Result {
  seed: number;
  departures: number;
  ours: LaneDropEngineResult & EngineCounts & { atWarmUp: LaneDropSnapshot; laneChangesStarted: number };
  sumo:
    | (LaneDropEngineResult &
        SumoCounts & { repeatedIdentically: boolean | null; summaryConservationViolations: number; summaryRows: number })
    | null;
  /** SUMO with departSpeed "max" for the entering cars, for comparison only. */
  sumoDepartSpeedMax: (LaneDropEngineResult & { teleports: number; collisions: number }) | null;
}

function runT15(job: Extract<Job, { kind: "t1.5" }>, context: JobContext): T15Result {
  const scenario = laneDropScenario(job.seed);
  const { input, stationaryIds } = toEngineInput(scenario);
  const placed = input.initialVehicles?.length ?? 0;
  const departures: Departure[] = [];
  let produced = 0;
  let throughAtWarmUp = 0;
  let atWarmUp: LaneDropSnapshot = { standingInClosedLane: 0, carsInOpenLanes: 0, meanSpeedOpenLanesMps: 0 };
  let laneChangesStarted = 0;
  let betweenLanes = new Set<number>();
  const ours = runEngine(input, {
    durationS: scenario.durationS,
    stationaryIds,
    observe: (snapshot, results) => {
      // What the road upstream of the closure looks like, for the account of the result.
      const nowBetween = new Set<number>();
      const isWarmUp = Math.abs(snapshot.timeS - LANE_DROP.warmUpS) < STEP_S / 2;
      let standing = 0;
      let open = 0;
      let openSpeed = 0;
      for (const vehicle of snapshot.vehicles) {
        if (stationaryIds.has(vehicle.id)) continue;
        const lane = vehicle.lateralM / LANE_WIDTH_M - 0.5;
        if (Math.abs(lane - Math.round(lane)) > 1e-6) {
          nowBetween.add(vehicle.id);
          if (!betweenLanes.has(vehicle.id)) laneChangesStarted++;
        }
        if (!isWarmUp || vehicle.positionM > LANE_DROP.dropAtM) continue;
        if (Math.round(lane) === LANE_DROP.droppedLane) {
          if (vehicle.speedMps === 0) standing++;
        } else {
          open++;
          openSpeed += vehicle.speedMps;
        }
      }
      betweenLanes = nowBetween;
      if (isWarmUp) atWarmUp = { standingInClosedLane: standing, carsInOpenLanes: open, meanSpeedOpenLanesMps: open ? openSpeed / open : 0 };
      // The engine draws the departure times itself. They are read back here, to the step, as the
      // growth of (entered + waiting to enter), and the same departures are then given to SUMO.
      const now = results.vehiclesEntered + results.vehiclesWaitingToEnter - placed;
      for (; produced < now; produced++) departures.push({ timeS: snapshot.timeS });
      if (Math.abs(snapshot.timeS - LANE_DROP.warmUpS) < STEP_S / 2) throughAtWarmUp = results.vehiclesThrough;
    },
  });
  const perHour = 3600 / LANE_DROP.measureS;

  let sumo: T15Result["sumo"] = null;
  let sumoDepartSpeedMax: T15Result["sumoDepartSpeedMax"] = null;
  if (context.sumo) {
    const inputs = writeSumoInputs(scenario, context.workDir, { departures });
    const options = { durationS: scenario.durationS, seed: job.seed, summaryPeriodS: LANE_DROP.warmUpS };
    const summary = runSumo(inputs, options);
    const arrivedAt = (timeS: number) => summary.arrivedSeries.find(([time]) => Math.abs(time - timeS) < STEP_S / 2)?.[1];
    const atWarmUp = arrivedAt(LANE_DROP.warmUpS);
    const atEnd = arrivedAt(scenario.durationS);
    if (atWarmUp === undefined || atEnd === undefined) throw new Error("SUMO's summary output lacks the measuring times");
    let repeatedIdentically: boolean | null = null;
    if (job.seed === 1) {
      const again = runSumo(inputs, options);
      repeatedIdentically = JSON.stringify(again.arrivedSeries) === JSON.stringify(summary.arrivedSeries);
    }
    sumo = {
      dischargePerHour: (atEnd - atWarmUp) * perHour,
      entered: summary.vehicles.inserted,
      waitingToEnter: summary.vehicles.loaded - summary.vehicles.inserted,
      repeatedIdentically,
      summaryConservationViolations: summary.summaryConservationViolations,
      summaryRows: summary.summaryRows,
      ...sumoCounts(summary),
    };

    // The same run with SUMO's departSpeed "max" instead of "avg", to show what that choice does.
    const maxInputs = writeSumoInputs(scenario, join(context.workDir, "depart-max"), { departures, departSpeed: "max" });
    const maxSummary = runSumo(maxInputs, options);
    const at = (timeS: number) => maxSummary.arrivedSeries.find(([time]) => Math.abs(time - timeS) < STEP_S / 2)?.[1] ?? 0;
    sumoDepartSpeedMax = {
      dischargePerHour: (at(scenario.durationS) - at(LANE_DROP.warmUpS)) * perHour,
      entered: maxSummary.vehicles.inserted,
      waitingToEnter: maxSummary.vehicles.loaded - maxSummary.vehicles.inserted,
      teleports: maxSummary.teleports.total,
      collisions: maxSummary.collisions,
    };
  }
  return {
    seed: job.seed,
    departures: departures.length,
    ours: {
      dischargePerHour: (ours.finalResults.vehiclesThrough - throughAtWarmUp) * perHour,
      entered: ours.finalResults.vehiclesEntered - placed,
      waitingToEnter: ours.finalResults.vehiclesWaitingToEnter,
      tier0: ours.tier0,
      stuckVehicles: ours.stuckVehicles,
      atWarmUp,
      laneChangesStarted,
    },
    sumo,
    sumoDepartSpeedMax,
  };
}

// ---------------------------------------------------------------------------------------------
// Capacity per lane on an open road under saturating demand (our engine only): the orchestrator's
// observation that vehicles through per lane fell as lanes were added.

export type OpenRoadMix = "cars" | "bengaluru" | VehicleClass | "two-wheelers and cars" | "bengaluru at one desired speed";

function mixOf(name: OpenRoadMix): VehicleMix | undefined {
  if (name === "cars") return undefined;
  if (name === "bengaluru" || name === "bengaluru at one desired speed") return BENGALURU_VEHICLE_MIX;
  if (name === "two-wheelers and cars") return { "two-wheeler": 0.65, car: 0.22 };
  return { [name]: 1 };
}

export const OPEN_ROAD = { lengthM: 500, demandPerHour: 12000, durationS: 3600, speedLimitMps: 13.9 };

export interface OpenRoadResult extends EngineCounts {
  mix: OpenRoadMix;
  lanes: number;
  laneWidthM: number;
  seed: number;
  vehiclesThrough: number;
  throughPerLane: number;
  meanSpeedMps: number;
  /** Share of all vehicle time spent between lanes (during a lane change the vehicle occupies both lanes). */
  betweenLanesShare: number;
  laneChangesStarted: number;
  /** Mean time one lane change takes, s. */
  meanLaneChangeS: number | null;
}

function runOpenRoad(job: Extract<Job, { kind: "open-road" }>): OpenRoadResult {
  // "At one desired speed": a speed limit below every class's desired speed, so that all classes want the same speed.
  const slowest = Math.min(...Object.values(VEHICLE_CLASS_ASSUMPTIONS).map((assumptions) => assumptions.desiredSpeedMps));
  const speedLimitMps = job.mix === "bengaluru at one desired speed" ? slowest : OPEN_ROAD.speedLimitMps;
  const input: RunInput = {
    network: {
      formatVersion: 2,
      roads: [
        {
          id: "main",
          points: [{ x: 0, y: 0 }, { x: OPEN_ROAD.lengthM, y: 0 }],
          widthM: job.lanes * job.laneWidthM,
          lanes: job.lanes,
          speedLimitMps,
        },
      ],
    },
    demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: OPEN_ROAD.demandPerHour }], vehicleMix: mixOf(job.mix) },
    seed: job.seed,
    laneDiscipline: true,
  };
  let vehicleSteps = 0;
  let speedSum = 0;
  let between = 0;
  let started = 0;
  let wasBetween = new Set<number>();
  const summary = runEngine(input, {
    durationS: OPEN_ROAD.durationS,
    observe: (snapshot) => {
      const nowBetween = new Set<number>();
      for (const vehicle of snapshot.vehicles) {
        vehicleSteps++;
        speedSum += vehicle.speedMps;
        const lane = vehicle.lateralM / job.laneWidthM - 0.5;
        if (Math.abs(lane - Math.round(lane)) > 1e-6) {
          between++;
          nowBetween.add(vehicle.id);
          if (!wasBetween.has(vehicle.id)) started++;
        }
      }
      wasBetween = nowBetween;
    },
  });
  return {
    mix: job.mix,
    lanes: job.lanes,
    laneWidthM: job.laneWidthM,
    seed: job.seed,
    vehiclesThrough: summary.finalResults.vehiclesThrough,
    throughPerLane: summary.finalResults.vehiclesThrough / job.lanes,
    meanSpeedMps: speedSum / vehicleSteps,
    betweenLanesShare: between / vehicleSteps,
    laneChangesStarted: started,
    // A change is seen between lanes on every step but its last, so add one step.
    meanLaneChangeS: started > 0 ? (between / started + 1) * STEP_S : null,
    tier0: summary.tier0,
    stuckVehicles: summary.stuckVehicles,
  };
}

// ---------------------------------------------------------------------------------------------

export type JobResult = Tier0Result | T11Result | T12Result | T12PartialResult | RingResult | T15Result | OpenRoadResult;

export function runJob(job: Job, context: JobContext): JobResult {
  try {
    switch (job.kind) {
      case "tier0":
        return runTier0(job);
      case "t1.1":
        return runT11(context);
      case "t1.2":
        return runT12(context);
      case "t1.2-partial":
        return runT12Partial(context);
      case "ring":
        return runRing(job, context);
      case "t1.5":
        return runT15(job, context);
      case "open-road":
        return runOpenRoad(job);
      default:
        throw new Error(`Unknown job: ${JSON.stringify(job)}`);
    }
  } finally {
    if (!context.keepWork) rmSync(context.workDir, { recursive: true, force: true });
  }
}
