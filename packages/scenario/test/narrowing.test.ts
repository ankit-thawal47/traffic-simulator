import { describe, expect, it } from "vitest";
import { createRun, type Results } from "@traffic-simulator/engine";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import {
  baselineOf,
  compareResults,
  createBaseline,
  resolveScenario,
  withRoadWidth,
  type Scenario,
} from "../src/index";

function resultsAfter(scenario: Scenario, seconds: number): Results {
  const run = createRun(resolveScenario(scenario));
  while (run.timeS < seconds - 1e-9) run.step();
  return run.results();
}

/** The mixed-traffic example the app opens with: one 10.5 m road, four vehicle classes. */
function oneRoad(vehiclesPerHour: number, seed: number): Scenario {
  return createBaseline({
    name: "One road",
    network: mixedTraffic.network as Scenario["network"],
    demand: { ...mixedTraffic.demand, flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour }] },
    seed,
  });
}

const TEN_MINUTES_S = 600;

function compared(proposal: Scenario) {
  const before = resultsAfter(baselineOf(proposal), TEN_MINUTES_S);
  const after = resultsAfter(proposal, TEN_MINUTES_S);
  const rows = compareResults(before, after);
  const row = (id: string) => rows.find((candidate) => candidate.id === id)!;
  // Vehicles waiting to enter are not in the fixed result set (ADR 0005), so they are read from the engine's results.
  return {
    through: row("vehicles-through"),
    waiting: { baseline: before.vehiclesWaitingToEnter, proposal: after.vehiclesWaitingToEnter },
  };
}

describe("narrowing a road that carries mixed traffic", () => {
  it("lowers its throughput in the results when the demand is more than the narrower road can carry", () => {
    // The example's own demand, 6000 vehicles an hour; 10.5 m narrowed to one 3.5 m lane's width.
    const { through, waiting } = compared(withRoadWidth(oneRoad(6000, 1), "main", 3.5));

    expect(through.proposal!).toBeLessThan(through.baseline!);
    // Seen: 945 through in the baseline and 740 in the proposal, about a fifth fewer.
    expect(through.changePercent!).toBeLessThan(-15);
    // The demand is the same, so the vehicles that did not get through are held back at the entry.
    expect(waiting.baseline).toBe(0);
    expect(waiting.proposal!).toBeGreaterThan(100);
  });

  it.each([1, 2, 3, 4, 5])("does so with seed %i", (seed) => {
    const { through } = compared(withRoadWidth(oneRoad(6000, seed), "main", 3.5));

    expect(through.changePercent!).toBeLessThan(-15);
  });

  it("the narrower the road, the fewer vehicles get through", () => {
    const through = [10.5, 7, 5, 3.5, 3].map(
      (widthM) => resultsAfter(withRoadWidth(oneRoad(12000, 1), "main", widthM), TEN_MINUTES_S).vehiclesThrough,
    );

    expect(through).toEqual([...through].sort((a, b) => b - a));
    expect(new Set(through).size).toBe(through.length);
  });

  it("changes almost nothing when the demand is well within what the narrower road can carry", () => {
    const { through } = compared(withRoadWidth(oneRoad(3000, 1), "main", 3.5));

    expect(Math.abs(through.changePercent!)).toBeLessThan(2);
  });

  it("the narrowed road passes the consistency checks", () => {
    const narrowed = resolveScenario(withRoadWidth(oneRoad(6000, 1), "main", 3.5));

    expect(checkRunConsistency(narrowed, { durationS: 300 }).violations).toEqual([]);
  });
});
