import type { RunInput } from "@traffic-simulator/engine";
import oneRoad from "@traffic-simulator/engine/examples/one-road.json";
import { compareAcrossSeeds, runEverySeed, type RunPlan } from "@traffic-simulator/scenario";
import { describe, expect, it } from "vitest";
import { collectedResults, newFiveSeeds, runUnseenSeeds, withUnseenSeedEvent, withWatchedFrame, type FiveSeeds } from "./five-seeds";
import { createWatch, type Watch } from "./watch";

const baseline: RunInput = { ...(oneRoad as RunInput), seed: 20 };
const proposal: RunInput = {
  ...baseline,
  demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 300 }] },
};
const inputs = [baseline, proposal];
/** Short, so the tests are quick: one minute of warm-up, then three minutes of results. */
const plan: RunPlan = { warmUpS: 60, measuredS: 180, seeds: 5 };

/** What every seed gives when simply run to the end, with no app around it. */
const expected = { baseline: runEverySeed(baseline, plan), proposal: runEverySeed(proposal, plan) };

function watchUntil(watch: Watch, untilRunTimeS: number, fromMs: number, each: (watch: Watch) => void): number {
  let nowMs = fromMs;
  while (watch.frame().timeS < untilRunTimeS - 1e-9) {
    nowMs += 50;
    if (watch.tick(nowMs)) each(watch);
  }
  return nowMs;
}

describe("the seeds that run unseen", () => {
  it("are the four after the watched one, each run to its end for every scenario, in order", () => {
    const finished = [...runUnseenSeeds(inputs, plan)].filter((event) => event.type === "seed-finished");

    expect(finished.map((event) => event.seedIndex)).toEqual([1, 2, 3, 4]);
    for (const event of finished) {
      expect(event.results).toEqual([expected.baseline[event.seedIndex], expected.proposal[event.seedIndex]]);
    }
  });

  it("report progress through each seed on the way", () => {
    const events = [...runUnseenSeeds(inputs, plan)];

    for (const seedIndex of [1, 2, 3, 4]) {
      const fractions = events.flatMap((event) =>
        event.type === "seed-progress" && event.seedIndex === seedIndex ? [event.fraction] : [],
      );
      expect(fractions.length).toBeGreaterThanOrEqual(10);
      expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
      expect(fractions[0]).toBeGreaterThan(0);
      expect(fractions.at(-1)).toBeLessThanOrEqual(1);
      // Half-way through the seed's steps is reported as about half.
      expect(fractions.some((fraction) => fraction > 0.4 && fraction < 0.6)).toBe(true);
    }
  });
});

describe("collecting results across the five seeds", () => {
  it("starts with nothing finished and says the figures are partial", () => {
    const start = newFiveSeeds(plan);

    expect(collectedResults(start)).toEqual({ seedsFinished: 0, seeds: 5, partial: true, progress: 0, baseline: [], proposal: [] });
  });

  it("takes in each unseen seed as it finishes, and its progress before that", () => {
    let collected = newFiveSeeds(plan);
    collected = withUnseenSeedEvent(collected, { type: "seed-progress", seedIndex: 1, fraction: 0.5 });

    expect(collectedResults(collected)).toMatchObject({ seedsFinished: 0, progress: 0.1, partial: true });

    collected = withUnseenSeedEvent(collected, {
      type: "seed-finished",
      seedIndex: 1,
      results: [expected.baseline[1]!, expected.proposal[1]!],
    });
    collected = withUnseenSeedEvent(collected, { type: "seed-progress", seedIndex: 2, fraction: 0.25 });

    expect(collectedResults(collected)).toEqual({
      seedsFinished: 1,
      seeds: 5,
      partial: true,
      progress: 0.25,
      baseline: [expected.baseline[1]],
      proposal: [expected.proposal[1]],
    });
  });

  it("counts the watched run as the first seed only once it has reached its end", () => {
    const watch = createWatch({ inputs, plan, speed: 16, nowMs: 0 });
    let collected = newFiveSeeds(plan);
    const take = (watching: Watch) => (collected = withWatchedFrame(collected, watching.frame()));

    const nowMs = watchUntil(watch, 120, 0, take);

    expect(collected.watched).toMatchObject({ warmingUp: false, finished: false });
    expect(collected.watched!.timeS).toBeCloseTo(120, 6);
    // 120 of 240 seconds of one seed of five.
    expect(collectedResults(collected)).toMatchObject({ seedsFinished: 0, partial: true, baseline: [], proposal: [] });
    expect(collectedResults(collected).progress).toBeCloseTo(0.1, 6);

    watchUntil(watch, 240, nowMs, take);

    expect(collected.watched).toMatchObject({ finished: true });
    expect(collectedResults(collected)).toMatchObject({
      seedsFinished: 1,
      partial: true,
      baseline: [expected.baseline[0]],
      proposal: [expected.proposal[0]],
    });
  });

  /** Everything the page would receive: every unseen seed, and the watched run as the planner chose to watch it. */
  function collectWhileWatching(watching: (watch: Watch, take: (watch: Watch) => void) => void): FiveSeeds {
    let collected = newFiveSeeds(plan);
    for (const event of runUnseenSeeds(inputs, plan)) collected = withUnseenSeedEvent(collected, event);
    const watch = createWatch({ inputs, plan, speed: 1, nowMs: 0 });
    watching(watch, (current) => (collected = withWatchedFrame(collected, current.frame())));
    return collected;
  }

  it("gives the same averages and ranges whatever the speed, with pauses, and when watched again", () => {
    const straightThrough = collectWhileWatching((watch, take) => {
      watchUntil(watch, 240, 0, take);
    });
    const fussedWith = collectWhileWatching((watch, take) => {
      watch.setSpeed(16, 0);
      let nowMs = watchUntil(watch, 100, 0, take);
      watch.pause(nowMs);
      nowMs += 120_000;
      watch.tick(nowMs);
      watch.resume(nowMs);
      watch.setSpeed(0.5, nowMs);
      nowMs = watchUntil(watch, 110, nowMs, take);
      // Started again part-way through, then watched to the end, then started again after the end.
      watch.watchAgain(nowMs);
      take(watch);
      watch.setSpeed(8, nowMs);
      nowMs = watchUntil(watch, 240, nowMs, take);
      watch.watchAgain(nowMs);
      take(watch);
      watchUntil(watch, 30, nowMs, take);
    });

    const plain = collectedResults(straightThrough);
    const fussed = collectedResults(fussedWith);
    expect(plain).toMatchObject({ seedsFinished: 5, partial: false, progress: 1 });
    expect(fussed).toMatchObject({ seedsFinished: 5, partial: false, progress: 1 });
    expect(plain.baseline).toEqual(expected.baseline);
    expect(plain.proposal).toEqual(expected.proposal);
    expect(compareAcrossSeeds(fussed.baseline, fussed.proposal)).toEqual(
      compareAcrossSeeds(expected.baseline, expected.proposal),
    );
    // The run being watched again is back in its warm-up, and the first seed's results stand.
    expect(fussedWith.watched).toMatchObject({ warmingUp: true, finished: false });
  });

  it("is not finished while the planner has not watched the first seed to its end", () => {
    const leftEarly = collectWhileWatching((watch, take) => {
      watchUntil(watch, 200, 0, take);
    });

    expect(collectedResults(leftEarly)).toMatchObject({ seedsFinished: 4, partial: true });
    expect(collectedResults(leftEarly).baseline).toEqual(expected.baseline.slice(1));
  });
});
