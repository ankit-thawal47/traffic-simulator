import { RUN_PLAN } from "@traffic-simulator/scenario";
import { describe, expect, it } from "vitest";
import { formatAcrossSeeds, formatClock, stuckVehiclesNote } from "./results-text";

describe("a figure across seeds, written out", () => {
  it("is the average, then the range from lowest to highest", () => {
    expect(formatAcrossSeeds({ average: 5987.4, lowest: 5950, highest: 6020, seeds: 5 })).toBe("5987.4 (5950 to 6020)");
    expect(formatAcrossSeeds({ average: 2.26, lowest: 1.94, highest: 2.81, seeds: 5 })).toBe("2.3 (1.9 to 2.8)");
  });

  it("is a dash when there is nothing to measure", () => {
    expect(formatAcrossSeeds({ average: null, lowest: null, highest: null, seeds: 0 })).toBe("–");
  });
});

describe("the note on stuck vehicles", () => {
  const none = { average: 0, lowest: 0, highest: 0, seeds: 5 };

  it("is nothing when no seed of either scenario had a stuck vehicle", () => {
    expect(stuckVehiclesNote(none, none)).toBeNull();
    expect(stuckVehiclesNote({ average: null, lowest: null, highest: null, seeds: 0 }, none)).toBeNull();
  });

  it("says which scenario locked up and that its figures are less reliable", () => {
    expect(stuckVehiclesNote(none, { average: 0.4, lowest: 0, highest: 2, seeds: 5 })).toBe(
      "The proposal locked up: in at least one seed vehicles could not move and were released by force (stuck vehicles). " +
        "Its figures are less reliable.",
    );
    expect(stuckVehiclesNote({ average: 1, lowest: 1, highest: 1, seeds: 5 }, { average: 3, lowest: 1, highest: 6, seeds: 5 })).toBe(
      "The baseline and the proposal locked up: in at least one seed vehicles could not move and were released by force (stuck vehicles). " +
        "Their figures are less reliable.",
    );
  });
});

describe("the watched run's clock", () => {
  it("counts the warm-up on its own, and says it is left out", () => {
    expect(formatClock({ timeS: 200, warmingUp: true, finished: false }, RUN_PLAN)).toBe(
      "Warm-up 3:20 of 10:00, left out of the results",
    );
  });

  it("then counts the hour the results cover from zero", () => {
    expect(formatClock({ timeS: 600, warmingUp: false, finished: false }, RUN_PLAN)).toBe("Run time 0:00 of 60:00");
    expect(formatClock({ timeS: 1350.4, warmingUp: false, finished: false }, RUN_PLAN)).toBe("Run time 12:30 of 60:00");
    expect(formatClock({ timeS: 4200, warmingUp: false, finished: true }, RUN_PLAN)).toBe(
      "Run time 60:00 of 60:00, finished",
    );
  });
});
