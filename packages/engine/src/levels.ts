/**
 * Levels: how high a road, and a vehicle on it, is above the ground. A flyover
 * is a road whose points have heights. The engine never uses heights to move
 * vehicles (a vehicle looks for neighbours only on its own road and in the
 * junction it is in, so a flyover and what is beneath it cannot interact);
 * heights are for drawing and for the consistency checks.
 */
import type { NetworkLayout } from "./junction-geometry";
import type { Network, Road, VehicleState } from "./types";

/**
 * Two things closer in height than this are on the same level: where they
 * overlap on the plan, they overlap. It is about the height of a bus, the
 * tallest vehicle class; our choice for the consistency checks, and nothing
 * in the engine's behaviour depends on it.
 */
export const SAME_LEVEL_WITHIN_M = 3;

/** Throws when a network uses what format version 4 added without saying it is version 4, or has a height that is not a number. */
export function checkFlyoverFormat(network: Network): void {
  const before4 = network.formatVersion < 4;
  for (const road of network.roads) {
    for (const point of road.points) {
      if (point.z === undefined) continue;
      if (before4) throw new Error(`Road "${road.id}" has heights, which need network format version 4`);
      if (!Number.isFinite(point.z)) throw new Error(`Road "${road.id}" has a height that is not a number`);
    }
  }
  for (const junction of network.junctions ?? []) {
    if (before4 && junction.control === "none") {
      throw new Error(`Junction "${junction.id}" has no signal, which needs network format version 4`);
    }
  }
}

/** Whether any point of the road is above or below the ground. */
export function isRaised(road: Road): boolean {
  return road.points.some((point) => (point.z ?? 0) !== 0);
}

/**
 * The height of a road's surface at a distance along it (measured on the
 * plan, as all distances along a road are), clamped to the road's ends. The
 * height changes evenly between one point of the road and the next.
 */
export function roadHeightM(road: Road, distanceM: number): number {
  let remaining = Math.max(0, distanceM);
  let last = road.points[0]?.z ?? 0;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!;
    const b = road.points[i]!;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (segment === 0) continue;
    const from = a.z ?? 0;
    const to = b.z ?? 0;
    if (remaining <= segment) return from + ((to - from) * remaining) / segment;
    remaining -= segment;
    last = to;
  }
  return last;
}

/**
 * The height of the road surface under a point of a vehicle `behindFrontM`
 * behind its front bumper. Inside a junction the height changes evenly from
 * the end of the road the vehicle came from to the start of the one it is
 * heading for, along the straight line between them.
 */
export function vehicleHeightM(layout: NetworkLayout, vehicle: VehicleState, behindFrontM = vehicle.lengthM / 2): number {
  const road = layout.roads.get(vehicle.roadId);
  if (!road) return 0;
  const atM = vehicle.positionM - behindFrontM;
  const turn = vehicle.turn;
  if (!turn) return roadHeightM(road.road, atM);
  const from = layout.roads.get(turn.fromRoadId);
  const to = layout.roads.get(turn.toRoadId);
  if (!from || !to) return roadHeightM(road.road, atM);
  const fromEndM = roadHeightM(from.road, from.lengthM);
  const toStartM = roadHeightM(to.road, 0);
  if (fromEndM === toStartM && fromEndM === 0 && !isRaised(road.road)) return 0;
  const path = layout.turningPath(turn.fromRoadId, turn.toRoadId);
  const acrossM = path ? Math.hypot(path.control[3].x - path.control[0].x, path.control[3].y - path.control[0].y) : 0;
  if (vehicle.roadId === turn.fromRoadId) {
    const beyondM = atM - from.lengthM;
    if (beyondM <= 0) return roadHeightM(from.road, atM);
    return fromEndM + (toStartM - fromEndM) * Math.min(1, acrossM > 0 ? beyondM / acrossM : 1);
  }
  if (atM >= 0) return roadHeightM(to.road, atM);
  return toStartM + (fromEndM - toStartM) * Math.min(1, acrossM > 0 ? -atM / acrossM : 1);
}
