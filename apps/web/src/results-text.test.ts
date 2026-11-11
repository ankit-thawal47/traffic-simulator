import { RUN_PLAN } from "@traffic-simulator/scenario";
import { describe, expect, it } from "vitest";
import { completenessNote, formatAcrossSeeds, formatClock } from "./results-text";

describe("a figure across seeds, written out", () => {
  it("is the average, then the range from lowest to highest", () => {
    expect(formatAcrossSeeds({ average: 5987.4, lowest: 5950, highest: 6020, seeds: 5 })).toBe("5987.4 (5950 to 6020)");
    expect(formatAcrossSeeds({ average: 2.26, lowest: 1.94, highest: 2.81, seeds: 5 })).toBe("2.3 (1.9 to 2.8)");
  });

  it("is a dash when there is nothing to measure", () => {
    expect(formatAcrossSeeds({ average: null, lowest: null, highest: null, seeds: 0 })).toBe("–");
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

describe("saying how complete the figures are", () => {
  const watching = { timeS: 1350, warmingUp: false, finished: false };

  it("says so when no seed has finished", () => {
    expect(completenessNote({ seedsFinished: 0, seeds: 5, firstSeedFinished: false }, watching, RUN_PLAN)).toBe(
      "No figures yet: none of the 5 seeds has finished.",
    );
  });

  it("says the figures are partial while the unseen seeds are still running", () => {
    expect(completenessNote({ seedsFinished: 2, seeds: 5, firstSeedFinished: false }, watching, RUN_PLAN)).toBe(
      "Partial: the figures are over the 2 seeds of 5 that have finished. The other seeds are still running.",
    );
    expect(completenessNote({ seedsFinished: 1, seeds: 5, firstSeedFinished: false }, watching, RUN_PLAN)).toBe(
      "Partial: the figures are over the 1 seed of 5 that has finished. The other seeds are still running.",
    );
  });

  it("says what is missing when only the watched run has not reached the end of its hour", () => {
    expect(completenessNote({ seedsFinished: 4, seeds: 5, firstSeedFinished: false }, watching, RUN_PLAN)).toBe(
      "Partial: the figures are over the 4 seeds of 5 that have finished. The run you are watching is the one still to come: it is at 12:30 of its hour and joins the figures when it reaches the end.",
    );
    expect(completenessNote({ seedsFinished: 4, seeds: 5, firstSeedFinished: false }, { timeS: 90, warmingUp: true, finished: false }, RUN_PLAN)).toBe(
      "Partial: the figures are over the 4 seeds of 5 that have finished. The run you are watching is the one still to come: it is still in its warm-up and joins the figures when it reaches the end of its hour.",
    );
  });

  it("does not blame the watched run when it has finished and an unseen seed has not", () => {
    expect(completenessNote({ seedsFinished: 4, seeds: 5, firstSeedFinished: true }, watching, RUN_PLAN)).toBe(
      "Partial: the figures are over the 4 seeds of 5 that have finished. The other seeds are still running.",
    );
  });

  it("says when the figures are complete", () => {
    expect(completenessNote({ seedsFinished: 5, seeds: 5, firstSeedFinished: true }, watching, RUN_PLAN)).toBe(
      "Complete: the figures are over all 5 seeds.",
    );
  });
});
