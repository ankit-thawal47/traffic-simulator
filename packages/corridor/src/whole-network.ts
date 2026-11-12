/**
 * The whole corridor as one network in the engine's format (version 4).
 *
 * OpenStreetMap draws each carriageway as a line, and draws the lines of two
 * roads that divide or join to one shared node. The engine needs more than
 * that: where a road divides or roads join with no signal, the roads must lie
 * side by side, and the path between two roads needs room. So the importer
 * reconciles the two, the same way everywhere, and says in words what it did
 * (`adjustments`). Nothing is adjusted by hand in its output.
 *
 *  - Roads end to end with the same lanes, width and speed limit become one
 *    road (`network.roads` in the corrections).
 *  - Where a road divides (or two join), the two roads are one road as wide
 *    as both for as long as their widths would overlap on the ground, and at
 *    least `sideBySideMinM`. It follows the line of the main road, moved
 *    sideways by half the other road's width. Beyond it the main road keeps
 *    its line; the other road starts exactly beside it and comes back to the
 *    line OpenStreetMap draws within 25 m.
 *  - `joinGapM` is left between two roads at every join with no signal.
 *  - The roads of a signal junction drawn to one node are set back from it.
 *  - OpenStreetMap has no heights. A raised road rises from the ground at
 *    `rampGradient` from each of its ends until it is `deckHeightM` up.
 */
import type { Connection, Junction, Network, Point, Road } from "@traffic-simulator/engine";
import type { Corrections, CorridorRoad, NetworkCorrections } from "./types";

/** A centre line, with whether each stretch between two of its points is raised. */
interface Line {
  points: Point[];
  raised: boolean[];
}

interface Working {
  id: string;
  name: string;
  line: Line;
  widthM: number;
  lanes: number;
  speedLimitMps: number;
}

/** How far past the place beside the main road the other road is back on its own line, and how finely the curve between is drawn. */
const LEAD_IN_M = 5;
const BLEND_M = 20;
const CURVE_POINTS = 8;

const stretch = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

function lengthOf(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += stretch(points[i - 1]!, points[i]!);
  return total;
}

/** The place a distance along a line, the direction of travel there, and the stretch it is on. */
function placeAt(points: Point[], alongM: number): { point: Point; direction: Point; segment: number } {
  let left = Math.max(0, alongM);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const step = stretch(a, b);
    if (step === 0) continue;
    if (left <= step || i === points.length - 1) {
      const t = Math.min(1, left / step);
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        direction: { x: (b.x - a.x) / step, y: (b.y - a.y) / step },
        segment: i - 1,
      };
    }
    left -= step;
  }
  return { point: points[0]!, direction: { x: 0, y: 1 }, segment: 0 };
}

/** The part of a line between two distances along it. */
function slice(line: Line, fromM: number, toM: number): Line {
  const points: Point[] = [];
  const raised: boolean[] = [];
  let before = 0;
  for (let i = 1; i < line.points.length; i++) {
    const a = line.points[i - 1]!;
    const b = line.points[i]!;
    const step = stretch(a, b);
    const after = before + step;
    const start = Math.max(fromM, before);
    const end = Math.min(toM, after);
    if (step > 0 && end - start > 1e-6) {
      const at = (alongM: number): Point => {
        const t = (alongM - before) / step;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      };
      if (points.length === 0) points.push(at(start));
      points.push(at(end));
      raised.push(line.raised[i - 1]!);
    }
    before = after;
  }
  return { points, raised };
}

function reversed(line: Line): Line {
  return { points: line.points.slice().reverse(), raised: line.raised.slice().reverse() };
}

/** The line moved sideways, to the left of its direction: each point along the mean of the directions of the stretches it joins. */
function movedLeft(points: Point[], byM: number): Point[] {
  return points.map((point, i) => {
    const before = points[Math.max(i - 1, 0)]!;
    const after = points[Math.min(i + 1, points.length - 1)]!;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: point.x - (dy / length) * byM, y: point.y + (dx / length) * byM };
  });
}

/** The nearest place on a line to a point: how far along the line it is, and how far from the point. */
function nearestOn(points: Point[], to: Point): { alongM: number; distanceM: number } {
  let best = { alongM: 0, distanceM: Infinity };
  let before = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const step = stretch(a, b);
    if (step === 0) continue;
    const t = Math.max(0, Math.min(1, ((to.x - a.x) * (b.x - a.x) + (to.y - a.y) * (b.y - a.y)) / (step * step)));
    const distanceM = Math.hypot(to.x - a.x - (b.x - a.x) * t, to.y - a.y - (b.y - a.y) * t);
    if (distanceM < best.distanceM) best = { alongM: before + t * step, distanceM };
    before += step;
  }
  return best;
}

const metres = (value: number): string => String(Math.round(value * 10) / 10);

interface Divided {
  shared: Line;
  main: Line;
  other: Line;
  sharedM: number;
  /** How far along the main road the two are half of both widths apart. */
  apartAfterM: number;
  /** How far the start of the other road lies from the line OpenStreetMap draws. */
  movedM: number;
  /** The main road's own line for the stretch where the two are one road. */
  mainNear: Line;
  /** Which side of the main road the other lies on: +1 to its left, -1 to its right. */
  side: number;
}

/**
 * Two roads leaving one node, as one wide road followed by the two side by
 * side. Both lines run away from the node. Undefined, with a problem
 * reported, when the roads are too short for it.
 */
function divided(
  what: string,
  main: Working,
  other: Working,
  settings: { sideBySideMinM: number; joinGapM: number },
  problems: string[],
): Divided | undefined {
  const apartM = (main.widthM + other.widthM) / 2;
  const mainM = lengthOf(main.line.points);
  const otherM = lengthOf(other.line.points);
  let apartAfterM = 0;
  while (apartAfterM < mainM && nearestOn(other.line.points, placeAt(main.line.points, apartAfterM).point).distanceM < apartM) apartAfterM += 1;
  const sharedM = Math.max(settings.sideBySideMinM, apartAfterM);
  const startM = sharedM + settings.joinGapM;
  if (startM + 1 > mainM) {
    problems.push(`${what}: road "${main.id}" is ${metres(mainM)} m long, too short for ${metres(sharedM)} m as one road with "${other.id}"`);
    return undefined;
  }
  const start = placeAt(main.line.points, startM);
  const left: Point = { x: -start.direction.y, y: start.direction.x };
  const beside = nearestOn(other.line.points, start.point);
  const there = placeAt(other.line.points, beside.alongM).point;
  // Which side of the main road the other lies on: +1 to its left, -1 to its right.
  const probe = beside.distanceM > 0.5 ? there : placeAt(other.line.points, Math.min(otherM, startM + 30)).point;
  const side = (probe.x - start.point.x) * left.x + (probe.y - start.point.y) * left.y >= 0 ? 1 : -1;
  const first: Point = { x: start.point.x + left.x * side * apartM, y: start.point.y + left.y * side * apartM };
  const backOnLineM = nearestOn(other.line.points, first).alongM + LEAD_IN_M + BLEND_M;
  if (backOnLineM + 1 > otherM) {
    problems.push(`${what}: road "${other.id}" is ${metres(otherM)} m long, too short to start beside "${main.id}" after ${metres(sharedM)} m as one road`);
    return undefined;
  }
  const rest = slice(other.line, backOnLineM, otherM);
  // From beside the main road back to its own line along a smooth curve (a cubic Bezier), leaving parallel to the main road.
  const restStart = rest.points[0]!;
  const restDirection = placeAt(rest.points, 0).direction;
  const reach = stretch(first, restStart) / 3;
  const c1 = { x: first.x + start.direction.x * reach, y: first.y + start.direction.y * reach };
  const c2 = { x: restStart.x - restDirection.x * reach, y: restStart.y - restDirection.y * reach };
  const curve: Point[] = [];
  for (let k = 1; k < CURVE_POINTS; k++) {
    const t = k / CURVE_POINTS;
    const u = 1 - t;
    const at = (a: number, b: number, c: number, d: number) => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    curve.push({ x: at(first.x, c1.x, c2.x, restStart.x), y: at(first.y, c1.y, c2.y, restStart.y) });
  }
  const sharedLine = slice(main.line, 0, sharedM);
  const bothRaised = main.line.raised[0]! && other.line.raised[0]!;
  return {
    shared: { points: movedLeft(sharedLine.points, (side * other.widthM) / 2), raised: sharedLine.raised.map(() => bothRaised) },
    main: slice(main.line, startM, mainM),
    other: { points: [first, ...curve, ...rest.points], raised: [...curve.map(() => rest.raised[0]!), rest.raised[0]!, ...rest.raised] },
    sharedM,
    apartAfterM,
    movedM: nearestOn(other.line.points, first).distanceM,
    mainNear: sharedLine,
    side,
  };
}

/** The roads of the corridor put together as the engine's network, with a name for each road and what was adjusted. */
export function wholeNetwork(
  checked: CorridorRoad[],
  corrections: Corrections,
  settings: NetworkCorrections,
  problems: string[],
): { network: Network; roadNames: Record<string, string>; adjustments: string[] } {
  const adjustments: string[] = [];
  const checkedById = new Map(checked.map((road) => [road.id, road]));
  const shortNames = new Map(corrections.roads.map((road) => [road.id, road.shortName ?? road.name ?? road.id]));

  // Roads made of parts end to end; every other checked road is a road of its own.
  const working = new Map<string, Working>();
  /** The network road a checked road belongs to. */
  const roadOfPart = new Map<string, string>();
  const madeOfParts = new Map<string, { id: string; name: string; parts: string[] }>();
  for (const made of settings.roads) {
    for (const part of made.parts) roadOfPart.set(part, made.id);
    if (made.parts[0] !== undefined) madeOfParts.set(made.parts[0], made);
  }
  for (const road of checked) {
    const made = madeOfParts.get(road.id);
    if (!made && roadOfPart.has(road.id)) continue;
    const parts = made ? made.parts.map((id) => checkedById.get(id)) : [road];
    const missing = made?.parts.find((id) => !checkedById.has(id));
    if (missing !== undefined) {
      problems.push(`Road "${made!.id}" is made of "${missing}", which is not a road of the corridor`);
      continue;
    }
    const line: Line = { points: [], raised: [] };
    let sound = true;
    parts.forEach((part, at) => {
      const before = parts[at - 1];
      if (before && (before.lanes !== part!.lanes || before.widthM !== part!.widthM || before.speedLimitMps !== part!.speedLimitMps)) {
        problems.push(`Road "${made!.id}" is made of "${before.id}" and "${part!.id}", which differ in lanes, width or speed limit`);
        sound = false;
      }
      if (before && (before.toNodeId === undefined || before.toNodeId !== part!.fromNodeId)) {
        problems.push(`Road "${made!.id}": "${part!.id}" does not start where "${before.id}" ends`);
        sound = false;
      }
      const points = before ? part!.points.slice(1) : part!.points;
      for (let i = 0; i < points.length; i++) {
        if (line.points.length > 0) line.raised.push(part!.level === "raised");
        line.points.push(points[i]!);
      }
    });
    if (!sound) continue;
    const id = made?.id ?? road.id;
    working.set(id, { id, name: made?.name ?? shortNames.get(road.id)!, line, widthM: road.widthM, lanes: road.lanes, speedLimitMps: road.speedLimitMps });
    if (made) adjustments.push(`Road "${id}" is ${made.parts.map((part) => `"${part}"`).join(", ")} end to end, as one road.`);
  }

  const junctions: Junction[] = [];
  const get = (what: string, id: string): Working | undefined => {
    const road = working.get(roadOfPart.get(id) ?? id);
    if (!road) problems.push(`${what} names "${id}", which is not a road of the network`);
    return road;
  };
  const cutEnd = (road: Working, byM: number): void => {
    road.line = slice(road.line, 0, lengthOf(road.line.points) - byM);
  };
  const cutStart = (road: Working, byM: number): void => {
    road.line = slice(road.line, byM, lengthOf(road.line.points));
  };

  // Signal junctions, with their roads set back from the node where the corrections say so.
  for (const junction of corrections.junctions) {
    if (junction.control !== "signal" || !junction.signalPlan) continue;
    const what = `Junction "${junction.id}"`;
    const inNetwork = (id: string): string => roadOfPart.get(id) ?? id;
    const connections: Connection[] = junction.connections.map(({ fromRoadId, toRoadId }) => ({
      fromRoadId: inNetwork(fromRoadId),
      toRoadId: inNetwork(toRoadId),
    }));
    if (connections.some((connection) => !get(what, connection.fromRoadId) || !get(what, connection.toRoadId))) continue;
    if (junction.setBackM) {
      for (const id of new Set(connections.map((connection) => connection.fromRoadId))) cutEnd(working.get(id)!, junction.setBackM);
      for (const id of new Set(connections.map((connection) => connection.toRoadId))) cutStart(working.get(id)!, junction.setBackM);
      adjustments.push(
        `${what}: OpenStreetMap draws its roads to one node. Each is cut back ${metres(junction.setBackM)} m from it, ` +
          "so that the stop lines stand back and the turns have room.",
      );
    }
    junctions.push({
      id: junction.id,
      control: "signal",
      connections,
      signalPlan: {
        ...junction.signalPlan,
        phases: junction.signalPlan.phases.map((phase) => ({ ...phase, greenRoadIds: phase.greenRoadIds.map(inNetwork) })),
      },
    });
  }

  // The joins with no signal.
  const gapM = settings.joinGapM;
  for (const join of settings.joins) {
    const what = `Join "${join.id}"`;
    if (join.kind === "continue") {
      const from = get(what, join.fromRoadId);
      const to = get(what, join.toRoadId);
      if (!from || !to) continue;
      cutEnd(from, gapM / 2);
      cutStart(to, gapM / 2);
      junctions.push({ id: join.id, control: "none", connections: [{ fromRoadId: from.id, toRoadId: to.id }] });
      adjustments.push(`${what}: "${from.id}" ends ${metres(gapM / 2)} m before the node and "${to.id}" starts ${metres(gapM / 2)} m after it. ${join.reason}`);
      continue;
    }
    const main = get(what, join.mainRoadId);
    const other = get(what, join.otherRoadId);
    const through = join.kind === "diverge" ? join.fromRoadId : join.ontoRoadId;
    const beyond = through === undefined ? undefined : get(what, through);
    if (!main || !other || (through !== undefined && !beyond)) continue;
    if (working.has(join.shared.id)) {
      problems.push(`${what} makes road "${join.shared.id}", which is already a road of the network`);
      continue;
    }
    const merge = join.kind === "merge";
    // A merge is a diverge seen from the other end.
    const outward = (road: Working): Working => (merge ? { ...road, line: reversed(road.line) } : road);
    const leastM = join.sideBySideMinM ?? settings.sideBySideMinM;
    const result = divided(what, outward(main), outward(other), { sideBySideMinM: leastM, joinGapM: gapM }, problems);
    if (!result) continue;
    const inward = (line: Line): Line => (merge ? reversed(line) : line);
    main.line = inward(result.main);
    other.line = inward(result.other);
    if (merge && beyond && beyond.widthM < main.widthM + other.widthM) {
      // Onto a road narrower than both: no wide road between. The road beyond starts across the line between the two, so
      // each leads onto part of it and the engine lets vehicles in first come, first served; it is back on its own line 20 m past the node.
      const between = inward({ points: movedLeft(result.mainNear.points, (result.side * main.widthM) / 2), raised: result.mainNear.raised });
      const rest = slice(beyond.line, BLEND_M, lengthOf(beyond.line.points));
      beyond.line = { points: [...between.points, ...rest.points], raised: [...between.raised, rest.raised[0]!, ...rest.raised] };
      junctions.push({
        id: join.id,
        control: "none",
        connections: [
          { fromRoadId: main.id, toRoadId: beyond.id },
          { fromRoadId: other.id, toRoadId: beyond.id },
        ],
      });
      adjustments.push(
        `${what}: "${main.id}" and "${other.id}" end side by side ${metres(result.sharedM + gapM)} m before the node, "${other.id}" ` +
          `${metres(result.movedM)} m from the line OpenStreetMap draws. "${beyond.id}" starts ${metres(gapM)} m on, across the line between them ` +
          `(so each leads onto part of its width), and is on its own line again ${metres(BLEND_M)} m past the node. ` +
          `(As drawn, the two are half of both widths apart ${metres(result.apartAfterM)} m from the node; the least length is ${metres(leastM)} m.) ${join.reason}`,
      );
      continue;
    }
    const shared: Working = {
      id: join.shared.id,
      name: join.shared.name,
      line: inward(result.shared),
      widthM: main.widthM + other.widthM,
      lanes: main.lanes + other.lanes,
      speedLimitMps: main.speedLimitMps,
    };
    working.set(shared.id, shared);
    if (merge) {
      junctions.push({
        id: join.id,
        control: "none",
        connections: [
          { fromRoadId: main.id, toRoadId: shared.id },
          { fromRoadId: other.id, toRoadId: shared.id },
        ],
      });
      if (beyond) {
        cutStart(beyond, gapM);
        junctions.push({ id: `${join.id}-out`, control: "none", connections: [{ fromRoadId: shared.id, toRoadId: beyond.id }] });
      }
    } else {
      if (beyond) {
        cutEnd(beyond, gapM);
        junctions.push({ id: `${join.id}-in`, control: "none", connections: [{ fromRoadId: beyond.id, toRoadId: shared.id }] });
      }
      junctions.push({
        id: join.id,
        control: "none",
        connections: [
          { fromRoadId: shared.id, toRoadId: main.id },
          { fromRoadId: shared.id, toRoadId: other.id },
        ],
      });
    }
    const [nearNode, begins, awayFrom] = merge ? ["up to the node", "ends", "before"] : ["from the node", "starts", "beyond"];
    adjustments.push(
      `${what}: for ${metres(result.sharedM)} m ${nearNode}, "${main.id}" and "${other.id}" are one road, "${shared.id}", ` +
        `${metres(shared.widthM)} m wide with ${shared.lanes} lanes, on the line of "${main.id}" moved ${metres(other.widthM / 2)} m towards "${other.id}". ` +
        `(As drawn, their centre lines are half of both widths apart ${metres(result.apartAfterM)} m from the node; the least length is ${metres(leastM)} m.) ` +
        `"${main.id}" ${begins} ${metres(gapM)} m ${awayFrom} it on its own line. "${other.id}" ${begins} exactly beside it, ` +
        `${metres(result.movedM)} m from the line OpenStreetMap draws, and is on that line again within ${LEAD_IN_M + BLEND_M} m.` +
        (beyond ? ` "${beyond.id}" is cut back ${metres(gapM)} m from the node.` : "") +
        ` ${join.reason}`,
    );
  }

  for (const apart of settings.keepApart ?? []) {
    const what = `Keeping "${apart.roadId}" apart from "${apart.fromRoadId}"`;
    const road = get(what, apart.roadId);
    const from = get(what, apart.fromRoadId);
    if (!road || !from) continue;
    const movedM = keepApart(road, from);
    adjustments.push(
      `"${road.id}" is moved up to ${metres(movedM)} m away from "${from.id}", wherever OpenStreetMap draws the two closer than ` +
        `half of both widths (${metres((road.widthM + from.widthM) / 2)} m). ${apart.reason}`,
    );
  }

  const roads = [...working.values()];
  const heights = heightsOf(roads, junctions, settings);
  const network: Network = {
    formatVersion: 4,
    roads: roads.map((road): Road => ({
      id: road.id,
      points: heights.get(road.id)!,
      widthM: road.widthM,
      lanes: road.lanes,
      speedLimitMps: road.speedLimitMps,
    })),
    junctions,
  };
  if (roads.some((road) => road.line.raised.some(Boolean))) {
    adjustments.push(
      `Heights: OpenStreetMap has none. Each raised road rises ${settings.rampGradient * 100} m in 100 m from the ground at each of its ends ` +
        `until it is ${settings.deckHeightM} m up.`,
    );
  }
  return { network, roadNames: Object.fromEntries(roads.map((road) => [road.id, road.name])), adjustments };
}

/** How finely a road moved away from another is followed, in metres. */
const KEEP_APART_STEP_M = 10;

/**
 * Moves `road` away from `from` wherever their centre lines are closer than
 * half of both widths: each point (with points added every 10 m) goes
 * straight away from the nearest place on `from`, just far enough. Gives the
 * furthest any point moved.
 */
function keepApart(road: Working, from: Working): number {
  const needM = (road.widthM + from.widthM) / 2;
  const points: Point[] = [];
  const raised: boolean[] = [];
  for (let i = 1; i < road.line.points.length; i++) {
    const a = road.line.points[i - 1]!;
    const b = road.line.points[i]!;
    const pieces = Math.max(1, Math.ceil(stretch(a, b) / KEEP_APART_STEP_M));
    if (i === 1) points.push(a);
    for (let k = 1; k <= pieces; k++) {
      points.push({ x: a.x + ((b.x - a.x) * k) / pieces, y: a.y + ((b.y - a.y) * k) / pieces });
      raised.push(road.line.raised[i - 1]!);
    }
  }
  let mostM = 0;
  road.line = {
    raised,
    points: points.map((point) => {
      const nearest = nearestOn(from.line.points, point);
      const shortM = needM - nearest.distanceM;
      if (shortM <= 1e-6 || nearest.distanceM < 1e-6) return point;
      const on = placeAt(from.line.points, nearest.alongM).point;
      mostM = Math.max(mostM, shortM);
      const scale = needM / nearest.distanceM;
      return { x: on.x + (point.x - on.x) * scale, y: on.y + (point.y - on.y) * scale };
    }),
  };
  return mostM;
}

/**
 * The points of every road with their heights: a point on a raised stretch
 * is as high as the gradient takes it from the nearest ground, going either
 * way along raised roads, and no higher than the deck. Points are added
 * where the slope ends, so the height between two points changes evenly.
 */
function heightsOf(roads: Working[], junctions: Junction[], settings: NetworkCorrections): Map<string, Point[]> {
  const before = new Map<string, string[]>();
  const after = new Map<string, string[]>();
  for (const junction of junctions) {
    for (const { fromRoadId, toRoadId } of junction.connections) {
      after.set(fromRoadId, [...(after.get(fromRoadId) ?? []), toRoadId]);
      before.set(toRoadId, [...(before.get(toRoadId) ?? []), fromRoadId]);
    }
  }
  /** Distance to the ground from each point of a line, looking back along it; `atStart` is the distance at its first point. */
  const lookingBack = (line: Line, atStart: number): number[] => {
    const distances: number[] = [];
    for (let i = 0; i < line.points.length; i++) {
      const raisedBefore = i === 0 ? atStart > 0 : line.raised[i - 1]!;
      const raisedAfter = i === line.points.length - 1 ? true : line.raised[i]!;
      if (!raisedBefore || !raisedAfter) distances.push(0);
      else distances.push(i === 0 ? atStart : distances[i - 1]! + stretch(line.points[i - 1]!, line.points[i]!));
    }
    return distances;
  };
  // Distance to the ground at each road's start (looking back) and end (looking on), through the roads it joins.
  const atStart = new Map<string, number>();
  const atEnd = new Map<string, number>();
  for (const road of roads) {
    atStart.set(road.id, road.line.raised[0] && before.has(road.id) ? Infinity : 0);
    atEnd.set(road.id, road.line.raised[road.line.raised.length - 1] && after.has(road.id) ? Infinity : 0);
  }
  for (let pass = 0; pass < roads.length; pass++) {
    for (const road of roads) {
      if (road.line.raised[0] && before.has(road.id)) {
        const nearest = Math.min(
          ...before.get(road.id)!.map((id) => {
            const feeder = roads.find((one) => one.id === id)!;
            return lookingBack(feeder.line, atStart.get(id)!).at(-1)!;
          }),
        );
        atStart.set(road.id, nearest);
      }
      if (road.line.raised[road.line.raised.length - 1] && after.has(road.id)) {
        const nearest = Math.min(
          ...after.get(road.id)!.map((id) => {
            const next = roads.find((one) => one.id === id)!;
            return lookingBack(reversed(next.line), atEnd.get(id)!).at(-1)!;
          }),
        );
        atEnd.set(road.id, nearest);
      }
    }
  }

  const slopeM = settings.deckHeightM / settings.rampGradient;
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  const result = new Map<string, Point[]>();
  for (const road of roads) {
    const line = road.line;
    const back = lookingBack(line, atStart.get(road.id)!);
    const on = lookingBack(reversed(line), atEnd.get(road.id)!).reverse();
    const heightAt = (toGroundM: number): number => Math.min(settings.deckHeightM, settings.rampGradient * toGroundM);
    const points: Point[] = [];
    const add = (point: Point, toGroundM: number): void => {
      const z = round(heightAt(toGroundM));
      points.push(z > 0 ? { x: round(point.x), y: round(point.y), z } : { x: round(point.x), y: round(point.y) });
    };
    for (let i = 0; i < line.points.length; i++) {
      add(line.points[i]!, Math.min(back[i]!, on[i]!));
      if (i === line.points.length - 1 || !line.raised[i]) continue;
      // Along a raised stretch the distance to the ground is the lesser of two straight lines: where the slope ends, add a point.
      const a = line.points[i]!;
      const b = line.points[i + 1]!;
      const step = stretch(a, b);
      const fromBack = back[i]!;
      const fromOn = on[i + 1]!;
      const highest = (fromOn + step - fromBack) / 2;
      const breaks = [highest, ...(slopeM - fromBack < highest ? [slopeM - fromBack, step - (slopeM - fromOn)] : [])]
        .filter((alongM) => alongM > 0.5 && alongM < step - 0.5)
        .sort((p, q) => p - q)
        .filter((alongM, at, all) => at === 0 || alongM - all[at - 1]! > 0.5);
      for (const alongM of breaks) {
        const toGroundM = Math.min(fromBack + alongM, fromOn + step - alongM);
        // A point in the middle of the level deck changes nothing.
        if (toGroundM > slopeM + 1e-6) continue;
        const t = alongM / step;
        add({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, toGroundM);
      }
    }
    result.set(road.id, points);
  }
  return result;
}
