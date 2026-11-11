import { describe, expect, it } from "vitest";
import { createRun, type Network, type Results, type RunInput, type Snapshot, type VehicleState } from "../src/index";
import { checkRunConsistency, createConsistencyChecker } from "../src/consistency-checks";

const network: Network = {
  formatVersion: 1,
  roads: [
    {
      id: "main",
      points: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
      ],
      widthM: 3.5,
      speedLimitMps: 13.9,
    },
  ],
};

function car(id: number, positionM: number, overrides: Partial<VehicleState> = {}): VehicleState {
  return {
    id,
    vehicleClass: "car",
    roadId: "main",
    positionM,
    lateralM: 1.75,
    speedMps: 10,
    lengthM: 4.4,
    widthM: 1.9,
    ...overrides,
  };
}

function frame(timeS: number, vehicles: VehicleState[], through = 0): [Snapshot, Results] {
  return [
    { timeS, vehicles },
    {
      timeS,
      vehiclesEntered: vehicles.length + through,
      vehiclesThrough: through,
      vehiclesOnNetwork: vehicles.length,
      vehiclesWaitingToEnter: 0,
    },
  ];
}

function checksFailedBy(...frames: [Snapshot, Results][]): string[] {
  const checker = createConsistencyChecker(network);
  for (const [snapshot, results] of frames) checker.observe(snapshot, results);
  return [...new Set(checker.violations.map((violation) => violation.check))];
}

describe("consistency checks on hand-made frames", () => {
  it("accept vehicles that keep apart, move forward and leave by being counted through", () => {
    expect(
      checksFailedBy(
        frame(0, [car(1, 399), car(2, 100)]),
        frame(0.2, [car(2, 102), car(3, 4.4)], 1),
      ),
    ).toEqual([]);
  });

  it("report two vehicles that overlap", () => {
    expect(checksFailedBy(frame(0, [car(1, 100), car(2, 97)]))).toEqual(["no-overlap"]);
  });

  it("accept two vehicles side by side on a wide enough road", () => {
    const wide: Network = { formatVersion: 1, roads: [{ ...network.roads[0]!, widthM: 7 }] };
    const checker = createConsistencyChecker(wide);
    checker.observe(...frame(0, [car(1, 100, { lateralM: 1.5 }), car(2, 100, { lateralM: 5 })]));
    expect(checker.violations).toEqual([]);
  });

  it("report a negative speed", () => {
    expect(checksFailedBy(frame(0, [car(1, 100, { speedMps: -0.1 })]))).toEqual(["no-negative-speed"]);
  });

  it("report a vehicle beyond either end of its road, off its side, or on an unknown road", () => {
    expect(checksFailedBy(frame(0, [car(1, 401)]))).toEqual(["inside-road"]);
    expect(checksFailedBy(frame(0, [car(1, 3)]))).toEqual(["inside-road"]);
    expect(checksFailedBy(frame(0, [car(1, 100, { lateralM: 0.5 })]))).toEqual(["inside-road"]);
    expect(checksFailedBy(frame(0, [car(1, 100, { roadId: "elsewhere" })]))).toEqual(["inside-road"]);
  });

  it("report a vehicle that vanishes without being counted through", () => {
    expect(checksFailedBy(frame(0, [car(1, 300), car(2, 100)]), frame(0.2, [car(1, 302)]))).toEqual([
      "no-vehicle-lost",
    ]);
  });

  it("report counts that do not add up: entered must equal through plus on the network", () => {
    const [snapshot, results] = frame(0, [car(1, 100)]);
    expect(checksFailedBy([snapshot, { ...results, vehiclesEntered: 5 }])).toEqual(["no-vehicle-lost"]);
  });
});

describe("consistency checks on a run", () => {
  const scenario: RunInput = {
    network,
    demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 1200 }] },
    seed: 42,
    initialVehicles: [{ roadId: "main", positionM: 200, speedMps: 2 }],
  };

  it("pass on cars entering, following and leaving one road", () => {
    const report = checkRunConsistency(scenario, { durationS: 900 });

    expect(report.violations).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(200);
  });

  it("pass on a road blocked by a stationary car, where a queue forms", () => {
    const blocked: RunInput = {
      ...scenario,
      initialVehicles: [{ roadId: "main", positionM: 350, speedMps: 0, stationary: true }],
    };

    const report = checkRunConsistency(blocked, { durationS: 600 });

    expect(report.violations).toEqual([]);
    expect(report.results.vehiclesThrough).toBe(0);
    expect(report.results.vehiclesWaitingToEnter).toBeGreaterThan(0);
  });

  it("report a run that does not repeat for the same seed", () => {
    let runsStarted = 0;
    const drifting = (input: RunInput) => createRun({ ...input, seed: input.seed + runsStarted++ });

    const report = checkRunConsistency(scenario, { durationS: 300, createRun: drifting });

    expect(report.violations.map((violation) => violation.check)).toEqual(["repeatable"]);
  });
});
