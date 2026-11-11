import type { RunInput } from "@traffic-simulator/engine";
import type { TogetherFrame } from "./run-together";

/** Messages from the page to the worker that runs the engine. */
export type RunCommand =
  | {
      type: "start";
      /** One engine input per run. The runs advance together on one clock. */
      inputs: RunInput[];
      /** Simulated seconds per real second. */
      speed: number;
      paused: boolean;
    }
  /** Watch faster or slower. This changes how fast the runs are shown, never their results. */
  | { type: "set-speed"; speed: number }
  | { type: "pause" }
  | { type: "resume" }
  /** Start the same runs again from the beginning, with the same seeds. */
  | { type: "watch-again" };

/** One moment of the runs' shared clock, sent from the worker to the page after a step. */
export interface RunFrame extends TogetherFrame {
  type: "frame";
}
