import { describe, expect, it } from "vitest";
import { createRun, type Demand, type RunInput } from "../src/index";
import { ARMS, everyMovement, fourWay, oneApproachAtATime } from "./four-way";

/** Every approach sends all its traffic straight on. */
function straightOnOnly(vehiclesPerHourPerApproach: number, mixed: boolean): Demand {
  const flows = ARMS.map((from, at) => ({
    entryRoadId: `${from}-in`,
    exitRoadId: `${ARMS[(at + 2) % 4]}-out`,
    vehiclesPerHour: vehiclesPerHourPerApproach,
  }));
  return mixed ? { flows, vehicleMix: everyMovement(1).vehicleMix } : { flows };
}

function throughIn(input: RunInput, seconds: number): number {
  const run = createRun(input);
  while (run.timeS < seconds - 1e-9) run.step();
  return run.results().vehiclesThrough;
}

describe("turning traffic at a saturated signal junction", () => {
  // One approach at a time: no turn meets traffic from another approach, so the only thing that can hold
  // the queue back is the approach's own traffic. Ticket 24 measured 67% of straight-on discharge before
  // turns left from their own side of the approach (turners in the wrong lane crossed the traffic beside them).
  for (const laneDiscipline of [true, false]) {
    it(`discharges about as much with turning traffic in the queue as with straight on only (${laneDiscipline ? "cars in lanes" : "mixed traffic"})`, () => {
      const network = fourWay({ signalPlan: oneApproachAtATime(20) });
      const turning = throughIn({ network, demand: everyMovement(1500, !laneDiscipline), seed: 1, laneDiscipline }, 900);
      const straight = throughIn({ network, demand: straightOnOnly(1500, !laneDiscipline), seed: 1, laneDiscipline }, 900);
      expect(turning / straight).toBeGreaterThan(laneDiscipline ? 0.9 : 0.7);
    });
  }
});
