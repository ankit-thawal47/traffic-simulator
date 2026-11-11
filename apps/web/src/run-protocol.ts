import type { Results, RunInput, Snapshot } from "@traffic-simulator/engine";

/** Messages from the page to the worker that runs the engine. */
export type RunCommand = {
  type: "start";
  input: RunInput;
  /** Simulated seconds per real second. */
  speed: number;
};

/** One moment of the run, sent from the worker to the page after a step. */
export interface RunFrame {
  type: "frame";
  snapshot: Snapshot;
  results: Results;
}
