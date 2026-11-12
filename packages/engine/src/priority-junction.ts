/**
 * Priority junctions (spec: Engine behaviour, Priority junctions): a junction
 * with no signal where traffic on the main road goes first and side-road
 * traffic waits for a gap.
 *
 * How they work, with what the engine already has for junctions:
 *
 *  - Every approach always shows green, as at a junction with no signal, and
 *    vehicles ask to be let in near the stop line. Main-road vehicles are let
 *    in first come, first served, each only when the road beyond has room and
 *    the vehicles let in before it will be clear of its path (crossing paths,
 *    crossings.ts). A side-road vehicle that has not been let in never holds
 *    one back.
 *  - A side-road vehicle is let in only if, besides that, the gap in main-road
 *    traffic is large enough: for every main-road vehicle on an approach of
 *    the junction whose path crosses its own and that has not reached that
 *    place yet, the soonest it can get there (the lag) is at least the
 *    side-road vehicle's accepted gap, and later, by the crossing margin, than
 *    the soonest the side-road vehicle can be clear of the place. So the
 *    main-road vehicle finds the place free and is not held.
 *  - A side-road vehicle refused for want of a gap is waiting for a gap: it is
 *    held, as at a red signal, and is not counted towards a stuck vehicle.
 *
 * The places where paths cross are those found once for the junction
 * (findCrossings); the gap is measured to the first of them on the main-road
 * vehicle's path, as Kota, Pallela and Lalam (2025) measured it, to the next
 * main-road vehicle reaching the conflict point. Forced entry by impatient
 * drivers is not modelled (spec: Out of Scope).
 */
import { JUNCTION_ASSUMPTIONS, PRIORITY_JUNCTION_ASSUMPTIONS } from "./assumptions";
import type { Network, PriorityJunction, VehicleClass } from "./types";

/** The accepted gap of a vehicle class, in seconds, from the assumptions table. */
export function acceptedGapS(vehicleClass: VehicleClass): number {
  return PRIORITY_JUNCTION_ASSUMPTIONS[vehicleClass].value;
}

/**
 * Whether a side-road vehicle may go ahead of one main-road vehicle whose path
 * crosses its own: `lagS` is the soonest the main-road vehicle can reach the
 * place where the paths cross, `clearS` the soonest the side-road vehicle can
 * be clear of it.
 */
export function gapIsLargeEnough(vehicleClass: VehicleClass, lagS: number, clearS: number): boolean {
  return lagS >= acceptedGapS(vehicleClass) && lagS >= clearS + JUNCTION_ASSUMPTIONS.crossingMarginS.value;
}

/** Throws when a network has a priority junction without saying it is format version 5. */
export function checkPriorityFormat(network: Network): void {
  if (network.formatVersion >= 5) return;
  for (const junction of network.junctions ?? []) {
    if (junction.control === "priority") {
      throw new Error(`Junction "${junction.id}" is a priority junction, which needs network format version 5`);
    }
  }
}

/**
 * The main roads of a priority junction, checked against its approaches (the
 * roads its connections leave from). Throws when it names a road that is not
 * an approach, names none, or names them all.
 */
export function mainRoadsOf(junction: PriorityJunction, approachIds: readonly string[]): Set<string> {
  const ids = Array.isArray(junction.mainRoadIds) ? junction.mainRoadIds : [];
  const main = new Set<string>();
  for (const id of ids) {
    if (!approachIds.includes(id)) {
      throw new Error(`Priority junction "${junction.id}" names as a main road "${id}", which is not an approach of it`);
    }
    main.add(id);
  }
  if (main.size === 0) throw new Error(`Priority junction "${junction.id}" needs a main road`);
  if (main.size === approachIds.length) throw new Error(`Priority junction "${junction.id}" needs a side road: every approach is a main road`);
  return main;
}
