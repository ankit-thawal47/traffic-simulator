import type { Point, Road } from "./types";

/** Length of a road along its centreline, in metres. */
export function roadLengthM(road: Road): number {
  let length = 0;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!;
    const b = road.points[i]!;
    length += Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
  }
  return length;
}

export interface RoadPosition {
  /** The point on the centreline. */
  point: Point;
  /** Unit vector in the direction of travel at that point. */
  direction: Point;
}

/** The centreline point at a distance along a road, clamped to the road's ends. */
export function positionAlongRoad(road: Road, distanceM: number): RoadPosition {
  let remaining = Math.max(0, distanceM);
  let last: RoadPosition | undefined;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!;
    const b = road.points[i]!;
    const segment = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    if (segment === 0) continue;
    const direction = { x: (b.x - a.x) / segment, y: (b.y - a.y) / segment };
    if (remaining <= segment) {
      return { point: { x: a.x + direction.x * remaining, y: a.y + direction.y * remaining }, direction };
    }
    remaining -= segment;
    last = { point: { x: b.x, y: b.y }, direction };
  }
  if (!last) throw new Error(`Road "${road.id}" has no length`);
  return last;
}
