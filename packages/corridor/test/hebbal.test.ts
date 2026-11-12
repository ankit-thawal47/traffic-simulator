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

  it("carries the flyover and ramps as raised roads, outside the ground-level network", () => {
    const raised = corridor.roads.filter((road) => road.level === "raised").map((road) => road.id);
    expect(raised).toEqual(["flyover-main", "krpuram-ramp", "city-ramp-two-lane", "city-ramp", "tumkur-loop", "ganganagar-flyover"]);
    const inNetwork = new Set(corridor.groundNetwork.roads.map((road) => road.id));
    for (const id of raised) expect(inNetwork.has(id)).toBe(false);
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
    const [junction] = corridor.groundNetwork.junctions!;
    expect(corridor.groundNetwork.junctions).toHaveLength(1);
    expect(junction!.id).toBe("hebbal");
    expect(junction!.connections).toHaveLength(7);
    if (!junction || junction.control !== "signal") throw new Error("the Hebbal junction should be a signal junction");
    const plan = junction.signalPlan;
    const cycleS = plan.phases.reduce((sum, phase) => sum + phase.greenS + plan.amberS + plan.allRedS, 0);
    expect(cycleS).toBe(160);
    // Each phase's green and amber together are the published phase time.
    expect(plan.phases.map((phase) => phase.greenS + plan.amberS)).toEqual([40, 60, 50, 10]);
  });

  it("runs at ground level for five minutes with the consistency checks passing", () => {
    const report = checkRunConsistency({ network: corridor.groundNetwork, demand: corridor.groundDemand, seed: 1 }, { durationS: 300 });
    expect(report.violations).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(100);
  });
});
