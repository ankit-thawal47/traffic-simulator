import { describe, expect, it } from "vitest";
import { checkRunConsistency } from "../src/consistency-checks";
import { createRun, resultsExcludingWarmUp, type InitialVehicle, type RunInput, type SignalPlan } from "../src/index";
import flyover from "../examples/flyover.json";
import mixedTraffic from "../examples/mixed-traffic.json";
import oneRoad from "../examples/one-road.json";
import signalJunction from "../examples/signal-junction.json";
import { flyoverNetworkWithSplitExit, weavingDemand } from "./flyover-network";
import { alwaysGreenFor, fourWay } from "./four-way";

const LANE_M = 3.5;

/**
 * A lock built on purpose. The approach from the south has two lanes; its left lane alone
 * leads left (onto a one-lane road to the west) and its right lane alone leads right (onto a
 * one-lane road to the east). Two cars stand side by side at the stop line, each in the lane
 * the other needs: the car in the right lane turns left, the car in the left lane turns right.
 * Neither can move across while the other is beside it, and neither can be let into the
 * junction from where it is, so neither can ever move. Traffic going straight on queues behind.
 */
function sideBySideLock(signalPlan: SignalPlan = alwaysGreenFor("south-in"), seed = 1, vehiclesPerHour = 300): RunInput {
  const atStopLine = (lane: number, exitRoadId: string): InitialVehicle => ({
    roadId: "south-in",
    positionM: 199,
    speedMps: 0,
    vehicleClass: "car",
    lateralM: (lane + 0.5) * LANE_M,
    exitRoadId,
  });
  return {
    network: fourWay({
      lanes: 2,
      widthM: 2 * LANE_M,
      signalPlan,
      roads: { "west-out": { widthM: LANE_M, lanes: 1 }, "east-out": { widthM: LANE_M, lanes: 1 } },
    }),
    demand: { flows: [{ entryRoadId: "south-in", exitRoadId: "north-out", vehiclesPerHour }] },
    seed,
    laneDiscipline: true,
    initialVehicles: [atStopLine(1, "west-out"), atStopLine(0, "east-out")],
  };
}

function runFor(input: RunInput, durationS: number) {
  const run = createRun(input);
  while (run.timeS < durationS - 1e-9) run.step();
  return run.results();
}

describe("stuck vehicles in the ordinary examples, at their own demand, for the warm-up and a simulated hour", () => {
  const examples = { oneRoad, mixedTraffic, signalJunction, flyover } as Record<string, RunInput>;
  it.each(Object.keys(examples).flatMap((name) => [1, 2, 3].map((seed) => [name, seed] as const)))(
    "are none: %s, seed %i",
    { timeout: 60_000 },
    (name, seed) => {
      expect(runFor({ ...examples[name]!, seed }, 4200).stuckVehicles).toBe(0);
    },
  );
});

describe("stuck vehicles", () => {
  it("are found in a lock built on purpose, one is released, and the run goes on", () => {
    // The lock is real: until a release, nothing gets through.
    const before = runFor(sideBySideLock(), 290);
    expect(before.vehiclesThrough).toBe(0);
    expect(before.stuckVehicles).toBe(0);
    const results = runFor(sideBySideLock(), 900);
    expect(results.stuckVehicles).toBe(1);
    // Released, the lock is gone: the other car turns and the queue behind it drains.
    expect(results.vehiclesThrough).toBeGreaterThan(30);
  });

  it("are counted apart: not through, not lost, and in the mean delay with their delay up to the release", () => {
    const report = checkRunConsistency(sideBySideLock(), { durationS: 600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    const results = report.results;
    expect(results.stuckVehicles).toBe(1);
    expect(results.vehiclesEntered).toBe(results.vehiclesThrough + results.vehiclesOnNetwork + results.stuckVehicles);
    const car = results.delayByVehicleClass.car;
    expect(car.stuckVehicles).toBe(1);
    expect(car.vehiclesThrough).toBe(results.vehiclesThrough);
    expect(car.vehicles).toBe(results.vehiclesEntered + results.vehiclesWaitingToEnter);
    // The two locked cars alone: one is released after standing 300 s, and that is its delay; the other
    // then turns and leaves with a little over 300 s. Both are in the mean.
    const alone = runFor(sideBySideLock(alwaysGreenFor("south-in"), 1, 0), 600).delayByVehicleClass.car;
    expect(alone).toMatchObject({ vehicles: 2, vehiclesThrough: 1, stuckVehicles: 1 });
    expect(alone.totalDelayS).toBeGreaterThan(600);
    expect(alone.totalDelayS).toBeLessThan(630);
  });

  it("are released the same way every time for the same seed, and only once a lock has stood long enough", () => {
    for (const seed of [1, 2]) {
      const first = runFor(sideBySideLock(alwaysGreenFor("south-in"), seed), 600);
      const second = runFor(sideBySideLock(alwaysGreenFor("south-in"), seed), 600);
      expect(second).toEqual(first);
    }
  });

  it("released during the warm-up are left out of the results with it", () => {
    const run = createRun(sideBySideLock(alwaysGreenFor("south-in"), 1, 0));
    while (run.timeS < 301 - 1e-9) run.step();
    const atEndOfWarmUp = run.results();
    while (run.timeS < 600 - 1e-9) run.step();
    const after = resultsExcludingWarmUp(atEndOfWarmUp, run.results());
    expect(atEndOfWarmUp.stuckVehicles).toBe(1);
    expect(after.stuckVehicles).toBe(0);
    // Only the car still there when the warm-up ended is in the mean.
    expect(after.delayByVehicleClass.car).toMatchObject({ vehicles: 1, stuckVehicles: 0 });
  });

  it("released after the warm-up are in the results", () => {
    const run = createRun(sideBySideLock(alwaysGreenFor("south-in"), 1, 0));
    while (run.timeS < 100 - 1e-9) run.step();
    const atEndOfWarmUp = run.results();
    while (run.timeS < 600 - 1e-9) run.step();
    const after = resultsExcludingWarmUp(atEndOfWarmUp, run.results());
    expect(after.stuckVehicles).toBe(1);
    expect(after.delayByVehicleClass.car).toMatchObject({ vehicles: 2, vehiclesThrough: 1, stuckVehicles: 1 });
  });

  it("are not vehicles waiting at a red signal, however long the red", () => {
    // The approach from the south is red for the whole run; its queue stands for ten minutes and more.
    const input: RunInput = {
      network: fourWay({ signalPlan: alwaysGreenFor("north-in") }),
      demand: { flows: [{ entryRoadId: "south-in", exitRoadId: "north-out", vehiclesPerHour: 600 }] },
      seed: 2,
    };
    const results = runFor(input, 900);
    expect(results.vehiclesThrough).toBe(0);
    expect(results.vehiclesOnNetwork).toBeGreaterThan(20);
    expect(results.stuckVehicles).toBe(0);
  });

  it("are not stationary vehicles, nor the vehicles queued behind one that blocks the road right across", () => {
    const input: RunInput = {
      network: {
        formatVersion: 2,
        roads: [{ id: "main", points: [{ x: 0, y: 0 }, { x: 400, y: 0 }], widthM: LANE_M, lanes: 1, speedLimitMps: 13.9 }],
      },
      demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 600 }] },
      seed: 3,
      laneDiscipline: true,
      initialVehicles: [{ roadId: "main", positionM: 300, speedMps: 0, vehicleClass: "car", stationary: true }],
    };
    const run = createRun(input);
    while (run.timeS < 900) run.step();
    const results = run.results();
    expect(results.vehiclesThrough).toBe(0);
    expect(results.stuckVehicles).toBe(0);
    expect(run.snapshot().vehicles.some((vehicle) => vehicle.id === 1)).toBe(true);
  });
});

describe("stuck vehicles in a known lock-up: a weaving section with lane discipline on, loaded far beyond what it carries", () => {
  // The README's known case: the weaving section jams back into the signal junction before it.
  const weaving = (seed: number): RunInput => ({
    network: flyoverNetworkWithSplitExit(),
    demand: weavingDemand(3000, 600),
    seed,
    laneDiscipline: true,
  });

  it("are released and counted, and the run finishes", { timeout: 120_000 }, () => {
    // Measured by hand for seeds 81 to 83 over the warm-up and an hour: 7, 3 and 4.
    const results = runFor(weaving(82), 4200);
    expect(results.stuckVehicles).toBeGreaterThan(0);
    expect(results.vehiclesEntered).toBe(results.vehiclesThrough + results.vehiclesOnNetwork + results.stuckVehicles);
  });

  it("keep every consistency check through a release", { timeout: 300_000 }, () => {
    // Seed 81 locks up first: its first release is at 2,571 s (since turns leave from their own side of the approach, ticket 24).
    const report = checkRunConsistency(weaving(81), { durationS: 2700 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.stuckVehicles).toBeGreaterThan(0);
  });
});
