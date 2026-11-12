/**
 * Stuck vehicles (spec: Engine behaviour; ADR 0005: a headline result, not a
 * hidden repair). When vehicles lock each other so that none can move, the run
 * releases one by force and counts it.
 *
 * The test, once a step, from the state at the start of the step:
 *  - A vehicle is standing when it is slower than standingBelowMps and is not
 *    moving across.
 *  - A standing vehicle whose nearest vehicle ahead in its strips (on the same
 *    road) is also standing, and is not a stationary vehicle, is queued: its
 *    time restarts. Only a vehicle at the front of a queue collects time, so a
 *    long queue behind a lock, or behind a red, collects none.
 *  - A vehicle at the front of a queue that is held by a red or amber signal,
 *    stands behind a stationary vehicle with no clear strips to go round it, or
 *    waits on a side road of a priority junction for a gap in main-road
 *    traffic (refused for want of a large enough gap, or because the room
 *    beyond is taken by traffic still moving on), is held: its time neither
 *    grows nor restarts. Main-road traffic never waits for side-road traffic,
 *    so a vehicle waiting for a gap is never part of a lock.
 *  - Any other standing vehicle collects the step's time.
 *  - Moving, its time restarts.
 * A vehicle whose time reaches stuckAfterS is a stuck vehicle. At most one is
 * released at a time (the one that has stood longest; of equals, the lowest
 * id), and after a release every vehicle's time counts only from the release,
 * so the vehicles it frees have stuckAfterS to move before another is released.
 *
 * Every lock has a vehicle at the front of a queue in it: a vehicle only ever
 * follows one further along the same road, so a ring of vehicles waiting for
 * each other must pass through one that waits for something else (to be let
 * into a junction, to move across, for room on the next road). That vehicle
 * collects time and is found.
 *
 * It does not catch a lock whose vehicles keep creeping forward, nor a vehicle
 * whose standing leader is far ahead of it (it counts as queued). Stationary
 * vehicles (breakdowns) are never released.
 *
 * The released vehicle is taken off the network (SUMO puts it back further on;
 * that is more than this needs and would hide where it was). It is not counted
 * through; it stays in the mean delay of its vehicle class with its delay up to
 * the moment of release.
 */
import { STEP_SECONDS, STUCK_VEHICLE_ASSUMPTIONS } from "./assumptions";

/** What a vehicle is doing this step, as the test above sees it. */
export type Standing = "moving" | "queued" | "held" | "standing";

/** Facts about one vehicle at the start of a step, from which the test decides. */
export interface StandingFacts {
  speedMps: number;
  movingAcross: boolean;
  /** Its nearest vehicle ahead in its strips on the same road is standing and is not a stationary vehicle. */
  behindStandingVehicle: boolean;
  /** It is held by a red or amber signal, stands behind a stationary vehicle with no clear strips to go round it, or waits for a gap at a priority junction. */
  held: boolean;
}

export function standing(facts: StandingFacts): Standing {
  if (facts.speedMps >= STUCK_VEHICLE_ASSUMPTIONS.standingBelowMps.value || facts.movingAcross) return "moving";
  if (facts.behindStandingVehicle) return "queued";
  if (facts.held) return "held";
  return "standing";
}

/** Whether a vehicle at this speed is standing. */
export function isStanding(speedMps: number): boolean {
  return speedMps < STUCK_VEHICLE_ASSUMPTIONS.standingBelowMps.value;
}

/** The time a vehicle has stood, after one more step of the given kind. */
export function standingTimeAfter(standingS: number, kind: Standing): number {
  if (kind === "standing") return standingS + STEP_SECONDS;
  if (kind === "held") return standingS;
  return 0;
}

export interface StuckVehicles {
  /**
   * Of the vehicles looked at this step (with the time each has stood, after this
   * step's test), the one to release, or undefined. Call once a step, with the
   * time at the start of the step.
   */
  choose<T extends { id: number; standingS: number }>(vehicles: Iterable<T>, nowS: number): T | undefined;
  /** Count a release; every vehicle's time then counts only from now. */
  released(nowS: number): void;
  /** Releases so far. */
  readonly count: number;
}

export function createStuckVehicles(): StuckVehicles {
  const afterS = STUCK_VEHICLE_ASSUMPTIONS.stuckAfterS.value;
  let lastReleaseS = -Infinity;
  let count = 0;
  return {
    choose<T extends { id: number; standingS: number }>(vehicles: Iterable<T>, nowS: number): T | undefined {
      // Time stood counts only from the last release.
      if (nowS - lastReleaseS < afterS - 1e-9) return undefined;
      let chosen: T | undefined;
      for (const vehicle of vehicles) {
        if (vehicle.standingS < afterS - 1e-9) continue;
        if (!chosen || vehicle.standingS > chosen.standingS || (vehicle.standingS === chosen.standingS && vehicle.id < chosen.id)) {
          chosen = vehicle;
        }
      }
      return chosen;
    },
    released(nowS) {
      lastReleaseS = nowS;
      count++;
    },
    get count() {
      return count;
    },
  };
}
