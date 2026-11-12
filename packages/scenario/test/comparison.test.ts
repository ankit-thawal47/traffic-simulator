import { describe, expect, it } from "vitest";
import type { Results, VehicleClassDelay } from "@traffic-simulator/engine";
import { SMALLEST_BASELINE_FOR_PERCENT, compareResults, formatChange, type Measure } from "../src/index";

const noVehicles: VehicleClassDelay = { vehicles: 0, vehiclesThrough: 0, stuckVehicles: 0, meanDelayS: null, totalDelayS: 0 };
const delays = (twoWheelerS: number, carS: number): Results["delayByVehicleClass"] => ({
  "two-wheeler": { vehicles: 120, vehiclesThrough: 110, stuckVehicles: 0, meanDelayS: twoWheelerS, totalDelayS: 120 * twoWheelerS },
  car: { vehicles: 90, vehiclesThrough: 80, stuckVehicles: 0, meanDelayS: carS, totalDelayS: 90 * carS },
  "auto-rickshaw": noVehicles,
  bus: noVehicles,
});

const baseline: Results = {
  timeS: 600,
  vehiclesEntered: 210,
  vehiclesThrough: 200,
  vehiclesOnNetwork: 10,
  vehiclesWaitingToEnter: 0,
  stuckVehicles: 0,
  delayByVehicleClass: delays(4, 10),
  longestQueueByApproach: {},
};
const proposal: Results = {
  timeS: 600,
  vehiclesEntered: 190,
  vehiclesThrough: 150,
  vehiclesOnNetwork: 40,
  vehiclesWaitingToEnter: 20,
  stuckVehicles: 0,
  delayByVehicleClass: delays(5, 25),
  longestQueueByApproach: {},
};

describe("comparing a proposal's results against the baseline's", () => {
  it("gives each measure for both scenarios as an absolute number and as a change from the baseline", () => {
    const rows = compareResults(baseline, proposal);

    expect(rows.find((row) => row.id === "vehicles-through")).toEqual({
      id: "vehicles-through",
      name: "Vehicles through",
      unit: "vehicles",
      baseline: 200,
      proposal: 150,
      change: -50,
      changePercent: -25,
      estimateLabel: "Uncalibrated estimate",
    });
  });

  it("reports only the fixed result set (ADR 0005), in the same order, whatever the results are", () => {
    const ids = compareResults(baseline, proposal).map((row) => row.id);

    // Of the fixed set, these are what the engine reports so far. Its other counts are not results.
    expect(ids).toEqual([
      "vehicles-through",
      "mean-delay-two-wheeler",
      "mean-delay-car",
      "mean-delay-auto-rickshaw",
      "mean-delay-bus",
    ]);
    expect(compareResults(baseline, baseline).map((row) => row.id)).toEqual(ids);
  });

  it("every result carries the uncalibrated estimate label", () => {
    for (const row of compareResults(baseline, proposal)) expect(row.estimateLabel).toBe("Uncalibrated estimate");
  });

  it("gives no percentage when the baseline is zero, only the absolute change", () => {
    const through = compareResults({ ...baseline, vehiclesThrough: 0 }, { ...proposal, vehiclesThrough: 20 }).find(
      (row) => row.id === "vehicles-through",
    );

    expect(through).toMatchObject({ baseline: 0, proposal: 20, change: 20, changePercent: null });
  });

  it("gives no percentage when the baseline is close to zero: a change of +4650% says nothing the absolute change does not", () => {
    // A mean delay of 0.4 s that becomes 19 s is +4650%; a queue of 2 m that becomes 95 m likewise.
    const rows = compareResults({ ...baseline, delayByVehicleClass: delays(0.4, 4.9) }, { ...proposal, delayByVehicleClass: delays(19, 25) });

    expect(rows.find((row) => row.id === "mean-delay-two-wheeler")).toMatchObject({ change: 18.6, changePercent: null });
    expect(rows.find((row) => row.id === "mean-delay-car")).toMatchObject({ baseline: 4.9, changePercent: null });
  });

  it("gives the percentage from the smallest baseline that carries one: 5 s, 10 m, 10 vehicles", () => {
    expect(SMALLEST_BASELINE_FOR_PERCENT).toEqual({ s: 5, m: 10, vehicles: 10 });
    const rows = compareResults(
      { ...baseline, vehiclesThrough: 10, delayByVehicleClass: delays(5, 10) },
      { ...proposal, vehiclesThrough: 20, delayByVehicleClass: delays(10, 10) },
    );

    expect(rows.find((row) => row.id === "vehicles-through")!.changePercent).toBe(100);
    expect(rows.find((row) => row.id === "mean-delay-two-wheeler")!.changePercent).toBe(100);
    expect(compareResults({ ...baseline, vehiclesThrough: 9 }, proposal)[0]!.changePercent).toBeNull();
  });

  it("gives the mean delay of each vehicle class, and nothing for a vehicle class with no vehicles", () => {
    const rows = compareResults(baseline, proposal);

    expect(rows.find((row) => row.id === "mean-delay-car")).toMatchObject({
      name: "Mean delay of cars (s)",
      baseline: 10,
      proposal: 25,
      change: 15,
      changePercent: 150,
    });
    expect(rows.find((row) => row.id === "mean-delay-bus")).toMatchObject({
      baseline: null,
      proposal: null,
      change: null,
      changePercent: null,
    });
  });

  it("a further measure slots in as one more entry in the list of measures", () => {
    const meanOccupancy: Measure = {
      id: "share-still-on-network",
      name: "Share still on the network",
      unit: "%",
      value: (results) => (100 * results.vehiclesOnNetwork) / results.vehiclesEntered,
    };

    const [row] = compareResults(baseline, { ...proposal, vehiclesEntered: 200 }, [meanOccupancy]);

    expect(row).toMatchObject({ id: "share-still-on-network", baseline: 100 / 21, proposal: 20 });
    expect(row!.change).toBeCloseTo(20 - 100 / 21, 12);
  });
});

describe("writing a change from the baseline", () => {
  it("always shows its direction", () => {
    expect(formatChange(50)).toBe("+50");
    expect(formatChange(-50)).toBe("−50");
    expect(formatChange(0)).toBe("0");
    expect(formatChange(-12.345)).toBe("−12.3");
  });
});
