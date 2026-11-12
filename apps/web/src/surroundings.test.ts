import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";
import { distanceToNearestRoadM, surroundings } from "./surroundings";

const hebbal = EXAMPLES.find((example) => example.id === "hebbal-city-bound")!.scenario.network;

describe("the buildings and trees along a corridor", () => {
  const placed = surroundings(hebbal);

  it("puts a few of each along the roads", () => {
    expect(placed.buildings.length).toBeGreaterThan(20);
    expect(placed.trees.length).toBeGreaterThan(40);
    // A few, not a city: the view stays cheap to draw.
    expect(placed.buildings.length).toBeLessThanOrEqual(400);
    expect(placed.trees.length).toBeLessThanOrEqual(800);
  });

  it("never puts a building or a tree on a road, or under a flyover", () => {
    for (const building of placed.buildings) {
      // The building's corners reach out to half its diagonal from its middle.
      const reachM = Math.hypot(building.widthM, building.depthM) / 2;
      expect(distanceToNearestRoadM(hebbal, building) - reachM).toBeGreaterThan(2);
    }
    for (const tree of placed.trees) expect(distanceToNearestRoadM(hebbal, tree) - tree.crownM).toBeGreaterThan(0.5);
  });

  it("is the same every time, so both views and every visit show the same place", () => {
    expect(surroundings(hebbal)).toEqual(placed);
  });

  it("stays near the roads, not spread over the whole ground", () => {
    for (const building of placed.buildings) expect(distanceToNearestRoadM(hebbal, building)).toBeLessThan(110);
  });
});
