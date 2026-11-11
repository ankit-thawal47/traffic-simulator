import { describe, expect, it } from "vitest";
import {
  BENGALURU_VEHICLE_MIX,
  createNetworkLayout,
  createRun,
  resultsExcludingWarmUp,
  signalState,
  STEP_SECONDS,
  vehiclePose,
  type InitialVehicle,
  type Run,
  type SignalPlan,
  type VehicleState,
} from "../src/index";
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

  it("vehicles cross the stop line on green or amber; a few stragglers cross in the all-red time just after, none later", () => {
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
    let onRed = 0;
    while (run.timeS < 1000 - 1e-9) {
      const before = run.timeS;
      run.step();
      for (const vehicle of run.snapshot().vehicles) {
        if (!pastStopLine(vehicle)) {
          approachOf.set(vehicle.id, vehicle.roadId);
        } else if (!crossed.has(vehicle.id)) {
          crossed.add(vehicle.id);
          crossings++;
          const approach = approachOf.get(vehicle.id)!;
          if (signalState(plan, approach, before) !== "red") continue;
          // A vehicle is let in only on green, and only if it can reach the stop line before the
          // amber ends. One that is then slowed by the vehicle ahead can be a moment late.
          onRed++;
          expect(signalState(plan, approach, before - plan.allRedS)).toBe("amber");
        }
      }
    }
    expect(crossings).toBeGreaterThan(300);
    expect(onRed / crossings).toBeLessThan(0.02);
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

describe("the longest queue per approach", () => {
  // South has red until 50 s, then green for 20 s.
  const plan = oneApproachAtATime(20, 3, 2);
  const singleLane = { widthM: 3.5, lanes: 1 };
  const network = fourWay({ signalPlan: plan, roads: { "south-in": singleLane, "north-out": singleLane } });

  it("is reported for every approach, and is nothing where no vehicle has queued", () => {
    const run = createRun({ network, demand: noDemand, seed: 1 });
    advance(run, 10);
    const none = { lengthM: 0, vehicles: 0, eachMinute: [{ lengthM: 0, vehicles: 0 }] };
    expect(run.results().longestQueueByApproach).toEqual({
      "south-in": none,
      "north-in": none,
      "west-in": none,
      "east-in": none,
    });
  });

  it("is kept for each minute of the run, so that a warm-up can be left out", () => {
    const run = createRun({
      network,
      demand: noDemand,
      seed: 1,
      laneDiscipline: true,
      // Five cars queue at the red signal in the first minute, and leave on the green that starts at 50 s.
      initialVehicles: [160, 140, 120, 100, 80].map((positionM) => ({
        roadId: "south-in",
        positionM,
        speedMps: 8,
        exitRoadId: "north-out",
      })),
    });
    advance(run, 120);
    const atEndOfWarmUp = run.results();
    advance(run, 120);
    const atEnd = run.results();

    const whole = atEnd.longestQueueByApproach["south-in"]!;
    expect(whole.vehicles).toBe(5);
    expect(whole.eachMinute.map((minute) => minute.vehicles)).toEqual([5, 0, 0, 0]);
    expect(whole.eachMinute[0]).toEqual({ lengthM: whole.lengthM, vehicles: 5 });

    // With the first two minutes left out, no queue was seen.
    const measured = resultsExcludingWarmUp(atEndOfWarmUp, atEnd);
    expect(measured.longestQueueByApproach["south-in"]).toEqual({
      lengthM: 0,
      vehicles: 0,
      eachMinute: [
        { lengthM: 0, vehicles: 0 },
        { lengthM: 0, vehicles: 0 },
      ],
    });
    // With nothing left out, it is the queue of the first minute.
    const all = resultsExcludingWarmUp(createRun({ network, demand: noDemand, seed: 1 }).results(), atEnd);
    expect(all.longestQueueByApproach["south-in"]).toEqual(whole);
  });

  it("is measured from the stop line to the back of the last queued vehicle", () => {
    const run = createRun({
      network,
      demand: noDemand,
      seed: 1,
      laneDiscipline: true,
      // Five cars in one lane, arriving at a red signal.
      initialVehicles: [160, 140, 120, 100, 80].map((positionM) => ({
        roadId: "south-in",
        positionM,
        speedMps: 8,
        exitRoadId: "north-out",
      })),
    });
    advance(run, 49);

    // Each car is 4.4 m long and stands about 2 m behind the car, or the stop line, ahead of it: 5 x 6.4 m = 32 m.
    const queue = run.results().longestQueueByApproach["south-in"]!;
    expect(queue.vehicles).toBe(5);
    expect(queue.lengthM).toBeGreaterThan(31);
    expect(queue.lengthM).toBeLessThan(33);
    expect(run.results().longestQueueByApproach["north-in"]).toMatchObject({ lengthM: 0, vehicles: 0 });

    // It is the longest over the run so far: it stays after the queue has gone.
    advance(run, 40);
    expect(run.snapshot().vehicles.filter((vehicle) => vehicle.roadId === "south-in")).toEqual([]);
    expect(run.results().longestQueueByApproach["south-in"]).toMatchObject({ lengthM: queue.lengthM, vehicles: 5 });
  });

  it("does not count vehicles that drive through on green without queuing", () => {
    const run = createRun({
      network: fourWay({ signalPlan: alwaysGreenFor("south-in") }),
      demand: { flows: [{ entryRoadId: "south-in", exitRoadId: "north-out", vehiclesPerHour: 600 }] },
      seed: 2,
    });
    advance(run, 120);
    expect(run.results().vehiclesThrough).toBeGreaterThan(5);
    expect(run.results().longestQueueByApproach["south-in"]).toMatchObject({ lengthM: 0, vehicles: 0 });
  });

  it("is empty for a network with no junction", () => {
    const run = createRun({
      network: { formatVersion: 2, roads: [{ ...network.roads[0]!, id: "main" }] },
      demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 600 }] },
      seed: 2,
    });
    advance(run, 30);
    expect(run.results().longestQueueByApproach).toEqual({});
  });
});

describe("keeping the junction clear", () => {
  // Three stationary vehicles side by side fill the 7 m road out of the junction, their rear bumpers 7.6 m and 9.1 m along it.
  const blockers: InitialVehicle[] = [
    { roadId: "north-out", positionM: 12, speedMps: 0, stationary: true, vehicleClass: "car", lateralM: 1.25 },
    { roadId: "north-out", positionM: 12, speedMps: 0, stationary: true, vehicleClass: "car", lateralM: 3.75 },
    { roadId: "north-out", positionM: 12, speedMps: 0, stationary: true, vehicleClass: "auto-rickshaw", lateralM: 6 },
  ];
  const demand = {
    flows: [{ entryRoadId: "south-in", exitRoadId: "north-out", vehiclesPerHour: 1500 }],
    vehicleMix: BENGALURU_VEHICLE_MIX,
  };

  it("a vehicle does not enter the junction when the road beyond has no room for it, even on green", () => {
    const run = createRun({
      network: fourWay({ signalPlan: alwaysGreenFor("south-in") }),
      demand,
      seed: 6,
      initialVehicles: blockers,
    });

    let longestStopInJunctionS = 0;
    const stoppedFor = new Map<number, number>();
    while (run.timeS < 180 - 1e-9) {
      run.step();
      for (const vehicle of run.snapshot().vehicles) {
        if (vehicle.turn && vehicle.speedMps < 0.1) {
          const stoppedS = (stoppedFor.get(vehicle.id) ?? 0) + STEP_SECONDS;
          stoppedFor.set(vehicle.id, stoppedS);
          longestStopInJunctionS = Math.max(longestStopInJunctionS, stoppedS);
        } else {
          stoppedFor.delete(vehicle.id);
        }
      }
    }

    const vehicles = run.snapshot().vehicles;
    // Nobody is left standing in the junction.
    expect(vehicles.filter((vehicle) => vehicle.turn)).toEqual([]);
    expect(longestStopInJunctionS).toBeLessThan(2);
    // A few vehicles fitted into the 7.6 m behind the stationary ones; they stand wholly on the road beyond.
    const beyond = vehicles.filter((vehicle) => vehicle.roadId === "north-out" && vehicle.positionM < 12);
    expect(beyond.length).toBeGreaterThanOrEqual(1);
    for (const vehicle of beyond) expect(vehicle.positionM - vehicle.lengthM).toBeGreaterThanOrEqual(0);
    // Everyone else waits at the stop line, on green.
    const waiting = vehicles.filter((vehicle) => vehicle.roadId === "south-in");
    expect(waiting.length).toBeGreaterThan(20);
    expect(waiting.filter((vehicle) => vehicle.positionM > STOP_LINE_M - 4).length).toBeGreaterThanOrEqual(2);
    expect(run.results().vehiclesThrough).toBe(0);
  });

  it("vehicles still go where the road beyond has room in their own strips", () => {
    const run = createRun({
      network: fourWay({ signalPlan: alwaysGreenFor("south-in") }),
      demand,
      seed: 6,
      // Only the left 2.5 m of the road beyond is blocked.
      initialVehicles: blockers.slice(0, 1),
    });
    advance(run, 180);
    expect(run.results().vehiclesThrough).toBeGreaterThan(20);
    expect(run.snapshot().vehicles.filter((vehicle) => vehicle.turn && vehicle.speedMps < 0.1)).toEqual([]);
  });
});

describe("turning at a junction in left-hand traffic", () => {
  /** Follow one vehicle from south-in until it has left the junction; returns where its middle was at each step. */
  function drive(exitRoadId: string, lateralM = 3.5) {
    const network = fourWay({ signalPlan: alwaysGreenFor("south-in") });
    const layout = createNetworkLayout(network);
    const run = createRun({
      network,
      demand: noDemand,
      seed: 1,
      initialVehicles: [{ roadId: "south-in", positionM: 120, speedMps: 13, exitRoadId, lateralM }],
    });
    const track: { x: number; y: number; speedMps: number; inJunction: boolean; roadId: string }[] = [];
    for (;;) {
      const vehicle = run.snapshot().vehicles[0];
      if (!vehicle) break;
      const pose = vehiclePose(layout, vehicle)!;
      // The pose faces along a unit vector.
      expect(Math.hypot(pose.direction.x, pose.direction.y)).toBeCloseTo(1, 6);
      track.push({ ...pose.centre, speedMps: vehicle.speedMps, inJunction: vehicle.turn !== undefined, roadId: vehicle.roadId });
      if (vehicle.roadId !== "south-in" && !vehicle.turn && vehicle.positionM > 30) break;
      run.step();
    }
    return track;
  }

  it("a vehicle turning left keeps to the near side, and ends on the road to its left", () => {
    const track = drive("west-out");
    expect(track[track.length - 1]!.roadId).toBe("west-out");
    const inJunction = track.filter((at) => at.inJunction);
    expect(inJunction.length).toBeGreaterThan(5);
    // Coming from the south on the west half of the arm, a left turn stays in the south-west quarter.
    for (const at of inJunction) {
      expect(at.x).toBeLessThan(0);
      expect(at.y).toBeLessThan(0);
    }
    // It ends heading west on the south half of the western arm.
    const last = track[track.length - 1]!;
    expect(last.x).toBeLessThan(-15);
    expect(last.y).toBeGreaterThan(-7);
    expect(last.y).toBeLessThan(0);
  });

  it("a vehicle turning right crosses the junction to the far side, and ends on the road to its right", () => {
    const track = drive("east-out");
    const last = track[track.length - 1]!;
    expect(last.roadId).toBe("east-out");
    expect(last.x).toBeGreaterThan(15);
    expect(last.y).toBeGreaterThan(0);
    expect(last.y).toBeLessThan(7);
    // The right turn is the long way round: further through the junction than the left turn.
    const stepsInJunction = (exitRoadId: string) => drive(exitRoadId).filter((at) => at.inJunction).length;
    expect(stepsInJunction("east-out")).toBeGreaterThan(stepsInJunction("west-out"));
  });

  it("a vehicle going straight on stays in line", () => {
    const track = drive("north-out", 2.25);
    expect(track[track.length - 1]!.roadId).toBe("north-out");
    // 2.25 m from the left edge of a road whose left edge is at x = -7.
    for (const at of track) expect(at.x).toBeCloseTo(-4.75, 6);
  });

  it("moves smoothly from the approach through the turn onto the next road", () => {
    for (const exitRoadId of ["west-out", "north-out", "east-out"]) {
      const track = drive(exitRoadId);
      for (let i = 1; i < track.length; i++) {
        const moved = Math.hypot(track[i]!.x - track[i - 1]!.x, track[i]!.y - track[i - 1]!.y);
        const expected = ((track[i]!.speedMps + track[i - 1]!.speedMps) / 2) * STEP_SECONDS;
        // The middle of a vehicle cuts the corner a little, so it moves no further than its front bumper does.
        expect(moved).toBeLessThan(expected + 0.05);
        expect(moved).toBeGreaterThan(expected * 0.8 - 0.05);
      }
    }
  });

  it("slows for a turn, more for the tight left turn than the wide right turn, and not when going straight on", () => {
    const fastestInJunction = (exitRoadId: string) =>
      Math.max(...drive(exitRoadId).filter((at) => at.inJunction).map((at) => at.speedMps));
    const left = fastestInJunction("west-out");
    const right = fastestInJunction("east-out");
    const straight = fastestInJunction("north-out");
    expect(left).toBeLessThan(6.5);
    expect(left).toBeGreaterThan(3);
    expect(right).toBeGreaterThan(left);
    expect(right).toBeLessThan(9);
    expect(straight).toBeGreaterThan(12.5);

    // It slows down for the turn gently: never harder than 2 m/s2.
    const track = drive("west-out");
    for (let i = 1; i < track.length; i++) {
      expect(track[i - 1]!.speedMps - track[i]!.speedMps).toBeLessThan(2 * STEP_SECONDS);
    }
  });
});
