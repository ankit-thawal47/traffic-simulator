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

const noDemand = { flows: [] };

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

  it("a lone car speeds up to the road's speed limit and holds it", () => {
    const run = createRun({
      network: oneRoad,
      demand: noDemand,
      seed: 1,
      initialVehicles: [{ roadId: "main", positionM: 10, speedMps: 0 }],
    });

    // At most 1 m/s2 (the car assumption), so it cannot be at the limit of 13.9 m/s after 5 s.
    advance(run, 5);
    expect(run.snapshot().vehicles[0]!.speedMps).toBeGreaterThan(2);
    expect(run.snapshot().vehicles[0]!.speedMps).toBeLessThan(5.01);

    advance(run, 25);
    const speed = run.snapshot().vehicles[0]!.speedMps;
    expect(speed).toBeGreaterThan(0.95 * 13.9);
    expect(speed).toBeLessThanOrEqual(13.9);
  });

  it("a car stops behind a stationary car, about the standstill gap short of it", () => {
    const run = createRun({
      network: oneRoad,
      demand: noDemand,
      seed: 1,
      initialVehicles: [
        { roadId: "main", positionM: 300, speedMps: 0, stationary: true },
        { roadId: "main", positionM: 50, speedMps: 13.9 },
      ],
    });

    advance(run, 120);

    const [stationary, follower] = run.snapshot().vehicles;
    expect(stationary!.positionM).toBe(300);
    expect(follower!.speedMps).toBeLessThan(0.05);
    const gap = stationary!.positionM - stationary!.lengthM - follower!.positionM;
    // Reference: the following rule's equation integrated at a 0.001 s step for this
    // approach (13.9 m/s, car assumptions) comes to rest 1.72 m behind the car ahead,
    // a little inside the 2.0 m standstill gap. That undershoot belongs to the rule.
    expect(gap).toBeGreaterThan(1.6);
    expect(gap).toBeLessThan(1.85);
    expect(run.results().vehiclesThrough).toBe(0);
  });

  it("cars arriving far too fast to stop still never pass through the car ahead", () => {
    // Two cars 3 m apart at 20 m/s, the first only 5 cm from a stationary car:
    // the first stops dead, and the second has no room to brake comfortably.
    const run = createRun({
      network: oneRoad,
      demand: noDemand,
      seed: 1,
      initialVehicles: [
        { roadId: "main", positionM: 100, speedMps: 0, stationary: true },
        { roadId: "main", positionM: 95.55, speedMps: 20 },
        { roadId: "main", positionM: 88.15, speedMps: 20 },
      ],
    });

    for (let i = 0; i < 100; i++) {
      run.step();
      const vehicles = run.snapshot().vehicles;
      for (let k = 1; k < vehicles.length; k++) {
        const ahead = vehicles[k - 1]!;
        const behind = vehicles[k]!;
        expect(ahead.positionM - ahead.lengthM - behind.positionM).toBeGreaterThanOrEqual(0);
        expect(behind.speedMps).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("cars wait to enter while the start of the road is blocked, and none is lost", () => {
    const run = createRun({
      network: oneRoad,
      demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 1800 }] },
      seed: 3,
      initialVehicles: [{ roadId: "main", positionM: 20, speedMps: 0, stationary: true }],
    });

    advance(run, 120);

    const results = run.results();
    // Room for the stationary car and two queued cars behind it; the rest must wait.
    expect(results.vehiclesOnNetwork).toBeLessThanOrEqual(3);
    expect(results.vehiclesWaitingToEnter).toBeGreaterThan(20);
    expect(results.vehiclesThrough).toBe(0);
    const vehicles = run.snapshot().vehicles.sort((a, b) => b.positionM - a.positionM);
    for (let i = 1; i < vehicles.length; i++) {
      expect(vehicles[i - 1]!.positionM - vehicles[i - 1]!.lengthM - vehicles[i]!.positionM).toBeGreaterThanOrEqual(0);
    }
  });
});
