import { describe, expect, it } from "vitest";
import { checkRunConsistency, createConsistencyChecker } from "../src/consistency-checks";
import {
  BENGALURU_VEHICLE_MIX,
  createRun,
  STEP_SECONDS,
  VEHICLE_CLASS_ASSUMPTIONS,
  type InitialVehicle,
  type Network,
  type RunInput,
  type Run,
  type VehicleClass,
  type VehicleState,
} from "../src/index";

function road(widthM: number, lanes: number, speedLimitMps = 13.9, lengthM = 500): Network {
  return {
    formatVersion: 2,
    roads: [
      {
        id: "main",
        points: [
          { x: 0, y: 0 },
          { x: lengthM, y: 0 },
        ],
        widthM,
        lanes,
        speedLimitMps,
      },
    ],
  };
}

const noDemand = { flows: [] };

function advance(run: Run, seconds: number): void {
  const target = run.timeS + seconds;
  while (run.timeS < target - 1e-9) run.step();
}

function countByClass(vehicles: VehicleState[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const vehicle of vehicles) counts[vehicle.vehicleClass] = (counts[vehicle.vehicleClass] ?? 0) + 1;
  return counts;
}

describe("vehicle classes", () => {
  it("the demand's vehicle mix sets the share of each vehicle class entering", () => {
    const run = createRun({
      network: road(10.5, 3),
      demand: {
        flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 3600 }],
        vehicleMix: { "two-wheeler": 0.6, car: 0.25, "auto-rickshaw": 0.1, bus: 0.05 },
      },
      seed: 5,
    });

    const seen = new Map<number, VehicleState>();
    for (let i = 0; i < 5 * 1800; i++) {
      run.step();
      for (const vehicle of run.snapshot().vehicles) seen.set(vehicle.id, vehicle);
    }

    // About 1800 vehicles in half an hour; each bound is more than four standard deviations wide.
    const counts = countByClass([...seen.values()]);
    const total = seen.size;
    expect(total).toBeGreaterThan(1600);
    expect(counts["two-wheeler"]! / total).toBeGreaterThan(0.54);
    expect(counts["two-wheeler"]! / total).toBeLessThan(0.66);
    expect(counts.car! / total).toBeGreaterThan(0.2);
    expect(counts.car! / total).toBeLessThan(0.3);
    expect(counts["auto-rickshaw"]! / total).toBeGreaterThan(0.065);
    expect(counts["auto-rickshaw"]! / total).toBeLessThan(0.135);
    expect(counts.bus! / total).toBeGreaterThan(0.025);
    expect(counts.bus! / total).toBeLessThan(0.075);
  });

  it("each vehicle class has its own size, about the published Chennai measurements", () => {
    const classes: VehicleClass[] = ["two-wheeler", "car", "auto-rickshaw", "bus"];
    const run = createRun({
      network: road(3.5, 1),
      demand: noDemand,
      seed: 1,
      initialVehicles: classes.map((vehicleClass, i) => ({
        roadId: "main",
        positionM: 400 - 50 * i,
        speedMps: 5,
        vehicleClass,
      })),
    });

    const size = Object.fromEntries(run.snapshot().vehicles.map((v) => [v.vehicleClass, [v.lengthM, v.widthM]]));
    // Spec: about 2.0 x 0.7 (two-wheeler), 4.4 x 1.9 (car), 2.9 x 1.4 (auto-rickshaw), 10 to 12 x 2.1 to 2.9 (bus).
    expect(size["two-wheeler"]).toEqual([2.0, 0.7]);
    expect(size.car).toEqual([4.4, 1.9]);
    expect(size["auto-rickshaw"]).toEqual([2.9, 1.4]);
    expect(size.bus![0]).toBeGreaterThanOrEqual(10);
    expect(size.bus![0]).toBeLessThanOrEqual(12);
    expect(size.bus![1]).toBeGreaterThanOrEqual(2.1);
    expect(size.bus![1]).toBeLessThanOrEqual(2.9);
  });

  it("every value of every vehicle class names its source and says how far it has been checked", () => {
    for (const vehicleClass of ["two-wheeler", "car", "auto-rickshaw", "bus"] as const) {
      const assumptions = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass];
      for (const name of ["lengthM", "widthM", "desiredSpeedMps", "timeGapS", "standstillGapM"] as const) {
        expect(assumptions.evidence[name].source.length).toBeGreaterThan(20);
        expect(["confirmed", "secondary-source", "our-choice", "unconfirmed"]).toContain(assumptions.evidence[name].state);
      }
    }
  });

  it("a demand without a vehicle mix sends cars only", () => {
    const run = createRun({
      network: road(7, 2),
      demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 1800 }] },
      seed: 2,
    });
    advance(run, 60);
    expect(Object.keys(countByClass(run.snapshot().vehicles))).toEqual(["car"]);
  });

  it("refuses a vehicle mix with a negative share, no positive share, or a vehicle class too wide for the entry road", () => {
    const flows = [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 600 }];
    const mixed = (network: Network, vehicleMix: Partial<Record<VehicleClass, number>>) => () =>
      createRun({ network, demand: { flows, vehicleMix }, seed: 1 });
    expect(mixed(road(7, 2), { car: -1 })).toThrow(/vehicle mix/i);
    expect(mixed(road(7, 2), { car: 0 })).toThrow(/vehicle mix/i);
    expect(mixed(road(2, 1), { bus: 1 })).toThrow(/too narrow/i);
  });
});

/** Run for some seconds, applying the per-moment consistency checks and handing each snapshot to `watch`. */
function runChecked(
  input: RunInput,
  seconds: number,
  watch?: (vehicles: Map<number, VehicleState>, timeS: number) => void,
): Run {
  const run = createRun(input);
  const checker = createConsistencyChecker(input.network);
  const look = () => {
    const snapshot = run.snapshot();
    checker.observe(snapshot, run.results());
    watch?.(new Map(snapshot.vehicles.map((vehicle) => [vehicle.id, vehicle])), snapshot.timeS);
  };
  look();
  while (run.timeS < seconds - 1e-9) {
    run.step();
    look();
  }
  expect(checker.violations).toEqual([]);
  return run;
}

function vehicle(run: Run, id: number): VehicleState | undefined {
  return run.snapshot().vehicles.find((candidate) => candidate.id === id);
}

describe("strips", () => {
  // On a 3.5 m road (7 strips) a stationary car at lateral 2.25 m takes strips 2 to 6, leaving strips 0 and 1.
  const stationaryCar: InitialVehicle = { roadId: "main", positionM: 300, speedMps: 0, stationary: true, lateralM: 2.25 };

  it("a vehicle whose strips are clear of the vehicle ahead does not react to it", () => {
    const speeds: number[] = [];
    const run = runChecked(
      {
        network: road(3.5, 1),
        demand: noDemand,
        seed: 1,
        initialVehicles: [
          stationaryCar,
          { roadId: "main", positionM: 50, speedMps: 13.9, vehicleClass: "two-wheeler", lateralM: 0.5 },
        ],
      },
      30,
      (vehicles) => {
        const twoWheeler = vehicles.get(2);
        if (twoWheeler) speeds.push(twoWheeler.speedMps);
      },
    );

    expect(vehicle(run, 2)!.positionM).toBeGreaterThan(400);
    expect(Math.min(...speeds)).toBeGreaterThan(13.8);
    expect(vehicle(run, 2)!.lateralM).toBe(0.5);
  });

  it("a vehicle that overlaps the vehicle ahead by even one strip has it as its leader", () => {
    // An auto-rickshaw takes 4 strips; at lateral 1.0 m they are strips 0 to 3, two of them shared with the car.
    const run = runChecked(
      {
        network: road(3.5, 1),
        demand: noDemand,
        seed: 1,
        initialVehicles: [
          stationaryCar,
          { roadId: "main", positionM: 50, speedMps: 11, vehicleClass: "auto-rickshaw", lateralM: 1.0 },
        ],
      },
      120,
    );

    const autoRickshaw = vehicle(run, 2)!;
    expect(autoRickshaw.speedMps).toBeLessThan(0.05);
    const gapM = 300 - 4.4 - autoRickshaw.positionM;
    expect(gapM).toBeGreaterThan(1);
    expect(gapM).toBeLessThan(2.5);
  });

  it("the leader is the nearest overlapping vehicle, not the next vehicle along the road", () => {
    // The two-wheeler at the left edge is next along the road from the car, but beside its path;
    // the car's leader is the stationary car beyond it.
    const run = runChecked(
      {
        network: road(3.5, 1),
        demand: noDemand,
        seed: 1,
        initialVehicles: [
          stationaryCar,
          { roadId: "main", positionM: 200, speedMps: 0, stationary: true, vehicleClass: "two-wheeler", lateralM: 0.5 },
          { roadId: "main", positionM: 50, speedMps: 13.9, lateralM: 2.25 },
        ],
      },
      120,
    );

    const car = vehicle(run, 3)!;
    expect(car.speedMps).toBeLessThan(0.05);
    expect(car.positionM).toBeGreaterThan(290);
    expect(car.positionM).toBeLessThan(300 - 4.4);
  });
});

describe("sideways movement", () => {
  // A 4.5 m road has 9 strips. A bus takes 6 (strips 1 to 6 in the middle), leaving room
  // for a two-wheeler (2 strips) beside it but not for a car (5 strips).
  // With a 20 m/s limit the bus (desired speed 12 m/s) is slower than a two-wheeler (18) or a car (15).
  const busRoad = road(4.5, 1, 20, 1500);
  const slowBus: InitialVehicle = { roadId: "main", positionM: 100, speedMps: 12, vehicleClass: "bus" };
  const behindBus = (vehicleClass: VehicleClass): RunInput => ({
    network: busRoad,
    demand: noDemand,
    seed: 1,
    initialVehicles: [slowBus, { roadId: "main", positionM: 60, speedMps: 12, vehicleClass }],
  });

  it("behind the same slow bus on the same road, a two-wheeler passes and a car queues", () => {
    const withTwoWheeler = runChecked(behindBus("two-wheeler"), 60);
    expect(vehicle(withTwoWheeler, 2)!.positionM).toBeGreaterThan(vehicle(withTwoWheeler, 1)!.positionM + 50);
    expect(vehicle(withTwoWheeler, 2)!.speedMps).toBeGreaterThan(17);

    const withCar = runChecked(behindBus("car"), 60);
    const bus = vehicle(withCar, 1)!;
    const car = vehicle(withCar, 2)!;
    expect(car.positionM).toBeLessThan(bus.positionM - bus.lengthM);
    expect(car.speedMps).toBeGreaterThan(11);
    expect(car.speedMps).toBeLessThan(12.1);
  });

  it("a sideways shift is no faster than the vehicle class's cap", () => {
    let before: VehicleState | undefined;
    let fastest = 0;
    runChecked(behindBus("two-wheeler"), 30, (vehicles) => {
      const now = vehicles.get(2)!;
      if (before) fastest = Math.max(fastest, Math.abs(now.lateralM - before.lateralM) / STEP_SECONDS);
      before = now;
    });

    expect(fastest).toBeGreaterThan(0.5);
    expect(fastest).toBeLessThanOrEqual(VEHICLE_CLASS_ASSUMPTIONS["two-wheeler"].maxSidewaysSpeedMps + 1e-9);
  });

  it("a vehicle with nothing to gain keeps its place across the road", () => {
    const laterals = new Set<number>();
    runChecked(
      {
        network: road(7, 2),
        demand: noDemand,
        seed: 1,
        initialVehicles: [
          { roadId: "main", positionM: 100, speedMps: 13.9, vehicleClass: "two-wheeler", lateralM: 1 },
          // Following a vehicle that is as fast as it wants to be itself.
          { roadId: "main", positionM: 60, speedMps: 13.9, vehicleClass: "two-wheeler", lateralM: 1 },
        ],
      },
      20,
      (vehicles) => {
        for (const each of vehicles.values()) laterals.add(each.lateralM);
      },
    );

    expect([...laterals]).toEqual([1]);
  });

  it("a vehicle does not shift into the way of a fast vehicle close behind; it shifts once that has passed", () => {
    // A stationary bus fills strips 1 to 6. Two-wheeler 2 is slowing behind it; two-wheeler 3 comes up fast
    // in the free strips beside the bus, 3 m behind. Shifting at once would force 3 to brake very hard.
    let shiftedWhileBehind = false;
    let slowest = Infinity;
    const run = runChecked(
      {
        network: road(4.5, 1, 20),
        demand: noDemand,
        seed: 1,
        initialVehicles: [
          { roadId: "main", positionM: 300, speedMps: 0, stationary: true, vehicleClass: "bus" },
          { roadId: "main", positionM: 250, speedMps: 5, vehicleClass: "two-wheeler", lateralM: 2 },
          { roadId: "main", positionM: 245, speedMps: 18, vehicleClass: "two-wheeler", lateralM: 4 },
        ],
      },
      40,
      (vehicles) => {
        const slow = vehicles.get(2)!;
        const fast = vehicles.get(3);
        if (!fast) return;
        slowest = Math.min(slowest, fast.speedMps);
        if (fast.positionM - fast.lengthM < slow.positionM && slow.lateralM !== 2) shiftedWhileBehind = true;
      },
    );

    expect(shiftedWhileBehind).toBe(false);
    expect(slowest).toBeGreaterThan(17.5);
    // It got past the bus (by now it may have left the road).
    expect(vehicle(run, 2)?.positionM ?? Infinity).toBeGreaterThan(320);
  });
});

describe("same-space conflicts", () => {
  // A 3 m road has 6 strips. Stationary two-wheelers block strips 0-1 and 4-5 at 200 m, leaving the
  // middle two strips free. Two-wheelers 3 (left) and 4 (right) come up alongside each other, each
  // held back by the one ahead of it, and both want the same free space in the middle.
  const twoWheeler = (positionM: number, lateralM: number, stationary = false): InitialVehicle => ({
    roadId: "main",
    positionM,
    speedMps: stationary ? 0 : 10,
    stationary,
    vehicleClass: "two-wheeler",
    lateralM,
  });
  const contest = (leftAtM: number, rightAtM: number): RunInput => ({
    network: road(3, 1),
    demand: noDemand,
    seed: 1,
    initialVehicles: [
      twoWheeler(200, 0.5, true),
      twoWheeler(200, 2.5, true),
      twoWheeler(leftAtM, 0.5),
      twoWheeler(rightAtM, 2.5),
    ],
  });

  /** Which of the two contenders have moved sideways at the first moment either has, and which got past the block. */
  function contestOutcome(input: RunInput): { atFirstShift: number[]; passedBlock: number[] } {
    let atFirstShift: number[] | undefined;
    const run = runChecked(input, 60, (vehicles) => {
      if (atFirstShift) return;
      const shifted = [3, 4].filter((id) => vehicles.get(id)!.lateralM !== (id === 3 ? 0.5 : 2.5));
      if (shifted.length > 0) atFirstShift = shifted;
    });
    const passedBlock = [3, 4].filter((id) => (vehicle(run, id)?.positionM ?? Infinity) > 200);
    return { atFirstShift: atFirstShift ?? [], passedBlock };
  }

  it("when two vehicles choose the same free space in one step, only the one further ahead gets it", () => {
    expect(contestOutcome(contest(150, 150.5)).atFirstShift).toEqual([4]);
    expect(contestOutcome(contest(150.5, 150)).atFirstShift).toEqual([3]);
  });

  it("of two vehicles exactly level, the one with the lower id gets the space", () => {
    expect(contestOutcome(contest(150, 150)).atFirstShift).toEqual([3]);
  });

  it("the vehicle that did not get the space follows the other through it, and they never overlap", () => {
    // runChecked applies the no-overlap check at every step.
    expect(contestOutcome(contest(150, 150.5)).passedBlock).toEqual([3, 4]);
    expect(contestOutcome(contest(150, 150)).passedBlock).toEqual([3, 4]);
  });

  it("two vehicles that are not alongside each other may both take strips in the same step", () => {
    // 10 m apart: both can head for the middle at once, one behind the other.
    const { atFirstShift, passedBlock } = contestOutcome(contest(140, 150));
    expect(atFirstShift).toEqual([3, 4]);
    expect(passedBlock).toEqual([3, 4]);
  });
});

describe("lane discipline", () => {
  it("with lane discipline on, a two-wheeler stays behind a slow bus in its lane; with it off, it passes", () => {
    const behindBus = (laneDiscipline: boolean): RunInput => ({
      network: road(4.5, 1, 20, 1500),
      demand: noDemand,
      seed: 1,
      laneDiscipline,
      initialVehicles: [
        { roadId: "main", positionM: 100, speedMps: 12, vehicleClass: "bus" },
        { roadId: "main", positionM: 60, speedMps: 12, vehicleClass: "two-wheeler" },
      ],
    });

    const on = runChecked(behindBus(true), 60);
    expect(vehicle(on, 2)!.positionM).toBeLessThan(vehicle(on, 1)!.positionM - vehicle(on, 1)!.lengthM);
    expect(vehicle(on, 2)!.lateralM).toBe(2.25);

    const off = runChecked(behindBus(false), 60);
    expect(vehicle(off, 2)!.positionM).toBeGreaterThan(vehicle(off, 1)!.positionM);
  });

  it("with lane discipline on, every vehicle is in the middle of a lane or changing between two neighbouring lanes", () => {
    // Three 3.5 m lanes, with a stationary car in the middle lane that traffic must change lanes to pass.
    const laneCentres = [1.75, 5.25, 8.75];
    const lanesUsed = new Map<number, Set<number>>();
    let changing = 0;
    const previous = new Map<number, number>();
    const run = runChecked(
      {
        network: road(10.5, 3),
        demand: {
          flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 3000 }],
          vehicleMix: BENGALURU_VEHICLE_MIX,
        },
        seed: 9,
        laneDiscipline: true,
        initialVehicles: [{ roadId: "main", positionM: 350, speedMps: 0, stationary: true, lateralM: 5.25 }],
      },
      300,
      (vehicles) => {
        for (const each of vehicles.values()) {
          const lane = laneCentres.findIndex((centre) => Math.abs(each.lateralM - centre) < 1e-9);
          if (lane >= 0) {
            if (!lanesUsed.has(each.id)) lanesUsed.set(each.id, new Set());
            lanesUsed.get(each.id)!.add(lane);
          } else {
            // Between lanes: it must be moving steadily from one lane centre towards the next.
            changing++;
            expect(each.lateralM).toBeGreaterThan(1.75);
            expect(each.lateralM).toBeLessThan(8.75);
            const was = previous.get(each.id);
            if (was !== undefined) {
              const cap = VEHICLE_CLASS_ASSUMPTIONS[each.vehicleClass].maxSidewaysSpeedMps * STEP_SECONDS;
              expect(Math.abs(each.lateralM - was)).toBeGreaterThan(0);
              expect(Math.abs(each.lateralM - was)).toBeLessThanOrEqual(cap + 1e-9);
            }
          }
          previous.set(each.id, each.lateralM);
        }
      },
    );

    expect(changing).toBeGreaterThan(0);
    expect([...lanesUsed.values()].some((lanes) => lanes.size > 1)).toBe(true);
    expect(run.results().vehiclesThrough).toBeGreaterThan(100);
  });

  it("with lane discipline on, vehicles in one lane keep in single file", () => {
    // Heavy mixed demand on one 3.5 m lane: wide enough for two-wheelers side by side, but they must not be.
    runChecked(
      {
        network: road(3.5, 1),
        demand: {
          flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 4000 }],
          vehicleMix: BENGALURU_VEHICLE_MIX,
        },
        seed: 4,
        laneDiscipline: true,
      },
      300,
      (vehicles) => {
        const frontFirst = [...vehicles.values()].sort((a, b) => b.positionM - a.positionM);
        for (let i = 1; i < frontFirst.length; i++) {
          const ahead = frontFirst[i - 1]!;
          expect(ahead.positionM - ahead.lengthM - frontFirst[i]!.positionM).toBeGreaterThanOrEqual(-1e-9);
          expect(frontFirst[i]!.lateralM).toBe(1.75);
        }
      },
    );
  });

  it("reads a version 1 network, which has no lane counts, and refuses a version 2 road without one", () => {
    const versionOne: Network = { formatVersion: 1, roads: [{ ...road(7, 2).roads[0]!, lanes: undefined }] };
    // 7 m at the standard 3.5 m lane width is two lanes: a car put at 1 m ends up in the middle of the left lane.
    const run = createRun({
      network: versionOne,
      demand: noDemand,
      seed: 1,
      laneDiscipline: true,
      initialVehicles: [{ roadId: "main", positionM: 100, speedMps: 5, lateralM: 1 }],
    });
    expect(run.snapshot().vehicles[0]!.lateralM).toBe(1.75);

    const versionTwo: Network = { ...versionOne, formatVersion: 2 };
    expect(() => createRun({ network: versionTwo, demand: noDemand, seed: 1 })).toThrow(/lane count/i);
    // Version 3 (junctions) still needs lane counts; a version this engine does not know is refused.
    const versionThree: Network = { ...versionOne, formatVersion: 3 };
    expect(() => createRun({ network: versionThree, demand: noDemand, seed: 1 })).toThrow(/lane count/i);
    const versionFour = { ...versionOne, formatVersion: 4 } as unknown as Network;
    expect(() => createRun({ network: versionFour, demand: noDemand, seed: 1 })).toThrow(/version/i);
  });
});

describe("mean delay per vehicle class", () => {
  it("a vehicle that travels at its desired speed all the way has no delay", () => {
    const run = createRun({
      network: road(3.5, 1),
      demand: noDemand,
      seed: 1,
      initialVehicles: [{ roadId: "main", positionM: 10, speedMps: 13.9 }],
    });
    advance(run, 60);

    const delay = run.results().delayByVehicleClass;
    expect(delay.car.vehicles).toBe(1);
    expect(delay.car.vehiclesThrough).toBe(1);
    expect(Math.abs(delay.car.meanDelayS!)).toBeLessThan(0.01);
    expect(delay.bus).toEqual({ vehicles: 0, vehiclesThrough: 0, meanDelayS: null, totalDelayS: 0 });
  });

  it("delay is actual travel time less travel time at desired speed: a car held behind a slow bus loses about a fifth", () => {
    // 1440 m behind a bus at 12 m/s takes about 120 s; at the car's desired 15 m/s it would take 96 s.
    const run = createRun({
      network: road(4.5, 1, 20, 1500),
      demand: noDemand,
      seed: 1,
      initialVehicles: [
        { roadId: "main", positionM: 100, speedMps: 12, vehicleClass: "bus" },
        { roadId: "main", positionM: 60, speedMps: 12, vehicleClass: "car" },
      ],
    });
    advance(run, 200);

    const delay = run.results().delayByVehicleClass;
    expect(delay.car.vehiclesThrough).toBe(1);
    expect(delay.car.meanDelayS!).toBeGreaterThan(22);
    expect(delay.car.meanDelayS!).toBeLessThan(27);
    expect(Math.abs(delay.bus.meanDelayS!)).toBeLessThan(0.01);
  });

  it("vehicles still on the network or waiting to enter count with their delay so far; stationary vehicles do not", () => {
    const run = createRun({
      network: road(3.5, 1),
      demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 1800 }] },
      seed: 3,
      initialVehicles: [{ roadId: "main", positionM: 20, speedMps: 0, stationary: true }],
    });

    advance(run, 60);
    const early = run.results();
    advance(run, 60);
    const late = run.results();

    expect(late.vehiclesThrough).toBe(0);
    // Everything the demand produced, less the stationary car.
    expect(late.delayByVehicleClass.car.vehicles).toBe(late.vehiclesOnNetwork - 1 + late.vehiclesWaitingToEnter);
    // Nothing moves, so every vehicle's delay grows; arrivals spread over the two minutes average about half of it.
    expect(late.delayByVehicleClass.car.meanDelayS!).toBeGreaterThan(early.delayByVehicleClass.car.meanDelayS! + 20);
    expect(late.delayByVehicleClass.car.meanDelayS!).toBeGreaterThan(45);
    expect(late.delayByVehicleClass.car.meanDelayS!).toBeLessThan(75);
  });

  it("in mixed traffic two-wheelers are delayed less than cars", () => {
    const run = createRun({
      network: road(7, 2, 13.9, 1000),
      demand: {
        flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 5000 }],
        vehicleMix: BENGALURU_VEHICLE_MIX,
      },
      seed: 6,
    });
    advance(run, 900);

    const delay = run.results().delayByVehicleClass;
    expect(delay["two-wheeler"].vehiclesThrough).toBeGreaterThan(100);
    expect(delay.car.vehiclesThrough).toBeGreaterThan(50);
    expect(delay["two-wheeler"].meanDelayS!).toBeLessThan(delay.car.meanDelayS!);
  });
});

describe("consistency checks with mixed traffic at high density", () => {
  const heavy = (
    widthM: number,
    lanes: number,
    vehiclesPerHour: number,
    seed: number,
    extra: Partial<RunInput> = {},
  ): RunInput => ({
    network: road(widthM, lanes, 13.9, 300),
    demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour }], vehicleMix: BENGALURU_VEHICLE_MIX },
    seed,
    ...extra,
  });
  const stationary = (vehicleClass: VehicleClass, positionM: number, lateralM: number): InitialVehicle => ({
    roadId: "main",
    positionM,
    speedMps: 0,
    stationary: true,
    vehicleClass,
    lateralM,
  });
  const seeds = [1, 2, 3, 4, 5];

  it("pass when a 7 m road is blocked but for a space only two-wheelers fit through, and jams solid", () => {
    // 14 strips: a stationary bus takes 0 to 5 and a stationary car 6 to 10, leaving 3.
    // A few two-wheelers get through before larger vehicles queue across the space; then the
    // 250 m behind the block fill with stopped vehicles (about 0.09 to 0.11 vehicles per square metre).
    for (const seed of seeds) {
      const input = heavy(7, 2, 12000, seed, {
        initialVehicles: [stationary("bus", 250, 1.5), stationary("car", 250, 4.25)],
      });
      const report = checkRunConsistency(input, { durationS: 300 });
      expect(report.violations).toEqual([]);
      expect(report.results.vehiclesThrough).toBeGreaterThan(0);
      expect(report.results.vehiclesOnNetwork).toBeGreaterThan(150);
      const delay = report.results.delayByVehicleClass;
      expect(delay["two-wheeler"].vehiclesThrough).toBe(report.results.vehiclesThrough);
      expect(delay.bus.vehiclesThrough + delay.car.vehiclesThrough + delay["auto-rickshaw"].vehiclesThrough).toBe(0);
    }
  });

  it("pass when a 10.5 m road narrows past a stationary bus and all vehicle classes squeeze by", () => {
    for (const seed of seeds) {
      const input = heavy(10.5, 3, 15000, seed, { initialVehicles: [stationary("bus", 250, 5.25)] });
      const report = checkRunConsistency(input, { durationS: 300 });
      expect(report.violations).toEqual([]);
      for (const vehicleClass of ["two-wheeler", "car", "auto-rickshaw", "bus"] as const) {
        expect(report.results.delayByVehicleClass[vehicleClass].vehiclesThrough).toBeGreaterThan(0);
      }
      expect(report.results.vehiclesWaitingToEnter).toBeGreaterThan(0);
    }
  });

  it("pass on an open road loaded beyond what it can carry", () => {
    for (const seed of seeds) {
      const report = checkRunConsistency(heavy(7, 2, 20000, seed), { durationS: 300 });
      expect(report.violations).toEqual([]);
      expect(report.results.vehiclesThrough).toBeGreaterThan(500);
    }
  });

  it("pass with lane discipline on, where a stationary bus closes one of three lanes", () => {
    for (const seed of seeds) {
      const input = heavy(10.5, 3, 15000, seed, {
        laneDiscipline: true,
        initialVehicles: [stationary("bus", 250, 5.25)],
      });
      const report = checkRunConsistency(input, { durationS: 300 });
      expect(report.violations).toEqual([]);
      expect(report.results.vehiclesThrough).toBeGreaterThan(100);
    }
  });
});
