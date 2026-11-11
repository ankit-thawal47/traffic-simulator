/**
 * The run plan (spec: Runs and results): a run covers one simulated hour after
 * a 10 minute warm-up that is left out of the results, and each scenario runs
 * with five seeds. Plain logic with no browser dependencies, so the app's
 * worker, a command and the tests all run a scenario the same way.
 */
import { STEP_SECONDS, createRun, resultsExcludingWarmUp, type Results, type RunInput, type Snapshot } from "@traffic-simulator/engine";

export interface RunPlan {
  /** The first seconds of a run, which fill the network and are left out of the results. */
  warmUpS: number;
  /** The seconds after the warm-up that the results cover. */
  measuredS: number;
  /** How many seeds each scenario runs with. */
  seeds: number;
}

export const RUN_PLAN: RunPlan = { warmUpS: 600, measuredS: 3600, seeds: 5 };

/**
 * The seeds a scenario runs with: the scenario's own seed first (the run the
 * planner watches), then the whole numbers that follow it. So a scenario with
 * seed 7 runs with 7, 8, 9, 10 and 11, every time. The engine mixes the seed
 * into each of its random streams, so neighbouring seeds give unrelated runs.
 *
 * A baseline and its proposal have the same seed, so they run with the same
 * five seeds and each proposal run meets the same arrivals as its baseline run.
 */
export function seedsFor(scenarioSeed: number, count: number = RUN_PLAN.seeds): number[] {
  return Array.from({ length: count }, (_, index) => scenarioSeed + index);
}

/** One run of the engine over the run plan: a warm-up, then the period the results cover, then it is finished. */
export interface MeasuredRun {
  /** Simulated seconds since the start of the run, warm-up included. */
  readonly timeS: number;
  readonly warmingUp: boolean;
  /** The run has reached its end. A finished run no longer advances. */
  readonly finished: boolean;
  /** Advance by one engine step; nothing once finished. */
  step(): void;
  snapshot(): Snapshot;
  /** The results so far with the warm-up left out; nothing during the warm-up. */
  results(): Results | undefined;
}

export function createMeasuredRun(input: RunInput, plan: RunPlan = RUN_PLAN): MeasuredRun {
  const run = createRun(input);
  // Counted in steps, so the ends fall on the same step whatever the rounding of run time.
  const warmUpSteps = Math.round(plan.warmUpS / STEP_SECONDS);
  const lastStep = warmUpSteps + Math.round(plan.measuredS / STEP_SECONDS);
  let steps = 0;
  let atEndOfWarmUp: Results | undefined = warmUpSteps === 0 ? run.results() : undefined;

  return {
    get timeS() {
      return run.timeS;
    },
    get warmingUp() {
      return atEndOfWarmUp === undefined;
    },
    get finished() {
      return steps >= lastStep;
    },
    step() {
      if (steps >= lastStep) return;
      run.step();
      steps++;
      if (steps === warmUpSteps) atEndOfWarmUp = run.results();
    },
    snapshot: () => run.snapshot(),
    results: () => (atEndOfWarmUp ? resultsExcludingWarmUp(atEndOfWarmUp, run.results()) : undefined),
  };
}

/**
 * Run the engine's input with every seed of the run plan, one run after
 * another, to the end. Gives the results of each seed, warm-up left out, in
 * the order of seedsFor(input.seed). The same input always gives the same results.
 */
export function runEverySeed(input: RunInput, plan: RunPlan = RUN_PLAN): Results[] {
  return seedsFor(input.seed, plan.seeds).map((seed) => {
    const run = createMeasuredRun({ ...input, seed }, plan);
    while (!run.finished) run.step();
    return run.results()!;
  });
}
