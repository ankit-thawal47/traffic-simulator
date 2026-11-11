/**
 * The watch clock: how fast a planner watches the runs. It turns real time
 * into a number of engine steps that are due, at the chosen speed, and none
 * while paused. It only ever decides *when* steps happen, never what a step
 * does, so the speed and pausing cannot change the results.
 */
export interface WatchClock {
  /** Simulated seconds per real second. */
  readonly speed: number;
  readonly paused: boolean;
  /** The engine steps that have come due by `nowMs` and were not reported before. */
  stepsDue(nowMs: number): number;
  setSpeed(speed: number, nowMs: number): void;
  pause(nowMs: number): void;
  resume(nowMs: number): void;
}

export function createWatchClock(options: {
  /** Simulated seconds in one engine step. */
  stepSeconds: number;
  speed: number;
  nowMs: number;
  paused?: boolean;
  /** When further behind than this, the rest is dropped and the runs lag behind real time. */
  maxStepsAtOnce?: number;
}): WatchClock {
  const stepMs = options.stepSeconds * 1000;
  const maxStepsAtOnce = options.maxStepsAtOnce ?? Infinity;
  let speed = options.speed;
  let paused = options.paused ?? false;
  let lastMs = options.nowMs;
  /** Simulated milliseconds that have come due and are not yet turned into steps. */
  let owedMs = 0;

  /** Count the real time since the last call at the speed that held during it. */
  const account = (nowMs: number) => {
    if (!paused) owedMs += Math.max(0, nowMs - lastMs) * speed;
    lastMs = nowMs;
  };

  return {
    get speed() {
      return speed;
    },
    get paused() {
      return paused;
    },
    stepsDue(nowMs) {
      account(nowMs);
      const due = Math.floor(owedMs / stepMs);
      if (due > maxStepsAtOnce) {
        owedMs = 0;
        return maxStepsAtOnce;
      }
      owedMs -= due * stepMs;
      return due;
    },
    setSpeed(next, nowMs) {
      account(nowMs);
      speed = next;
    },
    pause(nowMs) {
      account(nowMs);
      paused = true;
    },
    resume(nowMs) {
      account(nowMs);
      paused = false;
    },
  };
}

/** The speeds a planner can choose, as multiples of real time. */
export const WATCH_SPEEDS: readonly number[] = [0.25, 0.5, 1, 2, 4, 8, 16];

function nearestSpeedIndex(speed: number): number {
  let nearest = 0;
  WATCH_SPEEDS.forEach((choice, index) => {
    if (Math.abs(choice - speed) < Math.abs(WATCH_SPEEDS[nearest]! - speed)) nearest = index;
  });
  return nearest;
}

export function fasterSpeed(speed: number): number {
  return WATCH_SPEEDS[Math.min(nearestSpeedIndex(speed) + 1, WATCH_SPEEDS.length - 1)]!;
}

export function slowerSpeed(speed: number): number {
  return WATCH_SPEEDS[Math.max(nearestSpeedIndex(speed) - 1, 0)]!;
}

export function formatSpeed(speed: number): string {
  return `${speed}×`;
}
