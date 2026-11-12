import { createRun, type RunInput } from "@traffic-simulator/engine";
import oneRoad from "@traffic-simulator/engine/examples/one-road.json";
import { describe, expect, it } from "vitest";
import { runTogether } from "./run-together";

const baseline = oneRoad as RunInput;
const proposal: RunInput = {
  ...baseline,
  demand: { flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: 300 }] },
};

/** No warm-up, so each run's results are the engine's own from the start of the run. */
const noWarmUp = { warmUpS: 0, measuredS: 3600, seeds: 5 };

describe("runs advanced together on one clock", () => {
  it("every frame shows all the runs at the same moment", () => {
    const together = runTogether([baseline, proposal], noWarmUp);

    expect(together.frame().timeS).toBe(0);
    for (let i = 0; i < 50; i++) together.step();
    const frame = together.frame();

    expect(frame.timeS).toBeCloseTo(10, 9);
    expect(frame.runs).toHaveLength(2);
    for (const run of frame.runs) {
      expect(run.snapshot.timeS).toBe(frame.timeS);
      expect(run.results?.timeS).toBe(frame.timeS);
    }
  });

  it("each run is exactly what it would be on its own, in the order given", () => {
    const together = runTogether([baseline, proposal], noWarmUp);
    const alone = [createRun(baseline), createRun(proposal)];
    for (let i = 0; i < 600; i++) {
      together.step();
      for (const run of alone) run.step();
    }

    const frame = together.frame();

    expect(frame.runs[0]).toEqual({ snapshot: alone[0]!.snapshot(), results: alone[0]!.results() });
    expect(frame.runs[1]).toEqual({ snapshot: alone[1]!.snapshot(), results: alone[1]!.results() });
    expect(frame.runs[0]!.results!.vehiclesEntered).toBeGreaterThan(frame.runs[1]!.results!.vehiclesEntered);
  });
});
