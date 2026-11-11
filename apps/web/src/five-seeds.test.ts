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
  it("are all five, the watched seed among them, each run to its end for every scenario, in order", () => {
    const finished = [...runUnseenSeeds(inputs, plan)].filter((event) => event.type === "seed-finished");

    expect(finished.map((event) => event.seedIndex)).toEqual([0, 1, 2, 3, 4]);
    for (const event of finished) {
      expect(event.results).toEqual([expected.baseline[event.seedIndex], expected.proposal[event.seedIndex]]);
    }
  });

  it("report progress through each seed on the way", () => {
    const events = [...runUnseenSeeds(inputs, plan)];

    for (const seedIndex of [0, 1, 2, 3, 4]) {
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

  it("takes in each seed as it finishes, and its progress before that", () => {
    let collected = newFiveSeeds(plan);
    collected = withUnseenSeedEvent(collected, { type: "seed-progress", seedIndex: 0, fraction: 0.5 });

    expect(collectedResults(collected)).toMatchObject({ seedsFinished: 0, progress: 0.1, partial: true });

    collected = withUnseenSeedEvent(collected, {
      type: "seed-finished",
      seedIndex: 0,
      results: [expected.baseline[0]!, expected.proposal[0]!],
    });
    collected = withUnseenSeedEvent(collected, { type: "seed-progress", seedIndex: 1, fraction: 0.25 });

    expect(collectedResults(collected)).toEqual({
      seedsFinished: 1,
      seeds: 5,
      partial: true,
      progress: 0.25,
      baseline: [expected.baseline[0]],
      proposal: [expected.proposal[0]],
    });
  });

  it("is complete once all five have finished, without the planner watching at all", () => {
    let collected = newFiveSeeds(plan);
    for (const event of runUnseenSeeds(inputs, plan)) collected = withUnseenSeedEvent(collected, event);

    expect(collected.watched).toBeUndefined();
    expect(collectedResults(collected)).toEqual({
      seedsFinished: 5,
      seeds: 5,
      partial: false,
      progress: 1,
      baseline: expected.baseline,
      proposal: expected.proposal,
    });
  });

  it("the watched run only shows where it is: it adds nothing to the figures or to the progress", () => {
    const watch = createWatch({ inputs, plan, speed: 16, nowMs: 0 });
    let collected = newFiveSeeds(plan);
    const take = (watching: Watch) => (collected = withWatchedFrame(collected, watching.frame()));

    const nowMs = watchUntil(watch, 120, 0, take);

    expect(collected.watched).toMatchObject({ warmingUp: false, finished: false });
    expect(collected.watched!.timeS).toBeCloseTo(120, 6);
    expect(collectedResults(collected)).toEqual(collectedResults(newFiveSeeds(plan)));

    watchUntil(watch, 240, nowMs, take);

    expect(collected.watched).toMatchObject({ finished: true });
    expect(collectedResults(collected)).toEqual(collectedResults(newFiveSeeds(plan)));
  });

  it("what the planner watches is the first of the five runs behind the figures", () => {
    const watch = createWatch({ inputs, plan, speed: 16, nowMs: 0 });
    watchUntil(watch, 240, 0, () => undefined);

    expect(watch.frame().runs.map((run) => run.results)).toEqual([expected.baseline[0], expected.proposal[0]]);
  });

  /** Everything the page would receive: every seed, and the watched run as the planner chose to watch it, interleaved. */
  function collectWhileWatching(watching: (watch: Watch, take: (watch: Watch) => void) => void): FiveSeeds {
    let collected = newFiveSeeds(plan);
    const events = [...runUnseenSeeds(inputs, plan)];
    const half = Math.floor(events.length / 2);
    for (const event of events.slice(0, half)) collected = withUnseenSeedEvent(collected, event);
    const watch = createWatch({ inputs, plan, speed: 1, nowMs: 0 });
    watching(watch, (current) => (collected = withWatchedFrame(collected, current.frame())));
    for (const event of events.slice(half)) collected = withUnseenSeedEvent(collected, event);
    return collected;
  }

  it("gives the same averages and ranges whatever the speed, with pauses, when watched again, or left early", () => {
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
    const leftEarly = collectWhileWatching((watch, take) => {
      watchUntil(watch, 20, 0, take);
    });

    for (const collected of [straightThrough, fussedWith, leftEarly]) {
      const results = collectedResults(collected);
      expect(results).toMatchObject({ seedsFinished: 5, partial: false, progress: 1 });
      expect(results.baseline).toEqual(expected.baseline);
      expect(results.proposal).toEqual(expected.proposal);
      expect(compareAcrossSeeds(results.baseline, results.proposal)).toEqual(
        compareAcrossSeeds(expected.baseline, expected.proposal),
      );
    }
    // The run being watched again is back in its warm-up, and the figures stand.
    expect(fussedWith.watched).toMatchObject({ warmingUp: true, finished: false });
  });
});
