import { describe, expect, it } from "vitest";
import { importArea, type OsmElement } from "@traffic-simulator/corridor";
import { areaBaseline, withAreaGreenTimes, withAreaRoad } from "@traffic-simulator/scenario";
import { guessTable } from "./area-guesses";

const bounds = { south: -0.003, west: -0.003, north: 0.003, east: 0.003 };
const elements: OsmElement[] = [
  { type: "node", id: 1, lat: -0.004, lon: 0 },
  { type: "node", id: 2, lat: 0, lon: 0 },
  { type: "node", id: 3, lat: 0.004, lon: 0 },
  { type: "node", id: 4, lat: 0, lon: -0.004 },
  { type: "node", id: 5, lat: 0, lon: 0.004 },
  { type: "way", id: 100, nodes: [1, 2, 3], tags: { highway: "primary", name: "North Road", lanes: "4" } },
  { type: "way", id: 200, nodes: [4, 2, 5], tags: { highway: "primary", name: "East Road" } },
];

function scenario() {
  const imported = importArea({ bounds, elements });
  if (!imported.ok) throw new Error(imported.message);
  return areaBaseline(imported.value);
}

describe("the table of guessed values", () => {
  it("has a row for every road, each value marked guessed or from OpenStreetMap", () => {
    const table = guessTable(scenario().area!);
    expect(table.roads).toHaveLength(8);
    const north = table.roads.find((row) => row.name === "North Road, northbound")!;
    expect(north.lanes).toMatchObject({ value: "2", guessed: false, corrected: false });
    const east = table.roads.find((row) => row.name === "East Road, eastbound")!;
    expect(east.lanes).toMatchObject({ value: "2", guessed: true, corrected: false });
    expect(east.width).toMatchObject({ value: "7 m", guessed: true });
  });

  it("states each rule once, with the kind of value it guesses", () => {
    const table = guessTable(scenario().area!);
    const kinds = table.rules.map((rule) => rule.kind);
    expect(kinds).toEqual(expect.arrayContaining(["lanes", "width", "speed-limit", "control", "signal-plan", "demand", "vehicle-mix"]));
    expect(new Set(table.rules.map((rule) => rule.text)).size).toBe(table.rules.length);
  });

  it("shows a corrected value as corrected, with the planner's figure", () => {
    const start = scenario();
    const roadId = start.network.roads[0]!.id;
    const junctionId = start.network.junctions![0]!.id;
    const corrected = withAreaGreenTimes(withAreaRoad(start, roadId, { lanes: 3 }), junctionId, [40, 20]);
    const table = guessTable(corrected.area!);
    expect(table.roads.find((row) => row.roadId === roadId)!.lanes).toMatchObject({ value: "3", corrected: true });
    expect(table.junctions.find((row) => row.junctionId === junctionId)!.greenS).toEqual([40, 20]);
    expect(table.junctions.find((row) => row.junctionId === junctionId)!.planCorrected).toBe(true);
  });
});
