import { describe, expect, it } from "vitest";
import type { Results, VehicleClassDelay } from "@traffic-simulator/engine";
import { acrossSeeds, compareAcrossSeeds } from "../src/index";

const noVehicles: VehicleClassDelay = { vehicles: 0, vehiclesThrough: 0, stuckVehicles: 0, meanDelayS: null, totalDelayS: 0 };

/** The results of one seed: vehicles through, and the mean delay of cars (null for no cars). */
function seedResults(vehiclesThrough: number, carDelayS: number | null): Results {
  return {
    timeS: 3600,
    vehiclesEntered: vehiclesThrough,
    vehiclesThrough,
    vehiclesOnNetwork: 0,
    vehiclesWaitingToEnter: 0,
    stuckVehicles: 0,
    delayByVehicleClass: {
      "two-wheeler": noVehicles,
      car:
        carDelayS === null
          ? noVehicles
          : { vehicles: 100, vehiclesThrough: 100, stuckVehicles: 0, meanDelayS: carDelayS, totalDelayS: 100 * carDelayS },
      "auto-rickshaw": noVehicles,
      bus: noVehicles,
    },
    longestQueueByApproach: {},
  };
}

describe("one figure across seeds", () => {
  it("is the average, with the lowest and the highest", () => {
    expect(acrossSeeds([200, 230, 190, 180, 250])).toEqual({ average: 210, lowest: 180, highest: 250, seeds: 5 });
  });

  it("leaves out seeds with nothing to measure, and says how many it is over", () => {
    expect(acrossSeeds([4, null, 8])).toEqual({ average: 6, lowest: 4, highest: 8, seeds: 2 });
    expect(acrossSeeds([null, null])).toEqual({ average: null, lowest: null, highest: null, seeds: 0 });
    expect(acrossSeeds([])).toEqual({ average: null, lowest: null, highest: null, seeds: 0 });
  });
});

describe("comparing a proposal against the baseline across seeds", () => {
  const baseline = [seedResults(200, 10), seedResults(230, 14), seedResults(190, 6)];
  const proposal = [seedResults(150, 20), seedResults(160, 30), seedResults(155, 25)];

  it("gives each measure as an average and a range for both, and the change between the averages", () => {
    const rows = compareAcrossSeeds(baseline, proposal);

    expect(rows.find((row) => row.id === "vehicles-through")).toEqual({
      id: "vehicles-through",
      name: "Vehicles through",
      unit: "vehicles",
      baseline: { average: 620 / 3, lowest: 190, highest: 230, seeds: 3 },
      proposal: { average: 155, lowest: 150, highest: 160, seeds: 3 },
      change: 155 - 620 / 3,
      changePercent: (100 * (155 - 620 / 3)) / (620 / 3),
      estimateLabel: "Uncalibrated estimate",
    });
    expect(rows.find((row) => row.id === "mean-delay-car")).toMatchObject({
      baseline: { average: 10, lowest: 6, highest: 14 },
      proposal: { average: 25, lowest: 20, highest: 30 },
      change: 15,
      changePercent: 150,
    });
  });

  it("reports the same measures in the same order however many seeds have finished, even none", () => {
    const ids = compareAcrossSeeds(baseline, proposal).map((row) => row.id);
    const none = compareAcrossSeeds([], []);

    expect(none.map((row) => row.id)).toEqual(ids);
    expect(none[0]).toMatchObject({
      baseline: { average: null, lowest: null, highest: null, seeds: 0 },
      change: null,
      changePercent: null,
    });
  });

  it("gives no change for a measure one of the scenarios has nothing for", () => {
    const rows = compareAcrossSeeds(baseline, [seedResults(150, null)]);

    expect(rows.find((row) => row.id === "mean-delay-car")).toMatchObject({
      proposal: { average: null, seeds: 0 },
      change: null,
      changePercent: null,
    });
    expect(rows.find((row) => row.id === "mean-delay-bus")).toMatchObject({ change: null });
  });
});
