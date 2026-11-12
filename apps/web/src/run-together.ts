import type { Results, RunInput, Snapshot } from "@traffic-simulator/engine";
import { RUN_PLAN, createMeasuredRun, type RunPlan } from "@traffic-simulator/scenario";

/** All the runs at one moment of their shared clock, in the order their inputs were given. */
export interface TogetherFrame {
  /** Simulated seconds since the start, warm-up included, the same for every run. */
  timeS: number;
  /** Still in the warm-up, which is left out of the results. */
  warmingUp: boolean;
  /** The runs have reached the end of the run plan and advance no further. */
  finished: boolean;
  /** Each run's results so far with the warm-up left out; none during the warm-up. */
  runs: { snapshot: Snapshot; results: Results | undefined }[];
}

/**
 * Several runs advanced together on one clock: every step advances all of
 * them, so they are always at the same simulated moment. The runs do not
 * affect one another. Used to run a baseline and a proposal side by side.
 * Each run covers the run plan: a warm-up, then the period its results cover.
 */
export function runTogether(inputs: RunInput[], plan: RunPlan = RUN_PLAN): { step(): void; frame(): TogetherFrame } {
  const runs = inputs.map((input) => createMeasuredRun(input, plan));
  return {
    step() {
      for (const run of runs) run.step();
    },
    frame() {
      return {
        timeS: runs[0]?.timeS ?? 0,
        warmingUp: runs[0]?.warmingUp ?? false,
        finished: runs[0]?.finished ?? true,
        runs: runs.map((run) => ({ snapshot: run.snapshot(), results: run.results() })),
      };
    },
  };
}
