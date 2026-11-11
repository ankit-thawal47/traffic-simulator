import { describe, expect, it } from "vitest";
import { WATCH_SPEEDS, createWatchClock, fasterSpeed, formatSpeed, slowerSpeed } from "./watch-clock";

/** A clock for an engine that advances 0.2 simulated seconds per step, started at real time 0. */
function clockAt(speed: number, options: { paused?: boolean; maxStepsAtOnce?: number } = {}) {
  return createWatchClock({ stepSeconds: 0.2, speed, nowMs: 0, ...options });
}

describe("the watch clock: how many engine steps are due as real time passes", () => {
  it("at normal speed, one real second is one simulated second", () => {
    const clock = clockAt(1);

    expect(clock.stepsDue(1000)).toBe(5);
  });

  it("steps already taken are not due again, and part of a step carries over", () => {
    const clock = clockAt(1);

    expect(clock.stepsDue(300)).toBe(1);
    expect(clock.stepsDue(350)).toBe(0);
    expect(clock.stepsDue(400)).toBe(1);
  });

  it("a higher speed makes more steps due in the same real time, a lower speed fewer", () => {
    expect(clockAt(4).stepsDue(1000)).toBe(20);
    expect(clockAt(0.5).stepsDue(2000)).toBe(5);
  });

  it("a change of speed applies only from the moment it is made", () => {
    const clock = clockAt(1);

    clock.setSpeed(4, 1000);

    expect(clock.speed).toBe(4);
    // 1 s at normal speed (5 steps), then 1 s at four times (20 steps).
    expect(clock.stepsDue(2000)).toBe(25);
  });

  it("no steps come due while paused, and none are owed for the pause afterwards", () => {
    const clock = clockAt(1);

    clock.pause(1000);
    expect(clock.paused).toBe(true);
    expect(clock.stepsDue(60_000)).toBe(5);
    expect(clock.stepsDue(120_000)).toBe(0);

    clock.resume(120_000);
    expect(clock.paused).toBe(false);
    expect(clock.stepsDue(121_000)).toBe(5);
  });

  it("can start paused", () => {
    const clock = clockAt(1, { paused: true });

    expect(clock.stepsDue(5000)).toBe(0);
    clock.resume(5000);
    expect(clock.stepsDue(5200)).toBe(1);
  });

  it("when far behind, catches up by a limited number of steps and drops the rest", () => {
    const clock = clockAt(1, { maxStepsAtOnce: 10 });

    // 100 steps' worth of real time passed at once.
    expect(clock.stepsDue(20_000)).toBe(10);
    // What could not be caught up is not owed later: the run lags instead.
    expect(clock.stepsDue(20_000)).toBe(0);
    expect(clock.stepsDue(20_200)).toBe(1);
  });
});

describe("the speeds a planner can choose", () => {
  it("include normal speed, slower speeds, and at least five times normal", () => {
    expect(WATCH_SPEEDS).toContain(1);
    expect(Math.min(...WATCH_SPEEDS)).toBeLessThan(1);
    expect(Math.max(...WATCH_SPEEDS)).toBeGreaterThanOrEqual(5);
  });

  it("faster and slower move one choice at a time and stop at the ends", () => {
    expect(fasterSpeed(1)).toBe(2);
    expect(slowerSpeed(1)).toBe(0.5);
    const fastest = Math.max(...WATCH_SPEEDS);
    const slowest = Math.min(...WATCH_SPEEDS);
    expect(fasterSpeed(fastest)).toBe(fastest);
    expect(slowerSpeed(slowest)).toBe(slowest);
  });

  it("are written as a multiple of normal speed", () => {
    expect(formatSpeed(1)).toBe("1×");
    expect(formatSpeed(0.25)).toBe("0.25×");
    expect(formatSpeed(16)).toBe("16×");
  });
});
