/**
 * What a road and a junction are drawn with, as plain lists of triangle
 * corners in scene coordinates: ground (x east, y north) and height map to the
 * scene as (x, height, -y), as in RoadScene. No three.js here, so it can be
 * checked from the command line; RoadScene turns the lists into meshes.
 *
 * Heights come from the engine's roadHeightM(), which also places the
 * vehicles, so a line painted on a flyover's ramp lies on the ramp.
 */
import { positionAlongRoad, roadHeightM, roadLengthM, type Junction, type Network, type Point, type Road } from "@traffic-simulator/engine";

/** A strip along a road: its middle `acrossM` to the left of the centreline (negative: to the right), from `fromM` to `toM` along it. */
export interface Strip {
  acrossM: number;
  widthM: number;
  fromM: number;
  toM: number;
}

export interface Marking extends Strip {
  kind: "edge" | "lane";
}

/** Paint, after IRC 35 (road markings): lines 0.15 m wide; a broken lane line is 3 m painted and 4.5 m gap. */
const LINE_WIDTH_M = 0.15;
const DASH_M = 3;
const GAP_M = 4.5;
/** The edge line's middle is this far in from the edge of the carriageway, inside the kerb. */
const EDGE_LINE_IN_M = 0.35;
/** A strip is cut into pieces no longer than this, so it follows bends and ramps. */
const PIECE_M = 6;

/**
 * The lines painted on a road: a solid line along each edge and a broken line
 * between lanes, where traffic keeps to marked lanes. Where traffic is mixed
 * (no lane discipline), or the road has no marked lanes, there are none: the
 * view then shows what the engine runs, a road used across its whole width.
 */
export function laneMarkings(road: Road, laneDiscipline: boolean): Marking[] {
  if (!laneDiscipline || !road.lanes) return [];
  const lengthM = roadLengthM(road);
  const half = road.widthM / 2;
  const edge = Math.round((half - EDGE_LINE_IN_M) * 1000) / 1000;
  const marks: Marking[] = [
    { kind: "edge", acrossM: -edge, widthM: LINE_WIDTH_M, fromM: 0, toM: lengthM },
    { kind: "edge", acrossM: edge, widthM: LINE_WIDTH_M, fromM: 0, toM: lengthM },
  ];
  for (let lane = 1; lane < road.lanes; lane++) {
    const acrossM = Math.round((half - (lane * road.widthM) / road.lanes) * 1000) / 1000;
    for (let fromM = 0; fromM < lengthM; fromM += DASH_M + GAP_M) {
      marks.push({ kind: "lane", acrossM, widthM: LINE_WIDTH_M, fromM, toM: Math.min(lengthM, fromM + DASH_M) });
    }
  }
  return marks;
}

/** The road's direction at a distance along it, smoothed across a bend so strips do not tear at a corner. */
function frameAt(road: Road, distanceM: number, lengthM: number) {
  const { point } = positionAlongRoad(road, distanceM);
  const behind = positionAlongRoad(road, Math.max(0, distanceM - 0.5)).point;
  const ahead = positionAlongRoad(road, Math.min(lengthM, distanceM + 0.5)).point;
  let dx = ahead.x - behind.x;
  let dy = ahead.y - behind.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) ({ x: dx, y: dy } = positionAlongRoad(road, distanceM).direction);
  else {
    dx /= length;
    dy /= length;
  }
  return { point, left: { x: -dy, y: dx }, heightM: roadHeightM(road, distanceM) };
}

/** The distances at which a strip is cut: its ends, every corner of the road between them, and every PIECE_M. */
function cutsAlong(road: Road, fromM: number, toM: number): number[] {
  const cuts = new Set<number>([fromM, toM]);
  let at = 0;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!;
    const b = road.points[i]!;
    at += Math.hypot(b.x - a.x, b.y - a.y);
    if (at > fromM && at < toM) cuts.add(at);
  }
  const pieces = Math.ceil((toM - fromM) / PIECE_M);
  for (let i = 1; i < pieces; i++) cuts.add(fromM + ((toM - fromM) * i) / pieces);
  return [...cuts].sort((a, b) => a - b);
}

/** A strip as triangles facing up, `liftM` above the road's surface; added to `into`. */
export function stripTriangles(road: Road, strip: Strip, liftM: number, into: number[]): void {
  const lengthM = roadLengthM(road);
  const fromM = Math.max(0, strip.fromM);
  const toM = Math.min(lengthM, strip.toM);
  if (toM <= fromM) return;
  const corner = (distanceM: number) => {
    const { point, left, heightM } = frameAt(road, distanceM, lengthM);
    const y = heightM + liftM;
    const inner = strip.acrossM - strip.widthM / 2;
    const outer = strip.acrossM + strip.widthM / 2;
    return {
      right: [point.x + left.x * inner, y, -(point.y + left.y * inner)],
      left: [point.x + left.x * outer, y, -(point.y + left.y * outer)],
    };
  };
  const cuts = cutsAlong(road, fromM, toM);
  let before = corner(cuts[0]!);
  for (let i = 1; i < cuts.length; i++) {
    const after = corner(cuts[i]!);
    // Anticlockwise seen from above, so the face points up.
    into.push(...before.right, ...after.right, ...after.left, ...before.right, ...after.left, ...before.left);
    before = after;
  }
}

/** The road's carriageway, its whole width, as triangles facing up. */
export function roadSurface(road: Road): number[] {
  const into: number[] = [];
  stripTriangles(road, { acrossM: 0, widthM: road.widthM, fromM: 0, toM: Infinity }, 0, into);
  return into;
}

const KERB_WIDTH_M = 0.2;
const KERB_HEIGHT_M = 0.15;

/**
 * The kerbs along both edges of a road on the ground: a low raised strip just
 * inside each edge, so two carriageways side by side show a narrow median.
 * Each is a top and its two sides; added to `into`.
 */
export function kerbTriangles(road: Road, into: number[]): void {
  const half = road.widthM / 2;
  for (const side of [-1, 1]) {
    const acrossM = side * (half - KERB_WIDTH_M / 2);
    stripTriangles(road, { acrossM, widthM: KERB_WIDTH_M, fromM: 0, toM: Infinity }, KERB_HEIGHT_M, into);
    // The two upright sides: each a strip of the top's edge, dropped to the road.
    for (const edge of [acrossM - KERB_WIDTH_M / 2, acrossM + KERB_WIDTH_M / 2]) {
      const top: number[] = [];
      stripTriangles(road, { acrossM: edge, widthM: 0, fromM: 0, toM: Infinity }, KERB_HEIGHT_M, top);
      // Each piece of a zero-width strip has corners right, right', left', right, left', left at one place across;
      // its first two corners (before and after) give the top edge of an upright face.
      for (let i = 0; i < top.length; i += 18) {
        const a = top.slice(i, i + 3);
        const b = top.slice(i + 3, i + 6);
        const a0 = [a[0]!, a[1]! - KERB_HEIGHT_M, a[2]!];
        const b0 = [b[0]!, b[1]! - KERB_HEIGHT_M, b[2]!];
        into.push(...a0, ...b0, ...b, ...a0, ...b, ...a);
      }
    }
  }
}

/** A point of a cubic Bezier curve. */
function bezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const s = 1 - t;
  return {
    x: s * s * s * p0.x + 3 * s * s * t * p1.x + 3 * s * t * t * p2.x + t * t * t * p3.x,
    y: s * s * s * p0.y + 3 * s * s * t * p1.y + 3 * s * t * t * p2.y + t * t * t * p3.y,
  };
}

const JUNCTION_PIECES = 10;

/**
 * The surface of a junction: for each connection, the ground swept from the
 * whole width of the road it leaves to the whole width of the road it joins,
 * each edge a smooth curve that leaves and joins along the roads. Together
 * these cover where vehicles turn and no more, and not the whole outline
 * round the ends of every road, which at a large junction is a wide patch.
 * As triangles facing up.
 */
export function junctionSurface(network: Network, junction: Junction): number[] {
  const roads = new Map(network.roads.map((road) => [road.id, road]));
  const into: number[] = [];
  for (const connection of junction.connections) {
    const from = roads.get(connection.fromRoadId);
    const to = roads.get(connection.toRoadId);
    if (!from || !to) continue;
    const fromLength = roadLengthM(from);
    const end = positionAlongRoad(from, fromLength);
    const start = positionAlongRoad(to, 0);
    const heightFrom = roadHeightM(from, fromLength);
    const heightTo = roadHeightM(to, 0);
    const edges = [1, -1].map((side) => {
      const p0 = { x: end.point.x - end.direction.y * side * (from.widthM / 2), y: end.point.y + end.direction.x * side * (from.widthM / 2) };
      const p3 = { x: start.point.x - start.direction.y * side * (to.widthM / 2), y: start.point.y + start.direction.x * side * (to.widthM / 2) };
      // The curve leaves along the first road and joins along the second, a third of the way across each.
      const reach = Math.hypot(p3.x - p0.x, p3.y - p0.y) / 3;
      const p1 = { x: p0.x + end.direction.x * reach, y: p0.y + end.direction.y * reach };
      const p2 = { x: p3.x - start.direction.x * reach, y: p3.y - start.direction.y * reach };
      return [p0, p1, p2, p3] as const;
    });
    const [left, right] = edges as [readonly [Point, Point, Point, Point], readonly [Point, Point, Point, Point]];
    const at = (curve: readonly [Point, Point, Point, Point], t: number) => {
      const point = bezier(curve[0], curve[1], curve[2], curve[3], t);
      return [point.x, heightFrom + (heightTo - heightFrom) * t, -point.y];
    };
    for (let i = 0; i < JUNCTION_PIECES; i++) {
      const t0 = i / JUNCTION_PIECES;
      const t1 = (i + 1) / JUNCTION_PIECES;
      const r0 = at(right, t0);
      const r1 = at(right, t1);
      const l0 = at(left, t0);
      const l1 = at(left, t1);
      into.push(...r0, ...r1, ...l1, ...r0, ...l1, ...l0);
    }
  }
  return into;
}
