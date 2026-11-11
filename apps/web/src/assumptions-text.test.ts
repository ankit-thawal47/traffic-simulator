import { describe, expect, it } from "vitest";
import { formatAssumptionValue, STATES, STATE_TEXT } from "./assumptions-text";

describe("an assumption's value as the planner reads it", () => {
  it("shows a speed in m/s and in km/h", () => {
    expect(formatAssumptionValue({ value: 18, unit: "m/s" })).toBe("18 m/s (65 km/h)");
    expect(formatAssumptionValue({ value: 0.4, unit: "m/s" })).toBe("0.4 m/s (1.4 km/h)");
  });

  it("shows a share of vehicles as a percentage", () => {
    expect(formatAssumptionValue({ value: 0.055, unit: "of all vehicles" })).toBe("5.5% of all vehicles");
  });

  it("shows other values with their unit, or alone when they have none", () => {
    expect(formatAssumptionValue({ value: 2.43, unit: "m" })).toBe("2.43 m");
    expect(formatAssumptionValue({ value: 4, unit: "m/s2" })).toBe("4 m/s²");
    expect(formatAssumptionValue({ value: 0.2, unit: "" })).toBe("0.2");
  });

  it("shows a rule as a rule, with no number", () => {
    expect(formatAssumptionValue({ value: null, unit: "" })).toBe("Rule");
  });
});

describe("the words for an assumption's state", () => {
  it("has a label and a meaning for every state, none claiming calibration or validation", () => {
    for (const state of STATES) {
      expect(STATE_TEXT[state].label.length).toBeGreaterThan(5);
      expect(`${STATE_TEXT[state].label} ${STATE_TEXT[state].meaning}`).not.toMatch(/calibrat|validat/i);
    }
  });
});
