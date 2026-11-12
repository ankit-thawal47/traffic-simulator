import { describe, expect, it } from "vitest";
import { createRun, type Run, type VehicleState } from "../src/index";
import { flyoverNetwork } from "./flyover-network";

function runFor(run: Run, seconds: number, each?: (vehicles: VehicleState[]) => void): void {
  const until = run.timeS + seconds;
  while (run.timeS < until - 1e-9) {
    run.step();
    if (each) each(run.snapshot().vehicles);
  }
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
});
