import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import { prepareCorridor, type PreparedCorridor } from "../src/index";

const read = (file: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../data/hebbal/${file}`, import.meta.url)), "utf8"));

describe("the Hebbal corridor, city-bound", () => {
  const { corridor, problems } = prepareCorridor(read("osm-extract.json"), read("corrections.json"), read("demand.json"));

  it("has corrections that agree with the OpenStreetMap extract", () => {
    expect(problems).toEqual([]);
  });

  it("is the committed corridor file", () => {
    const committed = read("corridor.json") as PreparedCorridor;
    expect(committed).toEqual(JSON.parse(JSON.stringify(corridor)));
    expect(committed.id).toBe("hebbal-city-bound");
    expect(committed.attribution).toBe("© OpenStreetMap contributors");
  });

  it("carries the flyover and ramps as raised roads", () => {
    const raised = corridor.roads.filter((road) => road.level === "raised").map((road) => road.id);
    expect(raised).toEqual(["flyover-main", "krpuram-ramp", "city-ramp-two-lane", "city-ramp", "tumkur-loop", "ganganagar-flyover"]);
  });

  it("meets end to end: each road of the city-bound path starts at the node the one before ends at", () => {
    const road = (id: string) => corridor.roads.find((r) => r.id === id)!;
    const paths = [
      ["flyover-approach", "flyover-main", "bellary-landing", "bellary-south", "ganganagar-flyover"],
      ["krpuram-ramp-ground", "krpuram-ramp", "city-ramp-two-lane", "city-ramp", "city-ramp-landing", "bellary-south"],
      ["tumkur-loop-ground", "tumkur-loop", "city-ramp-two-lane"],
    ];
    for (const path of paths) {
      for (let i = 1; i < path.length; i++) {
        expect([path[i], road(path[i]!).fromNodeId]).toEqual([path[i], road(path[i - 1]!).toNodeId]);
      }
    }
  });

  it("has the signal junction beneath the flyover, on the published peak plan of 160 s", () => {
    const junction = corridor.network.junctions!.find((one) => one.id === "hebbal");
    expect(junction!.connections).toHaveLength(7);
    if (!junction || junction.control !== "signal") throw new Error("the Hebbal junction should be a signal junction");
    const plan = junction.signalPlan;
    const cycleS = plan.phases.reduce((sum, phase) => sum + phase.greenS + plan.amberS + plan.allRedS, 0);
    expect(cycleS).toBe(160);
    // Each phase's green and amber together are the published phase time.
    expect(plan.phases.map((phase) => phase.greenS + plan.amberS)).toEqual([40, 60, 50, 10]);
  });

  describe("as one network", () => {
    const network = corridor.network;
    const roadIds = () => network.roads.map((road) => road.id);

    it("has every road, ground-level and raised, with the flyovers and ramps raised", () => {
      const raised = network.roads.filter((road) => road.points.some((point) => (point.z ?? 0) > 0)).map((road) => road.id);
      expect(network.formatVersion).toBe(4);
      expect(raised.sort()).toEqual(["city-ramp", "city-ramp-two-lane", "ganganagar-flyover", "hebbal-flyover", "krpuram-ramp", "tumkur-loop"]);
      for (const road of network.roads) for (const point of road.points) expect(point.z ?? 0).toBeLessThanOrEqual(6);
    });

    it("has the Hebbal junction on its published plan and the CBI Road junction on an assumed plan", () => {
      const signals = network.junctions!.filter((junction) => junction.control === "signal").map((junction) => junction.id);
      expect(signals).toEqual(["hebbal", "cbi-road"]);
      const cbi = corridor.junctions.find((junction) => junction.id === "cbi-road")!;
      expect(cbi.evidence!.control!.state).toBe("assumed");
    });

    it("has the diverges, merges and the fork as junctions with no signal", () => {
      const none = network.junctions!.filter((junction) => junction.control === "none").map((junction) => junction.id);
      for (const id of ["airport-diverge", "krpuram-diverge", "tumkur-loop-merge", "city-ramp-merge", "ganganagar-fork"]) {
        expect(none).toContain(id);
      }
    });

    it("names every road for a planner", () => {
      for (const id of roadIds()) expect(corridor.roadNames[id], id).toBeTruthy();
      expect(corridor.roadNames["airport-entry"]).toBe("Bellary Road from the airport");
    });

    it("says how it departs from what OpenStreetMap draws", () => {
      expect(corridor.adjustments.length).toBeGreaterThan(5);
    });

    it("runs whole for five minutes, at the default demand, with the consistency checks passing", () => {
      const report = checkRunConsistency({ network, demand: corridor.demand, seed: 1 }, { durationS: 300 });
      expect(report.violations).toEqual([]);
      expect(report.results.vehiclesThrough).toBeGreaterThan(200);
    });
  });
});
