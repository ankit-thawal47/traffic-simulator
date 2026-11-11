import { describe, expect, it } from "vitest";
import type { Demand, Network } from "@traffic-simulator/engine";
import {
  createBaseline,
  createProposal,
  lanesOf,
  resolveScenario,
  withChange,
  withRoadLanes,
  withRoadWidth,
} from "../src/index";

const points = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
];
const network: Network = {
  formatVersion: 2,
  roads: [
    { id: "main", points, widthM: 10.5, lanes: 3, speedLimitMps: 13.9 },
    { id: "side", points, widthM: 7, lanes: 2, speedLimitMps: 8.3 },
  ],
};
const demand: Demand = { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 900 }] };
const proposal = createProposal(createBaseline({ name: "Two roads", network, demand, seed: 7 }), "Proposal");

describe("changing the number of lanes of a road", () => {
  it("adds one change against the road's identifier", () => {
    expect(withRoadLanes(proposal, "main", 2).changes).toEqual([{ kind: "road-lanes", roadId: "main", lanes: 2 }]);
  });

  it("resolves to that road with the new lane count and the width it had: lanes and width are independent", () => {
    const input = resolveScenario(withRoadLanes(proposal, "main", 2));

    expect(input.network.roads).toEqual([{ ...network.roads[0]!, lanes: 2 }, network.roads[1]!]);
    expect(proposal.network).toEqual(network);
  });

  it("stands beside a width change to the same road, each replacing only its own kind", () => {
    const both = withRoadWidth(withRoadLanes(withRoadLanes(proposal, "main", 2), "main", 4), "main", 14);

    expect(both.changes).toEqual([
      { kind: "road-lanes", roadId: "main", lanes: 4 },
      { kind: "road-width", roadId: "main", widthM: 14 },
    ]);
    expect(resolveScenario(both).network.roads[0]).toEqual({ ...network.roads[0]!, lanes: 4, widthM: 14 });
  });

  it("setting a road back to the lanes it has today leaves no change for it", () => {
    expect(withRoadLanes(withRoadLanes(proposal, "main", 2), "main", 3).changes).toEqual([]);
  });

  it("refuses a road that is not in the network", () => {
    const wrong = withChange(proposal, { kind: "road-lanes", roadId: "bypass", lanes: 2 });

    expect(() => resolveScenario(wrong)).toThrow('Change 1 names a road that is not in the network: "bypass"');
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses %s lanes", (lanes) => {
    const wrong = withChange(proposal, { kind: "road-lanes", roadId: "main", lanes });

    expect(() => resolveScenario(wrong)).toThrow(
      'Change 1 gives road "main" a number of lanes that is not a whole number of 1 or more',
    );
  });
});

describe("the lanes a road has", () => {
  it("is its lane count", () => {
    expect(lanesOf(network.roads[0]!)).toBe(3);
  });

  it("for a road with no lane count (network format version 1), is as many 3.5 m lanes as fit its width, at least one", () => {
    const road = { id: "old", points, speedLimitMps: 10 };

    expect(lanesOf({ ...road, widthM: 7 })).toBe(2);
    expect(lanesOf({ ...road, widthM: 10 })).toBe(2);
    expect(lanesOf({ ...road, widthM: 3 })).toBe(1);
  });
});
