import { describe, expect, it } from "vitest";
import type { RunInput } from "../src/index";
import { checkRunConsistency } from "../src/consistency-checks";
import { everyMovement, fourWay, oneApproachAtATime, opposingApproachesTogether } from "./four-way";

function expectConsistent(input: RunInput, durationS: number, atLeastThrough: number): void {
  const report = checkRunConsistency(input, { durationS });
  expect(report.violations.slice(0, 5)).toEqual([]);
  expect(report.results.vehiclesThrough).toBeGreaterThan(atLeastThrough);
}

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

  it("pass where the roads out of the junction are half as wide as the approaches, so vehicles must move over before entering", () => {
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
