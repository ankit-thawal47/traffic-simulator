import { describe, expect, it } from "vitest";
import type { Results } from "@traffic-simulator/engine";
import { compareResults, formatChange, type Measure } from "../src/index";

const baseline: Results = {
  timeS: 600,
  vehiclesEntered: 210,
  vehiclesThrough: 200,
  vehiclesOnNetwork: 10,
  vehiclesWaitingToEnter: 0,
};
const proposal: Results = {
  timeS: 600,
  vehiclesEntered: 190,
  vehiclesThrough: 150,
  vehiclesOnNetwork: 40,
  vehiclesWaitingToEnter: 20,
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

  it("reports the same measures, in the same order, whatever the results are", () => {
    const ids = compareResults(baseline, proposal).map((row) => row.id);

    expect(ids).toEqual(["vehicles-through", "vehicles-entered", "vehicles-on-network", "vehicles-waiting-to-enter"]);
    expect(compareResults(baseline, baseline).map((row) => row.id)).toEqual(ids);
  });

  it("every result carries the uncalibrated estimate label", () => {
    for (const row of compareResults(baseline, proposal)) expect(row.estimateLabel).toBe("Uncalibrated estimate");
  });

  it("gives no percentage when the baseline is zero, only the absolute change", () => {
    const waiting = compareResults(baseline, proposal).find((row) => row.id === "vehicles-waiting-to-enter");

    expect(waiting).toMatchObject({ baseline: 0, proposal: 20, change: 20, changePercent: null });
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
