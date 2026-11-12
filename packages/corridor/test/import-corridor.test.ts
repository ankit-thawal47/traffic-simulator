import { describe, expect, it } from "vitest";
import { importCorridor, type Corrections, type OsmExtract, type RoadCorrection } from "../src/index";

/**
 * A small made-up place. One degree of latitude is 111,320 m, so 0.001 degrees
 * north is 111.32 m; the origin is on the equator, where the same holds east.
 *
 *   way 10: node 1 (0, 0) -> node 2 (0.001 N) -> node 3 (0.002 N), one-way, lanes=3, maxspeed=60
 *   way 11: node 3 -> node 4 (0.003 N), a bridge on layer 1, lanes=2
 *   way 20: node 5 (0.002 N, 0.001 E) -> node 6 (0.002 N, 0.002 E), leaving east
 *   way 21: node 3 -> node 5, the turn inside the junction
 */
const extract: OsmExtract = {
  elements: [
    { type: "node", id: 1, lat: 0, lon: 0 },
    { type: "node", id: 2, lat: 0.001, lon: 0 },
    { type: "node", id: 3, lat: 0.002, lon: 0 },
    { type: "node", id: 4, lat: 0.003, lon: 0 },
    { type: "node", id: 5, lat: 0.002, lon: 0.001 },
    { type: "node", id: 6, lat: 0.002, lon: 0.002 },
    { type: "way", id: 10, nodes: [1, 2, 3], tags: { highway: "trunk", oneway: "yes", lanes: "3", maxspeed: "60" } },
    { type: "way", id: 11, nodes: [3, 4], tags: { highway: "trunk", oneway: "yes", lanes: "2", bridge: "yes", layer: "1" } },
    { type: "way", id: 20, nodes: [5, 6], tags: { highway: "trunk", oneway: "yes" } },
    { type: "way", id: 21, nodes: [3, 5], tags: { highway: "trunk_link", oneway: "yes" } },
  ],
};

const assumed = { state: "assumed", source: "test" } as const;
const evidence = { lanes: assumed, widthM: assumed, level: assumed, oneWay: assumed, speedLimit: assumed };

function road(id: string, wayIds: number[], more: Partial<RoadCorrection> = {}): RoadCorrection {
  return { id, wayIds, level: "ground", lanes: 3, widthM: 10.5, speedLimitKmh: 60, evidence, ...more };
}

function corrections(roads: RoadCorrection[], more: Partial<Corrections> = {}): Corrections {
  return { corridorId: "test-place", name: "Test place", origin: { lat: 0, lon: 0 }, roads, junctions: [], ...more };
}

describe("importing a corridor", () => {
  it("turns a road's ways into one road in metres, with the corrected lanes, width and speed limit", () => {
    const corridor = importCorridor(extract, corrections([road("north-in", [10])]));

    expect(corridor.problems).toEqual([]);
    expect(corridor.groundNetwork.formatVersion).toBe(3);
    const [imported] = corridor.groundNetwork.roads;
    expect(imported).toMatchObject({ id: "north-in", widthM: 10.5, lanes: 3 });
    expect(imported!.speedLimitMps).toBeCloseTo(16.667, 3);
    expect(imported!.points).toHaveLength(3);
    expect(imported!.points[0]!.x).toBeCloseTo(0, 6);
    expect(imported!.points[0]!.y).toBeCloseTo(0, 6);
    expect(imported!.points[2]!.x).toBeCloseTo(0, 6);
    expect(imported!.points[2]!.y).toBeCloseTo(222.64, 2);
  });

  it("joins several ways end to end and cuts the road at the nodes named", () => {
    const corridor = importCorridor(extract, corrections([road("whole", [10, 11]), road("cut", [10, 11], { fromNodeId: 2, toNodeId: 3 })]));

    expect(corridor.problems).toEqual([]);
    const [whole, cut] = corridor.roads;
    expect(whole!.points.map((p) => Math.round(p.y))).toEqual([0, 111, 223, 334]);
    expect(whole!.lengthM).toBeCloseTo(333.96, 2);
    expect(cut!.points.map((p) => Math.round(p.y))).toEqual([111, 223]);
    expect([cut!.fromNodeId, cut!.toNodeId]).toEqual([2, 3]);
  });

  it("keeps only the last or the first stretch of a long road when asked", () => {
    const corridor = importCorridor(
      extract,
      corrections([road("approach", [10], { keepLastM: 150 }), road("exit", [10], { keepFirstM: 150 })]),
    );

    const [approach, exit] = corridor.roads;
    expect(approach!.points.map((p) => Math.round(p.y))).toEqual([73, 111, 223]);
    expect(exit!.points.map((p) => Math.round(p.y))).toEqual([0, 111, 150]);
    expect(exit!.lengthM).toBeCloseTo(150, 6);
  });

  it("carries a raised road with its level but leaves it out of the ground-level network", () => {
    const corridor = importCorridor(
      extract,
      corrections([road("north-in", [10]), road("flyover", [11], { level: "raised", lanes: 2, widthM: 7.5 })]),
    );

    expect(corridor.roads.map((r) => [r.id, r.level])).toEqual([
      ["north-in", "ground"],
      ["flyover", "raised"],
    ]);
    expect(corridor.groundNetwork.roads.map((r) => r.id)).toEqual(["north-in"]);
  });

  it("travels a two-way way backwards, moved to its own side of the centre line", () => {
    const corridor = importCorridor(extract, corrections([road("southbound", [10], { reversed: true, offsetLeftM: 4 })]));

    const points = corridor.roads[0]!.points;
    expect(points.map((p) => Math.round(p.y))).toEqual([223, 111, 0]);
    // Facing south, left is east.
    for (const point of points) expect(point.x).toBeCloseTo(4, 6);
  });
});

describe("a signal junction of a corridor", () => {
  const plan = { phases: [{ greenRoadIds: ["north-in"], greenS: 27 }], amberS: 3, allRedS: 0 };
  const junction = {
    id: "cross",
    name: "Cross",
    control: "signal" as const,
    connections: [{ fromRoadId: "north-in", toRoadId: "east-out" }],
    signalPlan: plan,
  };

  it("becomes a junction of the network with its connections and signal plan", () => {
    const corridor = importCorridor(
      extract,
      corrections([road("north-in", [10]), road("east-out", [20])], { junctions: [junction] }),
    );

    expect(corridor.problems).toEqual([]);
    expect(corridor.groundNetwork.junctions).toEqual([
      { id: "cross", control: "signal", connections: [{ fromRoadId: "north-in", toRoadId: "east-out" }], signalPlan: plan },
    ]);
  });

  it("is left out of the network while its control is unconfirmed, and its roads stay", () => {
    const corridor = importCorridor(
      extract,
      corrections([road("north-in", [10]), road("east-out", [20])], {
        junctions: [{ ...junction, control: "unconfirmed", signalPlan: undefined }],
      }),
    );

    expect(corridor.problems).toEqual([]);
    expect(corridor.groundNetwork.junctions).toEqual([]);
    expect(corridor.groundNetwork.roads).toHaveLength(2);
    expect(corridor.junctions[0]!.control).toBe("unconfirmed");
  });

  it("reports a connection that OpenStreetMap has no way for", () => {
    const corridor = importCorridor(
      extract,
      corrections([road("north-in", [10]), road("east-out", [20])], {
        junctions: [{ ...junction, connections: [{ fromRoadId: "east-out", toRoadId: "north-in" }], signalPlan: { ...plan, phases: [{ greenRoadIds: ["east-out"], greenS: 27 }] } }],
      }),
    );

    expect(corridor.problems).toEqual([
      'Junction "cross" connects "east-out" to "north-in", but OpenStreetMap has no way from node 6 to node 1 within 250 m',
    ]);
  });

  it("reports a connection from or to a raised road", () => {
    const corridor = importCorridor(
      extract,
      corrections([road("north-in", [10]), road("east-out", [20], { level: "raised" })], { junctions: [junction] }),
    );

    expect(corridor.problems).toEqual(['Junction "cross" connects "north-in" to "east-out", which is not a ground-level road']);
  });
});

describe("checking the corrections against the extract", () => {
  it("reports a way that is not in the extract", () => {
    const corridor = importCorridor(extract, corrections([road("gone", [99])]));

    expect(corridor.problems).toEqual(['Road "gone" names way 99, which is not in the OpenStreetMap extract']);
    expect(corridor.roads).toEqual([]);
  });

  it("reports ways that do not join end to end", () => {
    const corridor = importCorridor(extract, corrections([road("broken", [10, 20])]));

    expect(corridor.problems).toEqual(['Road "broken": way 20 does not start where way 10 ends']);
  });

  it("reports a tag that has changed since the road was checked by hand", () => {
    const checked = road("north-in", [10], { osmAsChecked: [{ wayId: 10, lanes: "2", maxspeed: "60", oneway: "yes" }] });

    const corridor = importCorridor(extract, corrections([checked]));

    expect(corridor.problems).toEqual(['Road "north-in": way 10 had lanes=2 when it was checked by hand; the extract has lanes=3']);
  });

  it("reports a tag that has appeared since the road was checked by hand", () => {
    const checked = road("north-in", [10], { osmAsChecked: [{ wayId: 10, lanes: "3", oneway: "yes" }] });

    const corridor = importCorridor(extract, corrections([checked]));

    expect(corridor.problems).toEqual(['Road "north-in": way 10 had no maxspeed when it was checked by hand; the extract has maxspeed=60']);
  });
});
