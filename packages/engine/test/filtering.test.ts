import { describe, expect, it } from "vitest";
import { createRun, FILTERING_ASSUMPTIONS, type InitialVehicle, type RunInput, type VehicleClass } from "../src/index";
import { checkRunConsistency } from "../src/consistency-checks";
import { everyMovement, fourWay, oneApproachAtATime } from "./four-way";

/** Length of each approach in fourWay(): the stop line is this far along it. */
const STOP_LINE_M = 200;

/**
 * South-in is red for the first 60 s (north-in, then east-in, have green first).
 * Three cars stand nose to tail at the stop line on the left of the approach
 * (strips 0 to 4 of 14); the rest of the width, strips 5 to 13, is open. The
 * vehicle under test stands behind the last car, in the same strips.
 */
function queueAtRed(vehicleClass: VehicleClass, extra: Partial<RunInput> = {}): RunInput {
  const car = (positionM: number): InitialVehicle => ({
    roadId: "south-in",
    positionM,
    speedMps: 0,
    vehicleClass: "car",
    lateralM: 1.25,
    exitRoadId: "north-out",
  });
  return {
    network: fourWay({ signalPlan: oneApproachAtATime(25) }),
    demand: { flows: [] },
    seed: 1,
    initialVehicles: [
      car(199),
      car(192.6),
      car(186.2),
      { roadId: "south-in", positionM: 178, speedMps: 0, vehicleClass, lateralM: 1, exitRoadId: "north-out" },
    ],
    ...extra,
  };
}

/** Run until just before south-in turns green; the front bumper and the highest speed of the vehicle under test (id 4). */
function atRed(input: RunInput): { positionM: number; topSpeedMps: number } {
  const run = createRun(input);
  let topSpeedMps = 0;
  while (run.timeS < 58) {
    run.step();
    const vehicle = run.snapshot().vehicles.find((v) => v.id === 4)!;
    topSpeedMps = Math.max(topSpeedMps, vehicle.speedMps);
  }
  const vehicle = run.snapshot().vehicles.find((v) => v.id === 4)!;
  return { positionM: vehicle.positionM, topSpeedMps };
}

describe("consistency checks with filtering, at a junction loaded beyond what it can carry", () => {
  // Mostly two-wheelers, so many filter at once. The hour-long run is the signal junction example's, in junction-runs.test.ts.
  const demand = { ...everyMovement(1500), vehicleMix: { "two-wheeler": 0.8, car: 0.12, "auto-rickshaw": 0.05, bus: 0.03 } };
  it.each([61, 62, 63])("pass in mixed traffic with filtering (seed %i)", { timeout: 60_000 }, (seed) => {
    const report = checkRunConsistency({ network: fourWay({ signalPlan: oneApproachAtATime(25) }), demand, seed }, { durationS: 600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(400);
    expect(report.results.stuckVehicles).toBe(0);
  });
});

describe("filtering at a red signal", () => {
  it("takes a two-wheeler through the gap beside the queue to the front, at low speed", () => {
    const { positionM, topSpeedMps } = atRed(queueAtRed("two-wheeler"));
    // Ahead of the first car's rear bumper: it has passed the whole queue.
    expect(positionM).toBeGreaterThan(199 - 4.4);
    expect(positionM).toBeLessThanOrEqual(STOP_LINE_M);
    expect(topSpeedMps).toBeLessThanOrEqual(FILTERING_ASSUMPTIONS.filteringSpeedMps.value + 1e-9);
  });

  it("keeps a two-wheeler to its side of the road for its turn: one turning right does not filter to the left", () => {
    // The same queue on the right of the approach (strips 9 to 13); the open width is to the left.
    const input = queueAtRed("two-wheeler");
    const vehicles = input.initialVehicles!.map((vehicle) => ({ ...vehicle, lateralM: 5.75 }));
    vehicles[3] = { ...vehicles[3]!, lateralM: 6, exitRoadId: "east-out" };
    expect(atRed({ ...input, initialVehicles: vehicles }).positionM).toBeLessThan(186.2 - 4.4);
    // Going straight on, it does.
    vehicles[3] = { ...vehicles[3]!, exitRoadId: "north-out" };
    expect(atRed({ ...input, initialVehicles: vehicles }).positionM).toBeGreaterThan(199 - 4.4);
  });

  it("leaves the two-wheeler behind the queue when filtering is off", () => {
    const { positionM } = atRed(queueAtRed("two-wheeler", { filtering: false }));
    expect(positionM).toBeLessThan(186.2 - 4.4);
  });

  it("lets the car at the head of the queue get away on green, though two-wheelers keep coming and filtering", () => {
    const input = queueAtRed("car", {
      demand: { flows: [{ entryRoadId: "south-in", exitRoadId: "north-out", vehiclesPerHour: 3000 }], vehicleMix: { "two-wheeler": 1 } },
    });
    const run = createRun(input);
    // South-in turns green at 60 s. The first car (id 1) stands at the stop line.
    let crossedAtS = Infinity;
    while (run.timeS < 90 && crossedAtS === Infinity) {
      run.step();
      const head = run.snapshot().vehicles.find((v) => v.id === 1);
      if (!head || head.turn || head.roadId !== "south-in") crossedAtS = run.timeS;
    }
    expect(crossedAtS).toBeGreaterThan(60);
    expect(crossedAtS).toBeLessThan(66);
  });

  it("does not take a car, an auto-rickshaw or a bus past the queue", () => {
    for (const vehicleClass of ["car", "auto-rickshaw", "bus"] as const) {
      const { positionM } = atRed(queueAtRed(vehicleClass));
      expect(positionM, vehicleClass).toBeLessThan(186.2 - 4.4);
    }
  });
});
