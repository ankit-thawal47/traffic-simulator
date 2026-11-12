import { describe, expect, it } from "vitest";
import { createRun, ROUTE_CHOICE_ASSUMPTIONS, type InitialVehicle, type RunInput } from "../src/index";
import { flyoverDemand, flyoverNetwork } from "./flyover-network";

/**
 * Which way each vehicle of a run went: the ids of the vehicles seen on the
 * flyover and on the approach to the junction beneath, in the order they
 * entered (ids are given in order of entering).
 */
function waysTaken(input: RunInput, seconds: number): { flyover: number[]; junction: number[] } {
  const run = createRun(input);
  const flyover = new Set<number>();
  const junction = new Set<number>();
  while (run.timeS < seconds - 1e-9) {
    run.step();
    for (const vehicle of run.snapshot().vehicles) {
      if (vehicle.roadId === "flyover") flyover.add(vehicle.id);
      if (vehicle.roadId === "south-in") junction.add(vehicle.id);
    }
  }
  return { flyover: [...flyover], junction: [...junction] };
}

function share(ways: { flyover: number[]; junction: number[] }): number {
  return ways.flyover.length / (ways.flyover.length + ways.junction.length);
}

/** A breakdown on the flyover's deck that leaves cars one lane's width to pass. */
const BREAKDOWN: InitialVehicle[] = [
  { roadId: "flyover", positionM: 300, speedMps: 0, stationary: true, vehicleClass: "bus", lateralM: 1.5 },
  { roadId: "flyover", positionM: 300, speedMps: 0, stationary: true, vehicleClass: "car", lateralM: 3.8 },
];

describe("route choice between a flyover and the junction beneath it", () => {
  const throughOnly = (vehiclesPerHour: number, seed: number): RunInput => ({
    network: flyoverNetwork(),
    demand: flyoverDemand(vehiclesPerHour, 0, 0, false),
    seed,
  });

  it("gives the faster route the larger share of through traffic, and never all of it", () => {
    const ways = waysTaken(throughOnly(1200, 21), 1200);
    expect(ways.flyover.length + ways.junction.length).toBeGreaterThan(300);
    // The flyover has no signal to wait at, so it is the faster of the two.
    expect(share(ways)).toBeGreaterThan(0.55);
    expect(share(ways)).toBeLessThan(0.95);
    expect(ways.junction.length).toBeGreaterThan(15);
  });

  it("sends a smaller share over the flyover when the flyover is jammed, but still some", () => {
    const free = waysTaken(throughOnly(2400, 22), 1200);
    const jammed = waysTaken({ ...throughOnly(2400, 22), initialVehicles: BREAKDOWN }, 1200);
    expect(share(jammed)).toBeLessThan(share(free) - 0.15);
    expect(share(jammed)).toBeLessThan(0.5);
    // Of the vehicles that entered in the second half of the run, some still chose the flyover.
    const midway = Math.max(...jammed.flyover, ...jammed.junction) / 2;
    expect(jammed.flyover.filter((id) => id > midway).length).toBeGreaterThan(5);
  });

  it("never gives a route less than the smallest share, however slow it is", () => {
    // The flyover wholly blocked: nobody completes it, and the time of those stuck on it keeps growing.
    const blocked: InitialVehicle[] = [0.5, 2, 3.5, 5, 6.5].map((lateralM) => ({
      roadId: "flyover",
      positionM: 395,
      speedMps: 0,
      stationary: true,
      vehicleClass: "two-wheeler" as const,
      lateralM,
    }));
    const ways = waysTaken({ ...throughOnly(600, 23), initialVehicles: blocked }, 900);
    const late = ways.flyover.filter((id) => id > 60).length / [...ways.flyover, ...ways.junction].filter((id) => id > 60).length;
    expect(ways.flyover.length).toBeGreaterThan(3);
    expect(late).toBeLessThan(3 * ROUTE_CHOICE_ASSUMPTIONS.smallestShare.value);
  });

  it("is repeated exactly by the same seed, and differs with another", () => {
    const first = waysTaken(throughOnly(1200, 24), 300);
    expect(waysTaken(throughOnly(1200, 24), 300)).toEqual(first);
    expect(waysTaken(throughOnly(1200, 25), 300).flyover).not.toEqual(first.flyover);
  });

  it("does not disturb when vehicles arrive or what they are: the choice has its own random stream", () => {
    // Two networks that differ only in whether there is a choice to make.
    const withChoice = createRun({ network: flyoverNetwork(), demand: flyoverDemand(900, 0, 0), seed: 26 });
    const noFlyover = flyoverNetwork();
    noFlyover.junctions![0]!.connections.pop();
    noFlyover.junctions![2]!.connections.pop();
    const withoutChoice = createRun({ network: noFlyover, demand: flyoverDemand(900, 0, 0), seed: 26 });
    const classes = (run: ReturnType<typeof createRun>) => {
      while (run.timeS < 120) run.step();
      const result = run.results();
      return [result.vehiclesEntered + result.vehiclesWaitingToEnter, Object.values(result.delayByVehicleClass).map((delay) => delay.vehicles)];
    };
    expect(classes(withChoice)).toEqual(classes(withoutChoice));
  });
});
