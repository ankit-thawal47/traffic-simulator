import { describe, expect, it } from "vitest";
import { createRun, type Demand, type RunInput } from "../src/index";
import { ARMS, everyMovement, fourWay, oneApproachAtATime, opposingApproachesTogether } from "./four-way";

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

  // Opposite approaches share a green (the plan of benchmark test T2.4) and every approach is saturated, so
  // oncoming traffic leaves no gap during green. Ticket 24 measured right-turners standing at the stop line
  // for 700 s (and stuck vehicles released) when nobody could be let in after the green.
  it("lets a turner waiting at the stop line across oncoming traffic go after its green: nobody stands 300 s", () => {
    for (const seed of [1, 2, 3]) {
      const run = createRun({
        network: fourWay({ signalPlan: opposingApproachesTogether(30, 3, 2) }),
        demand: everyMovement(1500, false),
        seed,
        laneDiscipline: true,
      });
      const standingSince = new Map<number, number>();
      let longestS = 0;
      while (run.timeS < 1800 - 1e-9) {
        run.step();
        for (const vehicle of run.snapshot().vehicles) {
          if (vehicle.speedMps >= 0.1) standingSince.delete(vehicle.id);
          else if (!standingSince.has(vehicle.id)) standingSince.set(vehicle.id, run.timeS);
          else longestS = Math.max(longestS, run.timeS - standingSince.get(vehicle.id)!);
        }
      }
      expect({ seed, stoodUnder300S: longestS < 300, longestS: Math.round(longestS), stuck: run.results().stuckVehicles }).toEqual({
        seed,
        stoodUnder300S: true,
        longestS: expect.any(Number),
        stuck: 0,
      });
    }
  });
});
