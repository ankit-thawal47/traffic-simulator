import { describe, expect, it } from "vitest";
import { createRun, type Run } from "../src/index";
import { alwaysGreenFor, fourWay } from "./four-way";

const noDemand = { flows: [] };

/** Step a run and collect, for every vehicle, the roads it was seen on, in order. */
function roadsSeen(run: Run, seconds: number): Map<number, string[]> {
  const seen = new Map<number, string[]>();
  const target = run.timeS + seconds;
  const look = () => {
    for (const vehicle of run.snapshot().vehicles) {
      const roads = seen.get(vehicle.id) ?? [];
      if (roads[roads.length - 1] !== vehicle.roadId) roads.push(vehicle.roadId);
      seen.set(vehicle.id, roads);
    }
  };
  look();
  while (run.timeS < target - 1e-9) {
    run.step();
    look();
  }
  return seen;
}

describe("a network with a signal junction", () => {
  it("a vehicle crosses the junction on green from its entry road to its exit road and leaves the network", () => {
    const run = createRun({
      network: fourWay({ signalPlan: alwaysGreenFor("south-in") }),
      demand: noDemand,
      seed: 1,
      initialVehicles: [{ roadId: "south-in", positionM: 150, speedMps: 10, exitRoadId: "north-out" }],
    });

    const seen = roadsSeen(run, 60);

    expect(seen.get(1)).toEqual(["south-in", "north-out"]);
    expect(run.results().vehiclesThrough).toBe(1);
    expect(run.results().vehiclesOnNetwork).toBe(0);
  });

  it("demand finds its route across the junction", () => {
    const run = createRun({
      network: fourWay({ signalPlan: alwaysGreenFor("west-in") }),
      demand: { flows: [{ entryRoadId: "west-in", exitRoadId: "south-out", vehiclesPerHour: 600 }] },
      seed: 3,
    });

    const seen = roadsSeen(run, 120);

    expect(run.results().vehiclesThrough).toBeGreaterThan(5);
    for (const roads of seen.values()) expect(["west-in", "west-in,south-out"]).toContain(roads.join(","));
  });

  it("refuses demand between two roads the junction does not connect", () => {
    const network = fourWay();
    const flows = (entryRoadId: string, exitRoadId: string) => ({ flows: [{ entryRoadId, exitRoadId, vehiclesPerHour: 100 }] });

    // No U-turn is connected, and nothing leads from one exit road to another.
    expect(() => createRun({ network, demand: flows("south-in", "south-out"), seed: 1 })).toThrow(
      'There is no route from road "south-in" to road "south-out"',
    );
    expect(() => createRun({ network, demand: flows("north-out", "east-out"), seed: 1 })).toThrow(/no route/);
  });

  it("refuses junctions in a network of an older format version", () => {
    const network = { ...fourWay(), formatVersion: 2 as const };
    expect(() => createRun({ network, demand: noDemand, seed: 1 })).toThrow(/format version 3/);
  });
});
