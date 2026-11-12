import { describe, expect, it } from "vitest";
import flyover from "../examples/flyover.json";
import { checkRunConsistency } from "../src/consistency-checks";
import { createRun, resultsExcludingWarmUp, VEHICLE_CLASSES, type Results, type RunInput, type VehicleState } from "../src/index";
import { flyoverDemand, flyoverNetwork } from "./flyover-network";

const example = flyover as RunInput;

/**
 * Run to the end and count the vehicles that stood still (under 0.1 m/s) for
 * 300 s or more without a break: the sign of a merge that starves one stream.
 */
function runCountingStanding(
  input: RunInput,
  durationS: number,
  eachSecond?: (vehicles: VehicleState[], timeS: number) => void,
): { results: Results; stood300s: number; throughInLastFifth: number } {
  const run = createRun(input);
  const standingSince = new Map<number, number>();
  const stood = new Set<number>();
  let throughBeforeLastFifth = 0;
  while (run.timeS < durationS - 1e-9) {
    run.step();
    if (Math.abs(run.timeS - durationS * 0.8) < 0.1) throughBeforeLastFifth = run.results().vehiclesThrough;
    // Looked at once a second; standing is counted from the first look at which the vehicle stood.
    if (Math.round(run.timeS * 5) % 5 !== 0) continue;
    const seen = new Set<number>();
    const vehicles = run.snapshot().vehicles;
    if (eachSecond) eachSecond(vehicles, run.timeS);
    for (const vehicle of vehicles) {
      seen.add(vehicle.id);
      if (vehicle.speedMps >= 0.1) standingSince.delete(vehicle.id);
      else if (!standingSince.has(vehicle.id)) standingSince.set(vehicle.id, run.timeS);
      else if (run.timeS - standingSince.get(vehicle.id)! >= 300) stood.add(vehicle.id);
    }
    for (const id of standingSince.keys()) if (!seen.has(id)) standingSince.delete(id);
  }
  const results = run.results();
  return { results, stood300s: stood.size, throughInLastFifth: results.vehiclesThrough - throughBeforeLastFifth };
}

describe("consistency checks on the flyover example (the flyover test scenario)", () => {
  it("pass for a simulated hour of mixed traffic, with traffic getting through in every direction", { timeout: 240_000 }, () => {
    const report = checkRunConsistency(example, { durationS: 3600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    // 4900 vehicles an hour arrive.
    expect(report.results.vehiclesThrough).toBeGreaterThan(4500);
    expect(report.results.vehiclesWaitingToEnter).toBeLessThan(30);
  });

  it("pass for half a simulated hour with lane discipline on", { timeout: 240_000 }, () => {
    const report = checkRunConsistency({ ...example, laneDiscipline: true }, { durationS: 1800 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(1500);
  });
});

describe("results on a network with a flyover", () => {
  it("give the longest queue for every approach, delay for every vehicle class, and leave out the warm-up", { timeout: 60_000 }, () => {
    const run = createRun(example);
    while (run.timeS < 600 - 1e-9) run.step();
    const atWarmUpEnd = run.results();
    while (run.timeS < 1500 - 1e-9) run.step();
    const results = run.results();

    // An approach is a road arriving at a junction, with or without a signal.
    expect(Object.keys(results.longestQueueByApproach).sort()).toEqual(
      ["east-in", "flyover-north", "flyover-south", "north-entry", "north-in", "north-out", "south-entry", "south-in", "south-out", "west-in"].sort(),
    );
    // Queues form at the signal, not on the flyover.
    for (const approach of ["south-in", "north-in", "west-in", "east-in"]) {
      expect(results.longestQueueByApproach[approach]!.lengthM).toBeGreaterThan(10);
    }
    expect(results.longestQueueByApproach["flyover-north"]!.lengthM).toBe(0);
    expect(results.longestQueueByApproach["flyover-south"]!.lengthM).toBe(0);

    for (const vehicleClass of VEHICLE_CLASSES) {
      const delay = results.delayByVehicleClass[vehicleClass];
      expect(delay.vehicles).toBeGreaterThan(20);
      expect(delay.meanDelayS).toBeGreaterThan(0);
      expect(delay.meanDelayS).toBeLessThan(120);
    }

    const measured = resultsExcludingWarmUp(atWarmUpEnd, results);
    expect(measured.timeS).toBeCloseTo(900, 6);
    expect(measured.vehiclesThrough).toBe(results.vehiclesThrough - atWarmUpEnd.vehiclesThrough);
    expect(measured.longestQueueByApproach["south-in"]!.eachMinute).toHaveLength(15);
    expect(measured.longestQueueByApproach["south-in"]!.lengthM).toBeGreaterThan(10);
  });
});

describe("the merge and the diverge at the ends of a flyover, loaded beyond what the road can carry", () => {
  // Through traffic far above what the entry road lets in, with turning and cross traffic at the junction beneath.
  const saturated = (seed: number, laneDiscipline: boolean): RunInput => ({
    network: flyoverNetwork(),
    demand: flyoverDemand(9000, 600, 800),
    seed,
    laneDiscipline,
  });

  it.each([41, 42])("pass the consistency checks in mixed traffic (seed %i)", { timeout: 120_000 }, (seed) => {
    const report = checkRunConsistency(saturated(seed, false), { durationS: 600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(900);
  });

  it.each([44, 45])("pass the consistency checks with lane discipline on (seed %i)", { timeout: 120_000 }, (seed) => {
    const report = checkRunConsistency(saturated(seed, true), { durationS: 600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(400);
  });

  it.each([false, true])("do not lock in a simulated hour, and leave no vehicle standing for 300 s (lane discipline %s)", { timeout: 240_000 }, (laneDiscipline) => {
    const { results, stood300s, throughInLastFifth } = runCountingStanding(saturated(47, laneDiscipline), 3600);
    expect(stood300s).toBe(0);
    // Still discharging at the end: the last 12 minutes carry their share of the hour.
    expect(throughInLastFifth).toBeGreaterThan(results.vehiclesThrough * 0.15);
  });
});

describe("a merge where the flyover and the road beneath join onto the same lanes", () => {
  // The exit road is only as wide as one of the two roads, so both lead onto the same strips.
  const narrowExit = (seed: number, laneDiscipline: boolean, mainGreenS = 25): RunInput => ({
    network: flyoverNetwork({ exitWidthM: 7, mainGreenS }),
    demand: flyoverDemand(4000, 0, 400),
    seed,
    laneDiscipline,
  });

  it.each([
    [51, false],

    [53, true],

  ])("passes the consistency checks when saturated (seed %i, lane discipline %s)", { timeout: 120_000 }, (seed, laneDiscipline) => {
    const report = checkRunConsistency(narrowExit(seed, laneDiscipline), { durationS: 600 });
    expect(report.violations.slice(0, 5)).toEqual([]);
    expect(report.results.vehiclesThrough).toBeGreaterThan(300);
  });

  it.each([false, true])("starves neither road in a simulated hour: both keep discharging and no vehicle stands for 300 s (lane discipline %s)", { timeout: 240_000 }, (laneDiscipline) => {
    const fromFlyover = new Set<number>();
    const fromBeneath = new Set<number>();
    const late = { flyover: 0, beneath: 0 };
    const { stood300s } = runCountingStanding(narrowExit(55, laneDiscipline), 3600, (vehicles, timeS) => {
      for (const vehicle of vehicles) {
        if (vehicle.turn?.junctionId !== "merge") continue;
        const from = vehicle.turn.fromRoadId === "flyover" ? fromFlyover : fromBeneath;
        if (!from.has(vehicle.id) && timeS > 3000) late[from === fromFlyover ? "flyover" : "beneath"]++;
        from.add(vehicle.id);
      }
    });
    // Each road gets a real share of the merge, to the end of the hour.
    expect(fromFlyover.size).toBeGreaterThan(400);
    expect(fromBeneath.size).toBeGreaterThan(400);
    expect(late.flyover).toBeGreaterThan(50);
    expect(late.beneath).toBeGreaterThan(50);
    expect(stood300s).toBe(0);
  });

  // One stream arrives steadily off the flyover; the other is let go by the signal beneath in short bursts,
  // joined by traffic turning in from the cross road, and has to find its place at the merge.
  it.each([false, true])("lets a stream arriving in bursts in beside a steady one for a simulated hour (lane discipline %s)", { timeout: 240_000 }, (laneDiscipline) => {
    const input: RunInput = {
      network: flyoverNetwork({ exitWidthM: 7, mainGreenS: 15, crossGreenS: 30 }),
      demand: {
        flows: [
          { entryRoadId: "south-entry", exitRoadId: "north-exit", vehiclesPerHour: 2400 },
          { entryRoadId: "west-in", exitRoadId: "north-exit", vehiclesPerHour: 300 },
          { entryRoadId: "east-in", exitRoadId: "north-exit", vehiclesPerHour: 300 },
        ],
        vehicleMix: flyoverDemand(1).vehicleMix,
      },
      seed: 61,
      laneDiscipline,
    };
    const late = { flyover: new Set<number>(), beneath: new Set<number>() };
    const { stood300s, results } = runCountingStanding(input, 3600, (vehicles, timeS) => {
      for (const vehicle of vehicles) {
        if (vehicle.turn?.junctionId === "merge" && timeS > 3000) late[vehicle.turn.fromRoadId === "flyover" ? "flyover" : "beneath"].add(vehicle.id);
      }
    });
    expect(stood300s).toBe(0);
    expect(late.flyover.size).toBeGreaterThan(120);
    expect(late.beneath.size).toBeGreaterThan(120);
    expect(results.vehiclesThrough).toBeGreaterThan(2200);
  });
});
