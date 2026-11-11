import type { RunInput } from "@traffic-simulator/engine";
import oneRoad from "@traffic-simulator/engine/examples/one-road.json";
import { describe, expect, it } from "vitest";
import type { TogetherFrame } from "./run-together";
import { createMeasuredRun, type RunPlan } from "@traffic-simulator/scenario";
import { createWatch, type Watch } from "./watch";

const baseline = oneRoad as RunInput;
const proposal: RunInput = {
  ...baseline,
  network: { ...baseline.network, roads: baseline.network.roads.map((road) => ({ ...road, widthM: 7 })) },
  demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 1800 }] },
};

/** Real milliseconds between the moments the watch is asked to advance. */
const TICK_MS = 50;

/** No warm-up, so the results are the engine's own from the start of the run. The warm-up has its own tests below. */
const noWarmUp: RunPlan = { warmUpS: 0, measuredS: 3600, seeds: 5 };

function watchBoth(options: { speed?: number; paused?: boolean } = {}): Watch {
  return createWatch({
    inputs: [baseline, proposal],
    plan: noWarmUp,
    speed: options.speed ?? 1,
    paused: options.paused,
    nowMs: 0,
  });
}

/**
 * Let real time pass from `fromMs`, tick by tick, until the runs reach `untilRunTimeS`.
 * Gives back every frame seen on the way and the real time at the end.
 */
function watchUntil(watch: Watch, untilRunTimeS: number, fromMs = 0): { frames: TogetherFrame[]; nowMs: number } {
  const frames: TogetherFrame[] = [];
  let nowMs = fromMs;
  while (watch.frame().timeS < untilRunTimeS - 1e-9) {
    nowMs += TICK_MS;
    if (nowMs - fromMs > 3_600_000) throw new Error("the runs never reached the run time");
    const frame = watch.tick(nowMs);
    if (frame) frames.push(frame);
  }
  return { frames, nowMs };
}

describe("watching runs: speed and pausing change only how fast the planner watches", () => {
  it("advances every run together as real time passes", () => {
    const watch = watchBoth();

    expect(watch.frame().timeS).toBe(0);
    expect(watch.tick(100)).toBeUndefined();
    const frame = watch.tick(1000);

    expect(frame?.timeS).toBeCloseTo(1, 9);
    expect(frame?.runs).toHaveLength(2);
    expect(frame?.runs.map((run) => run.results?.timeS)).toEqual([frame?.timeS, frame?.timeS]);
  });

  it("the same scenarios watched at different speeds give identical results at the same run time", () => {
    const atNormalSpeed = watchBoth({ speed: 1 });
    const slowly = watchBoth({ speed: 0.25 });
    const quickly = watchBoth({ speed: 8 });

    const normal = watchUntil(atNormalSpeed, 120);
    const slow = watchUntil(slowly, 120);
    const quick = watchUntil(quickly, 120);

    // Watching faster really did take less real time.
    expect(quick.nowMs).toBeLessThan(normal.nowMs / 4);
    expect(slow.nowMs).toBeGreaterThan(normal.nowMs * 3);
    // Something happened on the road, and the two scenarios differ.
    const frame = atNormalSpeed.frame();
    expect(frame.timeS).toBeCloseTo(120, 9);
    expect(frame.runs[0]!.results!.vehiclesThrough).toBeGreaterThan(10);
    expect(frame.runs[0]!.results).not.toEqual(frame.runs[1]!.results);

    expect(slowly.frame()).toEqual(frame);
    expect(quickly.frame()).toEqual(frame);
  });

  it("changing speed part-way gives identical results at the same run time", () => {
    const steady = watchBoth({ speed: 1 });
    const varied = watchBoth({ speed: 1 });

    let { nowMs } = watchUntil(varied, 20);
    varied.setSpeed(16, nowMs);
    ({ nowMs } = watchUntil(varied, 80, nowMs));
    varied.setSpeed(0.5, nowMs);
    watchUntil(varied, 120, nowMs);
    watchUntil(steady, 120);

    expect(varied.speed).toBe(0.5);
    expect(varied.frame()).toEqual(steady.frame());
  });

  it("pausing holds the runs still, and resuming gives identical results at the same run time", () => {
    const uninterrupted = watchBoth();
    const interrupted = watchBoth();

    let { nowMs } = watchUntil(interrupted, 40);
    interrupted.pause(nowMs);
    const whenPaused = interrupted.frame();
    // Ten real minutes pass while paused.
    for (let i = 0; i < 100; i++) {
      nowMs += 6000;
      expect(interrupted.tick(nowMs)).toBeUndefined();
    }
    expect(interrupted.paused).toBe(true);
    expect(interrupted.frame()).toEqual(whenPaused);

    interrupted.resume(nowMs);
    watchUntil(interrupted, 120, nowMs);
    watchUntil(uninterrupted, 120);

    expect(interrupted.frame()).toEqual(uninterrupted.frame());
  });
});

describe("watching again", () => {
  it("starts the same runs from the beginning and shows the identical run", () => {
    const watch = watchBoth();
    const firstTime = watchUntil(watch, 90);

    const fromTheStart = watch.watchAgain(firstTime.nowMs);
    const secondTime = watchUntil(watch, 90, firstTime.nowMs);

    expect(fromTheStart.timeS).toBe(0);
    expect(fromTheStart).toEqual(watchBoth().frame());
    // Every frame on the way, positions of every vehicle included, is the same as the first time.
    expect(secondTime.frames.length).toBeGreaterThan(100);
    expect(secondTime.frames).toEqual(firstTime.frames);
  });

  it("shows the identical run even when watched again at another speed", () => {
    const watch = watchBoth({ speed: 1 });
    const firstTime = watchUntil(watch, 90);
    const firstEnd = watch.frame();

    watch.setSpeed(8, firstTime.nowMs);
    watch.watchAgain(firstTime.nowMs);
    const secondTime = watchUntil(watch, 90, firstTime.nowMs);

    expect(watch.speed).toBe(8);
    expect(watch.frame()).toEqual(firstEnd);
    // At 8 times, two steps pass between frames, so fewer frames are seen; each is one the first watching also showed.
    expect(secondTime.frames.length).toBeLessThan(firstTime.frames.length);
    for (const frame of secondTime.frames) expect(firstTime.frames).toContainEqual(frame);
  });

  it("stays paused when watched again while paused", () => {
    const watch = watchBoth();
    const { nowMs } = watchUntil(watch, 10);
    watch.pause(nowMs);

    const fromTheStart = watch.watchAgain(nowMs);

    expect(fromTheStart.timeS).toBe(0);
    expect(watch.tick(nowMs + 5000)).toBeUndefined();
    expect(watch.frame().timeS).toBe(0);
  });
});

describe("watching runs over the run plan", () => {
  const plan: RunPlan = { warmUpS: 20, measuredS: 40, seeds: 5 };
  const watchPlan = (speed = 1) => createWatch({ inputs: [baseline, proposal], plan, speed, nowMs: 0 });
  /** The results of each run at its end, warm-up left out, from running it alone with no watching at all. */
  const unwatched = [baseline, proposal].map((input) => {
    const run = createMeasuredRun(input, plan);
    while (!run.finished) run.step();
    return run.results();
  });

  it("covers one hour after a ten minute warm-up unless told otherwise", () => {
    const watch = createWatch({ inputs: [baseline], speed: 16, nowMs: 0 });
    const { frames } = watchUntil(watch, 600);

    expect(frames.slice(0, -1).every((frame) => frame.warmingUp && frame.runs[0]!.results === undefined)).toBe(true);
    expect(watch.frame().warmingUp).toBe(false);
    expect(watch.frame().finished).toBe(false);
  });

  it("shows no results during the warm-up, and afterwards results that leave it out", () => {
    const watch = watchPlan();

    watchUntil(watch, 19.8);
    expect(watch.frame()).toMatchObject({ warmingUp: true, finished: false });
    expect(watch.frame().runs.map((run) => run.results)).toEqual([undefined, undefined]);

    watchUntil(watch, 30);
    const frame = watch.frame();
    expect(frame.warmingUp).toBe(false);
    expect(frame.runs[0]!.results!.timeS).toBeCloseTo(10, 6);
    expect(frame.runs[0]!.snapshot.timeS).toBeCloseTo(30, 6);
  });

  it("stops at the end of the run, however much longer the planner waits", () => {
    const watch = watchPlan();
    const { nowMs } = watchUntil(watch, 60);
    const atTheEnd = watch.frame();

    expect(atTheEnd.finished).toBe(true);
    expect(atTheEnd.timeS).toBeCloseTo(60, 6);
    expect(atTheEnd.runs.map((run) => run.results)).toEqual(unwatched);
    for (let i = 1; i <= 20; i++) expect(watch.tick(nowMs + i * 1000)).toBeUndefined();
    expect(watch.frame()).toEqual(atTheEnd);
  });

  it("gives the same results at the end whatever the speed, with pauses, and when watched again", () => {
    const quickly = watchPlan(16);
    watchUntil(quickly, 60);

    const interrupted = watchPlan(0.5);
    let { nowMs } = watchUntil(interrupted, 25);
    interrupted.pause(nowMs);
    nowMs += 60_000;
    interrupted.tick(nowMs);
    interrupted.resume(nowMs);
    interrupted.setSpeed(8, nowMs);
    ({ nowMs } = watchUntil(interrupted, 45, nowMs));
    // Part-way through the results, the planner starts again from the beginning.
    expect(interrupted.watchAgain(nowMs)).toMatchObject({ timeS: 0, warmingUp: true, finished: false });
    ({ nowMs } = watchUntil(interrupted, 60, nowMs));
    // And once more after the end.
    interrupted.watchAgain(nowMs);
    watchUntil(interrupted, 60, nowMs);

    expect(quickly.frame().runs.map((run) => run.results)).toEqual(unwatched);
    expect(interrupted.frame().runs.map((run) => run.results)).toEqual(unwatched);
    expect(interrupted.frame().finished).toBe(true);
  });
});
