import { describe, expect, it } from "vitest";
import { createRun, roadLengthM, type Demand, type Network } from "@traffic-simulator/engine";
import { buildLayout, defaultBlock, type Layout } from "../src/index";

function built(layout: Layout) {
  const outcome = buildLayout(layout);
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

describe("the builder", () => {
  it("turns one straight road block into a two-way road of its lanes, width and length", () => {
    const { network } = built({ blocks: [{ kind: "straight", lanes: 2, widthM: 7, lengthM: 300 }] });

    expect(network.formatVersion).toBe(5);
    expect(network.roads.map((road) => [road.id, road.lanes, road.widthM, Math.round(roadLengthM(road))])).toEqual([
      ["b1-eastbound", 2, 7, 300],
      ["b1-westbound", 2, 7, 300],
    ]);
  });

  it("gives a built network demand in both directions that the engine runs", () => {
    const { network, demand } = built({ blocks: [defaultBlock("straight")] });

    expect(demand.flows.map((flow) => [flow.entryRoadId, flow.exitRoadId])).toEqual([
      ["b1-eastbound", "b1-eastbound"],
      ["b1-westbound", "b1-westbound"],
    ]);
    expect(() => createRun({ network, demand, seed: 1 })).not.toThrow();
  });

  it("joins blocks end to end where each carriageway runs straight on, and sends traffic from end to end", () => {
    const { network, demand } = built({ blocks: [defaultBlock("straight"), defaultBlock("straight")] });

    expect(network.junctions).toEqual([
      {
        id: "joint-1-2",
        control: "none",
        connections: [
          { fromRoadId: "b1-eastbound", toRoadId: "b2-eastbound" },
          { fromRoadId: "b2-westbound", toRoadId: "b1-westbound" },
        ],
      },
    ]);
    expect(demand.flows.map((flow) => [flow.entryRoadId, flow.exitRoadId])).toEqual([
      ["b1-eastbound", "b2-eastbound"],
      ["b2-westbound", "b1-westbound"],
    ]);
    const run = createRun({ network, demand, seed: 1 });
    while (run.timeS < 120) run.step();
    expect(run.results().vehiclesThrough).toBeGreaterThan(0);
  });

  it("builds a T-junction block as a signal junction with a side road to the south, a phase for each approach", () => {
    const { network, demand } = built({ blocks: [{ ...tJunction, mainGreenS: 35, sideGreenS: 15 }] });

    expect(network.roads.map((road) => road.id)).toEqual([
      "b1-eastbound-in",
      "b1-eastbound-out",
      "b1-westbound-in",
      "b1-westbound-out",
      "b1-south-in",
      "b1-south-out",
    ]);
    const junction = network.junctions?.[0];
    expect(junction?.control).toBe("signal");
    expect(junction?.connections).toHaveLength(6);
    expect(junction?.control === "signal" && junction.signalPlan.phases).toEqual([
      { greenRoadIds: ["b1-eastbound-in"], greenS: 35 },
      { greenRoadIds: ["b1-westbound-in"], greenS: 35 },
      { greenRoadIds: ["b1-south-in"], greenS: 15 },
    ]);
    expect(demand.flows.map((flow) => [flow.entryRoadId, flow.exitRoadId])).toEqual([
      ["b1-eastbound-in", "b1-eastbound-out"],
      ["b1-eastbound-in", "b1-south-out"],
      ["b1-westbound-in", "b1-westbound-out"],
      ["b1-westbound-in", "b1-south-out"],
      ["b1-south-in", "b1-eastbound-out"],
      ["b1-south-in", "b1-westbound-out"],
    ]);
    expect(runsFor(network, demand, 600).vehiclesThrough).toBeGreaterThan(0);
  });
});

const tJunction = defaultBlock("t-junction");

function runsFor(network: Network, demand: Demand, seconds: number) {
  const run = createRun({ network, demand, seed: 1 });
  while (run.timeS < seconds) run.step();
  return run.results();
}
