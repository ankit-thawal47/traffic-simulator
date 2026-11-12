import { describe, expect, it } from "vitest";
import mixedTraffic from "../examples/mixed-traffic.json";
import { createRun, resultsExcludingWarmUp, VEHICLE_CLASSES, type RunInput } from "../src/index";

/**
 * One lane, kept to (lane discipline on), with a breakdown 300 m along it and
 * one car that drives up behind the breakdown and can never pass. No demand.
 */
const heldBehindABreakdown: RunInput = {
  network: {
    formatVersion: 2,
    roads: [
      {
        id: "main",
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        widthM: 3.5,
        lanes: 1,
        speedLimitMps: 13.9,
      },
    ],
  },
  demand: { flows: [] },
  seed: 1,
  laneDiscipline: true,
  initialVehicles: [
    { roadId: "main", positionM: 300, speedMps: 0, stationary: true },
    { roadId: "main", positionM: 100, speedMps: 10 },
  ],
};

function runFor(input: RunInput, seconds: number) {
  const run = createRun(input);
  while (run.timeS < seconds - 1e-9) run.step();
  return run;
}

describe("the total delay behind each mean delay", () => {
  it("a car held behind a breakdown for ten minutes has close to ten minutes of delay in total", () => {
    const car = runFor(heldBehindABreakdown, 600).results().delayByVehicleClass.car;

    expect(car.vehicles).toBe(1);
    // Ten minutes, less the 14 seconds or so that the 190 m it did cover would take at its desired speed.
    expect(car.totalDelayS).toBeGreaterThan(580);
    expect(car.totalDelayS).toBeLessThan(590);
    expect(car.meanDelayS).toBe(car.totalDelayS);
  });
});

describe("results that exclude the warm-up", () => {
  it("a car held still for the whole hour after a ten minute warm-up has one hour of delay, not seventy minutes", () => {
    const run = createRun(heldBehindABreakdown);
    while (run.timeS < 600 - 1e-9) run.step();
    const atEndOfWarmUp = run.results();
    while (run.timeS < 4200 - 1e-9) run.step();

    const results = resultsExcludingWarmUp(atEndOfWarmUp, run.results());

    expect(results.timeS).toBeCloseTo(3600, 6);
    expect(results.delayByVehicleClass.car.vehicles).toBe(1);
    expect(results.delayByVehicleClass.car.vehiclesThrough).toBe(0);
    // It creeps a few millimetres towards its standstill gap, so not exactly an hour.
    expect(results.delayByVehicleClass.car.meanDelayS).toBeGreaterThan(3599);
    expect(results.delayByVehicleClass.car.meanDelayS).toBeLessThanOrEqual(3600);
    // The engine's own figure covers the warm-up too.
    expect(run.results().delayByVehicleClass.car.meanDelayS).toBeGreaterThan(4180);
  });

  it("counts only the vehicles seen to enter and to leave after the warm-up", () => {
    const run = createRun(mixedTraffic as RunInput);
    while (run.timeS < 120 - 1e-9) run.step();
    const atEndOfWarmUp = run.results();

    // Watch the road itself: a vehicle not seen before has entered; one no longer there has left.
    let onNetwork = new Map(run.snapshot().vehicles.map((vehicle) => [vehicle.id, vehicle.vehicleClass]));
    let seenToEnter = 0;
    const seenToLeave = { "two-wheeler": 0, car: 0, "auto-rickshaw": 0, bus: 0 };
    while (run.timeS < 420 - 1e-9) {
      run.step();
      const now = new Map(run.snapshot().vehicles.map((vehicle) => [vehicle.id, vehicle.vehicleClass]));
      for (const id of now.keys()) if (!onNetwork.has(id)) seenToEnter++;
      for (const [id, vehicleClass] of onNetwork) if (!now.has(id)) seenToLeave[vehicleClass]++;
      onNetwork = now;
    }

    const results = resultsExcludingWarmUp(atEndOfWarmUp, run.results());

    const left = seenToLeave["two-wheeler"] + seenToLeave.car + seenToLeave["auto-rickshaw"] + seenToLeave.bus;
    expect(left).toBeGreaterThan(300);
    expect(results.vehiclesThrough).toBe(left);
    expect(results.vehiclesEntered).toBe(seenToEnter);
    for (const vehicleClass of VEHICLE_CLASSES) {
      expect(results.delayByVehicleClass[vehicleClass].vehiclesThrough).toBe(seenToLeave[vehicleClass]);
    }
    // How things stand at the end is not a count over a period, so it is given as it is.
    expect(results.vehiclesOnNetwork).toBe(onNetwork.size);
    expect(results.vehiclesWaitingToEnter).toBe(run.results().vehiclesWaitingToEnter);
  });

  it("gives no mean delay for a vehicle class with no vehicles after the warm-up", () => {
    const run = createRun(heldBehindABreakdown);
    while (run.timeS < 600 - 1e-9) run.step();
    const atEndOfWarmUp = run.results();
    while (run.timeS < 900 - 1e-9) run.step();

    const results = resultsExcludingWarmUp(atEndOfWarmUp, run.results());

    expect(results.delayByVehicleClass.bus).toEqual({ vehicles: 0, vehiclesThrough: 0, stuckVehicles: 0, meanDelayS: null, totalDelayS: 0 });
  });
});
