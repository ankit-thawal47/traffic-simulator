/**
 * Filtering (spec: Engine behaviour; rule.filtering in assumptions.ts).
 *
 * On an approach whose signal is red or amber, the standing queue is counted
 * back from the stop line through vehicles slower than the standing speed, to
 * the first stretch of the look-ahead distance with none. A vehicle is at the
 * queue once its front bumper is within the look-ahead distance of the queue's
 * back, or inside the queue. There:
 *   - a vehicle class that filters (two-wheelers) shifts sideways as anywhere
 *     else, through gaps wide enough for its strips, and inside the queue goes no
 *     faster than the filtering speed (slowing to it comfortably as it comes up
 *     to the queue's back); it keeps to its side of the road for its turn (one
 *     turning right does not filter to the left, nor one turning left to the right);
 *   - the other vehicle classes keep their strips: they do not shift sideways to
 *     pass the queue (sorting for the way on and leaving a blocked strip still apply).
 * On green there is no standing queue in this sense, so nobody filters in front
 * of the head of the queue while it discharges.
 *
 * Everything here is worked out from the state at the start of a step.
 */
import { FILTERING_ASSUMPTIONS, FILTERING_CLASSES } from "./assumptions";
import type { VehicleClass } from "./types";

/** Whether a vehicle class filters. */
export function filters(vehicleClass: VehicleClass): boolean {
  return FILTERING_CLASSES[vehicleClass].value === 1;
}

/** What the queue count needs of each vehicle on the approach. */
export interface QueuedVehicle {
  positionM: number;
  lengthM: number;
  speedMps: number;
  /** Whether it can be part of the queue: on the approach, not let into the junction, not a stationary vehicle. */
  waiting: boolean;
}

/**
 * The back of the standing queue on an approach of length `roadLengthM`: the
 * rear bumper of its last vehicle, or the stop line when nothing stands there.
 * `vehicles` are sorted front first.
 */
export function standingQueueBackM(vehicles: readonly QueuedVehicle[], roadLengthM: number): number {
  const standingBelowMps = FILTERING_ASSUMPTIONS.standingBelowMps.value;
  const breakM = FILTERING_ASSUMPTIONS.lookAheadM.value;
  let backM = roadLengthM;
  for (const vehicle of vehicles) {
    if (!vehicle.waiting || vehicle.speedMps >= standingBelowMps) continue;
    if (backM - vehicle.positionM > breakM) break;
    backM = Math.min(backM, vehicle.positionM - vehicle.lengthM);
  }
  return backM;
}

/** Whether a vehicle with its front bumper at `positionM` is at a standing queue whose back is at `queueBackM`. */
export function atStandingQueue(positionM: number, queueBackM: number): boolean {
  return positionM + FILTERING_ASSUMPTIONS.lookAheadM.value >= queueBackM;
}

/**
 * The speed a filtering vehicle aims for: the filtering speed inside the queue,
 * and, coming up to it, the speed from which it can still slow to the filtering
 * speed by the queue's back at `slowingMps2` (so the following rule brings it
 * down gently rather than all at once).
 */
export function filteringSpeedCapMps(positionM: number, queueBackM: number, slowingMps2: number): number {
  const filteringMps = FILTERING_ASSUMPTIONS.filteringSpeedMps.value;
  const toQueueM = Math.max(0, queueBackM - positionM);
  return Math.sqrt(filteringMps * filteringMps + 2 * slowingMps2 * toQueueM);
}
