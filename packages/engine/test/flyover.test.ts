import { describe, expect, it } from "vitest";
import { createRun, type InitialVehicle, type Run, type RunInput, type VehicleState } from "../src/index";
import { flyoverDemand, flyoverNetwork } from "./flyover-network";

function runFor(run: Run, seconds: number, each?: (vehicles: VehicleState[]) => void): void {
  const until = run.timeS + seconds;
  while (run.timeS < until - 1e-9) {
    run.step();
    if (each) each(run.snapshot().vehicles);
  }
}

/** Every road a run's vehicles were seen on. */
function roadsUsedIn(input: RunInput, seconds: number): Set<string> {
  const run = createRun(input);
  const roads = new Set<string>();
  runFor(run, seconds, (vehicles) => vehicles.forEach((vehicle) => roads.add(vehicle.roadId)));
  return roads;
}

describe("a network with a flyover", () => {
  it("carries a vehicle over the junction on a road that shares no junction with the road beneath", () => {
    const run = createRun({
      network: flyoverNetwork(),
      demand: { flows: [] },
      seed: 1,
      initialVehicles: [{ roadId: "flyover", positionM: 20, speedMps: 10, exitRoadId: "north-exit" }],
    });
    const roadsUsed = new Set<string>();
    runFor(run, 60, (vehicles) => vehicles.forEach((vehicle) => roadsUsed.add(vehicle.roadId)));
    expect(run.results().vehiclesThrough).toBe(1);
    expect([...roadsUsed]).toEqual(["flyover", "north-exit"]);
  });

  it("lets a vehicle leave the main road for the flyover and rejoin it without slowing", () => {
    const run = createRun({
      network: flyoverNetwork(),
      demand: { flows: [] },
      seed: 1,
      // In the right half of the entry road, which lies in front of the flyover's ramp.
      initialVehicles: [{ roadId: "south-entry", positionM: 20, speedMps: 13.9, lateralM: 10.5, exitRoadId: "north-exit" }],
    });
    let slowest = Infinity;
    const roadsUsed = new Set<string>();
    // 780 m to the end of the exit road at 13.9 m/s takes 56.1 s.
    runFor(run, 57, (vehicles) =>
      vehicles.forEach((vehicle) => {
        slowest = Math.min(slowest, vehicle.speedMps);
        roadsUsed.add(vehicle.roadId);
      }),
    );
    expect(run.results().vehiclesThrough).toBe(1);
    expect(slowest).toBeGreaterThan(13.5);
    expect([...roadsUsed]).toEqual(["south-entry", "flyover", "north-exit"]);
  });

  it("sends turning traffic through the junction beneath, never over the flyover", () => {
    const roads = roadsUsedIn({ network: flyoverNetwork(), demand: flyoverDemand(0, 600), seed: 3 }, 300);
    expect(roads.has("south-in")).toBe(true);
    expect(roads.has("east-out")).toBe(true);
    expect(roads.has("west-out")).toBe(true);
    expect(roads.has("flyover")).toBe(false);
  });
});

describe("traffic on a flyover and traffic beneath it", () => {
  const BENEATH = ["west-in", "east-out", "east-in", "west-out"];
  /** Where every vehicle on the flyover, or on the cross road beneath it, is, moment by moment; vehicle ids are left out. */
  function tracesOffFlyover(input: RunInput, seconds: number, onFlyover: boolean): string[] {
    const run = createRun(input);
    const moments: string[] = [];
    runFor(run, seconds, (vehicles) =>
      moments.push(
        JSON.stringify(
          vehicles
            .filter((vehicle) => (onFlyover ? vehicle.roadId === "flyover" : BENEATH.includes(vehicle.roadId)))
            .map(({ roadId, positionM, lateralM, speedMps, vehicleClass }) => [roadId, positionM, lateralM, speedMps, vehicleClass]),
        ),
      ),
    );
    return moments;
  }

  /** The first moment at which two runs differ, or -1 when they never do. */
  function firstDifference(a: string[], b: string[]): number {
    if (a.length !== b.length) return Math.min(a.length, b.length);
    return a.findIndex((moment, at) => moment !== b[at]);
  }

  it("never react to each other: a jam on the flyover changes nothing beneath it", () => {
    const beneath = { network: flyoverNetwork(), demand: flyoverDemand(0, 0, 2400), seed: 5 };
    // A queue standing on the deck right over the junction, behind a breakdown.
    const jam: InitialVehicle[] = [{ roadId: "flyover", positionM: 260, speedMps: 0, stationary: true }];
    for (let positionM = 250; positionM > 60; positionM -= 8) {
      jam.push({ roadId: "flyover", positionM, speedMps: 0, exitRoadId: "north-exit" });
    }
    const alone = tracesOffFlyover(beneath, 240, false);
    const withJam = tracesOffFlyover({ ...beneath, initialVehicles: jam }, 240, false);
    expect(alone.some((moment) => moment.includes("west-in"))).toBe(true);
    expect(firstDifference(withJam, alone)).toBe(-1);
  });

  it("never react to each other: dense traffic beneath changes nothing on the flyover", () => {
    // A platoon crossing the deck while the cross road beneath is busy, or empty.
    const platoon: InitialVehicle[] = [];
    for (let positionM = 150; positionM > 10; positionM -= 12) {
      platoon.push({ roadId: "flyover", positionM, speedMps: 8, lateralM: positionM % 24 === 6 ? 1.75 : 5.25 });
    }
    const flyoverRoad = flyoverNetwork().roads.find((road) => road.id === "flyover")!;
    // The flyover on its own, ending where it ends, so that nothing beyond it differs either.
    const input = (cross: number): RunInput => ({
      network: { ...flyoverNetwork(), junctions: flyoverNetwork().junctions!.filter((junction) => junction.id !== "merge") },
      demand: { ...flyoverDemand(0, 0, cross), flows: flyoverDemand(0, 0, cross).flows.slice(3) },
      seed: 6,
      initialVehicles: platoon,
    });
    expect(flyoverRoad.points.some((point) => (point.z ?? 0) > 0)).toBe(true);
    const alone = tracesOffFlyover(input(0), 60, true);
    const withTrafficBeneath = tracesOffFlyover(input(2400), 60, true);
    expect(alone[100]).toContain("flyover");
    expect(firstDifference(withTrafficBeneath, alone)).toBe(-1);
  });
});
