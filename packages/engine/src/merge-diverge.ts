/**
 * Diverges and merges: the junctions with no signal where a flyover leaves
 * the main road and where it comes back to it (control "none").
 *
 * How they work, with what the engine already has for junctions:
 *
 *  - A connection runs straight on between two roads, across the part of the
 *    wider road's width that the narrower one lines up with on the plan. So at
 *    a diverge the road divides by position across it: the strips (or lanes)
 *    in front of the flyover's ramp lead onto the flyover, the others to the
 *    road beneath. A vehicle enters the network in strips that lead onto its
 *    route and does not leave them for strips that do not, as for any turn
 *    onto a narrower road, so nobody has to change strips at the last moment.
 *  - At a merge onto a road wide enough for both roads side by side, the two
 *    connections share no space: each stream arrives in its own strips, and
 *    vehicles sort themselves out on the road beyond by the ordinary sideways
 *    movement. Nothing has to decide who goes, and nothing can lock.
 *  - At a merge where two approaches lead onto the same strips, the junction
 *    rules already used under a signal decide: there is no signal, so every
 *    approach is treated as always green, and vehicles are let in nearest
 *    the stop line first, each only when the road beyond has room and the
 *    vehicles let in before it will be clear of the space they share (crossing
 *    paths). First come, first served: no approach has priority.
 *
 * Geometry is ours; nothing here is taken from another simulator.
 */
import { positionAlongRoad, roadLengthM } from "./geometry";
import type { Road } from "./types";

/**
 * How far the left edge of `to`, where it starts, lies to the right of the
 * left edge of `from`, where it ends, measured across `from`. Negative when it
 * lies to the left.
 */
export function sidewaysOffsetM(from: Road, to: Road): number {
  const end = positionAlongRoad(from, roadLengthM(from));
  const start = positionAlongRoad(to, 0);
  // To the right of the direction of travel (x east, y north).
  const rightX = end.direction.y;
  const rightY = -end.direction.x;
  const centreOffsetM = (start.point.x - end.point.x) * rightX + (start.point.y - end.point.y) * rightY;
  return centreOffsetM + from.widthM / 2 - to.widthM / 2;
}

export interface StripsAcross {
  stripCount: number;
  stripWidthM: number;
  /** Distance from the road's left edge to the left edge of strip 0. */
  stripOffsetM: number;
}

/**
 * The strips a connection between two roads lying one after the other has:
 * how many, and which strip of each road its first strip is. Undefined when
 * the two roads do not line up at all.
 */
export function stripsStraightOn(
  offsetM: number,
  from: StripsAcross,
  to: StripsAcross,
): { stripCount: number; fromShift: number; toShift: number } | undefined {
  // Strip 0 of `to`, counted in strips of `from` from strip 0 of `from`.
  const shift = Math.round((offsetM + to.stripOffsetM - from.stripOffsetM) / from.stripWidthM);
  const fromShift = Math.max(0, shift);
  const toShift = Math.max(0, -shift);
  const stripCount = Math.min(from.stripCount - fromShift, to.stripCount - toShift);
  return stripCount >= 1 ? { stripCount, fromShift, toShift } : undefined;
}
