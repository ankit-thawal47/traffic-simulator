import { createRun, STEP_SECONDS } from "@traffic-simulator/engine";
import { buildMeasurementScenario } from "./scenario";

export interface EngineBenchOptions {
  targetVehicles: number;
  seed: number;
  /** Steps run and thrown away before timing starts (lets the JavaScript engine optimise the code). */
  warmUpSteps: number;
  blocks: number;
  stepsPerBlock: number;
  /** Also build a snapshot after every step, as the worker must before it can post one. */
  snapshotEveryStep: boolean;
}

export interface EngineBenchResult extends EngineBenchOptions {
  stepSeconds: number;
  /** Simulated seconds per real second over the whole timed part. */
  simSecondsPerRealSecond: number;
  /** The same, for each timed block. */
  blockRates: number[];
  msPerStep: number;
  vehiclesOnNetwork: { min: number; mean: number; max: number };
  /** Reported so the work cannot be skipped by the optimiser, and to show which run it was. */
  vehiclesThrough: number;
  snapshotVehiclesSeen: number;
}

/** Time the engine alone. Uses only performance.now(), so it runs in Node and in a browser worker. */
export function measureEngine(options: EngineBenchOptions): EngineBenchResult {
  const run = createRun(buildMeasurementScenario(options.targetVehicles, options.seed));
  let snapshotVehiclesSeen = 0;
  const advance = (steps: number) => {
    for (let i = 0; i < steps; i++) {
      run.step();
      if (options.snapshotEveryStep) snapshotVehiclesSeen += run.snapshot().vehicles.length;
    }
  };
  advance(options.warmUpSteps);

  const blockRates: number[] = [];
  const counts: number[] = [run.results().vehiclesOnNetwork];
  let totalMs = 0;
  for (let b = 0; b < options.blocks; b++) {
    const startedAt = performance.now();
    advance(options.stepsPerBlock);
    const ms = performance.now() - startedAt;
    totalMs += ms;
    blockRates.push((options.stepsPerBlock * STEP_SECONDS) / (ms / 1000));
    counts.push(run.results().vehiclesOnNetwork);
  }
  const steps = options.blocks * options.stepsPerBlock;
  return {
    ...options,
    stepSeconds: STEP_SECONDS,
    simSecondsPerRealSecond: (steps * STEP_SECONDS) / (totalMs / 1000),
    blockRates,
    msPerStep: totalMs / steps,
    vehiclesOnNetwork: {
      min: Math.min(...counts),
      mean: counts.reduce((a, b) => a + b, 0) / counts.length,
      max: Math.max(...counts),
    },
    vehiclesThrough: run.results().vehiclesThrough,
    snapshotVehiclesSeen,
  };
}
