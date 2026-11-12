import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRun, type Results, type RunInput } from "@traffic-simulator/engine";
import { readScenario, resolveScenario, SCENARIO_FORMAT_VERSION, type Scenario } from "../src/index";

/**
 * One saved example of every version of the scenario description that has
 * existed, exactly as that version wrote it. Each must keep loading and keep
 * meaning what it meant. A new version adds its example here; none is ever
 * edited or removed.
 */
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

function loaded(name: string): Scenario {
  const read = readScenario(fixture(name));
  if (!read.ok) throw new Error(read.message);
  return read.value;
}

function resultsAfter(input: RunInput, seconds: number): Results {
  const run = createRun(input);
  while (run.timeS < seconds - 1e-9) run.step();
  return run.results();
}

const mixedTrafficRoad = {
  id: "main",
  points: [
    { x: -200, y: 0 },
    { x: 200, y: 0 },
  ],
  widthM: 10.5,
  lanes: 3,
  speedLimitMps: 13.9,
};
const mixedTrafficDemand = {
  flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 6000 }],
  vehicleMix: { "two-wheeler": 0.65, car: 0.22, "auto-rickshaw": 0.055, bus: 0.04 },
};

describe("a scenario saved by version 1 of the scenario description", () => {
  it("loads as the current version, with lane discipline off as version 1 always ran", () => {
    expect(loaded("v1-mixed-traffic-narrowed.json")).toEqual({
      formatVersion: SCENARIO_FORMAT_VERSION,
      name: "Proposal",
      network: { formatVersion: 2, roads: [mixedTrafficRoad] },
      unbuiltRoadIds: [],
      changes: [{ kind: "road-width", roadId: "main", widthM: 7 }],
      demand: mixedTrafficDemand,
      laneDiscipline: false,
      seed: 1,
    });
  });

  it("means the same thing: it runs exactly as the engine input version 1 resolved it to", () => {
    // What version 1's resolveScenario() gave for this file: network with the change applied, demand, seed.
    const asVersion1RanIt: RunInput = {
      network: { formatVersion: 2, roads: [{ ...mixedTrafficRoad, widthM: 7 }] },
      demand: mixedTrafficDemand,
      seed: 1,
    };

    const now = resolveScenario(loaded("v1-mixed-traffic-narrowed.json"));

    expect(resultsAfter(now, 120)).toEqual(resultsAfter(asVersion1RanIt, 120));
  });

  it("loads with a network of format version 1 inside, which stays as it is", () => {
    const scenario = loaded("v1-one-road-baseline.json");

    expect(scenario.network).toEqual({
      formatVersion: 1,
      roads: [{ id: "main", points: mixedTrafficRoad.points, widthM: 3.5, speedLimitMps: 13.9 }],
    });
    expect(scenario.changes).toEqual([]);
    expect(resolveScenario(scenario)).toEqual({
      network: scenario.network,
      demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 1200 }] },
      seed: 1,
      laneDiscipline: false,
    });
  });
});

describe("a scenario saved by version 2 of the scenario description", () => {
  it("loads as the current version, with every road of its network built, as version 2 always ran", () => {
    expect(loaded("v2-mixed-traffic-lanes-and-width.json")).toEqual({
      formatVersion: SCENARIO_FORMAT_VERSION,
      name: "One road, widened to four lanes",
      network: { formatVersion: 2, roads: [mixedTrafficRoad] },
      unbuiltRoadIds: [],
      changes: [
        { kind: "road-width", roadId: "main", widthM: 14 },
        { kind: "road-lanes", roadId: "main", lanes: 4 },
      ],
      demand: mixedTrafficDemand,
      laneDiscipline: true,
      seed: 5,
    });
  });

  it("means the same thing: it runs exactly as the engine input version 2 resolved it to", () => {
    // What version 2's resolveScenario() gave for this file.
    const asVersion2RanIt: RunInput = {
      network: { formatVersion: 2, roads: [{ ...mixedTrafficRoad, widthM: 14, lanes: 4 }] },
      demand: mixedTrafficDemand,
      seed: 5,
      laneDiscipline: true,
    };

    const now = resolveScenario(loaded("v2-mixed-traffic-lanes-and-width.json"));

    expect(now).toEqual(asVersion2RanIt);
    expect(resultsAfter(now, 120)).toEqual(resultsAfter(asVersion2RanIt, 120));
  });
});

describe("a scenario saved by version 3 of the scenario description", () => {
  const saved = fixture("v3-flyover-every-kind-of-change.json") as Record<string, unknown>;

  it("loads as the current version, carrying its own network and naming no corridor, as version 3 always did", () => {
    const scenario = loaded("v3-flyover-every-kind-of-change.json");
    const { formatVersion: _saved, ...asSaved } = saved;
    const { formatVersion, ...asLoaded } = scenario;

    expect(saved.formatVersion).toBe(3);
    expect(formatVersion).toBe(SCENARIO_FORMAT_VERSION);
    expect(scenario.corridorId).toBeUndefined();
    expect(asLoaded).toEqual(asSaved);
  });

  it("means the same thing: it resolves to the same engine input whatever version reads it", () => {
    const scenario = loaded("v3-flyover-every-kind-of-change.json");
    const asVersion3 = { ...scenario, formatVersion: SCENARIO_FORMAT_VERSION } as Scenario;

    expect(resolveScenario(scenario).network).toEqual(resolveScenario(asVersion3).network);
    expect(scenario.network).toEqual(saved.network);
  });
});
