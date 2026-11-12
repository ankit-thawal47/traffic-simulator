import { describe, expect, it } from "vitest";
import type { Demand, Network } from "@traffic-simulator/engine";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import {
  compareAcrossSeeds,
  createBaseline,
  createMeasuredRun,
  createProposal,
  resolveScenario,
  runEverySeed,
  withRoadWidth,
} from "../src/index";

const baseline = createBaseline({
  name: "One road today",
  network: mixedTraffic.network as Network,
  demand: mixedTraffic.demand as Demand,
  seed: 41,
});
const narrowed = withRoadWidth(createProposal(baseline, "Narrowed"), "main", 5);

describe("a scenario run with every seed of the run plan", () => {
  it("gives one set of results per seed: the scenario's own seed first, then the four after it", () => {
    const perSeed = runEverySeed(resolveScenario(baseline));

    expect(perSeed).toHaveLength(5);
    [41, 42, 43, 44, 45].forEach((seed, index) => {
      const alone = createMeasuredRun({ ...resolveScenario(baseline), seed });
      while (!alone.finished) alone.step();
      expect(perSeed[index]).toEqual(alone.results());
    });
    // The seeds really do give different runs: there is a range to show.
    const through = perSeed.map((results) => results.vehiclesThrough);
    expect(Math.max(...through)).toBeGreaterThan(Math.min(...through));
  });

  it("running the same scenarios again gives the same averages and ranges", () => {
    const first = compareAcrossSeeds(runEverySeed(resolveScenario(baseline)), runEverySeed(resolveScenario(narrowed)));
    // Scenarios read back from text, as from a saved file, and run again from scratch.
    const again = compareAcrossSeeds(
      runEverySeed(resolveScenario(JSON.parse(JSON.stringify(baseline)))),
      runEverySeed(resolveScenario(JSON.parse(JSON.stringify(narrowed)))),
    );

    expect(again).toEqual(first);
    // Not equal for want of anything to compare: five seeds each, a range, and a change from the baseline.
    const through = first.find((row) => row.id === "vehicles-through")!;
    expect(through.baseline.seeds).toBe(5);
    expect(through.proposal.seeds).toBe(5);
    expect(through.baseline.highest!).toBeGreaterThan(through.baseline.lowest!);
    expect(through.change).not.toBe(0);
  });
});
