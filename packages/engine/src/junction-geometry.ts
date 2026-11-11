/**
 * Where things are inside a junction. The engine, the consistency checks and
 * the 3D view all take the shape of a turning path from here, so they agree.
 *
 * A connection's turning path is a band from the end of one road to the start
 * of another. Its shape is fixed by one reference line, a cubic Bezier curve
 * along the band's edge on the inside of the turn (the left edge for a left
 * turn or straight on, the right edge for a right turn; this is left-hand
 * traffic, so the left turn is the near-side one). Every other line across the
 * band is that reference line moved sideways, outwards, by a set distance, so
 * the band keeps its width round the turn. Geometry is ours; nothing here is
 * taken from another simulator.
 */
import { positionAlongRoad, roadLengthM } from "./geometry";
import type { Junction, Network, Point, Road, SignalPlan, VehicleState } from "./types";

export type TurnDirection = "left" | "straight" | "right";

/** Turns of less than this are "straight". */
const STRAIGHT_WITHIN_RAD = Math.PI / 6;
/** Length of the pieces a turning path is cut into for measuring it and for finding where paths cross, in metres (about). */
const PIECE_LENGTH_M = 1;

export interface TurningPath {
  junctionId: string;
  fromRoadId: string;
  toRoadId: string;
  direction: TurnDirection;
  /** How far the heading turns, in radians: positive to the left. */
  turnRad: number;
  /** The number of equal steps of the path's parameter that it is cut into. */
  pieces: number;
  /** The reference line's four Bezier control points. */
  control: [Point, Point, Point, Point];
  /** Where the reference line is across each road, from the road's left edge. */
  referenceFromLateralM: number;
  referenceToLateralM: number;
  curves: Map<string, TurningCurve>;
}

/** One line along a turning path: the line a vehicle's centre follows, given where it is across each road. */
export interface TurningCurve {
  path: TurningPath;
  fromLateralM: number;
  toLateralM: number;
  lengthM: number;
  /** Distance along the line at each of the path's `pieces + 1` parameter steps. */
  arcM: number[];
}

/** Unit vector to the right of a direction of travel (x east, y north). */
function rightOf(direction: Point): Point {
  return { x: direction.y, y: -direction.x };
}

/** The point across a road's end (or start), at a distance from the road's left edge. */
function pointAcross(at: { point: Point; direction: Point }, widthM: number, lateralM: number): Point {
  const right = rightOf(at.direction);
  const offset = lateralM - widthM / 2;
  return { x: at.point.x + right.x * offset, y: at.point.y + right.y * offset };
}

export function createTurningPath(junctionId: string, from: Road, to: Road): TurningPath {
  const end = positionAlongRoad(from, roadLengthM(from));
  const start = positionAlongRoad(to, 0);
  const cross = end.direction.x * start.direction.y - end.direction.y * start.direction.x;
  const dot = end.direction.x * start.direction.x + end.direction.y * start.direction.y;
  const turnRad = Math.atan2(cross, dot);
  const direction: TurnDirection = Math.abs(turnRad) < STRAIGHT_WITHIN_RAD ? "straight" : turnRad > 0 ? "left" : "right";

  const referenceFromLateralM = direction === "right" ? from.widthM : 0;
  const referenceToLateralM = direction === "right" ? to.widthM : 0;
  const p0 = pointAcross(end, from.widthM, referenceFromLateralM);
  const p3 = pointAcross(start, to.widthM, referenceToLateralM);
  const chord = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  if (chord < 0.5) {
    throw new Error(`The turn from road "${from.id}" to road "${to.id}" is too tight: the two roads' edges meet`);
  }
  // 0.39 of the chord makes a quarter turn close to a circular arc.
  const handle = 0.39 * chord;
  const p1 = { x: p0.x + end.direction.x * handle, y: p0.y + end.direction.y * handle };
  const p2 = { x: p3.x - start.direction.x * handle, y: p3.y - start.direction.y * handle };

  const path: TurningPath = {
    junctionId,
    fromRoadId: from.id,
    toRoadId: to.id,
    direction,
    turnRad,
    pieces: 8,
    control: [p0, p1, p2, p3],
    referenceFromLateralM,
    referenceToLateralM,
    curves: new Map(),
  };
  // Cut it into pieces of about PIECE_LENGTH_M along its longer edge.
  const farFrom = direction === "right" ? 0 : from.widthM;
  const farTo = direction === "right" ? 0 : to.widthM;
  let longest = 0;
  for (const [fromLateralM, toLateralM] of [
    [referenceFromLateralM, referenceToLateralM],
    [farFrom, farTo],
  ] as const) {
    let length = 0;
    let previous = pointOnTurningPath(path, fromLateralM, toLateralM, 0);
    for (let k = 1; k <= 32; k++) {
      const point = pointOnTurningPath(path, fromLateralM, toLateralM, k / 32);
      length += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    longest = Math.max(longest, length);
  }
  path.pieces = Math.min(120, Math.max(8, Math.ceil(longest / PIECE_LENGTH_M)));
  return path;
}

/**
 * The point on a turning path at parameter t (0 at the stop line, 1 where the
 * next road starts), for a line that is `fromLateralM` from the left edge of
 * the road it leaves and `toLateralM` from the left edge of the road it joins.
 */
export function pointOnTurningPath(path: TurningPath, fromLateralM: number, toLateralM: number, t: number): Point {
  const [p0, p1, p2, p3] = path.control;
  const u = 1 - t;
  const x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
  const y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
  const dx = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const dy = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  const speed = Math.hypot(dx, dy);
  // The sideways distance changes smoothly from its value on the first road to its value on the second.
  const blend = t * t * (3 - 2 * t);
  const offset =
    (1 - blend) * (fromLateralM - path.referenceFromLateralM) + blend * (toLateralM - path.referenceToLateralM);
  // To the right of the direction of travel.
  return { x: x + (dy / speed) * offset, y: y - (dx / speed) * offset };
}

/** The line along a turning path for one place across it. Lines are kept, so asking again is cheap. */
export function turningCurve(path: TurningPath, fromLateralM: number, toLateralM: number): TurningCurve {
  const key = `${fromLateralM}:${toLateralM}`;
  let curve = path.curves.get(key);
  if (!curve) {
    const arcM = [0];
    let previous = pointOnTurningPath(path, fromLateralM, toLateralM, 0);
    for (let k = 1; k <= path.pieces; k++) {
      const point = pointOnTurningPath(path, fromLateralM, toLateralM, k / path.pieces);
      arcM.push(arcM[k - 1]! + Math.hypot(point.x - previous.x, point.y - previous.y));
      previous = point;
    }
    curve = { path, fromLateralM, toLateralM, lengthM: arcM[path.pieces]!, arcM };
    path.curves.set(key, curve);
  }
  return curve;
}

/** The path parameter at a distance along a turning curve; 0 before its start and 1 beyond its end. */
export function curveParameter(curve: TurningCurve, distanceM: number): number {
  if (distanceM <= 0) return 0;
  if (distanceM >= curve.lengthM) return 1;
  const { arcM } = curve;
  let low = 0;
  let high = arcM.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (arcM[middle]! <= distanceM) low = middle;
    else high = middle;
  }
  const span = arcM[high]! - arcM[low]!;
  return (low + (span > 0 ? (distanceM - arcM[low]!) / span : 0)) / (arcM.length - 1);
}

/** The distance along a turning curve at a path parameter between 0 and 1. */
export function curveDistanceM(curve: TurningCurve, t: number): number {
  const pieces = curve.arcM.length - 1;
  const at = Math.min(1, Math.max(0, t)) * pieces;
  const low = Math.min(pieces - 1, Math.floor(at));
  return curve.arcM[low]! + (curve.arcM[low + 1]! - curve.arcM[low]!) * (at - low);
}

export type SignalState = "green" | "amber" | "red";

export interface SignalAspect {
  state: SignalState;
  /** Seconds until this state ends for the approach. */
  remainingS: number;
}

/** Slack for times that are whole numbers of steps but not exact in floating point. */
const TIME_SLACK_S = 1e-6;

export function signalCycleS(plan: SignalPlan): number {
  let cycle = 0;
  for (const phase of plan.phases) cycle += phase.greenS + plan.amberS + plan.allRedS;
  return cycle;
}

/** What an approach's signal shows at a moment of a run, and for how much longer. */
export function signalAspect(plan: SignalPlan, approachRoadId: string, timeS: number): SignalAspect {
  const cycle = signalCycleS(plan);
  let into = (timeS + (plan.offsetS ?? 0)) % cycle;
  if (into < 0) into += cycle;
  if (cycle - into < TIME_SLACK_S) into = 0;
  // Walk the phases in order through this cycle and the next. The first of the
  // approach's phases whose amber has not ended yet tells what it shows now.
  let start = 0;
  for (let i = 0; i < plan.phases.length * 2; i++) {
    const phase = plan.phases[i % plan.phases.length]!;
    const greenEnd = start + phase.greenS;
    const amberEnd = greenEnd + plan.amberS;
    if (phase.greenRoadIds.includes(approachRoadId) && into < amberEnd - TIME_SLACK_S) {
      if (into < start - TIME_SLACK_S) return { state: "red", remainingS: start - into };
      if (into < greenEnd - TIME_SLACK_S) return { state: "green", remainingS: greenEnd - into };
      return { state: "amber", remainingS: amberEnd - into };
    }
    start = amberEnd + plan.allRedS;
  }
  return { state: "red", remainingS: Infinity };
}

/** What an approach's signal shows at a moment of a run. */
export function signalState(plan: SignalPlan, approachRoadId: string, timeS: number): SignalState {
  return signalAspect(plan, approachRoadId, timeS).state;
}

/** The roads and turning paths of a network, ready for working out where vehicles are. */
export interface NetworkLayout {
  roads: Map<string, { road: Road; lengthM: number }>;
  junctions: Junction[];
  turningPath(fromRoadId: string, toRoadId: string): TurningPath | undefined;
}

export function createNetworkLayout(network: Network): NetworkLayout {
  const roads = new Map(network.roads.map((road) => [road.id, { road, lengthM: roadLengthM(road) }]));
  const paths = new Map<string, TurningPath>();
  const junctions = network.junctions ?? [];
  for (const junction of junctions) {
    for (const connection of junction.connections) {
      const from = roads.get(connection.fromRoadId);
      const to = roads.get(connection.toRoadId);
      if (!from || !to) continue;
      paths.set(JSON.stringify([from.road.id, to.road.id]), createTurningPath(junction.id, from.road, to.road));
    }
  }
  return {
    roads,
    junctions,
    turningPath: (fromRoadId, toRoadId) => paths.get(JSON.stringify([fromRoadId, toRoadId])),
  };
}

export interface VehiclePose {
  /** The middle of the vehicle. */
  centre: Point;
  /** Unit vector in the direction the vehicle faces. */
  direction: Point;
}

/**
 * How far the front bumper of a vehicle in a junction is along its turning
 * curve: negative before the stop line, more than the curve's length once on the next road.
 */
function distanceAlongTurnM(layout: NetworkLayout, vehicle: VehicleState, curve: TurningCurve): number {
  const turn = vehicle.turn!;
  if (vehicle.roadId === turn.toRoadId) return curve.lengthM + vehicle.positionM;
  return vehicle.positionM - (layout.roads.get(turn.fromRoadId)?.lengthM ?? 0);
}

function curveOf(layout: NetworkLayout, vehicle: VehicleState): TurningCurve | undefined {
  const turn = vehicle.turn;
  if (!turn) return undefined;
  const path = layout.turningPath(turn.fromRoadId, turn.toRoadId);
  return path && turningCurve(path, turn.fromLateralM, turn.toLateralM);
}

function poseOnRoad(road: Road, distanceM: number, lateralM: number): VehiclePose {
  const at = positionAlongRoad(road, distanceM);
  return { centre: pointAcross(at, road.widthM, lateralM), direction: at.direction };
}

/** Where a vehicle's middle is on the ground and which way it faces, on a road or inside a junction. */
export function vehiclePose(layout: NetworkLayout, vehicle: VehicleState): VehiclePose | undefined {
  const curve = curveOf(layout, vehicle);
  if (!curve || !vehicle.turn) {
    const road = layout.roads.get(vehicle.roadId);
    return road && poseOnRoad(road.road, vehicle.positionM - vehicle.lengthM / 2, vehicle.lateralM);
  }
  const from = layout.roads.get(vehicle.turn.fromRoadId);
  const to = layout.roads.get(vehicle.turn.toRoadId);
  if (!from || !to) return undefined;
  const middleM = distanceAlongTurnM(layout, vehicle, curve) - vehicle.lengthM / 2;
  if (middleM <= 0) return poseOnRoad(from.road, from.lengthM + middleM, curve.fromLateralM);
  if (middleM >= curve.lengthM) return poseOnRoad(to.road, middleM - curve.lengthM, curve.toLateralM);
  const t = curveParameter(curve, middleM);
  const centre = pointOnTurningPath(curve.path, curve.fromLateralM, curve.toLateralM, t);
  const before = pointOnTurningPath(curve.path, curve.fromLateralM, curve.toLateralM, Math.max(0, t - 0.01));
  const after = pointOnTurningPath(curve.path, curve.fromLateralM, curve.toLateralM, Math.min(1, t + 0.01));
  const length = Math.hypot(after.x - before.x, after.y - before.y);
  return { centre, direction: { x: (after.x - before.x) / length, y: (after.y - before.y) / length } };
}

/**
 * The ground a vehicle covers inside a junction, as a chain of four-sided
 * pieces from its rear bumper to its front bumper. Inside a junction a
 * vehicle's footprint follows its turning curve: it is as long as the vehicle
 * along the curve and as wide as the vehicle across it. Parts of the vehicle
 * still on the road behind, or already on the road ahead, are left out.
 * Empty for a vehicle that is not in a junction.
 */
export function footprintInJunction(layout: NetworkLayout, vehicle: VehicleState): Point[][] {
  const curve = curveOf(layout, vehicle);
  if (!curve) return [];
  const frontM = distanceAlongTurnM(layout, vehicle, curve);
  const rearM = frontM - vehicle.lengthM;
  if (frontM <= 0 || rearM >= curve.lengthM) return [];
  const pieces = curve.path.pieces;
  const first = curveParameter(curve, rearM);
  const last = curveParameter(curve, frontM);
  const cuts = [first];
  for (let k = Math.floor(first * pieces) + 1; k / pieces < last; k++) cuts.push(k / pieces);
  cuts.push(last);
  const half = vehicle.widthM / 2;
  const edge = (t: number, side: number) =>
    pointOnTurningPath(curve.path, curve.fromLateralM + side * half, curve.toLateralM + side * half, t);
  const quads: Point[][] = [];
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1]!;
    const b = cuts[i]!;
    if (b - a < 1e-12) continue;
    quads.push([edge(a, -1), edge(b, -1), edge(b, 1), edge(a, 1)]);
  }
  return quads;
}

/** Whether two convex shapes overlap by more than a hair (shapes that only touch do not). */
export function convexShapesOverlap(a: Point[], b: Point[], slackM = 1e-6): boolean {
  for (const shape of [a, b]) {
    for (let i = 0; i < shape.length; i++) {
      const p = shape[i]!;
      const q = shape[(i + 1) % shape.length]!;
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      const length = Math.hypot(nx, ny);
      if (length === 0) continue;
      let minA = Infinity;
      let maxA = -Infinity;
      for (const point of a) {
        const d = (point.x * nx + point.y * ny) / length;
        if (d < minA) minA = d;
        if (d > maxA) maxA = d;
      }
      let minB = Infinity;
      let maxB = -Infinity;
      for (const point of b) {
        const d = (point.x * nx + point.y * ny) / length;
        if (d < minB) minB = d;
        if (d > maxB) maxB = d;
      }
      if (maxA <= minB + slackM || maxB <= minA + slackM) return false;
    }
  }
  return true;
}
