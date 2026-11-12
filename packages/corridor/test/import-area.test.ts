import { describe, expect, it } from "vitest";
import { createRun, roadLengthM, type SignalJunction } from "@traffic-simulator/engine";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import { importArea, type AreaBounds, type OsmElement } from "../src/index";

/**
 * Made-up places on the equator, where 0.001 degrees is 111.32 m each way.
 * The box is 0.006 degrees (668 m) across, centred on (0, 0).
 */
const bounds: AreaBounds = { south: -0.003, west: -0.003, north: 0.003, east: 0.003 };

function node(id: number, lat: number, lon: number, tags?: Record<string, string>): OsmElement {
  return { type: "node", id, lat, lon, ...(tags ? { tags } : {}) };
}
function way(id: number, nodes: number[], tags: Record<string, string>): OsmElement {
  return { type: "way", id, nodes, tags };
}
function area(elements: OsmElement[]) {
  return { bounds, elements, fetchedAt: "2026-11-12T00:00:00Z", osmDataTimestamp: "2026-11-12T00:00:00Z" };
}

/** Two two-way primary roads crossing at a signal, each running out of the box at both ends. */
const crossing = area([
  node(1, -0.004, 0),
  node(2, 0, 0, { highway: "traffic_signals" }),
  node(3, 0.004, 0),
  node(4, 0, -0.004),
  node(5, 0, 0.004),
  way(100, [1, 2, 3], { highway: "primary", name: "North Road" }),
  way(200, [4, 2, 5], { highway: "primary", name: "East Road", lanes: "4" }),
]);

function imported(extract: ReturnType<typeof area>) {
  const outcome = importArea(extract);
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

describe("importing an area", () => {
  it("makes a signal junction of a crossing OpenStreetMap marks as signalled, with one road each way on each arm", () => {
    const { network } = imported(crossing);

    expect(network.roads).toHaveLength(8);
    const junctions = network.junctions ?? [];
    expect(junctions).toHaveLength(1);
    const junction = junctions[0] as SignalJunction;
    expect(junction.control).toBe("signal");
    // One phase for north-south, one for east-west.
    expect(junction.signalPlan.phases).toHaveLength(2);
    expect(junction.signalPlan.phases.map((phase) => phase.greenRoadIds.length)).toEqual([2, 2]);
    // Arms are cut at the edge of the box: each road is under 334 m long.
    for (const road of network.roads) expect(roadLengthM(road)).toBeLessThan(334);
  });

  it("takes lanes from OpenStreetMap where tagged, and guesses them by class where not, saying which", () => {
    const { network, guesses } = imported(crossing);
    const eastRoads = network.roads.filter((road) => road.id.startsWith("w200"));
    expect(eastRoads.map((road) => road.lanes)).toEqual([2, 2, 2, 2]);
    expect(eastRoads.map((road) => road.widthM)).toEqual([7, 7, 7, 7]);
    const northRoads = network.roads.filter((road) => road.id.startsWith("w100"));
    expect(northRoads.map((road) => road.lanes)).toEqual([2, 2, 2, 2]);

    const lanes = guesses.filter((guess) => guess.kind === "lanes");
    expect(lanes.filter((guess) => guess.guessed).map((guess) => guess.roadId).sort()).toEqual(northRoads.map((road) => road.id).sort());
    expect(lanes.filter((guess) => !guess.guessed).map((guess) => guess.roadId).sort()).toEqual(eastRoads.map((road) => road.id).sort());
    expect(lanes.find((guess) => guess.guessed)!.rule).toMatch(/No lanes tag/);
    expect(guesses.some((guess) => guess.kind === "signal-plan" && guess.guessed && /30 s green/.test(guess.rule))).toBe(true);
    expect(guesses.some((guess) => guess.kind === "control" && !guess.guessed)).toBe(true);
    expect(guesses.filter((guess) => guess.kind === "demand")).toHaveLength(4);
  });

  it("guesses demand from every entry to every exit it can reach, but not straight back the way it came", () => {
    const { demand, network } = imported(crossing);
    // Four entries, each to three exits.
    expect(demand.flows).toHaveLength(12);
    // Never straight back out along the other direction of the same road ("w100f" in, "w100b" out).
    for (const flow of demand.flows) expect(flow.entryRoadId.replace(/[fb]$/, "")).not.toBe(flow.exitRoadId.replace(/[fb]$/, ""));
    const entering = new Set(demand.flows.map((flow) => flow.entryRoadId));
    expect(entering.size).toBe(4);
    // 150 vehicles per hour per lane, 2 lanes: 300 from each entry.
    const fromOne = demand.flows.filter((flow) => flow.entryRoadId === [...entering][0]);
    expect(fromOne.reduce((sum, flow) => sum + flow.vehiclesPerHour, 0)).toBe(300);
    expect(() => createRun({ network, demand, seed: 1 })).not.toThrow();
  });

  it("names the roads from OpenStreetMap, with the direction they run", () => {
    const { roadNames, network } = imported(crossing);
    const names = network.roads.map((road) => roadNames[road.id]);
    expect(names).toContain("North Road, northbound");
    expect(names).toContain("East Road, westbound");
  });

  it("runs five minutes with the consistency checks passing", () => {
    const { network, demand } = imported(crossing);
    const report = checkRunConsistency({ network, demand, seed: 1 }, { durationS: 300 });
    expect(report.violations).toEqual([]);
  });

  it("makes a priority junction of an unsignalled meeting of lesser roads, the more major road going first", () => {
    const { network } = imported(
      area([
        node(1, -0.004, 0),
        node(2, 0, 0),
        node(3, 0.004, 0),
        node(5, 0, 0.004),
        way(100, [1, 2, 3], { highway: "secondary" }),
        way(200, [2, 5], { highway: "tertiary" }),
      ]),
    );
    const junction = network.junctions![0]!;
    expect(junction.control).toBe("priority");
    if (junction.control !== "priority") return;
    expect(junction.mainRoadIds.every((id) => id.startsWith("w100"))).toBe(true);
    expect(junction.mainRoadIds).toHaveLength(2);
  });

  it("refuses an area with no roads it can import, saying so", () => {
    const outcome = importArea(area([node(1, 0, 0), way(100, [1, 1], { highway: "footway" })]));
    expect(outcome).toEqual({ ok: false, message: expect.stringMatching(/has no main roads/) });
  });

  it("refuses an area with a roundabout, which it cannot express", () => {
    const outcome = importArea(
      area([
        node(1, -0.004, 0),
        node(2, -0.0005, 0),
        node(3, 0, 0.0005),
        node(4, 0.0005, 0),
        node(6, 0, -0.0005),
        way(100, [1, 2], { highway: "primary" }),
        way(300, [2, 3, 4, 6, 2], { highway: "primary", junction: "roundabout" }),
      ]),
    );
    expect(outcome).toEqual({ ok: false, message: expect.stringMatching(/roundabout/) });
  });

  it("refuses roads that cross without meeting when neither is a bridge", () => {
    const outcome = importArea(
      area([
        node(1, -0.004, 0),
        node(3, 0.004, 0),
        node(4, 0, -0.004),
        node(5, 0, 0.004),
        way(100, [1, 3], { highway: "primary" }),
        way(200, [4, 5], { highway: "primary" }),
      ]),
    );
    expect(outcome).toEqual({ ok: false, message: expect.stringMatching(/cross without meeting.*neither is tagged as a bridge/) });
  });

  it("raises a bridge that passes over another road, and keeps it out of the junctions beneath", () => {
    const { network, guesses } = imported(
      area([
        node(1, -0.004, 0),
        node(2, -0.0015, 0),
        node(3, 0.0015, 0),
        node(9, 0.004, 0),
        node(4, 0, -0.004),
        node(5, 0, 0.004),
        way(100, [1, 2], { highway: "trunk", oneway: "yes" }),
        way(101, [2, 3], { highway: "trunk", oneway: "yes", bridge: "yes", layer: "1" }),
        way(102, [3, 9], { highway: "trunk", oneway: "yes" }),
        way(200, [4, 5], { highway: "primary" }),
      ]),
    );
    const flyover = network.roads.find((road) => road.id.startsWith("w100"))!;
    expect(Math.max(...flyover.points.map((point) => point.z ?? 0))).toBe(6);
    expect(network.junctions ?? []).toEqual([]);
    expect(guesses.some((guess) => guess.kind === "level" && guess.roadId === flyover.id && guess.guessed)).toBe(true);
  });
});
