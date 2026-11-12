import { describe, expect, it } from "vitest";
import { checkRunConsistency } from "../src/consistency-checks";
import { createRun, type RunInput } from "../src/index";
import { flyoverDemand, flyoverNetworkWithFeed, flyoverNetworkWithSplitExit, weavingDemand } from "./flyover-network";

/** Run for an hour; count vehicles that stood (under 0.1 m/s) for 300 s on end, and those that stood 5 s or more on one road. */
function hour(run: RunInput, watchRoadId: string): { stood300s: number; stoodOnRoad: number; through: number; throughInLastThird: number; entered: number; waiting: number } {
  const engine = createRun(run);
  const since = new Map<number, number>();
  const stood = new Set<number>();
  const stoodOnRoad = new Set<number>();
  let throughAt40Min = 0;
  while (engine.timeS < 3600 - 1e-9) {
    engine.step();
    if (Math.round(engine.timeS * 5) % 5 !== 0) continue;
    if (Math.round(engine.timeS) === 2400) throughAt40Min = engine.results().vehiclesThrough;
    for (const vehicle of engine.snapshot().vehicles) {
      if (vehicle.speedMps >= 0.1) {
        since.delete(vehicle.id);
        continue;
      }
      if (!since.has(vehicle.id)) since.set(vehicle.id, engine.timeS);
      if (engine.timeS - since.get(vehicle.id)! >= 300) stood.add(vehicle.id);
      if (vehicle.roadId === watchRoadId && engine.timeS - since.get(vehicle.id)! >= 5) stoodOnRoad.add(vehicle.id);
    }
  }
  const results = engine.results();
  return {
    stood300s: stood.size,
    stoodOnRoad: stoodOnRoad.size,
    through: results.vehiclesThrough,
    throughInLastThird: results.vehiclesThrough - throughAt40Min,
    entered: results.vehiclesEntered,
    waiting: results.vehiclesWaitingToEnter,
  };
}

/**
 * Traffic that does not enter the network on the road that divides: it enters
 * on a road before it, and must be on the side its route leaves from by the
 * time it reaches the diverge.
 */
describe("a diverge reached along a road before it", () => {
  const input = (seed: number, laneDiscipline: boolean, through = 1800, turning = 600): RunInput => ({
    network: flyoverNetworkWithFeed(),
    demand: flyoverDemand(through, turning, 400, true, "south-feed"),
    seed,
    laneDiscipline,
  });

  it.each([false, true])("is reached with traffic already on the side its route leaves from: nobody stands at it (lane discipline %s)", { timeout: 240_000 }, (laneDiscipline) => {
    const counted = hour(input(71, laneDiscipline), "south-entry");
    // 2800 vehicles an hour arrive, well within what the roads carry.
    expect(counted.through).toBeGreaterThan(2500);
    expect(counted.waiting).toBeLessThan(20);
    expect(counted.stood300s).toBe(0);
    expect(counted.stoodOnRoad).toBeLessThan(counted.entered * 0.01);
  });

  it.each([
    [72, false],
    [73, true],
  ])("passes the consistency checks, loaded beyond what the road carries (seed %i, lane discipline %s)", { timeout: 240_000 }, (seed, laneDiscipline) => {
    const report = checkRunConsistency(input(seed, laneDiscipline, 9000, 900), { durationS: 600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(400);
  });

  it.each([false, true])("leaves no vehicle standing for 300 s in an hour loaded beyond what the road carries (lane discipline %s)", { timeout: 240_000 }, (laneDiscipline) => {
    const counted = hour(input(74, laneDiscipline, 9000, 900), "south-entry");
    expect(counted.stood300s).toBe(0);
    expect(counted.through).toBeGreaterThan(laneDiscipline ? 3000 : 5000);
  });
});

/**
 * Traffic that arrives on the wrong side and has to cross over: off the
 * flyover on the right and from the junction on the left, with half of each
 * bound for the exit on the other side, on 185 m of road.
 */
describe("sorting for a diverge on a weaving section", () => {
  const weaving = (seed: number, laneDiscipline: boolean, toEachExit: number, cross: number): RunInput => ({
    network: flyoverNetworkWithSplitExit(),
    demand: weavingDemand(toEachExit, cross),
    seed,
    laneDiscipline,
  });

  it.each([false, true])("gets every vehicle across to its side: none stands for 300 s in an hour of busy traffic (lane discipline %s)", { timeout: 240_000 }, (laneDiscipline) => {
    // 3400 vehicles an hour over the weaving section.
    const counted = hour(weaving(81, laneDiscipline, 1500, 400), "north-exit");
    expect(counted.stood300s).toBe(0);
    expect(counted.through).toBeGreaterThan(3500);
    expect(counted.waiting).toBeLessThan(20);
    // Still discharging at the end: the last 20 minutes carry a third of the hour.
    expect(counted.throughInLastThird).toBeGreaterThan(1100);
  });

  it.each([
    [85, false],
    [86, true],
  ])("passes the consistency checks while vehicles wait, give way and cross over (seed %i, lane discipline %s)", { timeout: 240_000 }, (seed, laneDiscipline) => {
    const report = checkRunConsistency(weaving(seed, laneDiscipline, 3000, 600), { durationS: 600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(300);
  });

  it("keeps discharging in mixed traffic for an hour loaded beyond what the road carries", { timeout: 240_000 }, () => {
    const counted = hour(weaving(81, false, 3000, 600), "north-exit");
    expect(counted.stood300s).toBe(0);
    expect(counted.throughInLastThird).toBeGreaterThan(1800);
  });
});
