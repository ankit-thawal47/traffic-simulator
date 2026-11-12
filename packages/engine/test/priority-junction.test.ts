import { describe, expect, it } from "vitest";
import { createRun, VEHICLE_CLASSES, type Network, type VehicleClass } from "../src/index";
import { acceptedGapS } from "../src/priority-junction";
import { tJunction } from "./t-junction";

const noDemand = { flows: [] };

const MAIN_SPEED_MPS = 13.9;

interface Meeting {
  /** Whether the side-road vehicle entered the junction before the main-road car reached its stop line. */
  sideFirst: boolean;
  /** Time from the start until the main-road car's front bumper reached the road beyond the junction. */
  mainThroughS: number;
  mainSlowestMps: number;
}

/**
 * A side-road vehicle standing at the stop line of "south-in", turning right
 * onto "east-out" (across the westbound main road), and one main-road car on
 * "east-in", `mainAtM` along it at the speed limit, going straight on.
 */
function meet(sideClass: VehicleClass, mainAtM: number, laneDiscipline = false): Meeting {
  const run = createRun({
    network: tJunction(),
    demand: noDemand,
    seed: 1,
    laneDiscipline,
    initialVehicles: [
      { roadId: "south-in", positionM: 199.5, speedMps: 0, vehicleClass: sideClass, exitRoadId: "east-out", lateralM: 5 },
      { roadId: "east-in", positionM: mainAtM, speedMps: MAIN_SPEED_MPS, vehicleClass: "car", exitRoadId: "west-out", lateralM: 2 },
    ],
  });
  let sideInS = Infinity;
  let mainAtStopLineS = Infinity;
  let mainThroughS = Infinity;
  let mainSlowestMps = Infinity;
  while (run.timeS < 40) {
    run.step();
    const { vehicles, timeS } = run.snapshot();
    const side = vehicles.find((vehicle) => vehicle.id === 1);
    const main = vehicles.find((vehicle) => vehicle.id === 2);
    if (side && (side.turn || side.roadId !== "south-in") && sideInS === Infinity) sideInS = timeS;
    if (main) {
      mainSlowestMps = Math.min(mainSlowestMps, main.speedMps);
      if ((main.roadId !== "east-in" || main.positionM > 200) && mainAtStopLineS === Infinity) mainAtStopLineS = timeS;
      if (main.roadId === "west-out" && mainThroughS === Infinity) mainThroughS = timeS;
    }
  }
  return { sideFirst: sideInS < mainAtStopLineS, mainThroughS, mainSlowestMps };
}

describe("a network with a priority junction", () => {
  it("runs, with a main road and a side road", () => {
    const run = createRun({
      network: tJunction(),
      demand: { flows: [{ entryRoadId: "south-in", exitRoadId: "east-out", vehiclesPerHour: 300 }] },
      seed: 1,
    });
    for (let i = 0; i < 600; i++) run.step();
    expect(run.results().vehiclesThrough).toBeGreaterThan(0);
  });

  it("needs network format version 5", () => {
    const network: Network = { ...tJunction(), formatVersion: 4 };
    expect(() => createRun({ network, demand: noDemand, seed: 1 })).toThrow(/format version 5/);
  });

  it("names as main roads only approaches of the junction", () => {
    const network = tJunction();
    network.junctions = [{ ...network.junctions![0]!, mainRoadIds: ["west-in", "east-out"] } as never];
    expect(() => createRun({ network, demand: noDemand, seed: 1 })).toThrow(/"east-out", which is not an approach/);
  });

  it("leaves older networks as they were: a junction with no signal still needs no main road", () => {
    expect(() => createRun({ network: { ...tJunction(), formatVersion: 3, junctions: [] }, demand: noDemand, seed: 1 })).not.toThrow();
  });

  it.each([false, true])("lets a side-road vehicle go only into a gap at least its accepted gap, and never holds the main road (lane discipline %s)", (laneDiscipline) => {
    const positions = Array.from({ length: 39 }, (_, i) => 5 + 5 * i);
    for (const vehicleClass of VEHICLE_CLASSES) {
      const meetings = positions.map((at) => meet(vehicleClass, at, laneDiscipline));
      // With the main-road car far off, the side-road vehicle goes first; with it near, it waits.
      expect(meetings[0]!.sideFirst, vehicleClass).toBe(true);
      expect(meetings[meetings.length - 1]!.sideFirst, vehicleClass).toBe(false);
      for (const meeting of meetings) {
        // The gap is measured to where the paths cross, which the main-road car reaches before it is through the junction.
        if (meeting.sideFirst) expect(meeting.mainThroughS, vehicleClass).toBeGreaterThanOrEqual(acceptedGapS(vehicleClass));
        // The main-road car is never held: it keeps its speed whether or not the side-road vehicle went first.
        expect(meeting.mainSlowestMps, vehicleClass).toBeGreaterThan(0.99 * MAIN_SPEED_MPS);
      }
    }
  });

  it("lets a two-wheeler into a gap that a car refuses", () => {
    const positions = Array.from({ length: 39 }, (_, i) => 5 + 5 * i);
    const twoWheelerTakes = positions.filter((at) => meet("two-wheeler", at).sideFirst);
    const carTakes = positions.filter((at) => meet("car", at).sideFirst);
    // A main-road car nearer the junction (further along its road) is a smaller gap.
    expect(Math.max(...twoWheelerTakes)).toBeGreaterThan(Math.max(...carTakes));
  });

  it("does not release a side-road vehicle that is only waiting for a gap, however long it waits", () => {
    const main = 1500;
    const run = createRun({
      network: tJunction(),
      demand: {
        flows: [
          { entryRoadId: "west-in", exitRoadId: "east-out", vehiclesPerHour: main },
          { entryRoadId: "east-in", exitRoadId: "west-out", vehiclesPerHour: main },
          { entryRoadId: "south-in", exitRoadId: "east-out", vehiclesPerHour: 60 },
        ],
        vehicleMix: { bus: 1 },
      },
      seed: 3,
    });
    // The longest any vehicle has stood still at the front of the side road.
    const stoodS = new Map<number, number>();
    while (run.timeS < 1800) {
      run.step();
      for (const vehicle of run.snapshot().vehicles) {
        if (vehicle.roadId !== "south-in" || vehicle.turn || vehicle.positionM < 190 || vehicle.speedMps >= 0.1) continue;
        stoodS.set(vehicle.id, (stoodS.get(vehicle.id) ?? 0) + 0.2);
      }
    }
    expect(Math.max(...stoodS.values())).toBeGreaterThan(300);
    expect(run.results().stuckVehicles).toBe(0);
  });

  it("has at least one main road and at least one side road", () => {
    const none = tJunction();
    none.junctions = [{ ...none.junctions![0]!, mainRoadIds: [] } as never];
    expect(() => createRun({ network: none, demand: noDemand, seed: 1 })).toThrow(/needs a main road/);
    const all = tJunction();
    all.junctions = [{ ...all.junctions![0]!, mainRoadIds: ["west-in", "east-in", "south-in"] } as never];
    expect(() => createRun({ network: all, demand: noDemand, seed: 1 })).toThrow(/needs a side road/);
  });
});
