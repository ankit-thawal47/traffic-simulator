import { describe, expect, it } from "vitest";
import { BENGALURU_VEHICLE_MIX, createRun, signalState, type Run, type SignalPlan, type VehicleState } from "../src/index";
import { alwaysGreenFor, fourWay, oneApproachAtATime } from "./four-way";

const noDemand = { flows: [] };
/** Length of each approach in fourWay(): the stop line is this far along it. */
const STOP_LINE_M = 200;

function advance(run: Run, seconds: number): void {
  const target = run.timeS + seconds;
  while (run.timeS < target - 1e-9) run.step();
}

/** Whether a vehicle's front bumper is past the stop line of the approach it came by. */
function pastStopLine(vehicle: VehicleState): boolean {
  return vehicle.turn !== undefined || vehicle.roadId.endsWith("-out");
}

/** Step a run and collect, for every vehicle, the roads it was seen on, in order. */
function roadsSeen(run: Run, seconds: number): Map<number, string[]> {
  const seen = new Map<number, string[]>();
  const target = run.timeS + seconds;
  const look = () => {
    for (const vehicle of run.snapshot().vehicles) {
      const roads = seen.get(vehicle.id) ?? [];
      if (roads[roads.length - 1] !== vehicle.roadId) roads.push(vehicle.roadId);
      seen.set(vehicle.id, roads);
    }
  };
  look();
  while (run.timeS < target - 1e-9) {
    run.step();
    look();
  }
  return seen;
}

describe("a network with a signal junction", () => {
  it("a vehicle crosses the junction on green from its entry road to its exit road and leaves the network", () => {
    const run = createRun({
      network: fourWay({ signalPlan: alwaysGreenFor("south-in") }),
      demand: noDemand,
      seed: 1,
      initialVehicles: [{ roadId: "south-in", positionM: 150, speedMps: 10, exitRoadId: "north-out" }],
    });

    const seen = roadsSeen(run, 60);

    expect(seen.get(1)).toEqual(["south-in", "north-out"]);
    expect(run.results().vehiclesThrough).toBe(1);
    expect(run.results().vehiclesOnNetwork).toBe(0);
  });

  it("demand finds its route across the junction", () => {
    const run = createRun({
      network: fourWay({ signalPlan: alwaysGreenFor("west-in") }),
      demand: { flows: [{ entryRoadId: "west-in", exitRoadId: "south-out", vehiclesPerHour: 600 }] },
      seed: 3,
    });

    const seen = roadsSeen(run, 120);

    expect(run.results().vehiclesThrough).toBeGreaterThan(5);
    for (const roads of seen.values()) expect(["west-in", "west-in,south-out"]).toContain(roads.join(","));
  });

  it("refuses demand between two roads the junction does not connect", () => {
    const network = fourWay();
    const flows = (entryRoadId: string, exitRoadId: string) => ({ flows: [{ entryRoadId, exitRoadId, vehiclesPerHour: 100 }] });

    // No U-turn is connected, and nothing leads from one exit road to another.
    expect(() => createRun({ network, demand: flows("south-in", "south-out"), seed: 1 })).toThrow(
      'There is no route from road "south-in" to road "south-out"',
    );
    expect(() => createRun({ network, demand: flows("north-out", "east-out"), seed: 1 })).toThrow(/no route/);
  });

  it("refuses junctions in a network of an older format version", () => {
    const network = { ...fourWay(), formatVersion: 2 as const };
    expect(() => createRun({ network, demand: noDemand, seed: 1 })).toThrow(/format version 3/);
  });
});

describe("a fixed-time signal plan", () => {
  // Green for north 0 to 20 s, east 25 to 45 s, south 50 to 70 s, west 75 to 95 s; 3 s amber and 2 s all red after each.
  const plan = oneApproachAtATime(20, 3, 2);

  it("gives each approach green, then amber, then red, and repeats", () => {
    const at = (roadId: string, timeS: number) => signalState(plan, roadId, timeS);
    expect(at("north-in", 0)).toBe("green");
    expect(at("north-in", 19.8)).toBe("green");
    expect(at("north-in", 20)).toBe("amber");
    expect(at("north-in", 22.8)).toBe("amber");
    expect(at("north-in", 23)).toBe("red");
    expect(at("south-in", 49.8)).toBe("red");
    expect(at("south-in", 50)).toBe("green");
    expect(at("south-in", 70)).toBe("amber");
    expect(at("south-in", 73)).toBe("red");
    // The cycle is 100 s.
    expect(at("north-in", 100)).toBe("green");
    expect(at("south-in", 160)).toBe("green");
    expect(at("west-in", 24)).toBe("red");
    // An offset starts the run part-way through the cycle.
    expect(signalState({ ...plan, offsetS: 50 }, "south-in", 0)).toBe("green");
  });

  it("a vehicle stops at a red signal and moves off on green", () => {
    const run = createRun({
      network: fourWay({ signalPlan: plan }),
      demand: noDemand,
      seed: 1,
      initialVehicles: [{ roadId: "south-in", positionM: 100, speedMps: 10, exitRoadId: "north-out" }],
    });

    while (run.timeS < 50 - 1e-9) {
      run.step();
      const vehicle = run.snapshot().vehicles[0]!;
      expect(vehicle.roadId).toBe("south-in");
      expect(vehicle.positionM).toBeLessThanOrEqual(STOP_LINE_M);
    }
    // Stopped just short of the stop line, at its standstill gap.
    const waiting = run.snapshot().vehicles[0]!;
    expect(waiting.speedMps).toBeLessThan(0.05);
    expect(waiting.positionM).toBeGreaterThan(STOP_LINE_M - 3);

    advance(run, 10);
    const moving = run.snapshot().vehicles[0]!;
    expect(pastStopLine(moving)).toBe(true);
    expect(moving.speedMps).toBeGreaterThan(3);
  });

  it("a vehicle waiting at a red signal stays where it is across the road", () => {
    const run = createRun({
      network: fourWay({ signalPlan: plan }),
      demand: noDemand,
      seed: 1,
      initialVehicles: [{ roadId: "south-in", positionM: 150, speedMps: 10, exitRoadId: "north-out", lateralM: 2 }],
    });
    const lateralM = run.snapshot().vehicles[0]!.lateralM;
    while (run.timeS < 50 - 1e-9) {
      run.step();
      expect(run.snapshot().vehicles[0]!.lateralM).toBe(lateralM);
    }
  });

  it("a red signal holds mixed traffic across the whole width of the approach, and the queue discharges on green", () => {
    const run = createRun({
      network: fourWay({ signalPlan: plan }),
      demand: {
        flows: [{ entryRoadId: "south-in", exitRoadId: "north-out", vehiclesPerHour: 1800 }],
        vehicleMix: BENGALURU_VEHICLE_MIX,
      },
      seed: 11,
    });

    while (run.timeS < 50 - 1e-9) {
      run.step();
      for (const vehicle of run.snapshot().vehicles) expect(pastStopLine(vehicle)).toBe(false);
    }
    const atTheLine = run.snapshot().vehicles.filter((vehicle) => vehicle.positionM > STOP_LINE_M - 4);
    expect(atTheLine.length).toBeGreaterThanOrEqual(3);
    for (const vehicle of atTheLine) expect(vehicle.speedMps).toBeLessThan(0.3);
    // The front of the queue fills most of the 7 m width.
    const leftM = Math.min(...atTheLine.map((vehicle) => vehicle.lateralM - vehicle.widthM / 2));
    const rightM = Math.max(...atTheLine.map((vehicle) => vehicle.lateralM + vehicle.widthM / 2));
    expect(rightM - leftM).toBeGreaterThan(4.5);

    const queued = run
      .snapshot()
      .vehicles.filter((vehicle) => vehicle.speedMps < 0.5)
      .map((vehicle) => vehicle.id);
    expect(queued.length).toBeGreaterThan(15);
    const crossed = new Set<number>();
    while (run.timeS < 75 - 1e-9) {
      run.step();
      for (const vehicle of run.snapshot().vehicles) if (pastStopLine(vehicle)) crossed.add(vehicle.id);
    }
    // 20 s of green lets every vehicle that was standing in the queue go.
    for (const id of queued) expect(crossed.has(id)).toBe(true);
  });

  it("no vehicle crosses the stop line while its signal is red", () => {
    const run = createRun({
      network: fourWay({ signalPlan: plan }),
      demand: {
        flows: [
          { entryRoadId: "south-in", exitRoadId: "north-out", vehiclesPerHour: 1500 },
          { entryRoadId: "east-in", exitRoadId: "west-out", vehiclesPerHour: 1500 },
        ],
        vehicleMix: BENGALURU_VEHICLE_MIX,
      },
      seed: 4,
    });
    const approachOf = new Map<number, string>();
    const crossed = new Set<number>();
    let crossings = 0;
    while (run.timeS < 400 - 1e-9) {
      const before = run.timeS;
      run.step();
      for (const vehicle of run.snapshot().vehicles) {
        if (!pastStopLine(vehicle)) {
          approachOf.set(vehicle.id, vehicle.roadId);
        } else if (!crossed.has(vehicle.id)) {
          crossed.add(vehicle.id);
          crossings++;
          expect(signalState(plan, approachOf.get(vehicle.id)!, before)).not.toBe("red");
        }
      }
    }
    expect(crossings).toBeGreaterThan(100);
  });

  it("refuses a signal plan that cannot work", () => {
    const withPlan = (signalPlan: SignalPlan) => () => createRun({ network: fourWay({ signalPlan }), demand: noDemand, seed: 1 });

    expect(withPlan({ phases: [], amberS: 3, allRedS: 2 })).toThrow(/signal plan/i);
    expect(withPlan({ ...plan, phases: plan.phases.slice(0, 3) })).toThrow('Approach "west-in" of junction "cross" never has green');
    expect(withPlan({ ...plan, phases: [...plan.phases, { greenRoadIds: ["north-out"], greenS: 10 }] })).toThrow(
      /"north-out"/,
    );
    expect(withPlan({ ...plan, phases: plan.phases.map((phase) => ({ ...phase, greenS: 0 })) })).toThrow(/green/i);
    expect(withPlan({ ...plan, amberS: -1 })).toThrow(/amber/i);
  });
});
