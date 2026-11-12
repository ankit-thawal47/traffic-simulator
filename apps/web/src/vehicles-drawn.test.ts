import { describe, expect, it } from "vitest";
import { MAX_VEHICLES_DRAWN, notDrawnNotice } from "./vehicles-drawn";

describe("the most vehicles one 3D view draws", () => {
  it("covers the performance target of 3,000 vehicles in a view, three times over", () => {
    expect(MAX_VEHICLES_DRAWN).toBeGreaterThanOrEqual(3 * 3000);
  });

  it("says nothing while every vehicle is drawn", () => {
    expect(notDrawnNotice(0)).toBeUndefined();
  });

  it("says so in plain words when a run has more vehicles than are drawn, and that the results still count them", () => {
    expect(notDrawnNotice(250)).toBe(
      `250 vehicles are not drawn: this view draws at most ${MAX_VEHICLES_DRAWN.toLocaleString("en-IN")}. The results count every vehicle.`,
    );
    expect(notDrawnNotice(1)).toBe(
      `1 vehicle is not drawn: this view draws at most ${MAX_VEHICLES_DRAWN.toLocaleString("en-IN")}. The results count every vehicle.`,
    );
  });
});
