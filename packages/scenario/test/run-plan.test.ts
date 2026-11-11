import { describe, expect, it } from "vitest";
import { STEP_SECONDS, type RunInput } from "@traffic-simulator/engine";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import { RUN_PLAN, createMeasuredRun, seedsFor } from "../src/index";

const input = mixedTraffic as RunInput;

describe("the run plan", () => {
  it("is one hour after a ten minute warm-up, with five seeds", () => {
    expect(RUN_PLAN).toEqual({ warmUpS: 600, measuredS: 3600, seeds: 5 });
  });
});

describe("the seeds a scenario runs with", () => {
  it("are the scenario's own seed first, then the four whole numbers after it", () => {
    expect(seedsFor(7)).toEqual([7, 8, 9, 10, 11]);
    expect(seedsFor(-2)).toEqual([-2, -1, 0, 1, 2]);
  });
});

describe("a run that covers the run plan", () => {
  it("has no results during the warm-up", () => {
    const run = createMeasuredRun(input);
    expect(run.warmingUp).toBe(true);
    expect(run.results()).toBeUndefined();

    for (let i = 0; i < 600 / STEP_SECONDS - 1; i++) run.step();

    expect(run.warmingUp).toBe(true);
    expect(run.results()).toBeUndefined();

    run.step();

    expect(run.timeS).toBeCloseTo(600, 6);
    expect(run.warmingUp).toBe(false);
    expect(run.results()).toMatchObject({ timeS: 0, vehiclesThrough: 0 });
  });

  it("ends after one hour of results, and in that hour about the hourly demand gets through", () => {
    const run = createMeasuredRun(input);
    let steps = 0;
    while (!run.finished) {
      run.step();
      steps++;
    }

    expect(steps).toBe(4200 / STEP_SECONDS);
    expect(run.timeS).toBeCloseTo(4200, 6);
    const results = run.results()!;
    expect(results.timeS).toBeCloseTo(3600, 6);
    // The example sends 6000 vehicles an hour down a road that can take them. Seventy minutes' worth would be 7000.
    expect(results.vehiclesThrough).toBeGreaterThan(5700);
    expect(results.vehiclesThrough).toBeLessThan(6300);

    // A finished run stays as it is.
    const snapshot = run.snapshot();
    run.step();
    expect(run.timeS).toBeCloseTo(4200, 6);
    expect(run.snapshot()).toEqual(snapshot);
    expect(run.results()).toEqual(results);
  });

  it("can be given a shorter plan", () => {
    const run = createMeasuredRun(input, { warmUpS: 60, measuredS: 120, seeds: 5 });
    while (!run.finished) run.step();

    expect(run.timeS).toBeCloseTo(180, 6);
    expect(run.results()!.timeS).toBeCloseTo(120, 6);
  });
});
