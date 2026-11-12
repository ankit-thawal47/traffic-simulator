import { describe, expect, it } from "vitest";
import { checkRunConsistency } from "../src/consistency-checks";
import { createRun, VEHICLE_CLASS_ASSUMPTIONS, type RunInput } from "../src/index";

const CAR_LENGTH_M = VEHICLE_CLASS_ASSUMPTIONS.car.lengthM;
const LANE_WIDTH_M = 3.5;

/**
 * A three-lane road, 1.5 km long, whose right-hand lane is closed from 1 km on by a row of
 * stationary cars standing nose to tail (the only way the engine can express a lane that ends),
 * with more cars arriving than the two open lanes carry. Benchmark test T1.5 on a shorter road.
 */
function laneClosed(seed: number): RunInput {
  const initialVehicles: NonNullable<RunInput["initialVehicles"]> = [];
  for (let front = 1000 + CAR_LENGTH_M; front <= 1500; front += CAR_LENGTH_M) {
    initialVehicles.push({ roadId: "main", positionM: front, speedMps: 0, vehicleClass: "car", lateralM: 2.5 * LANE_WIDTH_M, stationary: true });
  }
  return {
    network: {
      formatVersion: 2,
      roads: [{ id: "main", points: [{ x: 0, y: 0 }, { x: 1500, y: 0 }], widthM: 3 * LANE_WIDTH_M, lanes: 3, speedLimitMps: 15 }],
    },
    demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 6000 }] },
    seed,
    laneDiscipline: true,
    initialVehicles,
  };
}

/** Run for a time; count the vehicles through after the first 10 minutes, and those that stood still for 300 s on end. */
function watch(input: RunInput, durationS: number): { throughPerHour: number; stood300s: number } {
  const placed = input.initialVehicles?.length ?? 0;
  const run = createRun(input);
  const since = new Map<number, number>();
  const stood = new Set<number>();
  let throughAtWarmUp = 0;
  while (run.timeS < durationS - 1e-9) {
    run.step();
    if (Math.round(run.timeS * 5) % 5 !== 0) continue;
    if (Math.round(run.timeS) === 600) throughAtWarmUp = run.results().vehiclesThrough;
    for (const vehicle of run.snapshot().vehicles) {
      // The stationary cars are the first ids.
      if (vehicle.id <= placed) continue;
      if (vehicle.speedMps > 0) {
        since.delete(vehicle.id);
        continue;
      }
      if (!since.has(vehicle.id)) since.set(vehicle.id, run.timeS);
      if (run.timeS - since.get(vehicle.id)! >= 300) stood.add(vehicle.id);
    }
  }
  return { throughPerHour: ((run.results().vehiclesThrough - throughAtWarmUp) * 3600) / (durationS - 600), stood300s: stood.size };
}

describe("a lane closed ahead by stationary vehicles, with more traffic than the open lanes carry", () => {
  // SUMO, with the same cars on the same road with a real lane drop, discharges 3,640 an hour
  // (benchmark T1.5); the benchmark's tolerance is 10%.
  const SUMO_PER_HOUR = 3640;

  it.each([1, 2, 3])(
    "is left by the vehicles queued in it: nobody stands for five minutes (seed %i)",
    { timeout: 60_000 },
    (seed) => {
      const counted = watch(laneClosed(seed), 1500);
      expect(counted.stood300s).toBe(0);
      // Before vehicles left a blocked lane as a rule, these three seeds discharged 2,400 to 2,700 an hour.
      expect(counted.throughPerHour).toBeGreaterThan(2800);
      expect(counted.throughPerHour).toBeLessThan(SUMO_PER_HOUR * 1.1);
    },
  );

  // Known shortfall (ticket 23): the road discharges about a fifth less than SUMO, because a vehicle
  // that moves across from a stand holds both lanes for the whole of its sideways shift. When this
  // test starts to fail, the shortfall is gone: make it an ordinary test.
  it.fails("discharges within 10% of what SUMO does", { timeout: 60_000 }, () => {
    expect(watch(laneClosed(1), 1500).throughPerHour).toBeGreaterThan(SUMO_PER_HOUR * 0.9);
  });

  it("keeps every consistency check", { timeout: 60_000 }, () => {
    expect(checkRunConsistency(laneClosed(4), { durationS: 600 }).violations).toEqual([]);
  });
});

describe("a stationary vehicle in saturated mixed traffic", () => {
  const input = (laneDiscipline: boolean): RunInput => ({
    network: {
      formatVersion: 2,
      roads: [{ id: "main", points: [{ x: 0, y: 0 }, { x: 500, y: 0 }], widthM: 10.5, lanes: 3, speedLimitMps: 13.9 }],
    },
    demand: {
      flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 12000 }],
      vehicleMix: { "two-wheeler": 0.65, car: 0.22, "auto-rickshaw": 0.1, bus: 0.03 },
    },
    seed: 5,
    laneDiscipline,
    initialVehicles: [{ roadId: "main", positionM: 250, speedMps: 0, vehicleClass: "car", lateralM: 5.25, stationary: true }],
  });

  it.each([false, true])("is passed on both sides: nobody stands for five minutes behind it, and every consistency check holds (lane discipline %s)", { timeout: 120_000 }, (laneDiscipline) => {
    expect(watch(input(laneDiscipline), 1200).stood300s).toBe(0);
    expect(checkRunConsistency(input(laneDiscipline), { durationS: 600 }).violations).toEqual([]);
  });
});
