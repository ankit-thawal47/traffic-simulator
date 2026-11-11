import { STEP_SECONDS, type RunInput } from "@traffic-simulator/engine";
import type { RunPlan } from "@traffic-simulator/scenario";
import { runTogether, type TogetherFrame } from "./run-together";
import { createWatchClock } from "./watch-clock";

/**
 * Runs being watched: the runs advance together on one clock, as fast as the
 * planner has chosen to watch. Nothing here knows about real timers; the
 * caller says what the real time is, so the same thing can be driven by a
 * worker's timer or by a test.
 */
export interface Watch {
  /** Simulated seconds per real second. */
  readonly speed: number;
  readonly paused: boolean;
  /** All the runs as they are now. */
  frame(): TogetherFrame;
  /**
   * Advance the runs by the steps that have come due. Gives the new frame, or
   * nothing if no step was due or the runs have already reached their end.
   */
  tick(nowMs: number): TogetherFrame | undefined;
  setSpeed(speed: number, nowMs: number): void;
  pause(nowMs: number): void;
  resume(nowMs: number): void;
  /** Start the same runs again from the beginning: same inputs, same seeds, so the identical runs. */
  watchAgain(nowMs: number): TogetherFrame;
}

/** If the runs fall behind real time, catch up by at most this many steps at once, then let them lag. */
const MAX_STEPS_AT_ONCE = 10;

export function createWatch(options: {
  inputs: RunInput[];
  /** What each run covers; the run plan of the spec unless given. */
  plan?: RunPlan;
  speed: number;
  paused?: boolean;
  nowMs: number;
}): Watch {
  let runs = runTogether(options.inputs, options.plan);
  let finished = runs.frame().finished;
  let clock = createWatchClock({
    stepSeconds: STEP_SECONDS,
    speed: options.speed,
    paused: options.paused,
    nowMs: options.nowMs,
    maxStepsAtOnce: MAX_STEPS_AT_ONCE,
  });

  return {
    get speed() {
      return clock.speed;
    },
    get paused() {
      return clock.paused;
    },
    frame: () => runs.frame(),
    tick(nowMs) {
      const steps = clock.stepsDue(nowMs);
      if (steps === 0 || finished) return undefined;
      for (let i = 0; i < steps; i++) runs.step();
      const frame = runs.frame();
      finished = frame.finished;
      return frame;
    },
    setSpeed: (speed, nowMs) => clock.setSpeed(speed, nowMs),
    pause: (nowMs) => clock.pause(nowMs),
    resume: (nowMs) => clock.resume(nowMs),
    watchAgain(nowMs) {
      runs = runTogether(options.inputs, options.plan);
      finished = false;
      clock = createWatchClock({
        stepSeconds: STEP_SECONDS,
        speed: clock.speed,
        paused: clock.paused,
        nowMs,
        maxStepsAtOnce: MAX_STEPS_AT_ONCE,
      });
      return runs.frame();
    },
  };
}
