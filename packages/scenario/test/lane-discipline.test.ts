import { describe, expect, it } from "vitest";
import { createRun } from "@traffic-simulator/engine";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import { baselineOf, createBaseline, createProposal, resolveScenario, withRoadWidth, type Scenario } from "../src/index";

const description = {
  name: "One road",
  network: mixedTraffic.network as Scenario["network"],
  demand: mixedTraffic.demand,
  seed: 1,
};

describe("lane discipline in the scenario description", () => {
  it("is off unless the scenario says otherwise, so the road carries mixed traffic", () => {
    const baseline = createBaseline(description);

    expect(baseline.laneDiscipline).toBe(false);
    expect(resolveScenario(baseline).laneDiscipline).toBe(false);
  });

  it("reaches the engine's input when it is on, for the baseline and for a proposal made from it", () => {
    const baseline = createBaseline({ ...description, laneDiscipline: true });
    const proposal = withRoadWidth(createProposal(baseline, "Proposal"), "main", 14);

    expect(resolveScenario(baseline).laneDiscipline).toBe(true);
    expect(resolveScenario(proposal).laneDiscipline).toBe(true);
  });

  it("changes the run: with it on, vehicles sit in the middle of the road's three lanes; with it off, most do not", () => {
    const shareInTheMiddleOfALane = (laneDiscipline: boolean): number => {
      const run = createRun(resolveScenario(createBaseline({ ...description, laneDiscipline })));
      while (run.timeS < 60) run.step();
      const vehicles = run.snapshot().vehicles;
      expect(vehicles.length).toBeGreaterThan(10);
      const laneCentres = [1.75, 5.25, 8.75];
      const inTheMiddle = vehicles.filter((vehicle) =>
        laneCentres.some((centre) => Math.abs(vehicle.lateralM - centre) < 1e-6),
      );
      return inTheMiddle.length / vehicles.length;
    };

    // The few that are not are part-way through a move to the next lane.
    expect(shareInTheMiddleOfALane(true)).toBeGreaterThan(0.8);
    expect(shareInTheMiddleOfALane(false)).toBeLessThan(0.5);
  });
});

describe("the baseline of a scenario", () => {
  it("is the same scenario with no changes", () => {
    const today = createBaseline({ ...description, laneDiscipline: true });
    const proposal = withRoadWidth(createProposal(today, "One road"), "main", 7);

    expect(baselineOf(proposal)).toEqual(today);
    expect(proposal.changes).toHaveLength(1);
  });
});
