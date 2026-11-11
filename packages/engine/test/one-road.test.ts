import { describe, expect, it } from "vitest";
import { createRun, type Network, type RunInput } from "../src/index";

const oneRoad: Network = {
  formatVersion: 1,
  roads: [
    {
      id: "main",
      points: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
      ],
      widthM: 3.5,
      speedLimitMps: 13.9,
    },
  ],
};

function advance(run: ReturnType<typeof createRun>, seconds: number): void {
  const target = run.timeS + seconds;
  while (run.timeS < target - 1e-9) run.step();
}

describe("cars on one road", () => {
  it("cars from the demand enter the road and leave at its end", () => {
    const input: RunInput = {
      network: oneRoad,
      demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 600 }] },
      seed: 1,
    };
    const run = createRun(input);

    advance(run, 300);

    const results = run.results();
    expect(results.vehiclesEntered).toBeGreaterThan(0);
    expect(results.vehiclesThrough).toBeGreaterThan(0);
    expect(results.vehiclesThrough).toBeLessThanOrEqual(results.vehiclesEntered);
  });
});
