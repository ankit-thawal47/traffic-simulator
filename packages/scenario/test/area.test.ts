import { describe, expect, it } from "vitest";
import { importArea, type ImportedArea, type OsmElement } from "@traffic-simulator/corridor";
import {
  areaBaseline,
  areaInLink,
  readScenario,
  scenarioFromLink,
  scenarioFromText,
  scenarioToLink,
  scenarioToText,
  whyRefused,
  withAreaGreenTimes,
  withAreaRoad,
  withRoadWidth,
  type Scenario,
} from "../src/index";

/** Two two-way primary roads crossing at a signal on the equator (0.001 degrees is 111.32 m). */
const bounds = { south: -0.003, west: -0.003, north: 0.003, east: 0.003 };
const elements: OsmElement[] = [
  { type: "node", id: 1, lat: -0.004, lon: 0 },
  { type: "node", id: 2, lat: 0, lon: 0, tags: { highway: "traffic_signals" } },
  { type: "node", id: 3, lat: 0.004, lon: 0 },
  { type: "node", id: 4, lat: 0, lon: -0.004 },
  { type: "node", id: 5, lat: 0, lon: 0.004 },
  { type: "way", id: 100, nodes: [1, 2, 3], tags: { highway: "primary", name: "North Road" } },
  { type: "way", id: 200, nodes: [4, 2, 5], tags: { highway: "primary", name: "East Road" } },
];

function imported(more: OsmElement[] = []): ImportedArea {
  const outcome = importArea({ bounds, elements: [...elements, ...more], fetchedAt: "2026-11-12T00:00:00Z", osmDataTimestamp: null });
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

const PAGE = "https://example.test/";

function opened(outcome: ReturnType<typeof readScenario> | undefined): Scenario {
  if (!outcome) throw new Error("no scenario");
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

describe("a scenario on an imported area", () => {
  it("starts as a baseline on the imported network with its guessed demand, ready to run", () => {
    const area = imported();
    const baseline = areaBaseline(area);

    expect(baseline.area?.bounds).toEqual(bounds);
    expect(baseline.network).toEqual(area.network);
    expect(baseline.demand).toEqual(area.demand);
    expect(whyRefused(baseline)).toBeUndefined();
  });

  it("takes the planner's correction of a road's lanes and width into the baseline, not as a change", () => {
    const area = imported();
    const roadId = area.network.roads[0]!.id;
    const corrected = withAreaRoad(areaBaseline(area), roadId, { lanes: 3, widthM: 10 });

    const road = corrected.network.roads.find((one) => one.id === roadId)!;
    expect(road.lanes).toBe(3);
    expect(road.widthM).toBe(10);
    expect(corrected.changes).toEqual([]);
    expect(corrected.area?.corrections.roads[roadId]).toEqual({ lanes: 3, widthM: 10 });
    // Back to the imported value: no correction left.
    const undone = withAreaRoad(corrected, roadId, { lanes: area.network.roads[0]!.lanes!, widthM: area.network.roads[0]!.widthM });
    expect(undone.area?.corrections.roads).toEqual({});
    expect(undone.network).toEqual(area.network);
  });

  it("takes the planner's correction of a signal plan's green times into the baseline", () => {
    const area = imported();
    const junctionId = area.network.junctions![0]!.id;
    const corrected = withAreaGreenTimes(areaBaseline(area), junctionId, [45, 20]);

    const junction = corrected.network.junctions!.find((one) => one.id === junctionId)!;
    expect(junction.control === "signal" && junction.signalPlan.phases.map((phase) => phase.greenS)).toEqual([45, 20]);
    expect(corrected.area?.corrections.greenS).toEqual({ [junctionId]: [45, 20] });
  });

  describe("shared as a link", () => {
    const area = imported();
    const roadId = area.network.roads[0]!.id;
    const scenario = withRoadWidth(withAreaRoad(areaBaseline(area), roadId, { lanes: 3 }), roadId, 9);

    it("carries the area's bounds, the corrections and the changes, but not the network", () => {
      const link = scenarioToLink(scenario, PAGE);
      expect(link.ok).toBe(true);
      if (!link.ok) return;
      expect(link.value.length).toBeLessThan(600);
      expect(areaInLink(link.value)).toEqual({ bounds, fingerprint: area.fingerprint });
    });

    it("opens again once the area is imported again, with the corrections and changes as they were", () => {
      const link = scenarioToLink(scenario, PAGE);
      if (!link.ok) throw new Error(link.message);
      expect(opened(scenarioFromLink(link.value, { importedArea: imported() }))).toEqual(scenario);
    });

    it("is not opened without importing the area again", () => {
      const link = scenarioToLink(scenario, PAGE);
      if (!link.ok) throw new Error(link.message);
      const outcome = scenarioFromLink(link.value);
      expect(outcome).toEqual({ ok: false, message: expect.stringMatching(/imported again from OpenStreetMap/) });
    });

    it("is refused, saying OpenStreetMap may have changed, when a corrected road is no longer there", () => {
      const link = scenarioToLink(scenario, PAGE);
      if (!link.ok) throw new Error(link.message);
      // The same place, but North Road is now drawn as a different way: its roads have other ids.
      const changed = importArea({
        bounds,
        elements: elements.map((element) => (element.type === "way" && element.id === 100 ? { ...element, id: 101 } : element)),
      });
      if (!changed.ok) throw new Error(changed.message);
      const outcome = scenarioFromLink(link.value, { importedArea: changed.value });
      expect(outcome).toEqual({ ok: false, message: expect.stringMatching(/not in the network.*OpenStreetMap may have changed/) });
    });
  });

  describe("saved as a file", () => {
    it("carries the whole imported network, and opens exactly without asking OpenStreetMap", () => {
      const area = imported();
      const scenario = withAreaGreenTimes(areaBaseline(area), area.network.junctions![0]!.id, [40, 25]);
      const text = scenarioToText(scenario);
      if (!text.ok) throw new Error(text.message);

      expect(JSON.parse(text.value).area.imported.network).toEqual(area.network);
      expect(opened(scenarioFromText(text.value))).toEqual(scenario);
    });

    it("is checked like any network on reading: a damaged imported network is refused", () => {
      const scenario = areaBaseline(imported());
      const text = scenarioToText(scenario);
      if (!text.ok) throw new Error(text.message);
      const saved = JSON.parse(text.value);
      saved.area.imported.network.roads[0].widthM = -3;
      expect(scenarioFromText(JSON.stringify(saved))).toEqual({ ok: false, message: expect.stringMatching(/width of road/) });
    });

    it("refuses a correction outside the ranges a road may have", () => {
      const scenario = areaBaseline(imported());
      const text = scenarioToText(scenario);
      if (!text.ok) throw new Error(text.message);
      const saved = JSON.parse(text.value);
      saved.area.corrections.roads[scenario.network.roads[0]!.id] = { lanes: 40 };
      expect(scenarioFromText(JSON.stringify(saved))).toEqual({ ok: false, message: expect.stringMatching(/lanes.*from 1 to 12/) });
    });
  });
});
