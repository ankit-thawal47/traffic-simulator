import { describe, expect, it } from "vitest";
import { createRun, type Results } from "@traffic-simulator/engine";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import oneRoad from "@traffic-simulator/engine/examples/one-road.json";
import { createBaseline, createProposal, resolveScenario, withRoadWidth, type Scenario } from "../src/index";

function resultsAfter(scenario: Scenario, seconds: number): Results {
  const run = createRun(resolveScenario(scenario));
  while (run.timeS < seconds - 1e-9) run.step();
  return run.results();
}

describe("a baseline and a proposal, resolved and run by the engine", () => {
  const baseline = createBaseline({
    name: "One road today",
    network: oneRoad.network as Scenario["network"],
    demand: oneRoad.demand,
    seed: oneRoad.seed,
  });
  const widened = withRoadWidth(createProposal(baseline, "One road widened"), "main", 7);

  it("a proposal with no changes gives exactly the baseline's results", () => {
    const unchanged = createProposal(baseline, "Nothing changed");

    expect(resultsAfter(unchanged, 300)).toEqual(resultsAfter(baseline, 300));
  });

  it("both resolved scenarios pass the consistency checks", () => {
    for (const scenario of [baseline, widened]) {
      expect(checkRunConsistency(resolveScenario(scenario), { durationS: 300 }).violations).toEqual([]);
    }
  });

  it("a scenario saved as text and read back resolves to the same engine input", () => {
    const readBack = JSON.parse(JSON.stringify(widened)) as Scenario;

    expect(readBack).toEqual(widened);
    expect(resolveScenario(readBack)).toEqual(resolveScenario(widened));
  });
});
