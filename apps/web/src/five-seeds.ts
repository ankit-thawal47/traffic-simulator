import { STEP_SECONDS, type Results, type RunInput } from "@traffic-simulator/engine";
import { RUN_PLAN, createMeasuredRun, seedsFor, type RunPlan } from "@traffic-simulator/scenario";
import type { TogetherFrame } from "./run-together";

/**
 * The run coordinator's logic (spec: Run coordinator). Each scenario runs with
 * the seeds of the run plan. All of them run unseen, as fast as the engine
 * goes (runUnseenSeeds), and their results are collected here: the figures
 * come from these runs alone. The run the planner watches (watch.ts) is the
 * first seed again, at the speed they chose: it is one of the runs behind the
 * figures, shown, and nothing is taken from it. Nothing in this file knows
 * about workers or timers, so it is tested from the command line; the workers
 * only carry its messages.
 *
 * So how the planner watches cannot change the figures, and the figures do
 * not wait for the planner to watch a run to its end.
 */

/** What the unseen seeds report, in the order it happens. `seedIndex` counts from 0, the seed the planner also watches. */
export type UnseenSeedEvent =
  /** How far through one seed's runs the engine is, from 0 to 1. */
  | { type: "seed-progress"; seedIndex: number; fraction: number }
  /** A seed has run to its end for every scenario. One set of results per input, warm-up left out. */
  | { type: "seed-finished"; seedIndex: number; results: Results[] };

/** How many times progress is reported through one seed. */
const PROGRESS_REPORTS_PER_SEED = 20;

/**
 * Run every seed, one after another, to the end. For each seed
 * all the inputs (baseline, proposal) run together, each with that seed in
 * place of its own, so a seed's results arrive for both at once.
 *
 * It never waits: whoever drives it decides when to look up. In the app that
 * is a worker of its own, so the page and the watched run are not held up.
 */
export function* runUnseenSeeds(inputs: RunInput[], plan: RunPlan = RUN_PLAN): Generator<UnseenSeedEvent> {
  const seeds = inputs.map((input) => seedsFor(input.seed, plan.seeds));
  const steps = Math.round((plan.warmUpS + plan.measuredS) / STEP_SECONDS);
  const stepsBetweenReports = Math.max(1, Math.round(steps / PROGRESS_REPORTS_PER_SEED));
  for (let seedIndex = 0; seedIndex < plan.seeds; seedIndex++) {
    const runs = inputs.map((input, at) => createMeasuredRun({ ...input, seed: seeds[at]![seedIndex]! }, plan));
    let done = 0;
    while (runs.some((run) => !run.finished)) {
      for (const run of runs) run.step();
      done++;
      if (done % stepsBetweenReports === 0) yield { type: "seed-progress", seedIndex, fraction: Math.min(1, done / steps) };
    }
    yield { type: "seed-finished", seedIndex, results: runs.map((run) => run.results()!) };
  }
}

/** Where the watched run is. */
export interface WatchedRun {
  /** Simulated seconds since its start, warm-up included. */
  timeS: number;
  warmingUp: boolean;
  finished: boolean;
}

/** What has been collected so far for one pair of scenarios. Plain data; every change gives a new value. */
export interface FiveSeeds {
  plan: RunPlan;
  /** The run the planner is watching, once its first frame has arrived. */
  watched?: WatchedRun;
  /** For each seed: its results per scenario once it has finished. */
  results: (Results[] | undefined)[];
  /** For each seed: how far through it is, from 0 to 1. */
  fractions: number[];
}

export function newFiveSeeds(plan: RunPlan = RUN_PLAN): FiveSeeds {
  return {
    plan,
    results: Array.from({ length: plan.seeds }, () => undefined),
    fractions: Array.from({ length: plan.seeds }, () => 0),
  };
}

function withSeed(collected: FiveSeeds, seedIndex: number, fraction: number, results?: Results[]): FiveSeeds {
  return {
    ...collected,
    fractions: collected.fractions.map((old, at) => (at === seedIndex ? fraction : old)),
    results: results ? collected.results.map((old, at) => (at === seedIndex ? results : old)) : collected.results,
  };
}

export function withUnseenSeedEvent(collected: FiveSeeds, event: UnseenSeedEvent): FiveSeeds {
  if (event.type === "seed-finished") return withSeed(collected, event.seedIndex, 1, event.results);
  return withSeed(collected, event.seedIndex, event.fraction);
}

/**
 * Take in a frame of the watched run: only where it is, for the clock. Its
 * results are not taken; the same seed runs unseen with the others.
 */
export function withWatchedFrame(collected: FiveSeeds, frame: TogetherFrame): FiveSeeds {
  return { ...collected, watched: { timeS: frame.timeS, warmingUp: frame.warmingUp, finished: frame.finished } };
}

/** The results in hand, ready to compare (compareAcrossSeeds), and how complete they are. */
export interface CollectedResults {
  seedsFinished: number;
  seeds: number;
  /** Fewer than all the seeds have finished, so averages and ranges are over some of them only. */
  partial: boolean;
  /** How far through all the seeds together, from 0 to 1. */
  progress: number;
  /** The results of each finished seed, for the first input and for the second. */
  baseline: Results[];
  proposal: Results[];
}

export function collectedResults(collected: FiveSeeds): CollectedResults {
  const finished = collected.results.filter((results): results is Results[] => results !== undefined);
  const seeds = collected.plan.seeds;
  return {
    seedsFinished: finished.length,
    seeds,
    partial: finished.length < seeds,
    progress: collected.fractions.reduce((sum, fraction) => sum + fraction, 0) / seeds,
    baseline: finished.flatMap((results) => (results[0] ? [results[0]] : [])),
    proposal: finished.flatMap((results) => (results[1] ? [results[1]] : [])),
  };
}
