import { describe, expect, it } from "vitest";
import priorityJunction from "../examples/priority-junction.json";
import { BENGALURU_VEHICLE_MIX, createRun, type Demand, type RunInput } from "../src/index";
import { checkRunConsistency } from "../src/consistency-checks";
import { tJunction } from "./t-junction";

/** Main-road traffic each way, straight on, and side-road traffic beyond what it can get in, half turning each way. */
function saturating(mainPerHour: number, sidePerHour = 1200, vehicleMix = BENGALURU_VEHICLE_MIX): Demand {
  return {
    flows: [
      { entryRoadId: "west-in", exitRoadId: "east-out", vehiclesPerHour: mainPerHour },
      { entryRoadId: "east-in", exitRoadId: "west-out", vehiclesPerHour: mainPerHour },
      { entryRoadId: "south-in", exitRoadId: "west-out", vehiclesPerHour: sidePerHour / 2 },
      { entryRoadId: "south-in", exitRoadId: "east-out", vehiclesPerHour: sidePerHour / 2 },
    ],
    vehicleMix,
  };
}

describe("consistency checks on the priority junction example (the priority junction test scenario)", () => {
  const example = priorityJunction as RunInput;

  it("pass for a simulated hour of mixed traffic, with side-road traffic getting through", { timeout: 120_000 }, () => {
    const report = checkRunConsistency(example, { durationS: 3600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.stuckVehicles).toBe(0);
    expect(report.results.vehiclesThrough).toBeGreaterThan(1300);
    expect(report.results.longestQueueByApproach["south-in"]!.lengthM).toBeGreaterThan(5);
  });

  it("pass for a simulated hour with lane discipline on", { timeout: 120_000 }, () => {
    const report = checkRunConsistency({ ...example, laneDiscipline: true }, { durationS: 3600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(1000);
  });
});

describe("consistency checks on a priority junction loaded beyond what it can carry", () => {
  // Hour-long runs at this demand, with more seeds, were made by hand and are in the ticket's report.
  it.each([41, 42])("pass in mixed traffic (seed %i)", { timeout: 60_000 }, (seed) => {
    const report = checkRunConsistency({ network: tJunction(), demand: saturating(1200), seed }, { durationS: 900 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.stuckVehicles).toBe(0);
  });

  it.each([43, 44])("pass with lane discipline on (seed %i)", { timeout: 60_000 }, (seed) => {
    const report = checkRunConsistency({ network: tJunction(), demand: saturating(1200), seed, laneDiscipline: true }, { durationS: 900 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.stuckVehicles).toBe(0);
  });
});

describe("side-road throughput", () => {
  /** Side-road vehicles that came out of the junction an hour, over 20 simulated minutes after a 5-minute warm-up, the mean of three seeds. */
  function sideThrough(mainPerHour: number): number {
    let total = 0;
    for (const seed of [51, 52, 53]) {
      const run = createRun({ network: tJunction(), demand: saturating(mainPerHour), seed });
      const out = new Set<number>();
      while (run.timeS < 1500 - 1e-9) {
        run.step();
        if (run.timeS < 300 - 1e-9) continue;
        for (const vehicle of run.snapshot().vehicles) {
          // Front bumper on the road beyond, rear still in the junction, having come from the side road.
          if (vehicle.turn?.fromRoadId === "south-in" && vehicle.roadId !== "south-in") out.add(vehicle.id);
        }
      }
      total += out.size;
    }
    return (total / 3) * 3;
  }

  it("falls as main-road flow rises", { timeout: 120_000 }, () => {
    const curve = [200, 600, 1000].map(sideThrough);
    expect(curve[0]!).toBeGreaterThan(curve[1]!);
    expect(curve[1]!).toBeGreaterThan(curve[2]!);
    // At the highest flow the side road still gets some vehicles in.
    expect(curve[2]!).toBeGreaterThan(0);
  });
});
