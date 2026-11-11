import { createRun, type Results, type RunInput, type Snapshot } from "@traffic-simulator/engine";

/** All the runs at one moment of their shared clock, in the order their inputs were given. */
export interface TogetherFrame {
  /** Simulated seconds since the start, the same for every run. */
  timeS: number;
  runs: { snapshot: Snapshot; results: Results }[];
}

/**
 * Several runs advanced together on one clock: every step advances all of
 * them, so they are always at the same simulated moment. The runs do not
 * affect one another. Used to run a baseline and a proposal side by side.
 */
export function runTogether(inputs: RunInput[]): { step(): void; frame(): TogetherFrame } {
  const runs = inputs.map((input) => createRun(input));
  return {
    step() {
      for (const run of runs) run.step();
    },
    frame() {
      return {
        timeS: runs[0]?.timeS ?? 0,
        runs: runs.map((run) => ({ snapshot: run.snapshot(), results: run.results() })),
      };
    },
  };
}
