import { describe, expect, it } from "vitest";
import { createRun, roadLengthM, type Network } from "@traffic-simulator/engine";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import { importCorridor, type Corrections, type NetworkCorrections, type OsmExtract, type RoadCorrection } from "../src/index";

/**
 * A small made-up place, on the equator (0.001 degrees is 111.32 m each way).
 *
 *   way 10: node 1 (0 N) -> node 2 (0.002 N): the road in, northbound
 *   way 11: node 2 -> node 3 (0.004 N) -> node 4 (0.006 N): straight on; node 3 to node 4 is a bridge
 *   way 12: node 4 -> node 5 (0.008 N): on the ground again
 *   way 30: node 2 -> node 6 (0.004 N, 0.0004 E): leaves to the right at a slight angle
 *   way 31: node 7 (0.006 N, 0.0004 E) -> node 5: comes back from the right
 *   way 40: node 5 -> node 8 (0.010 N): the road out
 */
const extract: OsmExtract = {
  elements: [
    { type: "node", id: 1, lat: 0, lon: 0 },
    { type: "node", id: 2, lat: 0.002, lon: 0 },
    { type: "node", id: 3, lat: 0.004, lon: 0 },
    { type: "node", id: 4, lat: 0.006, lon: 0 },
    { type: "node", id: 5, lat: 0.008, lon: 0 },
    { type: "node", id: 6, lat: 0.004, lon: 0.0004 },
    { type: "node", id: 7, lat: 0.006, lon: 0.0004 },
    { type: "node", id: 8, lat: 0.01, lon: 0 },
    { type: "way", id: 10, nodes: [1, 2], tags: { highway: "trunk", oneway: "yes" } },
    { type: "way", id: 11, nodes: [2, 3, 4], tags: { highway: "trunk", oneway: "yes" } },
    { type: "way", id: 12, nodes: [4, 5], tags: { highway: "trunk", oneway: "yes" } },
    { type: "way", id: 30, nodes: [2, 6], tags: { highway: "trunk_link", oneway: "yes" } },
    { type: "way", id: 31, nodes: [7, 5], tags: { highway: "trunk_link", oneway: "yes" } },
    { type: "way", id: 40, nodes: [5, 8], tags: { highway: "trunk", oneway: "yes" } },
  ],
};

const assumed = { state: "assumed", source: "test" } as const;
const evidence = { lanes: assumed, widthM: assumed, level: assumed, oneWay: assumed, speedLimit: assumed };

function road(id: string, wayIds: number[], more: Partial<RoadCorrection> = {}): RoadCorrection {
  return { id, wayIds, level: "ground", lanes: 3, widthM: 10.5, speedLimitKmh: 60, evidence, ...more };
}

const settings = {
  deckHeightM: 6,
  rampGradient: 0.04,
  joinGapM: 12,
  sideBySideMinM: 50,
  evidence: assumed,
};

function corrections(roads: RoadCorrection[], network: Partial<NetworkCorrections>, more: Partial<Corrections> = {}): Corrections {
  return {
    corridorId: "test-place",
    name: "Test place",
    origin: { lat: 0, lon: 0 },
    roads,
    junctions: [],
    network: { ...settings, roads: [], joins: [], ...network },
    ...more,
  };
}

function networkOf(input: Corrections): Network {
  const corridor = importCorridor(extract, input);
  expect(corridor.problems).toEqual([]);
  return corridor.network!;
}

const byId = (network: Network, id: string) => network.roads.find((one) => one.id === id)!;

describe("the whole network of a corridor", () => {
  it("makes one road of parts that follow each other, raised where a part is raised", () => {
    const network = networkOf(
      corrections(
        [
          road("up", [11], { toNodeId: 3 }),
          road("deck", [11], { fromNodeId: 3, level: "raised" }),
          road("down", [12]),
        ],
        { roads: [{ id: "flyover", name: "The flyover", parts: ["up", "deck", "down"] }] },
      ),
    );

    expect(network.formatVersion).toBe(4);
    expect(network.roads.map((one) => one.id)).toEqual(["flyover"]);
    const flyover = byId(network, "flyover");
    expect(roadLengthM(flyover)).toBeCloseTo(667.92, 1);
    // The deck is 222.64 m long: it rises at 4 in 100 from each end, so its middle is 111.32 m x 0.04 = 4.45 m up.
    const heights = flyover.points.map((point) => [Math.round(point.y), point.z ?? 0]);
    expect(heights).toEqual([
      [0 + 223, 0],
      [445, 0],
      [557, 4.453],
      [668, 0],
      [891, 0],
    ]);
  });

  it("levels a long raised part off at the deck height", () => {
    const network = networkOf(
      corrections([road("in", [10]), road("deck", [11], { level: "raised" }), road("down", [12])], {
        roads: [{ id: "flyover", name: "The flyover", parts: ["in", "deck", "down"] }],
      }),
    );

    // 6 m at 4 in 100 takes 150 m; the raised part runs from 223 m to 668 m.
    expect(byId(network, "flyover").points.map((point) => [Math.round(point.y), point.z ?? 0])).toEqual([
      [0, 0],
      [223, 0],
      [373, 6],
      [445, 6],
      [518, 6],
      [668, 0],
      [891, 0],
    ]);
  });

  it("keeps a raised road at the deck height where it is cut while raised, as at the edge of an imported area", () => {
    const network = networkOf(
      corrections([road("deck", [11], { level: "raised" }), road("down", [12])], {
        roads: [{ id: "flyover", name: "The flyover", parts: ["deck", "down"] }],
        raisedWhereCut: { atStart: ["flyover"], atEnd: [] },
      }),
    );

    // Starting cut at the deck, it comes down over the last 150 m before the ground part at 668 m.
    expect(byId(network, "flyover").points.map((point) => [Math.round(point.y), point.z ?? 0])).toEqual([
      [223, 6],
      [445, 6],
      [518, 6],
      [668, 0],
      [891, 0],
    ]);
  });

  it("where a road divides, puts the two roads side by side after one road as wide as both", () => {
    const input = corrections(
      [road("in", [10]), road("on", [11]), road("off", [30], { lanes: 2, widthM: 7 })],
      {
        joins: [
          {
            id: "fork",
            kind: "diverge",
            fromRoadId: "in",
            mainRoadId: "on",
            otherRoadId: "off",
            shared: { id: "fork-section", name: "Where the road divides" },
            reason: "test",
          },
        ],
      },
    );
    const corridor = importCorridor(extract, input);
    const network = corridor.network!;

    expect(corridor.problems).toEqual([]);
    expect(network.roads.map((one) => one.id)).toEqual(["in", "on", "off", "fork-section"]);
    const section = byId(network, "fork-section");
    expect(section).toMatchObject({ widthM: 17.5, lanes: 5 });
    // The two roads are 8.75 m apart 43.75 m from the node (the side road leaves at 1 in 5), so the least length is used.
    expect(roadLengthM(section)).toBeCloseTo(50, 3);
    // The road straight on keeps its line; the section lies half the side road's width to its right (east).
    expect(section.points[0]).toEqual({ x: 3.5, y: 222.64 });
    expect(byId(network, "in").points.at(-1)).toEqual({ x: 0, y: 210.64 });
    expect(byId(network, "on").points[0]).toEqual({ x: 0, y: 284.64 });
    // The side road starts exactly beside it, its centre half of both widths away.
    expect(byId(network, "off").points[0]).toEqual({ x: 8.75, y: 284.64 });
    expect(network.junctions).toEqual([
      { id: "fork-in", control: "none", connections: [{ fromRoadId: "in", toRoadId: "fork-section" }] },
      {
        id: "fork",
        control: "none",
        connections: [
          { fromRoadId: "fork-section", toRoadId: "on" },
          { fromRoadId: "fork-section", toRoadId: "off" },
        ],
      },
    ]);
    expect(corridor.roadNames).toMatchObject({ "fork-section": "Where the road divides" });
    expect(corridor.adjustments.join("\n")).toContain('"fork-section"');

    const report = checkRunConsistency(
      {
        network,
        demand: {
          flows: [
            { entryRoadId: "in", exitRoadId: "on", vehiclesPerHour: 1200 },
            { entryRoadId: "in", exitRoadId: "off", vehiclesPerHour: 600 },
          ],
        },
        seed: 1,
      },
      { durationS: 180 },
    );
    expect(report.violations).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(40);
  });

  it("uses a join's own least length for the one wide road where it gives one", () => {
    const network = networkOf(
      corrections([road("main", [12]), road("ramp", [31], { lanes: 2, widthM: 7 })], {
        joins: [
          {
            id: "join",
            kind: "merge",
            mainRoadId: "main",
            otherRoadId: "ramp",
            shared: { id: "join-section", name: "Where the roads join" },
            sideBySideMinM: 20,
            reason: "test",
          },
        ],
      }),
    );

    // The ramp comes in at 1 in 5 (sine 0.196): half of both widths (8.75 m) apart 44.6 m from the node, found to the next metre.
    expect(roadLengthM(byId(network, "join-section"))).toBeCloseTo(45, 3);
  });

  it("where roads join onto a road narrower than both, ends them side by side with the road beyond across both", () => {
    const input = corrections(
      [road("main", [12]), road("ramp", [31], { lanes: 2, widthM: 7 }), road("out", [40])],
      {
        joins: [
          {
            id: "join",
            kind: "merge",
            mainRoadId: "main",
            otherRoadId: "ramp",
            ontoRoadId: "out",
            shared: { id: "join-section", name: "Where the roads join" },
            reason: "test",
          },
        ],
      },
    );
    const corridor = importCorridor(extract, input);
    const network = corridor.network!;

    expect(corridor.problems).toEqual([]);
    expect(network.roads.map((one) => one.id)).toEqual(["main", "ramp", "out"]);
    // The ramp comes in at 1 in 5, so the two are side by side from 50 m before the node; with 12 m for the paths, they end 62 m before it.
    expect(byId(network, "main").points.at(-1)).toEqual({ x: 0, y: 828.56 });
    expect(byId(network, "ramp").points.at(-1)).toEqual({ x: 8.75, y: 828.56 });
    // The road beyond starts 12 m on, centred on the line between them (half the main road's width over), so each leads onto half of it.
    expect(byId(network, "out").points[0]).toEqual({ x: 5.25, y: 840.56 });
    expect(byId(network, "out").points.at(-1)).toEqual({ x: 0, y: 1113.2 });
    expect(network.junctions).toEqual([
      {
        id: "join",
        control: "none",
        connections: [
          { fromRoadId: "main", toRoadId: "out" },
          { fromRoadId: "ramp", toRoadId: "out" },
        ],
      },
    ]);
    expect(corridor.adjustments.join("\n")).toContain('"out" starts');

    const report = checkRunConsistency(
      {
        network,
        demand: {
          flows: [
            { entryRoadId: "main", exitRoadId: "out", vehiclesPerHour: 1200 },
            { entryRoadId: "ramp", exitRoadId: "out", vehiclesPerHour: 600 },
          ],
        },
        seed: 1,
      },
      { durationS: 180 },
    );
    expect(report.violations).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(40);
  });

  it("leaves room for the path between two roads where one simply follows the other", () => {
    const network = networkOf(
      corrections([road("in", [10]), road("on", [11], { lanes: 2, widthM: 7, speedLimitKmh: 30 })], {
        joins: [{ id: "slower", kind: "continue", fromRoadId: "in", toRoadId: "on", reason: "test" }],
      }),
    );

    expect(byId(network, "in").points.at(-1)).toEqual({ x: 0, y: 216.64 });
    expect(byId(network, "on").points[0]).toEqual({ x: 0, y: 228.64 });
    expect(network.junctions).toEqual([{ id: "slower", control: "none", connections: [{ fromRoadId: "in", toRoadId: "on" }] }]);
    expect(() => createRun({ network, demand: { flows: [{ entryRoadId: "in", exitRoadId: "on", vehiclesPerHour: 600 }] }, seed: 1 })).not.toThrow();
  });

  it("sets the roads of a signal junction back from the node they are all drawn to", () => {
    const plan = { phases: [{ greenRoadIds: ["in"], greenS: 27 }], amberS: 3, allRedS: 0 };
    const corridor = importCorridor(
      extract,
      corrections([road("in", [10]), road("on", [11])], {}, {
        junctions: [
          {
            id: "lights",
            name: "Lights",
            control: "signal",
            setBackM: 10,
            connections: [{ fromRoadId: "in", toRoadId: "on" }],
            signalPlan: plan,
          },
        ],
      }),
    );

    expect(corridor.problems).toEqual([]);
    expect(byId(corridor.network!, "in").points.at(-1)).toEqual({ x: 0, y: 212.64 });
    expect(byId(corridor.network!, "on").points[0]).toEqual({ x: 0, y: 232.64 });
    expect(corridor.network!.junctions).toEqual([
      { id: "lights", control: "signal", connections: [{ fromRoadId: "in", toRoadId: "on" }], signalPlan: plan },
    ]);
  });

  it("makes a priority junction, set back like a signal junction, in network format version 5", () => {
    const corridor = importCorridor(
      extract,
      corrections([road("in", [10]), road("on", [11]), road("slip", [30])], {}, {
        junctions: [
          {
            id: "give-way",
            name: "Give way",
            control: "priority",
            mainRoadIds: ["in"],
            setBackM: 10,
            connections: [
              { fromRoadId: "in", toRoadId: "on" },
              { fromRoadId: "in", toRoadId: "slip" },
            ],
          },
        ],
      }),
    );

    expect(corridor.problems).toEqual([]);
    expect(corridor.network!.formatVersion).toBe(5);
    expect(byId(corridor.network!, "in").points.at(-1)).toEqual({ x: 0, y: 212.64 });
    expect(corridor.network!.junctions).toEqual([
      {
        id: "give-way",
        control: "priority",
        connections: [
          { fromRoadId: "in", toRoadId: "on" },
          { fromRoadId: "in", toRoadId: "slip" },
        ],
        mainRoadIds: ["in"],
      },
    ]);
  });

  it("moves a road drawn too close to another just far enough for both widths, and says how far", () => {
    // Way 50 runs beside way 10, 0.00005 degrees (5.566 m) east of it: closer than half of both widths (8.75 m).
    const besides: OsmExtract = {
      elements: [
        ...extract.elements,
        { type: "node", id: 91, lat: 0, lon: 0.00005 },
        { type: "node", id: 92, lat: 0.002, lon: 0.00005 },
        { type: "way", id: 50, nodes: [91, 92], tags: { highway: "trunk", oneway: "yes" } },
      ],
    };
    const corridor = importCorridor(
      besides,
      corrections([road("main", [10]), road("beside", [50], { lanes: 2, widthM: 7 })], {
        keepApart: [{ roadId: "beside", fromRoadId: "main", reason: "test" }],
      }),
    );

    expect(corridor.problems).toEqual([]);
    const beside = byId(corridor.network!, "beside");
    for (const point of beside.points) expect(point.x).toBeCloseTo(8.75, 2);
    expect(byId(corridor.network!, "main").points.every((point) => point.x === 0)).toBe(true);
    expect(corridor.adjustments.join("\n")).toContain('"beside" is moved up to 3.2 m away from "main"');
  });

  it("reports parts of one road that differ in lanes, width or speed limit", () => {
    const corridor = importCorridor(
      extract,
      corrections([road("in", [10]), road("on", [11], { lanes: 2 })], { roads: [{ id: "both", name: "Both", parts: ["in", "on"] }] }),
    );

    expect(corridor.problems).toEqual(['Road "both" is made of "in" and "on", which differ in lanes, width or speed limit']);
  });
});
