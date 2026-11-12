/**
 * The corridor importer (spec: Modules, Corridor importer). OpenStreetMap
 * supplies the shape of each road; the corrections file, checked by hand,
 * supplies which ways make up the corridor and every value OpenStreetMap
 * cannot be trusted for: lanes, usable width, level, speed limit, and the
 * connections and signal plan of each junction.
 */
import type { Junction, Network, Point, Road } from "@traffic-simulator/engine";
import type {
  Corrections,
  CorridorRoad,
  ImportedCorridor,
  JunctionCorrection,
  OsmAsChecked,
  OsmExtract,
  OsmNode,
  OsmWay,
  RoadCorrection,
} from "./types";

const METRES_PER_DEGREE = 111_320;
/** How far apart, along OpenStreetMap ways, the two ends of a connection may be. */
const CONNECTION_REACH_M = 250;
const CHECKED_TAGS = ["lanes", "width", "layer", "bridge", "oneway", "maxspeed"] as const;

interface Extract {
  nodes: Map<number, OsmNode>;
  ways: Map<number, OsmWay>;
}

export function importCorridor(osm: OsmExtract, corrections: Corrections): ImportedCorridor {
  const extract: Extract = { nodes: new Map(), ways: new Map() };
  for (const element of osm.elements) {
    if (element.type === "node") extract.nodes.set(element.id, element);
    else if (element.type === "way") extract.ways.set(element.id, element);
  }
  const project = projection(corrections.origin);
  const problems: string[] = [];

  const roads: CorridorRoad[] = [];
  for (const correction of corrections.roads) {
    const road = importRoad(correction, extract, project, problems);
    if (road) roads.push(road);
  }

  const byId = new Map(roads.map((road) => [road.id, road]));
  const junctions: Junction[] = [];
  for (const junction of corrections.junctions) {
    const sound = checkJunction(junction, byId, extract, project, problems);
    if (sound && junction.control === "signal" && junction.signalPlan) {
      junctions.push({
        id: junction.id,
        control: "signal",
        connections: junction.connections.map(({ fromRoadId, toRoadId }) => ({ fromRoadId, toRoadId })),
        signalPlan: junction.signalPlan,
      });
    }
  }

  const groundNetwork: Network = {
    formatVersion: 3,
    roads: roads.filter((road) => road.level === "ground").map(engineRoad),
    junctions,
  };
  return { corridorId: corrections.corridorId, name: corrections.name, roads, junctions: corrections.junctions, groundNetwork, problems };
}

function engineRoad(road: CorridorRoad): Road {
  return { id: road.id, points: road.points, widthM: road.widthM, lanes: road.lanes, speedLimitMps: road.speedLimitMps };
}

type Projection = (node: OsmNode) => Point;

/** Metres east and north of the origin. Good to a few centimetres over a corridor a few kilometres long. */
function projection(origin: { lat: number; lon: number }): Projection {
  const eastPerDegree = METRES_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180);
  return (node) => ({ x: (node.lon - origin.lon) * eastPerDegree, y: (node.lat - origin.lat) * METRES_PER_DEGREE });
}

function importRoad(correction: RoadCorrection, extract: Extract, project: Projection, problems: string[]): CorridorRoad | undefined {
  const name = `Road "${correction.id}"`;
  let nodeIds: number[] = [];
  let previous: OsmWay | undefined;
  for (const wayId of correction.wayIds) {
    const way = extract.ways.get(wayId);
    if (!way) {
      problems.push(`${name} names way ${wayId}, which is not in the OpenStreetMap extract`);
      return undefined;
    }
    if (previous && previous.nodes[previous.nodes.length - 1] !== way.nodes[0]) {
      problems.push(`${name}: way ${wayId} does not start where way ${previous.id} ends`);
      return undefined;
    }
    nodeIds = nodeIds.concat(previous ? way.nodes.slice(1) : way.nodes);
    previous = way;
  }
  for (const checked of correction.osmAsChecked ?? []) checkTags(name, checked, extract, problems);

  if (correction.fromNodeId !== undefined) {
    const at = nodeIds.indexOf(correction.fromNodeId);
    if (at < 0) {
      problems.push(`${name} starts at node ${correction.fromNodeId}, which is not on its ways`);
      return undefined;
    }
    nodeIds = nodeIds.slice(at);
  }
  if (correction.toNodeId !== undefined) {
    const at = nodeIds.indexOf(correction.toNodeId);
    if (at < 0) {
      problems.push(`${name} ends at node ${correction.toNodeId}, which is not on its ways after its start`);
      return undefined;
    }
    nodeIds = nodeIds.slice(0, at + 1);
  }
  if (correction.reversed) nodeIds = nodeIds.slice().reverse();

  let points = nodeIds.map((id) => project(extract.nodes.get(id)!));
  let fromNodeId: number | undefined = nodeIds[0];
  let toNodeId: number | undefined = nodeIds[nodeIds.length - 1];
  if (correction.offsetLeftM) points = movedLeft(points, correction.offsetLeftM);
  if (correction.keepLastM !== undefined && lengthM(points) > correction.keepLastM) {
    points = firstStretch(points.slice().reverse(), correction.keepLastM).reverse();
    fromNodeId = undefined;
  }
  if (correction.keepFirstM !== undefined && lengthM(points) > correction.keepFirstM) {
    points = firstStretch(points, correction.keepFirstM);
    toNodeId = undefined;
  }
  if (points.length < 2) {
    problems.push(`${name} has no length`);
    return undefined;
  }

  return {
    id: correction.id,
    ...(correction.name === undefined ? {} : { name: correction.name }),
    level: correction.level,
    points: points.map(rounded),
    lengthM: lengthM(points),
    widthM: correction.widthM,
    lanes: correction.lanes,
    speedLimitMps: correction.speedLimitKmh / 3.6,
    wayIds: correction.wayIds,
    ...(fromNodeId === undefined ? {} : { fromNodeId }),
    ...(toNodeId === undefined ? {} : { toNodeId }),
  };
}

/** To the millimetre: the file stays short, and the same on every machine. */
function rounded(point: Point): Point {
  return { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000 };
}

function checkTags(name: string, checked: OsmAsChecked, extract: Extract, problems: string[]): void {
  const tags = extract.ways.get(checked.wayId)?.tags ?? {};
  for (const tag of CHECKED_TAGS) {
    const was = checked[tag];
    const is = tags[tag];
    if (was === is) continue;
    const before = was === undefined ? `no ${tag}` : `${tag}=${was}`;
    const now = is === undefined ? `no ${tag}` : `${tag}=${is}`;
    problems.push(`${name}: way ${checked.wayId} had ${before} when it was checked by hand; the extract has ${now}`);
  }
}

function lengthM(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return total;
}

/** The first `keepM` metres of a line. */
function firstStretch(points: Point[], keepM: number): Point[] {
  const kept: Point[] = [points[0]!];
  let left = keepM;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const step = Math.hypot(b.x - a.x, b.y - a.y);
    if (step >= left) {
      const t = left / step;
      kept.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      return kept;
    }
    kept.push(b);
    left -= step;
  }
  return kept;
}

/** The line moved sideways, to the left of its direction: each point along the mean of the directions of the segments it joins. */
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

/** Reports what is wrong with a junction; true when nothing is. */
function checkJunction(
  junction: JunctionCorrection,
  roads: Map<string, CorridorRoad>,
  extract: Extract,
  project: Projection,
  problems: string[],
): boolean {
  const before = problems.length;
  const name = `Junction "${junction.id}"`;
  if (junction.control === "signal" && !junction.signalPlan) problems.push(`${name} is a signal junction with no signal plan`);
  for (const connection of junction.connections) {
    const from = roads.get(connection.fromRoadId);
    const to = roads.get(connection.toRoadId);
    const connects = `${name} connects "${connection.fromRoadId}" to "${connection.toRoadId}"`;
    if (!from || !to) {
      problems.push(`${connects}, but "${from ? connection.toRoadId : connection.fromRoadId}" is not a road of the corridor`);
    } else if (from.level !== "ground" || to.level !== "ground") {
      problems.push(`${connects}, which is not a ground-level road`);
    } else if (from.toNodeId === undefined || to.fromNodeId === undefined) {
      problems.push(`${connects}, but the end that meets the junction has been cut by length`);
    } else if (!reachable(extract, project, from.toNodeId, to.fromNodeId, CONNECTION_REACH_M)) {
      problems.push(
        `${connects}, but OpenStreetMap has no way from node ${from.toNodeId} to node ${to.fromNodeId} within ${CONNECTION_REACH_M} m`,
      );
    }
  }
  return problems.length === before;
}

/** Whether traffic can get from one node to another along the extract's ways, obeying one-way tags, within a distance. */
function reachable(extract: Extract, project: Projection, fromNodeId: number, toNodeId: number, withinM: number): boolean {
  const next = new Map<number, number[]>();
  const link = (a: number, b: number): void => {
    const list = next.get(a);
    if (list) list.push(b);
    else next.set(a, [b]);
  };
  for (const way of extract.ways.values()) {
    const oneway = way.tags?.oneway;
    for (let i = 1; i < way.nodes.length; i++) {
      const a = way.nodes[i - 1]!;
      const b = way.nodes[i]!;
      if (oneway !== "-1") link(a, b);
      if (oneway !== "yes") link(b, a);
    }
  }
  const at = (id: number): Point | undefined => {
    const node = extract.nodes.get(id);
    return node && project(node);
  };
  // Shortest distances outward from the start, nearest node first.
  const distance = new Map<number, number>([[fromNodeId, 0]]);
  const settled = new Set<number>();
  for (;;) {
    let nearest: number | undefined;
    for (const [id, d] of distance) {
      if (!settled.has(id) && (nearest === undefined || d < distance.get(nearest)!)) nearest = id;
    }
    if (nearest === undefined) return false;
    if (nearest === toNodeId) return true;
    settled.add(nearest);
    const here = at(nearest);
    if (!here) continue;
    for (const id of next.get(nearest) ?? []) {
      const there = at(id);
      if (!there) continue;
      const d = distance.get(nearest)! + Math.hypot(there.x - here.x, there.y - here.y);
      if (d <= withinM && d < (distance.get(id) ?? Infinity)) distance.set(id, d);
    }
  }
}
