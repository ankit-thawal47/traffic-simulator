import { describe, expect, it } from "vitest";
import { checkRunConsistency } from "../src/consistency-checks";
import type { InitialVehicle, RunInput } from "../src/index";
import { flyoverDemand, flyoverNetwork } from "./flyover-network";

/** Vehicles standing on the flyover right over the middle of the junction beneath. */
function standingOverTheJunction(): InitialVehicle[] {
  const standing: InitialVehicle[] = [];
  for (let positionM = 225; positionM > 175; positionM -= 8) {
    standing.push({ roadId: "flyover", positionM, speedMps: 0, stationary: true, lateralM: 1.75 });
    standing.push({ roadId: "flyover", positionM, speedMps: 0, stationary: true, lateralM: 5.25 });
  }
  return standing;
}

describe("the no-overlap check, where one road passes over another", () => {
  const crossTraffic = (deckHeightM: number): RunInput => ({
    network: flyoverNetwork({ deckHeightM }),
    demand: flyoverDemand(0, 0, 1200),
    seed: 11,
    initialVehicles: standingOverTheJunction(),
  });

  it("does not count vehicles on different levels as overlapping, though they overlap on the plan", () => {
    const report = checkRunConsistency(crossTraffic(6), { durationS: 120 });
    expect(report.results.vehiclesThrough).toBeGreaterThan(10);
    expect(report.violations.slice(0, 3)).toEqual([]);
  });

  it("counts them as overlapping when the two roads are on the same level", () => {
    // The same network with the flyover's deck on the ground: a road laid through the junction without joining it.
    const report = checkRunConsistency(crossTraffic(0), { durationS: 120 });
    const overlaps = report.violations.filter((violation) => violation.check === "no-overlap");
    expect(overlaps.length).toBeGreaterThan(0);
    expect(overlaps[0]!.message).toMatch(/overlap where road "flyover" crosses junction "cross"/);
  });

  it("counts them as overlapping when the upper road is too low to clear the vehicles beneath", () => {
    const report = checkRunConsistency(crossTraffic(2), { durationS: 120 });
    expect(report.violations.some((violation) => violation.check === "no-overlap")).toBe(true);
  });
});
