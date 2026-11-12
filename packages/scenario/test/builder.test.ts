import { describe, expect, it } from "vitest";
import { createRun, roadLengthM, type Demand, type Network } from "@traffic-simulator/engine";
import {
  buildLayout,
  defaultBlock,
  withBlockAdded,
  withBlockMoved,
  withBlockSettings,
  withoutBlock,
  type BuildingBlock,
  type Layout,
} from "../src/index";

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

describe("assembling a layout", () => {
  const start: Layout = { blocks: [defaultBlock("straight")] };

  it("adds blocks at the east end, moves them along the line, changes their settings and removes them, leaving the layout it was given untouched", () => {
    const added = withBlockAdded(withBlockAdded(start, "flyover"), "t-junction");
    expect(added.blocks.map((block) => block.kind)).toEqual(["straight", "flyover", "t-junction"]);

    const moved = withBlockMoved(added, 2, -1);
    expect(moved.blocks.map((block) => block.kind)).toEqual(["straight", "t-junction", "flyover"]);
    expect(withBlockMoved(moved, 0, -1)).toEqual(moved);

    const set = withBlockSettings(moved, 1, { lanes: 2, widthM: 7, control: "priority" });
    expect(set.blocks[1]).toEqual({ ...defaultBlock("t-junction"), lanes: 2, widthM: 7, control: "priority" });

    expect(withoutBlock(set, 0).blocks.map((block) => block.kind)).toEqual(["t-junction", "flyover"]);
    expect(start.blocks).toHaveLength(1);
    expect(added.blocks.map((block) => block.kind)).toEqual(["straight", "flyover", "t-junction"]);
  });
});

describe("a layout that cannot run is refused before anything runs, naming the block and the problem", () => {
  const straight = defaultBlock("straight");
  const refusal = (blocks: BuildingBlock[]): string | undefined => {
    const outcome = buildLayout({ blocks });
    return outcome.ok ? undefined : outcome.message;
  };

  it("refuses an empty layout", () => {
    expect(refusal([])).toBe("A layout needs at least one building block.");
  });

  it("refuses a block of zero length", () => {
    expect(refusal([straight, { ...straight, lengthM: 0 }])).toBe(
      "Block 2 (straight road): its length is 0 m; a straight road needs at least 30 m.",
    );
  });

  it("refuses lanes too narrow for a vehicle", () => {
    expect(refusal([{ ...straight, lanes: 3, widthM: 6 }])).toBe(
      "Block 1 (straight road): its 3 lanes in 6 m would be 2 m wide each; a lane needs at least 2.5 m.",
    );
  });

  it("refuses a junction block too short for its approaches to hold a queue and show oncoming traffic", () => {
    expect(refusal([straight, { ...defaultBlock("four-way"), lengthM: 150 }])).toBe(
      "Block 2 (four-way junction): its approaches to the junction would be 52.5 m long; a junction needs approaches of at least 80 m, " +
        "so that queues fit and oncoming traffic can be seen. Make the block at least 205 m long.",
    );
  });

  it("refuses side roads too short", () => {
    expect(refusal([{ ...tJunction, sideLengthM: 40 }])).toBe(
      "Block 1 (T-junction): its side road is 40 m long; a side road needs at least 80 m.",
    );
  });

  it("refuses a flyover block with too few lanes, or a road too narrow, to give the flyover a lane", () => {
    expect(refusal([{ ...defaultBlock("flyover"), lanes: 1, widthM: 3.5 }])).toBe(
      "Block 1 (flyover over a junction): its road has 1 lane; a flyover needs at least 2, one to rise onto the flyover and one to go beneath.",
    );
    expect(refusal([{ ...defaultBlock("flyover"), lanes: 2, widthM: 5.6 }])).toBe(
      "Block 1 (flyover over a junction): its flyover would be 2.8 m wide; a flyover needs at least 3 m. Make the road wider.",
    );
  });

  it("refuses a flyover block too short for its ramps", () => {
    expect(refusal([{ ...defaultBlock("flyover"), lengthM: 300 }])).toBe(
      "Block 1 (flyover over a junction): it is 300 m long; a flyover over this junction needs at least 375 m for its ramps.",
    );
  });

  it("refuses a green time too short", () => {
    expect(refusal([{ ...tJunction, sideGreenS: 2 }])).toBe(
      "Block 1 (T-junction): its side-road green time is 2 s; a green time must be from 5 s to 180 s.",
    );
  });
});

describe("a flyover over a junction block", () => {
  const { network, demand } = built({ blocks: [defaultBlock("flyover")] });

  it("divides each carriageway into a flyover over the median lanes and a road beneath through the junction, joining again beyond", () => {
    expect(network.roads.filter((road) => road.id.includes("eastbound")).map((road) => [road.id, road.lanes, road.widthM])).toEqual([
      ["b1-eastbound-entry", 3, 10.5],
      ["b1-eastbound-in", 2, 7],
      ["b1-eastbound-flyover", 1, 3.5],
      ["b1-eastbound-out", 2, 7],
      ["b1-eastbound-exit", 3, 10.5],
    ]);
    expect(network.junctions?.map((junction) => [junction.id, junction.control])).toEqual([
      ["b1-diverge-eastbound", "none"],
      ["b1-merge-eastbound", "none"],
      ["b1-diverge-westbound", "none"],
      ["b1-merge-westbound", "none"],
      ["b1-junction", "signal"],
    ]);
    const flyover = network.roads.find((road) => road.id === "b1-eastbound-flyover")!;
    const junctionX = 300;
    const over = flyover.points.filter((point) => (point.z ?? 0) >= 6).map((point) => point.x);
    expect(Math.min(...over)).toBeLessThan(junctionX - 20);
    expect(Math.max(...over)).toBeGreaterThan(junctionX + 20);
  });

  it("carries through traffic over the junction", () => {
    const run = createRun({ network, demand, seed: 1 });
    let seenOnFlyover = false;
    while (run.timeS < 600) {
      run.step();
      seenOnFlyover ||= run.snapshot().vehicles.some((vehicle) => vehicle.roadId === "b1-eastbound-flyover");
    }
    expect(seenOnFlyover).toBe(true);
    expect(run.results().vehiclesThrough).toBeGreaterThan(0);
  });
});
