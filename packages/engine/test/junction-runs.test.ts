import { describe, expect, it } from "vitest";
import signalJunction from "../examples/signal-junction.json";
import { createRun, type RunInput } from "../src/index";
import { checkRunConsistency } from "../src/consistency-checks";
import { everyMovement, fourWay, oneApproachAtATime, opposingApproachesTogether } from "./four-way";

function expectConsistent(input: RunInput, durationS: number, atLeastThrough: number): void {
  const report = checkRunConsistency(input, { durationS });
  expect(report.violations.slice(0, 5)).toEqual([]);
  expect(report.results.vehiclesThrough).toBeGreaterThan(atLeastThrough);
}

describe("consistency checks on the signal junction example (the junction test scenario)", () => {
  const example = signalJunction as RunInput;

  it("pass for a simulated hour of mixed traffic, with every approach's traffic getting through", { timeout: 120_000 }, () => {
    const report = checkRunConsistency(example, { durationS: 3600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    // 2000 vehicles an hour arrive; all but those still on their way get through.
    expect(report.results.vehiclesThrough).toBeGreaterThan(1850);
    expect(report.results.vehiclesWaitingToEnter).toBeLessThan(20);
    for (const queue of Object.values(report.results.longestQueueByApproach)) {
      expect(queue.lengthM).toBeGreaterThan(10);
      expect(queue.lengthM).toBeLessThan(150);
    }
  });

  it("pass for a simulated hour with lane discipline on", { timeout: 120_000 }, () => {
    const report = checkRunConsistency({ ...example, laneDiscipline: true }, { durationS: 3600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(1000);
  });
});

describe("consistency checks on a signal junction loaded beyond what it can carry", () => {
  // Hour-long runs at this demand, three seeds of each, were made by hand and are in the ticket's report.
  it.each([31, 32])("pass in mixed traffic with opposing approaches green together (seed %i)", { timeout: 60_000 }, (seed) => {
    expectConsistent({ network: fourWay({ signalPlan: opposingApproachesTogether() }), demand: everyMovement(1500), seed }, 600, 400);
  });

  it.each([34, 35])("pass in mixed traffic with one approach green at a time (seed %i)", { timeout: 60_000 }, (seed) => {
    expectConsistent({ network: fourWay({ signalPlan: oneApproachAtATime() }), demand: everyMovement(1500), seed }, 600, 280);
  });

  it.each([36, 37])("pass with lane discipline on, in mixed vehicle classes (seed %i)", { timeout: 60_000 }, (seed) => {
    expectConsistent(
      { network: fourWay({ signalPlan: opposingApproachesTogether() }), demand: everyMovement(1500), seed, laneDiscipline: true },
      600,
      150,
    );
  });

  it("keeps discharging to the end: the last five minutes carry as much as the five before", { timeout: 60_000 }, () => {
    const run = createRun({ network: fourWay({ signalPlan: oneApproachAtATime() }), demand: everyMovement(1500), seed: 38 });
    const throughAt = (timeS: number) => {
      while (run.timeS < timeS - 1e-9) run.step();
      return run.results().vehiclesThrough;
    };
    const at20 = throughAt(1200);
    const at25 = throughAt(1500);
    const at30 = throughAt(1800);
    // No lock-up: the flow in each five minutes is steady (three cycles of 100 s each).
    expect(at25 - at20).toBeGreaterThan(150);
    expect(at30 - at25).toBeGreaterThan(0.8 * (at25 - at20));
  });
});

describe("consistency checks on a signal junction where paths cross", () => {
  it("pass in mixed traffic when opposing approaches have green together, so right turns cross oncoming traffic", () => {
    expectConsistent(
      { network: fourWay({ signalPlan: opposingApproachesTogether() }), demand: everyMovement(700), seed: 21 },
      600,
      250,
    );
  });

  it("pass in mixed traffic with one approach green at a time, where turning paths from one approach still cross", () => {
    expectConsistent({ network: fourWay({ signalPlan: oneApproachAtATime() }), demand: everyMovement(500), seed: 22 }, 600, 180);
  });

  it("pass where the roads out of the junction are half as wide as the approaches, so vehicles keep to the strips that lead onto their turn", () => {
    const narrow = { widthM: 3.5, lanes: 1 };
    const network = fourWay({
      signalPlan: oneApproachAtATime(),
      roads: { "north-out": narrow, "east-out": narrow, "south-out": narrow, "west-out": narrow },
    });
    const mixed = checkRunConsistency({ network, demand: everyMovement(300), seed: 24 }, { durationS: 600 });
    expect(mixed.violations.slice(0, 5)).toEqual([]);
    // About 200 vehicles arrive in 600 s; most must get through.
    expect(mixed.results.vehiclesThrough).toBeGreaterThan(120);

    const lanes = checkRunConsistency(
      { network, demand: everyMovement(300, false), seed: 24, laneDiscipline: true },
      { durationS: 600 },
    );
    expect(lanes.violations.slice(0, 5)).toEqual([]);
    expect(lanes.results.vehiclesThrough).toBeGreaterThan(120);
  });

  it("pass with lane discipline on, with cars only", () => {
    expectConsistent(
      {
        network: fourWay({ signalPlan: opposingApproachesTogether() }),
        demand: everyMovement(500, false),
        seed: 23,
        laneDiscipline: true,
      },
      600,
      150,
    );
  });
});
