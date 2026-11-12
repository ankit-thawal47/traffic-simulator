import { describe, expect, it } from "vitest";
import type { Demand, Network } from "@traffic-simulator/engine";
import {
  createBaseline,
  createProposal,
  resolveScenario,
  withChange,
  withoutChange,
  withRoadWidth,
  type Scenario,
} from "../src/index";

const network: Network = {
  formatVersion: 1,
  roads: [
    {
      id: "main",
      points: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
      ],
      widthM: 7,
      speedLimitMps: 13.9,
    },
    {
      id: "side",
      points: [
        { x: 0, y: 50 },
        { x: 400, y: 50 },
      ],
      widthM: 3.5,
      speedLimitMps: 8.3,
    },
  ],
};

const demand: Demand = { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 900 }] };

describe("a scenario", () => {
  it("a baseline has no changes and resolves to its own network, demand and seed", () => {
    const baseline = createBaseline({ name: "Main road today", network, demand, seed: 7 });

    expect(baseline.formatVersion).toBe(5);
    expect(baseline.changes).toEqual([]);
    expect(resolveScenario(baseline)).toEqual({ network, demand, seed: 7, laneDiscipline: false });
  });

  it("a proposal starts as a copy of the baseline and differs only by its changes", () => {
    const baseline = createBaseline({ name: "Main road today", network, demand, seed: 7 });

    const proposal = createProposal(baseline, "Main road narrowed");

    expect(proposal).toEqual({ ...baseline, name: "Main road narrowed" });
    expect(resolveScenario(proposal)).toEqual(resolveScenario(baseline));

    const narrowed = withChange(proposal, { kind: "road-width", roadId: "main", widthM: 3.5 });

    expect(narrowed.changes).toEqual([{ kind: "road-width", roadId: "main", widthM: 3.5 }]);
    expect({ ...narrowed, changes: [] }).toEqual(proposal);
    // The baseline is a separate copy: changing the proposal leaves it as it was.
    expect(baseline.changes).toEqual([]);
    expect(baseline.network.roads[0]!.widthM).toBe(7);
  });
});

describe("changing the width of a road", () => {
  const proposal = createProposal(createBaseline({ name: "Main road today", network, demand, seed: 7 }), "Proposal");

  it("adds one change against the road's identifier", () => {
    expect(withRoadWidth(proposal, "main", 3.5).changes).toEqual([{ kind: "road-width", roadId: "main", widthM: 3.5 }]);
  });

  it("changing the same road again replaces its change and leaves other roads' changes alone", () => {
    const first = withRoadWidth(withRoadWidth(proposal, "main", 3.5), "side", 5);

    const second = withRoadWidth(first, "main", 10.5);

    expect(second.changes).toEqual([
      { kind: "road-width", roadId: "side", widthM: 5 },
      { kind: "road-width", roadId: "main", widthM: 10.5 },
    ]);
  });

  it("setting a road back to the width it has today leaves no change for it", () => {
    const narrowed = withRoadWidth(proposal, "main", 3.5);

    expect(withRoadWidth(narrowed, "main", 7).changes).toEqual([]);
  });

  it("a single change can be taken out again", () => {
    const both = withRoadWidth(withRoadWidth(proposal, "main", 3.5), "side", 5);

    expect(withoutChange(both, 0).changes).toEqual([{ kind: "road-width", roadId: "side", widthM: 5 }]);
  });
});

describe("resolving a scenario into the engine's input", () => {
  const baseline = createBaseline({ name: "Main road today", network, demand, seed: 7 });

  it("a road width change sets the width of that road and nothing else", () => {
    const proposal = withChange(createProposal(baseline, "Main road narrowed"), {
      kind: "road-width",
      roadId: "main",
      widthM: 3.5,
    });

    const input = resolveScenario(proposal);

    expect(input.network.roads.map((road) => [road.id, road.widthM])).toEqual([
      ["main", 3.5],
      ["side", 3.5],
    ]);
    expect(input).toEqual({
      network: { formatVersion: 1, roads: [{ ...network.roads[0]!, widthM: 3.5 }, network.roads[1]!] },
      demand,
      seed: 7,
      laneDiscipline: false,
    });
    // Resolving does not write the change into the scenario's own network.
    expect(proposal.network).toEqual(network);
  });

  it("refuses a change to a road that is not in the network", () => {
    const proposal = withChange(createProposal(baseline, "Proposal"), {
      kind: "road-width",
      roadId: "bypass",
      widthM: 7,
    });

    expect(() => resolveScenario(proposal)).toThrow('Change 1 names a road that is not in the network: "bypass"');
  });

  it.each([0, -3.5, Number.NaN, Number.POSITIVE_INFINITY])("refuses a road width of %s metres", (widthM) => {
    const proposal = withChange(createProposal(baseline, "Proposal"), { kind: "road-width", roadId: "main", widthM });

    expect(() => resolveScenario(proposal)).toThrow('Change 1 gives road "main" a width that is not a positive number');
  });

  it("refuses a scenario description of a version it does not know", () => {
    const fromTheFuture = { ...baseline, formatVersion: 6 } as unknown as Scenario;

    expect(() => resolveScenario(fromTheFuture)).toThrow("Unsupported scenario format version: 6");
  });

  it("refuses a kind of change it does not know", () => {
    const proposal = { ...baseline, changes: [{ kind: "paint-it-blue", roadId: "main" }] } as unknown as Scenario;

    expect(() => resolveScenario(proposal)).toThrow('Change 1 is of a kind this version does not know: "paint-it-blue"');
  });
});
