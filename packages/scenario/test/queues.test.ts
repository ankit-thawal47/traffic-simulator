import { describe, expect, it } from "vitest";
import type { Results, VehicleClassDelay } from "@traffic-simulator/engine";
import { MEASURES, compareAcrossSeeds, compareResults, measuresFor } from "../src/index";

const noVehicles: VehicleClassDelay = { vehicles: 0, vehiclesThrough: 0, meanDelayS: null, totalDelayS: 0 };

/** Results with these longest queues, in metres, by approach. */
function results(queuesM: Record<string, number>): Results {
  return {
    timeS: 3600,
    vehiclesEntered: 0,
    vehiclesThrough: 0,
    vehiclesOnNetwork: 0,
    vehiclesWaitingToEnter: 0,
    delayByVehicleClass: { "two-wheeler": noVehicles, car: noVehicles, "auto-rickshaw": noVehicles, bus: noVehicles },
    longestQueueByApproach: Object.fromEntries(
      Object.entries(queuesM).map(([roadId, lengthM]) => [roadId, { lengthM, vehicles: 1, eachMinute: [] }]),
    ),
  };
}

describe("the longest queue per approach in the fixed result set", () => {
  const baseline = results({ "north-in": 40, "south-in": 0 });
  const proposal = results({ "north-in": 25, "south-in": 12.5 });

  it("is one measure per approach, in metres, after the measures every network has", () => {
    const measures = measuresFor([baseline, proposal]);

    expect(measures.slice(0, MEASURES.length)).toEqual(MEASURES);
    const rows = compareResults(baseline, proposal, measures).slice(MEASURES.length);
    expect(rows).toEqual([
      {
        id: "longest-queue:north-in",
        name: "Longest queue on north-in (m)",
        unit: "m",
        baseline: 40,
        proposal: 25,
        change: -15,
        changePercent: -37.5,
        estimateLabel: "Uncalibrated estimate",
      },
      {
        id: "longest-queue:south-in",
        name: "Longest queue on south-in (m)",
        unit: "m",
        baseline: 0,
        proposal: 12.5,
        change: 12.5,
        changePercent: null,
        estimateLabel: "Uncalibrated estimate",
      },
    ]);
  });

  it("is the average and range across seeds like any other measure", () => {
    const seeds = [results({ "north-in": 30 }), results({ "north-in": 50 }), results({ "north-in": 40 })];
    const row = compareAcrossSeeds(seeds, [proposal], measuresFor([...seeds, proposal])).find(
      (measure) => measure.id === "longest-queue:north-in",
    )!;
    expect(row.baseline).toEqual({ average: 40, lowest: 30, highest: 50, seeds: 3 });
    expect(row.change).toBe(-15);
  });

  it("covers an approach that only some of the results have, with nothing to measure in the others", () => {
    const withoutSouth = results({ "north-in": 25 });
    const rows = compareResults(baseline, withoutSouth, measuresFor([baseline, withoutSouth]));
    expect(rows.slice(MEASURES.length).map((row) => [row.id, row.baseline, row.proposal, row.change])).toEqual([
      ["longest-queue:north-in", 40, 25, -15],
      ["longest-queue:south-in", 0, null, null],
    ]);
  });

  it("adds nothing for a network with no junction", () => {
    expect(measuresFor([results({})])).toEqual(MEASURES);
    expect(measuresFor([])).toEqual(MEASURES);
  });
});
