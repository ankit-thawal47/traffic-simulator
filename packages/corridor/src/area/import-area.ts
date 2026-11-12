/**
 * Any-place import (ADR 0003, v2): the OpenStreetMap data of an area a
 * planner picks, made into a network in the engine's format with nothing
 * checked by hand.
 *
 * It does what a person did for the Hebbal corridor, by rule: it decides
 * which ways make each road and how roads meet, writes that down as
 * corrections (types.ts), and hands them to the same importer
 * (importCorridor and whole-network.ts), which joins roads end to end, puts
 * roads side by side where one divides or two join, sets roads back from
 * junctions, moves roads drawn too close apart and gives raised roads their
 * heights. Every value OpenStreetMap does not give is guessed by a stated
 * rule (guess-rules.ts) and listed. An area with a shape the importer cannot
 * express is refused with the reason, never imported into a network that
 * locks.
 *
 * Pure: no browser, no Node.
 */
import { createRun, junctionOutline, type Demand, type DemandFlow, type Junction, type Network, type Point, type SignalPlan } from "@traffic-simulator/engine";
import { importCorridor } from "../import-corridor";
import type { Corrections, Evidence, JoinCorrection, JunctionCorrection, OsmElement, OsmNode, OsmWay, RoadCorrection, RoadEvidence } from "../types";
import {
  ALL_RED_S,
  AMBER_S,
  CLASS_NAMES,
  CLASS_RANK,
  CONTROL_RULE,
  DECK_HEIGHT_M,
  DEMAND_PER_LANE_VPH,
  DEMAND_RULE,
  GREEN_S,
  GUESSED_LANES,
  GUESSED_SPEED_KMH,
  GUESSED_VEHICLE_MIX,
  JOIN_GAP_M,
  LANE_WIDTH_M,
  LANES_RULE,
  LEVEL_RULE,
  RAMP_GRADIENT,
  roadClassOf,
  SIDE_BY_SIDE_MIN_M,
  SIGNAL_NODE_WITHIN_M,
  SIGNAL_PLAN_RULE,
  SPEED_RULE,
  VEHICLE_MIX_RULE,
  WIDTH_RULE,
  type RoadClass,
} from "./guess-rules";
import { OSM_ATTRIBUTION, OSM_LICENCE, type AreaBounds, type Outcome } from "./overpass";

/** One value of an imported area, where it came from, and the rule that gave it when it was guessed. */
export interface Guess {
  kind: "lanes" | "width" | "speed-limit" | "level" | "control" | "signal-plan" | "demand" | "vehicle-mix";
  roadId?: string;
  junctionId?: string;
  /** The value, as a planner reads it. */
  value: string;
  /** True when OpenStreetMap does not give it and a rule did. */
  guessed: boolean;
  /** The rule that gave the value, or the OpenStreetMap tag it came from. */
  rule: string;
}

/** What an area's import makes: a network in the engine's format and its default demand, with every guess listed. */
export interface ImportedArea {
  bounds: AreaBounds;
  name: string;
  network: Network;
  demand: Demand;
  /** A short name for each road, for a planner to read. */
  roadNames: Record<string, string>;
  guesses: Guess[];
  /** Every place where the network departs from what OpenStreetMap draws, in words. */
  adjustments: string[];
  attribution: string;
  licence: string;
  fetchedAt: string | null;
  osmDataTimestamp: string | null;
  /** Changes when anything about the network changes: tells a re-import that OpenStreetMap is not as it was. */
  fingerprint: string;
}

/** What importArea() is given: OpenStreetMap elements for a box, as the Overpass API returns them. */
export interface AreaData {
  bounds: AreaBounds;
  elements: OsmElement[];
  fetchedAt?: string;
  osmDataTimestamp?: string | null;
}

const METRES_PER_DEGREE = 111_320;
/** Junction nodes joined by a road shorter than this are one junction, in metres. */
const CLUSTER_M = 35;
/** The least a road may keep between the ends it gives to its junctions, in metres. */
const LEAST_ROAD_M = 25;
/** The room kept between the two directions of a two-way road, in metres. */
const MEDIAN_M = 0.3;
/** A turn sharper than this, in degrees, is a U-turn, and not made. */
const U_TURN_DEG = 150;
/** The most roads and junctions an area may have: what a browser runs for an hour in reasonable time. */
export const AREA_NETWORK_LIMITS = { roads: 400, junctions: 120 } as const;

class Refusal extends Error {}
function refuse(message: string): never {
  throw new Refusal(message);
}

interface Way {
  id: number;
  tags: Record<string, string>;
  cls: RoadClass;
  /** Node ids, inside the box, in the direction of travel when one-way. */
  nodes: number[];
  oneway: boolean;
}

interface Edge {
  id: string;
  nodes: number[];
  /** The ways the edge is made of, each over a stretch of `nodes` (indices from, to). */
  parts: { way: Way; from: number; to: number }[];
  oneway: boolean;
  lengthM: number;
}

interface Carriageway {
  id: string;
  edge: Edge;
  /** Along the edge's nodes (true) or against them. */
  forward: boolean;
  nodes: number[];
  points: Point[];
  lengthM: number;
  fromVertex: number;
  toVertex: number;
  lanes: number;
  widthM: number;
  speedKmh: number;
  cls: RoadClass;
  offsetM: number;
  name: string;
  guesses: Guess[];
  evidence: RoadEvidence;
}

type ClusterKind =
  | { kind: "continue"; from: Carriageway; to: Carriageway }
  | { kind: "ends" }
  | { kind: "diverge"; from?: Carriageway; main: Carriageway; other: Carriageway }
  | { kind: "merge"; main: Carriageway; other: Carriageway; onto?: Carriageway }
  | { kind: "crossing"; ins: Carriageway[]; outs: Carriageway[] };

const stretch = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
function lengthOf(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += stretch(points[i - 1]!, points[i]!);
  return total;
}
const metres = (value: number): string => String(Math.round(value));

/** The direction of a line, from its start, over its first `overM` metres. */
function directionFrom(points: Point[], overM = 15): Point {
  const start = points[0]!;
  let far = points[1]!;
  let along = 0;
  for (let i = 1; i < points.length; i++) {
    along += stretch(points[i - 1]!, points[i]!);
    far = points[i]!;
    if (along >= overM) break;
  }
  const length = stretch(start, far) || 1;
  return { x: (far.x - start.x) / length, y: (far.y - start.y) / length };
}
const reversedPoints = (points: Point[]): Point[] => points.slice().reverse();
const angleDeg = (a: Point, b: Point): number => (Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))) * 180) / Math.PI;

function compass(points: Point[]): string {
  const a = points[0]!;
  const b = points[points.length - 1]!;
  const bearing = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  const names = ["northbound", "eastbound", "southbound", "westbound"];
  return names[((Math.round(bearing / 90) % 4) + 4) % 4]!;
}

function numberTag(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh|m)?\s*$/i.exec(value);
  if (!match) return undefined;
  const number = Number(match[1]);
  return match[2]?.toLowerCase() === "mph" ? number * 1.609 : number;
}

function fingerprintOf(value: unknown): string {
  // FNV-1a, 32 bits: enough to notice that OpenStreetMap has changed, not a security measure.
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * The network of an area, its default demand and every guess; or why the area cannot be imported.
 */
export function importArea(data: AreaData, options: { name?: string } = {}): Outcome<ImportedArea> {
  try {
    return { ok: true, value: importOrRefuse(data, options.name) };
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, message: `This area cannot be imported: ${error.message}` };
    throw error;
  }
}

function importOrRefuse(data: AreaData, givenName: string | undefined): ImportedArea {
  const { bounds } = data;
  const origin = { lat: (bounds.south + bounds.north) / 2, lon: (bounds.west + bounds.east) / 2 };
  const eastPerDegree = METRES_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180);
  const project = (node: { lat: number; lon: number }): Point => ({
    x: (node.lon - origin.lon) * eastPerDegree,
    y: (node.lat - origin.lat) * METRES_PER_DEGREE,
  });

  // --- The ways inside the box, cut at its edges. ---
  const nodes = new Map<number, OsmNode>();
  const osmWays: OsmWay[] = [];
  for (const element of data.elements) {
    if (element.type === "node") nodes.set(element.id, element.tags ? element : { ...element, ...(nodes.get(element.id)?.tags ? { tags: nodes.get(element.id)!.tags } : {}) });
    else if (element.type === "way") osmWays.push(element);
  }
  const inside = (node: { lat: number; lon: number }): boolean =>
    node.lat >= bounds.south && node.lat <= bounds.north && node.lon >= bounds.west && node.lon <= bounds.east;
  let nextSyntheticId = -1;
  const edgeNodes = new Map<string, number>();
  /** A node where the line from a to b crosses the edge of the box. */
  const atBoxEdge = (a: OsmNode, b: OsmNode, t: number): number => {
    const key = `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}:${(a.id < b.id ? t : 1 - t).toFixed(6)}`;
    const known = edgeNodes.get(key);
    if (known !== undefined) return known;
    const id = nextSyntheticId--;
    nodes.set(id, { type: "node", id, lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
    edgeNodes.set(key, id);
    return id;
  };
  const ways: Way[] = [];
  for (const way of osmWays.slice().sort((p, q) => p.id - q.id)) {
    const tags = way.tags ?? {};
    const cls = roadClassOf(tags.highway);
    if (!cls || tags.area === "yes") continue;
    const located = way.nodes.map((id) => nodes.get(id)).filter((node): node is OsmNode => node !== undefined);
    if (located.length < 2) continue;
    if (tags.junction === "roundabout" || tags.junction === "circular") {
      if (located.some(inside)) {
        refuse(
          `it has a roundabout (${tags.name ?? `OpenStreetMap way ${way.id}`}). The importer cannot express a roundabout yet: ` +
            "its roads would divide and join every few metres. Pick an area without one.",
        );
      }
      continue;
    }
    const oneway = tags.oneway === "yes" || tags.oneway === "true" || tags.oneway === "1" || tags.oneway === "-1" || (tags.highway === "motorway" && tags.oneway !== "no");
    const ordered = tags.oneway === "-1" ? located.slice().reverse() : located;
    // Liang-Barsky clipping of each stretch to the box; runs of stretches that stay inside become pieces.
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 2) ways.push({ id: way.id, tags, cls, nodes: run, oneway });
      run = [];
    };
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1]!;
      const b = ordered[i]!;
      let t0 = 0;
      let t1 = 1;
      const dLat = b.lat - a.lat;
      const dLon = b.lon - a.lon;
      const clip = (p: number, q: number): boolean => {
        if (p === 0) return q >= 0;
        const r = q / p;
        if (p < 0) {
          if (r > t1) return false;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return false;
          if (r < t1) t1 = r;
        }
        return true;
      };
      const visible =
        clip(-dLon, a.lon - bounds.west) && clip(dLon, bounds.east - a.lon) && clip(-dLat, a.lat - bounds.south) && clip(dLat, bounds.north - a.lat);
      if (!visible || t1 - t0 < 1e-9) {
        flush();
        continue;
      }
      const start = t0 > 0 ? atBoxEdge(a, b, t0) : a.id;
      const end = t1 < 1 ? atBoxEdge(a, b, t1) : b.id;
      if (run.length === 0 || run[run.length - 1] !== start) {
        flush();
        run = [start];
      }
      run.push(end);
      if (t1 < 1) flush();
    }
    flush();
  }
  if (ways.length === 0) {
    refuse("it has no main roads (motorway, trunk, primary, secondary or tertiary, with their slip roads) in OpenStreetMap. Residential streets and service roads are not imported.");
  }
  const position = new Map<number, Point>();
  const at = (id: number): Point => {
    let point = position.get(id);
    if (!point) {
      point = project(nodes.get(id)!);
      position.set(id, point);
    }
    return point;
  };

  // --- Which ways are raised: a bridge passing over another road. ---
  const raisedWays = new Set<number>();
  const crossings: { point: Point; ways: [Way, Way] }[] = [];
  const layerOf = (way: Way): number => numberTag(way.tags.layer) ?? 0;
  const isBridge = (way: Way): boolean => way.tags.bridge !== undefined && way.tags.bridge !== "no";
  const describeWay = (way: Way): string => `${way.tags.name ?? way.tags.ref ?? `an unnamed ${CLASS_NAMES[way.cls]}`} (way ${way.id})`;
  const boxes = ways.map((way) => {
    const points = way.nodes.map(at);
    return { points, minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)) };
  });
  for (let i = 0; i < ways.length; i++) {
    for (let j = i + 1; j < ways.length; j++) {
      const p = boxes[i]!;
      const q = boxes[j]!;
      if (p.maxX < q.minX || q.maxX < p.minX || p.maxY < q.minY || q.maxY < p.minY) continue;
      const shared = new Set(ways[i]!.nodes);
      for (let a = 1; a < p.points.length; a++) {
        for (let b = 1; b < q.points.length; b++) {
          const ids = [ways[i]!.nodes[a - 1]!, ways[i]!.nodes[a]!, ways[j]!.nodes[b - 1]!, ways[j]!.nodes[b]!];
          if (shared.has(ids[2]!) || shared.has(ids[3]!)) continue;
          const crossing = properCrossing(p.points[a - 1]!, p.points[a]!, q.points[b - 1]!, q.points[b]!);
          if (crossing) crossings.push({ point: crossing, ways: [ways[i]!, ways[j]!] });
        }
      }
    }
  }
  for (const { ways: [one, two] } of crossings) {
    const [over, under] = layerOf(one) >= layerOf(two) ? [one, two] : [two, one];
    if (layerOf(under) < 0 || under.tags.tunnel === "yes") {
      refuse(`${describeWay(under)} passes under ${describeWay(over)} in an underpass or tunnel. The importer cannot express a road below the ground yet.`);
    }
    if (!isBridge(over) || layerOf(over) <= layerOf(under) || layerOf(over) < 1) {
      refuse(
        `${describeWay(one)} and ${describeWay(two)} cross without meeting, and neither is tagged as a bridge on a higher layer, ` +
          "so the importer cannot tell which passes over the other (OpenStreetMap may be missing a junction or a bridge tag here).",
      );
    }
    if (isBridge(under) && layerOf(under) >= 1) {
      refuse(`${describeWay(over)} passes over ${describeWay(under)}, itself a bridge. The importer cannot express three levels.`);
    }
    raisedWays.add(over.id);
  }
  // The rest of the same structure: bridge ways on a raised layer joined end to end, or dividing and joining, with a raised way.
  for (let grown = true; grown; ) {
    grown = false;
    const raisedNodes = new Set(ways.filter((way) => raisedWays.has(way.id)).flatMap((way) => [way.nodes[0]!, way.nodes[way.nodes.length - 1]!]));
    for (const way of ways) {
      if (raisedWays.has(way.id) || !isBridge(way) || layerOf(way) < 1) continue;
      if (raisedNodes.has(way.nodes[0]!) || raisedNodes.has(way.nodes[way.nodes.length - 1]!)) {
        raisedWays.add(way.id);
        grown = true;
      }
    }
  }

  // --- Vertices and edges: ways split where they meet, and joined end to end where nothing else meets. ---
  const ends = new Map<number, number>();
  const count = (id: number, by: number) => ends.set(id, (ends.get(id) ?? 0) + by);
  for (const way of ways) way.nodes.forEach((id, i) => count(id, i === 0 || i === way.nodes.length - 1 ? 1 : 2));
  const isVertex = (id: number, i: number, length: number): boolean => i === 0 || i === length - 1 || (ends.get(id) ?? 0) > 2;
  interface Segment {
    way: Way;
    nodes: number[];
  }
  const segments: Segment[] = [];
  for (const way of ways) {
    let current: number[] = [way.nodes[0]!];
    for (let i = 1; i < way.nodes.length; i++) {
      current.push(way.nodes[i]!);
      if (isVertex(way.nodes[i]!, i, way.nodes.length)) {
        if (current.length >= 2) segments.push({ way, nodes: current });
        current = [way.nodes[i]!];
      }
    }
  }
  // Segment ends at each vertex; two compatible ends at a vertex with nothing else join into one edge.
  const endsAt = new Map<number, { segment: Segment; atStart: boolean }[]>();
  for (const segment of segments) {
    for (const atStart of [true, false]) {
      const id = atStart ? segment.nodes[0]! : segment.nodes[segment.nodes.length - 1]!;
      endsAt.set(id, [...(endsAt.get(id) ?? []), { segment, atStart }]);
    }
  }
  const used = new Set<Segment>();
  const edges: Edge[] = [];
  const edgeCount = new Map<number, number>();
  const passThrough = (vertex: number, from: Segment): { segment: Segment; atStart: boolean } | undefined => {
    const here = endsAt.get(vertex) ?? [];
    if (here.length !== 2 || vertex < 0) return undefined;
    const other = here.find((one) => one.segment !== from);
    if (!other || used.has(other.segment) || other.segment.way.oneway !== from.way.oneway) return undefined;
    // A signal node where nothing else meets is a crossing for people on foot; the road goes on through it.
    return other;
  };
  for (const start of segments) {
    if (used.has(start)) continue;
    used.add(start);
    // Walk back to the first segment of the chain, then forward.
    let chain: Segment[] = [start];
    let head = start.nodes[0]!;
    for (;;) {
      const before = passThrough(head, chain[0]!);
      if (!before) break;
      if (start.way.oneway && before.atStart) break;
      used.add(before.segment);
      const oriented = before.atStart ? { ...before.segment, nodes: before.segment.nodes.slice().reverse() } : before.segment;
      chain = [oriented, ...chain];
      head = oriented.nodes[0]!;
    }
    let tail = start.nodes[start.nodes.length - 1]!;
    for (;;) {
      const after = passThrough(tail, chain[chain.length - 1]!);
      if (!after) break;
      if (start.way.oneway && !after.atStart) break;
      used.add(after.segment);
      const oriented = after.atStart ? after.segment : { ...after.segment, nodes: after.segment.nodes.slice().reverse() };
      chain.push(oriented);
      tail = oriented.nodes[oriented.nodes.length - 1]!;
    }
    const edgeNodesList: number[] = [chain[0]!.nodes[0]!];
    const parts: Edge["parts"] = [];
    for (const segment of chain) {
      const from = edgeNodesList.length - 1;
      edgeNodesList.push(...segment.nodes.slice(1));
      parts.push({ way: segment.way, from, to: edgeNodesList.length - 1 });
    }
    if (edgeNodesList[0] === edgeNodesList[edgeNodesList.length - 1]) continue; // A closed loop on its own: nothing to drive between.
    const firstWay = chain[0]!.way.id;
    const n = (edgeCount.get(firstWay) ?? 0) + 1;
    edgeCount.set(firstWay, n);
    edges.push({
      id: n === 1 ? `w${firstWay}` : `w${firstWay}.${n}`,
      nodes: edgeNodesList,
      parts,
      oneway: chain[0]!.way.oneway,
      lengthM: lengthOf(edgeNodesList.map(at)),
    });
  }

  // --- Carriageways: one for a one-way edge, one each way for a two-way edge. ---
  const guessRoad = (way: Way, forward: boolean, oneway: boolean, roadId: string) => {
    const tags = way.tags;
    const guesses: Guess[] = [];
    const tagged = (key: string) => numberTag(tags[key]);
    let lanes: number | undefined;
    let lanesFrom = "";
    if (oneway) {
      lanes = tagged("lanes");
      lanesFrom = `lanes=${tags.lanes}`;
    } else {
      const directional = forward ? "lanes:forward" : "lanes:backward";
      if (tagged(directional) !== undefined) {
        lanes = tagged(directional);
        lanesFrom = `${directional}=${tags[directional]}`;
      } else if (tagged("lanes") !== undefined) {
        lanes = Math.max(1, Math.floor(tagged("lanes")! / 2));
        lanesFrom = `lanes=${tags.lanes}, shared between the two directions`;
      }
    }
    if (lanes !== undefined) lanes = Math.max(1, Math.min(8, Math.round(lanes)));
    const lanesGuessed = lanes === undefined;
    if (lanes === undefined) lanes = GUESSED_LANES[way.cls][oneway ? 0 : 1];
    guesses.push({ kind: "lanes", roadId, value: `${lanes}`, guessed: lanesGuessed, rule: lanesGuessed ? LANES_RULE : `OpenStreetMap way ${way.id}: ${lanesFrom}` });
    const widthTag = tagged("width");
    const widthFromTag = widthTag !== undefined && widthTag >= 2.5 ? (oneway ? widthTag : widthTag / 2) : undefined;
    const widthM = widthFromTag !== undefined && widthFromTag >= 2.5 ? Math.round(widthFromTag * 10) / 10 : lanes * LANE_WIDTH_M;
    const widthGuessed = widthM !== widthFromTag;
    guesses.push({
      kind: "width",
      roadId,
      value: `${widthM} m`,
      guessed: widthGuessed,
      rule: widthGuessed ? WIDTH_RULE : `OpenStreetMap way ${way.id}: width=${tags.width}${oneway ? "" : ", shared between the two directions"}`,
    });
    const speedTag = tagged("maxspeed");
    const speedKmh = speedTag !== undefined && speedTag >= 5 && speedTag <= 200 ? speedTag : GUESSED_SPEED_KMH[way.cls];
    const speedGuessed = speedKmh !== speedTag;
    guesses.push({
      kind: "speed-limit",
      roadId,
      value: `${Math.round(speedKmh)} km/h`,
      guessed: speedGuessed,
      rule: speedGuessed ? SPEED_RULE : `OpenStreetMap way ${way.id}: maxspeed=${tags.maxspeed}`,
    });
    const evidenceOf = (guessed: boolean, rule: string): Evidence => (guessed ? { state: "assumed", source: rule } : { state: "confirmed", source: rule });
    const evidence: RoadEvidence = {
      lanes: evidenceOf(lanesGuessed, guesses[0]!.rule),
      widthM: evidenceOf(widthGuessed, guesses[1]!.rule),
      level: { state: "assumed", source: LEVEL_RULE },
      oneWay: { state: "confirmed", source: `OpenStreetMap way ${way.id}: oneway=${tags.oneway ?? "(none)"}` },
      speedLimit: evidenceOf(speedGuessed, guesses[2]!.rule),
    };
    return { lanes, widthM, speedKmh, guesses, evidence };
  };

  const internalEdges = new Set<Edge>();
  const dropped = new Set<string>();
  /** Places where roads divide or join that the engine cannot run side by side: made junctions instead. */
  const asCrossing = new Set<number>();
  const adjustments: string[] = [];
  /** Vertices joined into one junction: each vertex's representative. */
  let cluster = new Map<number, number>();
  const signalNodes = [...nodes.values()].filter((node) => node.tags?.highway === "traffic_signals" && inside(node)).map(project);

  const carriagewaysOf = (edge: Edge): Carriageway[] => {
    const directions = edge.oneway ? [true] : [true, false];
    return directions.map((forward) => {
      const id = edge.oneway ? edge.id : `${edge.id}${forward ? "f" : "b"}`;
      const ordered = forward ? edge.nodes : edge.nodes.slice().reverse();
      const longest = edge.parts.reduce((best, part) => (part.to - part.from > best.to - best.from ? part : best), edge.parts[0]!).way;
      const values = guessRoad(longest, forward, edge.oneway, id);
      const points = ordered.map(at);
      const named = longest.tags.name ?? longest.tags.ref ?? `Unnamed ${CLASS_NAMES[longest.cls]}`;
      return {
        id,
        edge,
        forward,
        nodes: ordered,
        points,
        lengthM: edge.lengthM,
        fromVertex: ordered[0]!,
        toVertex: ordered[ordered.length - 1]!,
        lanes: values.lanes,
        widthM: values.widthM,
        speedKmh: values.speedKmh,
        cls: longest.cls,
        offsetM: edge.oneway ? 0 : values.widthM / 2 + MEDIAN_M / 2,
        name: `${named}, ${compass(points)}`,
        guesses: values.guesses,
        evidence: values.evidence,
      };
    });
  };
  const allCarriageways = edges.flatMap(carriagewaysOf);
  const rankOf = (road: Carriageway): number => CLASS_RANK[road.cls];

  // The shape of the network is settled by trying, then leaving out or joining what does not fit, and trying again;
  // then built, and a road that would overlap another on the same level is left out and it is tried again.
  let built: Built | undefined;
  let turnNotes: string[] = [];
  let demand: Demand = { flows: [] };
  for (let round = 0; !built; round++) {
    let settled: Settled | undefined;
    for (let attempt = 0; attempt < 60 && !settled; attempt++) {
      cluster = clustersOf(edges, internalEdges, ends, endsAt);
      const result = settle();
      if (result.ok) settled = result.value;
    }
    if (!settled) refuse("its roads meet in too many places too close together for the importer to lay them out. Pick a smaller or simpler area.");
    const candidate = build(settled);
    const overlap = overlapIn(candidate.network);
    const judged = overlap ? undefined : engineJudges(candidate.network, candidate.imported.roadNames);
    if (judged?.ok) {
      built = { ...candidate, network: judged.network };
      turnNotes = judged.notes;
      demand = judged.demand;
      break;
    }
    const sideBySide = judged && !judged.ok ? /Junction "([dm])(\d+)(-in|-out)?" has no signal/.exec(judged.message) : null;
    if (sideBySide && round < 40) {
      const key = cluster.get(Number(sideBySide[2])) ?? cluster.get(-Number(sideBySide[2]));
      if (key !== undefined && !asCrossing.has(key)) {
        asCrossing.add(key);
        adjustments.push(`Where roads divide or join at ${placeName(key)} they turn too sharply to lie side by side, so it is made a junction: ${judged!.message}.`);
        continue;
      }
    }
    const roadIds = overlap ? overlap.roadIds : judged!.roadIds;
    const what = overlap
      ? `as OpenStreetMap draws it, it would overlap ${overlap.what} on the same level`
      : `the engine cannot run the network with it (${judged!.message})`;
    const chains = roadIds.map((id) => candidate.chainOf.get(id)).filter((chain): chain is Carriageway[] => chain !== undefined);
    const culprit = chains
      .filter((chain) => chain.every((road) => road.edge.oneway))
      .sort((p, q) => Math.max(...p.map(rankOf)) - Math.max(...q.map(rankOf)) || chainLengthOf(p) - chainLengthOf(q))[0];
    if (!culprit || round >= 40) {
      refuse(
        overlap
          ? `two of its roads would overlap on the same level as OpenStreetMap draws them (${overlap.what}), and the importer cannot lay them apart.`
          : `the engine would not run its network: ${judged!.message}.`,
      );
    }
    for (const road of culprit) dropped.add(road.id);
    adjustments.push(`"${culprit[0]!.name}" (${culprit[0]!.id}) is left out: ${what}.`);
  }
  const { imported, guesses, junctionNames, corrections } = built;

  interface Settled {
    chains: Carriageway[][];
    kinds: Map<number, ClusterKind>;
    setBacks: Map<number, number>;
  }

  /** One attempt: Ok with the layout, or not (having left something out or joined two junctions, so that the next attempt differs). */
  function settle(): { ok: true; value: Settled } | { ok: false } {
    const live = allCarriageways.filter((road) => !dropped.has(road.id) && !internalEdges.has(road.edge));
    const keyOf = (vertex: number): number | undefined => cluster.get(vertex);
    const ins = new Map<number, Carriageway[]>();
    const outs = new Map<number, Carriageway[]>();
    for (const road of live) {
      const to = keyOf(road.toVertex);
      const from = keyOf(road.fromVertex);
      if (to !== undefined) ins.set(to, [...(ins.get(to) ?? []), road]);
      if (from !== undefined) outs.set(from, [...(outs.get(from) ?? []), road]);
    }
    const members = new Map<number, number[]>();
    for (const [vertex, key] of cluster) members.set(key, [...(members.get(key) ?? []), vertex]);
    const kinds = new Map<number, ClusterKind>();
    const drop = (road: Carriageway, why: string): { ok: false } => {
      dropped.add(road.id);
      adjustments.push(`"${road.name}" (${road.id}) is left out: ${why}`);
      return { ok: false };
    };
    for (const [key, vertices] of members) {
      const i = ins.get(key) ?? [];
      const o = outs.get(key) ?? [];
      const single = vertices.length === 1 && !asCrossing.has(key);
      if (asCrossing.has(key) && i.length > 0 && o.length > 0) {
        kinds.set(key, { kind: "crossing", ins: i, outs: o });
        continue;
      }
      const byRank = (list: Carriageway[]) => list.slice().sort((p, q) => rankOf(q) - rankOf(p) || q.lanes - p.lanes || q.lengthM - p.lengthM);
      if ((i.length === 0 && o.length > 2) || (o.length === 0 && i.length > 2)) {
        // Several roads start (or end) at one node with nothing arriving (or leaving): keep the two most major.
        const least = byRank(i.length === 0 ? o : i).at(-1)!;
        return drop(least, "it starts or ends at the same node as two or more other roads, with no road to divide from or join, which the importer cannot lay out.");
      } else if (single && i.length === 0 && o.length === 2) {
        // Two roads start at one node where the road they divide from is outside the area, or left out: they still divide there.
        const [main, other] = byRank(o);
        kinds.set(key, { kind: "diverge", main: main!, other: other! });
      } else if (single && o.length === 0 && i.length === 2) {
        const [main, other] = byRank(i);
        kinds.set(key, { kind: "merge", main: main!, other: other! });
      } else if (i.length === 0 || o.length === 0) kinds.set(key, { kind: "ends" });
      else if (i.length === 1 && o.length === 1) {
        if (i[0]!.edge === o[0]!.edge) kinds.set(key, { kind: "ends" });
        else if (single) kinds.set(key, { kind: "continue", from: i[0]!, to: o[0]! });
        else kinds.set(key, { kind: "crossing", ins: i, outs: o });
      } else if (i.length === 1 && o.length === 2 && single) {
        const [main, other] = o.slice().sort((p, q) => rankOf(q) - rankOf(p) || q.lanes - p.lanes || q.lengthM - p.lengthM);
        kinds.set(key, { kind: "diverge", from: i[0]!, main: main!, other: other! });
      } else if (i.length === 2 && o.length === 1 && single) {
        const [main, other] = i.slice().sort((p, q) => rankOf(q) - rankOf(p) || q.lanes - p.lanes || q.lengthM - p.lengthM);
        kinds.set(key, { kind: "merge", main: main!, other: other!, onto: o[0]! });
      } else if (i.length === 1 || o.length === 1) {
        // One road in and several out (or the reverse) at more than one node: no junction of the engine's fits. Leave out the least one-way road.
        const candidates = (i.length === 1 ? o : i).filter((road) => road.edge.oneway).sort((p, q) => rankOf(p) - rankOf(q) || p.lengthM - q.lengthM);
        if (candidates.length === 0) refuse(`roads divide at ${placeName(vertices[0]!)} in a way the importer cannot express.`);
        return drop(candidates[0]!, "where it leaves or joins, one road divides into several (or several join into one) across more than one node, which no junction of the engine expresses; its traffic uses the other roads.");
      } else kinds.set(key, { kind: "crossing", ins: i, outs: o });
    }

    // Chains: carriageways joined end to end through every "continue".
    const next = new Map<string, Carriageway>();
    const previous = new Set<string>();
    for (const kind of kinds.values()) {
      if (kind.kind !== "continue") continue;
      next.set(kind.from.id, kind.to);
      previous.add(kind.to.id);
    }
    const chains: Carriageway[][] = [];
    const inChain = new Set<string>();
    for (const road of live) {
      if (previous.has(road.id)) continue;
      const chain = [road];
      inChain.add(road.id);
      while (next.has(chain[chain.length - 1]!.id)) {
        const following = next.get(chain[chain.length - 1]!.id)!;
        if (inChain.has(following.id)) break;
        chain.push(following);
        inChain.add(following.id);
      }
      chains.push(chain);
    }
    for (const road of live) {
      if (!inChain.has(road.id)) refuse(`${road.name} runs in a closed loop with nothing joining it, which the importer cannot express.`);
    }
    const chainOf = new Map<string, Carriageway[]>();
    for (const chain of chains) for (const road of chain) chainOf.set(road.id, chain);
    const chainLength = (chain: Carriageway[]) => chain.reduce((sum, road) => sum + road.lengthM, 0);

    // How far each crossing junction's roads are set back from its nodes.
    const setBacks = new Map<number, number>();
    for (const [key, kind] of kinds) {
      if (kind.kind !== "crossing") continue;
      setBacks.set(key, setBackFor(members.get(key)!, kind));
    }
    const cutAt = (vertex: number, end: "start" | "end", road: Carriageway): number => {
      const key = keyOf(vertex);
      if (key === undefined) return 0;
      const kind = kinds.get(key)!;
      if (kind.kind === "crossing") return setBacks.get(key)!;
      if (kind.kind === "diverge") return end === "end" ? JOIN_GAP_M : SIDE_BY_SIDE_MIN_M + JOIN_GAP_M + (road === kind.other ? 40 : 0);
      if (kind.kind === "merge") return end === "start" ? JOIN_GAP_M : SIDE_BY_SIDE_MIN_M + JOIN_GAP_M + (road === kind.other ? 40 : 0);
      return 0;
    };
    for (const chain of chains) {
      const first = chain[0]!;
      const last = chain[chain.length - 1]!;
      const startKey = keyOf(first.fromVertex);
      if (startKey !== undefined && startKey === keyOf(last.toVertex) && kinds.get(startKey)?.kind === "crossing") {
        // A road that leaves a junction and comes back to it (a slip road inside it): part of the junction.
        for (const road of chain) internalEdges.add(road.edge);
        return { ok: false };
      }
      const left = chainLength(chain) - cutAt(first.fromVertex, "start", first) - cutAt(last.toVertex, "end", last);
      if (left >= LEAST_ROAD_M) continue;
      const fromKey = keyOf(first.fromVertex);
      const toKey = keyOf(last.toVertex);
      const fromKind = fromKey === undefined ? undefined : kinds.get(fromKey)!.kind;
      const toKind = toKey === undefined ? undefined : kinds.get(toKey)!.kind;
      if (chain.length === 1 && fromKind === "crossing" && toKind === "crossing") {
        // Two junctions too close for a road between them: one junction.
        internalEdges.add(first.edge);
        return { ok: false };
      }
      if (fromKind !== "crossing" && fromKind !== "diverge" && fromKind !== "merge") {
        return drop(first, `it is too short (${metres(chainLength(chain))} m) to drive before the junction it reaches.`);
      }
      if (toKind !== "crossing" && toKind !== "diverge" && toKind !== "merge") {
        return drop(last, `it is too short (${metres(chainLength(chain))} m) to drive after the junction it leaves.`);
      }
      const oneway = chain.find((road) => road.edge.oneway);
      if (oneway) {
        return drop(oneway, `it is too short (${metres(chainLength(chain))} m) to lie beside the road it leaves or joins and leave room to turn; its traffic uses the other roads.`);
      }
      // Two junctions joined by a two-way road too short to set both back: one junction.
      for (const road of chain) internalEdges.add(road.edge);
      return { ok: false };
    }
    return { ok: true, value: { chains, kinds, setBacks } };
  }

  function placeName(vertex: number): string {
    const node = nodes.get(vertex);
    return node ? `${node.lat.toFixed(5)} N, ${node.lon.toFixed(5)} E` : `node ${vertex}`;
  }

  /**
   * How far back from a crossing junction's nodes its roads stop: far enough
   * that the roads leaving one node at an angle do not overlap and a bus can
   * turn left between them: at least 16 m and at most 45 m.
   */
  function setBackFor(vertices: number[], kind: { ins: Carriageway[]; outs: Carriageway[] }): number {
    let most = 16;
    for (const vertex of vertices) {
      const arms = new Map<Edge, { direction: Point; halfM: number }>();
      for (const road of [...kind.ins, ...kind.outs]) {
        const atStart = road.fromVertex === vertex;
        const atEnd = road.toVertex === vertex;
        if (!atStart && !atEnd) continue;
        const outward = atStart ? directionFrom(road.points) : directionFrom(reversedPoints(road.points));
        const arm = arms.get(road.edge);
        const halfM = road.edge.oneway ? road.widthM / 2 : road.widthM + MEDIAN_M / 2;
        if (!arm) arms.set(road.edge, { direction: outward, halfM });
      }
      const list = [...arms.values()];
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          const theta = (angleDeg(list[a]!.direction, list[b]!.direction) * Math.PI) / 180;
          const half = Math.max(list[a]!.halfM, list[b]!.halfM);
          const need = half / Math.tan(Math.max(theta, 0.2) / 2) + 10;
          most = Math.max(most, need);
        }
      }
    }
    return Math.round(Math.min(45, most) * 10) / 10;
  }

  interface Built {
    network: Network;
    imported: ReturnType<typeof importCorridor>;
    guesses: Guess[];
    junctionNames: Map<string, string>;
    corrections: Corrections;
    /** The carriageways each road of the network is made of. */
    chainOf: Map<string, Carriageway[]>;
  }

  /** The corrections the importer works from, and what it makes of them. */
  function build({ chains, kinds, setBacks }: Settled): Built {
  const syntheticWays: OsmWay[] = [];
  const roads: RoadCorrection[] = [];
  const networkRoads: { id: string; name: string; parts: string[] }[] = [];
  /** Each chain's road id, the id of its first and last part, and the edges it comes from. */
  const chainInfo = new Map<Carriageway, { id: string; firstPart: string; lastPart: string; road: Carriageway }>();
  const guesses: Guess[] = [];
  const raisedWhereCut = { atStart: [] as string[], atEnd: [] as string[] };
  let nextWayId = -1;
  for (const chain of chains) {
    const id = chain[0]!.id;
    const longest = chain.reduce((best, road) => (road.lengthM > best.lengthM ? road : best), chain[0]!);
    const partIds: string[] = [];
    // Parts: stretches of one carriageway on one level.
    for (const road of chain) {
      // In the edge's own order first, then turned round for the other direction.
      const stretches: { nodes: number[]; raised: boolean }[] = [];
      for (const part of road.edge.parts) {
        const raised = raisedWays.has(part.way.id);
        const span = road.edge.nodes.slice(part.from, part.to + 1);
        const last = stretches[stretches.length - 1];
        if (last && last.raised === raised) last.nodes.push(...span.slice(1));
        else stretches.push({ nodes: span, raised });
      }
      const ordered = road.forward ? stretches : stretches.reverse().map((one) => ({ ...one, nodes: one.nodes.slice().reverse() }));
      for (const piece of ordered) {
        const wayId = nextWayId--;
        syntheticWays.push({ type: "way", id: wayId, nodes: piece.nodes, tags: { highway: "primary", oneway: "yes" } });
        const partId = chain.length === 1 && ordered.length === 1 ? id : `${id}~${partIds.length + 1}`;
        partIds.push(partId);
        roads.push({
          id: partId,
          name: longest.name,
          shortName: longest.name,
          wayIds: [wayId],
          level: piece.raised ? "raised" : "ground",
          lanes: longest.lanes,
          widthM: longest.widthM,
          speedLimitKmh: Math.round(longest.speedKmh),
          ...(road.offsetM ? { offsetLeftM: road.offsetM } : {}),
          evidence: longest.evidence,
        });
      }
    }
    if (partIds.length > 1) networkRoads.push({ id, name: longest.name, parts: partIds });
    // A flyover cut by the edge of the area is at its deck height there, not on the ground.
    const firstLevel = roads[roads.length - partIds.length]!.level;
    const lastLevel = roads[roads.length - 1]!.level;
    if (chain[0]!.fromVertex < 0 && firstLevel === "raised") raisedWhereCut.atStart.push(id);
    if (chain[chain.length - 1]!.toVertex < 0 && lastLevel === "raised") raisedWhereCut.atEnd.push(id);
    const info = { id, firstPart: partIds[0]!, lastPart: partIds[partIds.length - 1]!, road: longest };
    for (const road of chain) chainInfo.set(road, info);
    for (const guess of longest.guesses) guesses.push({ ...guess, roadId: id });
    if (chain.some((road) => road.edge.parts.some((part) => raisedWays.has(part.way.id)))) {
      guesses.push({ kind: "level", roadId: id, value: `raised, ${DECK_HEIGHT_M} m up`, guessed: true, rule: LEVEL_RULE });
    }
  }
  // Roads inside a junction carry no traffic, but show that its nodes are joined.
  for (const edge of internalEdges) syntheticWays.push({ type: "way", id: nextWayId--, nodes: edge.nodes, tags: { highway: "primary" } });

  const junctions: JunctionCorrection[] = [];
  const joins: JoinCorrection[] = [];
  const junctionNames = new Map<string, string>();
  const nameOfRoad = (road: Carriageway): string => road.name.replace(/, [a-z]+bound$/, "");
  for (const [key, kind] of [...kinds].sort((p, q) => p[0] - q[0])) {
    if (kind.kind === "diverge" || kind.kind === "merge") {
      const id = `${kind.kind === "diverge" ? "d" : "m"}${Math.abs(key)}`;
      const main = chainInfo.get(kind.main)!;
      const other = chainInfo.get(kind.other)!;
      const reason = `Where ${kind.kind === "diverge" ? `${kind.other.name} leaves ${kind.main.name}` : `${kind.other.name} joins ${kind.main.name}`} (${placeName(key)}).`;
      const shared = { id: `s${Math.abs(key)}`, name: kind.main.name };
      if (kind.kind === "diverge") {
        joins.push({ id, kind: "diverge", ...(kind.from ? { fromRoadId: chainInfo.get(kind.from)!.id } : {}), mainRoadId: main.id, otherRoadId: other.id, shared, reason });
      } else {
        joins.push({ id, kind: "merge", mainRoadId: main.id, otherRoadId: other.id, ...(kind.onto ? { ontoRoadId: chainInfo.get(kind.onto)!.id } : {}), shared, reason });
      }
      continue;
    }
    if (kind.kind !== "crossing") continue;
    const id = `j${Math.abs(key)}`;
    const vertices = [...cluster].filter(([, k]) => k === key).map(([vertex]) => vertex);
    /** The direction of travel as a road arrives at the junction. */
    const endDirection = (road: Carriageway): Point => {
      const back = directionFrom(reversedPoints(road.points));
      return { x: -back.x, y: -back.y };
    };
    const connections: { fromRoadId: string; toRoadId: string }[] = [];
    for (const from of kind.ins) {
      for (const to of kind.outs) {
        if (from.edge === to.edge) continue;
        const heading = endDirection(from);
        const leaving = directionFrom(to.points);
        if (angleDeg(heading, leaving) > U_TURN_DEG) continue;
        connections.push({ fromRoadId: chainInfo.get(from)!.lastPart, toRoadId: chainInfo.get(to)!.firstPart });
      }
    }
    // Approaches: grouped by the direction they come from (the same or opposite directions share a group), most major first.
    const approaches = kind.ins
      .filter((road) => connections.some((connection) => connection.fromRoadId === chainInfo.get(road)!.lastPart))
      .sort((p, q) => rankOf(q) - rankOf(p) || q.lanes - p.lanes || (p.id < q.id ? -1 : 1));
    const groups: Carriageway[][] = [];
    for (const road of approaches) {
      const heading = endDirection(road);
      const group = groups.find((members) => members.every((member) => {
        const angle = angleDeg(endDirection(member), heading);
        return angle < 45 || angle > 135;
      }));
      if (group) group.push(road);
      else groups.push([road]);
    }
    const names = [...new Set(kind.ins.concat(kind.outs).map(nameOfRoad))];
    const name = names.slice(0, 3).join(" × ");
    junctionNames.set(id, name);
    const signalled = signalNodes.some((signal) => vertices.some((vertex) => stretch(signal, at(vertex)) <= SIGNAL_NODE_WITHIN_M));
    const majorGroups = groups.filter((group) => group.some((road) => CLASS_RANK[road.cls] >= CLASS_RANK.primary));
    const signal = signalled || majorGroups.length >= 2;
    const lastPart = (road: Carriageway) => chainInfo.get(road)!.lastPart;
    if (approaches.length < 1 || connections.length === 0) continue;
    if (signal || approaches.length < 2) {
      guesses.push({
        kind: "control",
        junctionId: id,
        value: "signal",
        guessed: !signalled,
        rule: signalled ? `OpenStreetMap has a traffic_signals node within ${SIGNAL_NODE_WITHIN_M} m.` : CONTROL_RULE,
      });
      const plan: SignalPlan = {
        phases: groups.map((group) => ({ greenRoadIds: group.map(lastPart), greenS: GREEN_S })),
        amberS: AMBER_S,
        allRedS: ALL_RED_S,
      };
      guesses.push({ kind: "signal-plan", junctionId: id, value: `${plan.phases.length} phases of ${GREEN_S} s green`, guessed: true, rule: SIGNAL_PLAN_RULE });
      junctions.push({ id, name, control: "signal", connections, setBackM: setBacks.get(key)!, signalPlan: plan });
    } else {
      const topRank = rankOf(approaches[0]!);
      let main = approaches.filter((road) => rankOf(road) === topRank);
      if (main.length === approaches.length) main = groups[0]!.length < approaches.length ? groups[0]! : [approaches[0]!];
      guesses.push({ kind: "control", junctionId: id, value: `priority, main road: ${[...new Set(main.map(nameOfRoad))].join(", ")}`, guessed: true, rule: CONTROL_RULE });
      junctions.push({ id, name, control: "priority", connections, setBackM: setBacks.get(key)!, mainRoadIds: main.map(lastPart) });
    }
  }

  const corrections: Corrections = {
    corridorId: "imported-area",
    name: givenName ?? `Area around ${origin.lat.toFixed(4)} N, ${origin.lon.toFixed(4)} E`,
    attribution: OSM_ATTRIBUTION,
    origin,
    roads,
    junctions,
    network: {
      deckHeightM: DECK_HEIGHT_M,
      rampGradient: RAMP_GRADIENT,
      joinGapM: JOIN_GAP_M,
      sideBySideMinM: SIDE_BY_SIDE_MIN_M,
      evidence: { state: "assumed", source: "The Hebbal corridor's settings (data/hebbal/corrections.json), used everywhere." },
      roads: networkRoads,
      joins,
      keepApart: keepApartPairs(chains.map((chain) => ({ id: chain[0]!.id, chain }))),
      raisedWhereCut,
    },
  };
  const syntheticElements: OsmElement[] = [...[...nodes.values()].filter((node) => node.id < 0 || position.has(node.id)), ...syntheticWays];
  const imported = importCorridor({ elements: syntheticElements }, corrections);
  if (imported.problems.length > 0 || !imported.network) {
    refuse(`its roads could not be laid out as the engine needs: ${imported.problems.slice(0, 2).join("; ")}.`);
  }
  checkLevels(imported.network, crossings.map((crossing) => crossing.point));
  const chainOf = new Map<string, Carriageway[]>();
  for (const chain of chains) chainOf.set(chain[0]!.id, chain);
  for (const [key, kind] of kinds) {
    if (kind.kind === "diverge" || kind.kind === "merge") {
      const other = chains.find((chain) => chain.includes(kind.other));
      if (other) chainOf.set(`s${Math.abs(key)}`, other);
    }
  }
  return { network: imported.network, imported, guesses, junctionNames, corrections, chainOf };
  }

  const network = built.network;
  if (network.roads.length > AREA_NETWORK_LIMITS.roads || (network.junctions?.length ?? 0) > AREA_NETWORK_LIMITS.junctions) {
    refuse(
      `it makes ${network.roads.length} roads and ${network.junctions?.length ?? 0} junctions; the most is ${AREA_NETWORK_LIMITS.roads} roads ` +
        `and ${AREA_NETWORK_LIMITS.junctions} junctions, which a browser runs for an hour in reasonable time. Pick a smaller area.`,
    );
  }
  const roadNames: Record<string, string> = { ...imported.roadNames };
  const allAdjustments = [...adjustments, ...imported.adjustments];

  allAdjustments.push(...turnNotes);
  for (const flowEntry of new Set(demand.flows.map((flow) => flow.entryRoadId))) {
    const flows = demand.flows.filter((flow) => flow.entryRoadId === flowEntry);
    const total = flows.reduce((sum, flow) => sum + flow.vehiclesPerHour, 0);
    guesses.push({ kind: "demand", roadId: flowEntry, value: `${Math.round(total)} vehicles per hour, to ${flows.length} exit(s)`, guessed: true, rule: DEMAND_RULE });
  }
  // The one wide road where roads divide or join has what both have.
  for (const road of network.roads) {
    if (guesses.some((guess) => guess.kind === "lanes" && guess.roadId === road.id)) continue;
    const rule = "Where roads divide or join, the one road as wide as both has the lanes and the width of both together.";
    guesses.push({ kind: "lanes", roadId: road.id, value: String(road.lanes), guessed: true, rule });
    guesses.push({ kind: "width", roadId: road.id, value: `${road.widthM} m`, guessed: true, rule });
    guesses.push({ kind: "speed-limit", roadId: road.id, value: `${Math.round(road.speedLimitMps * 3.6)} km/h`, guessed: true, rule: "That of the main road of the two." });
  }
  guesses.push({ kind: "vehicle-mix", value: "65% two-wheelers, 22% cars, 5.5% auto-rickshaws, 4% buses", guessed: true, rule: VEHICLE_MIX_RULE });

  const roadIds = new Set(network.roads.map((road) => road.id));
  const junctionIds = new Set((network.junctions ?? []).map((junction) => junction.id));
  for (const [id, name] of junctionNames) if (junctionIds.has(id)) roadNames[id] ??= name;
  return {
    bounds,
    name: corrections.name,
    network,
    demand,
    roadNames: Object.fromEntries(Object.entries(roadNames).filter(([id]) => roadIds.has(id))),
    guesses: guesses.filter((guess) => (guess.roadId === undefined || roadIds.has(guess.roadId)) && (guess.junctionId === undefined || junctionIds.has(guess.junctionId))),
    adjustments: allAdjustments,
    attribution: OSM_ATTRIBUTION,
    licence: OSM_LICENCE,
    fetchedAt: data.fetchedAt ?? null,
    osmDataTimestamp: data.osmDataTimestamp ?? null,
    fingerprint: fingerprintOf(network),
  };

  /** Pairs of roads drawn alongside closer than half of both widths, away from their ends (on any level: ramps rise beside roads): the narrower is moved. */
  function keepApartPairs(list: { id: string; chain: Carriageway[] }[]) {
    const pairs: { roadId: string; fromRoadId: string; reason: string }[] = [];
    const lines = list.map(({ id, chain }) => {
      const points = chain.flatMap((road, i) => {
        const line = road.offsetM ? movedLeft(road.points, road.offsetM) : road.points;
        return i === 0 ? line : line.slice(1);
      });
      const ends = [chain[0]!.fromVertex, chain[chain.length - 1]!.toVertex].map((vertex) => cluster.get(vertex) ?? vertex);
      return { id, chain, points, ends, widthM: chain[0]!.widthM, rank: Math.max(...chain.map(rankOf)) };
    });
    for (const a of lines) {
      for (const b of lines) {
        if (a === b) continue;
        if (a.chain.some((road) => b.chain.some((other) => other.edge === road.edge))) continue;
        // Roads that divide or join, or meet at a junction, are laid out there by the importer; roads that cross pass over one another.
        if (a.ends.some((end) => b.ends.includes(end))) continue;
        if (linesCross(a.points, b.points)) continue;
        // a is the one moved: the lesser, or the later id of two alike.
        if (a.rank > b.rank || (a.rank === b.rank && (a.widthM > b.widthM || (a.widthM === b.widthM && a.id < b.id)))) continue;
        const needM = (a.widthM + b.widthM) / 2;
        const total = lengthOf(a.points);
        let closest = Infinity;
        for (let along = 40; along < total - 40; along += 10) {
          closest = Math.min(closest, distanceToLine(b.points, pointAlong(a.points, along)));
        }
        if (closest < needM - 0.05 && closest > 0.5) {
          pairs.push({ roadId: a.id, fromRoadId: b.id, reason: `OpenStreetMap draws the two ${metres(closest)} m apart at the closest, less than their widths need.` });
        }
      }
    }
    return pairs;
  }
}

/** The OpenStreetMap road (edge) a road of the network comes from: its id without the direction letter. */
const sourceRoad = (id: string): string => id.replace(/[fb]?(~\d+)?$/, "");

const chainLengthOf = (chain: { lengthM: number }[]): number => chain.reduce((sum, road) => sum + road.lengthM, 0);

/** Two vehicles closer in height than this are on the same level (the engine's consistency checks use 3 m). */
const SAME_LEVEL_M = 3;
/** Roads that only touch at their edges do not overlap. */
const EDGE_SLACK_M = 0.25;

interface Piece {
  corners: Point[];
  z: number;
}

/** The ground each stretch of a road covers, with its mean height. */
function piecesOf(points: Point[], widthM: number): Piece[] {
  const pieces: Piece[] = [];
  const half = Math.max(0.1, widthM / 2 - EDGE_SLACK_M);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = stretch(a, b);
    if (length < 1e-6) continue;
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    // Shortened at each end too, so that two roads meeting end to end do not count.
    const trim = Math.min(EDGE_SLACK_M, length / 4);
    const a2 = { x: a.x + ux * trim, y: a.y + uy * trim };
    const b2 = { x: b.x - ux * trim, y: b.y - uy * trim };
    const nx = -uy * half;
    const ny = ux * half;
    pieces.push({
      corners: [
        { x: a2.x + nx, y: a2.y + ny },
        { x: b2.x + nx, y: b2.y + ny },
        { x: b2.x - nx, y: b2.y - ny },
        { x: a2.x - nx, y: a2.y - ny },
      ],
      z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    });
  }
  return pieces;
}

function convexOverlap(a: Point[], b: Point[]): boolean {
  for (const shape of [a, b]) {
    for (let i = 0; i < shape.length; i++) {
      const p = shape[i]!;
      const q = shape[(i + 1) % shape.length]!;
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      let minA = Infinity;
      let maxA = -Infinity;
      for (const point of a) {
        const d = point.x * nx + point.y * ny;
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      let minB = Infinity;
      let maxB = -Infinity;
      for (const point of b) {
        const d = point.x * nx + point.y * ny;
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      if (maxA <= minB || maxB <= minA) return false;
    }
  }
  return true;
}

function boundsOf(points: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

/**
 * The first place where two roads of the network, or a road and a junction it
 * is not part of, cover the same ground on the same level: vehicles there
 * would drive through one another. Roads of one junction are laid out by the
 * importer and the engine, and are not compared.
 */
function overlapIn(network: Network): { roadIds: string[]; what: string } | undefined {
  const junctions = network.junctions ?? [];
  const junctionsOf = new Map<string, Set<string>>();
  for (const junction of junctions) {
    for (const { fromRoadId, toRoadId } of junction.connections) {
      for (const id of [fromRoadId, toRoadId]) junctionsOf.set(id, new Set([...(junctionsOf.get(id) ?? []), junction.id]));
    }
  }
  const roads = network.roads.map((road) => {
    const pieces = piecesOf(road.points, road.widthM);
    return { road, pieces, box: boundsOf(pieces.flatMap((piece) => piece.corners)) };
  });
  const apart = (p: { minX: number; maxX: number; minY: number; maxY: number }, q: typeof p) =>
    p.maxX < q.minX || q.maxX < p.minX || p.maxY < q.minY || q.maxY < p.minY;
  for (let i = 0; i < roads.length; i++) {
    for (let j = i + 1; j < roads.length; j++) {
      const a = roads[i]!;
      const b = roads[j]!;
      if (apart(a.box, b.box)) continue;
      const shared = [...(junctionsOf.get(a.road.id) ?? [])].some((id) => junctionsOf.get(b.road.id)?.has(id));
      // The two directions of one two-way road lie side by side by construction (they may touch on a sharp bend).
      if (shared || sourceRoad(a.road.id) === sourceRoad(b.road.id)) continue;
      for (const pa of a.pieces) {
        for (const pb of b.pieces) {
          if (Math.abs(pa.z - pb.z) < SAME_LEVEL_M && convexOverlap(pa.corners, pb.corners)) {
            return { roadIds: [a.road.id, b.road.id], what: `roads "${a.road.id}" and "${b.road.id}"` };
          }
        }
      }
    }
  }
  for (const junction of junctions) {
    if (junction.control === "none") continue;
    const outline = junctionOutline(network, junction);
    if (outline.length < 3) continue;
    const own = new Set(junction.connections.flatMap((connection) => [connection.fromRoadId, connection.toRoadId]));
    const box = boundsOf(outline);
    for (const { road, pieces, box: roadBox } of roads) {
      if (own.has(road.id) || apart(box, roadBox)) continue;
      if (pieces.some((piece) => piece.z < SAME_LEVEL_M && convexHullOverlap(outline, piece.corners))) {
        return { roadIds: [road.id], what: `road "${road.id}" and junction "${junction.id}"` };
      }
    }
  }
  return undefined;
}

/** A junction's outline may not be convex: compare its convex hull, which errs towards finding an overlap. */
function convexHullOverlap(outline: Point[], piece: Point[]): boolean {
  const sorted = outline.slice().sort((p, q) => p.x - q.x || p.y - q.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Point[] = [];
  for (const point of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
    upper.push(point);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return hull.length >= 3 && convexOverlap(hull, piece);
}

/**
 * The engine is the judge. A turn it cannot make is left out, with the
 * reason, and it is asked again; any other refusal names the roads it is
 * about, for the importer to leave one out.
 */
function engineJudges(
  given: Network,
  roadNames: Record<string, string>,
): { ok: true; network: Network; demand: Demand; notes: string[] } | { ok: false; roadIds: string[]; message: string } {
  let network = given;
  let demand = demandFor(network);
  const notes: string[] = [];
  for (let attempt = 0; attempt < 60; attempt++) {
    if (demand.flows.length === 0) refuse("no traffic can cross it: no road entering the area leads to a road leaving it.");
    try {
      createRun({ network, demand, seed: 1 });
      return { ok: true, network, demand, notes };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const turn = /turn from road "([^"]+)" to road "([^"]+)" is too (tight|short)/.exec(message);
      if (!turn) return { ok: false, roadIds: [...message.matchAll(/road "([^"]+)"/g)].map((match) => match[1]!), message };
      network = withoutConnection(network, turn[1]!, turn[2]!);
      notes.push(`The turn from "${roadNames[turn[1]!] ?? turn[1]}" to "${roadNames[turn[2]!] ?? turn[2]}" is left out: ${message.replace(/^The turn[^:]*: /, "")}.`);
      demand = demandFor(network);
    }
  }
  return { ok: false, roadIds: [], message: "too many turns it cannot make" };
}

/** The network without one connection; a signal phase left with no approach is dropped with it. */
function withoutConnection(network: Network, fromRoadId: string, toRoadId: string): Network {
  const junctions: Junction[] = [];
  for (const junction of network.junctions ?? []) {
    const connections = junction.connections.filter((one) => !(one.fromRoadId === fromRoadId && one.toRoadId === toRoadId));
    if (connections.length === 0) continue;
    const approaches = new Set(connections.map((one) => one.fromRoadId));
    if (junction.control === "signal") {
      const phases = junction.signalPlan.phases
        .map((phase) => ({ ...phase, greenRoadIds: phase.greenRoadIds.filter((id) => approaches.has(id)) }))
        .filter((phase) => phase.greenRoadIds.length > 0);
      junctions.push({ ...junction, connections, signalPlan: { ...junction.signalPlan, phases } });
    } else if (junction.control === "priority") {
      const mainRoadIds = junction.mainRoadIds.filter((id) => approaches.has(id));
      if (mainRoadIds.length === 0 || mainRoadIds.length === approaches.size) {
        // No longer a priority junction the engine can run: the approach left is let through first come, first served by a plain signal.
        junctions.push({ id: junction.id, control: "signal", connections, signalPlan: { phases: [{ greenRoadIds: [...approaches], greenS: GREEN_S }], amberS: 0, allRedS: 0 } });
      } else junctions.push({ ...junction, connections, mainRoadIds });
    } else junctions.push({ ...junction, connections });
  }
  return { ...network, junctions };
}

/**
 * The default demand (DEMAND_RULE): from each road entering the area to each
 * road leaving it that it can reach, but not the other direction of its own road.
 */
export function demandFor(network: Network): Demand {
  const junctions = network.junctions ?? [];
  const onward = new Map<string, string[]>();
  const fed = new Set<string>();
  const feeds = new Set<string>();
  for (const junction of junctions) {
    for (const { fromRoadId, toRoadId } of junction.connections) {
      onward.set(fromRoadId, [...(onward.get(fromRoadId) ?? []), toRoadId]);
      fed.add(toRoadId);
      feeds.add(fromRoadId);
    }
  }
  const sourceOf = sourceRoad;
  const flows: DemandFlow[] = [];
  for (const entry of network.roads) {
    if (fed.has(entry.id)) continue;
    const reached = new Set<string>([entry.id]);
    const queue = [entry.id];
    while (queue.length > 0) {
      for (const id of onward.get(queue.shift()!) ?? []) {
        if (!reached.has(id)) {
          reached.add(id);
          queue.push(id);
        }
      }
    }
    const exits = network.roads.filter(
      (road) => reached.has(road.id) && !feeds.has(road.id) && (road.id === entry.id || sourceOf(road.id) !== sourceOf(entry.id)),
    );
    if (exits.length === 0) continue;
    const total = DEMAND_PER_LANE_VPH * (entry.lanes ?? 1);
    exits.forEach((exit, i) => {
      // Shared in whole vehicles, the remainder to the first exits.
      const share = Math.floor(total / exits.length) + (i < total % exits.length ? 1 : 0);
      if (share > 0) flows.push({ entryRoadId: entry.id, exitRoadId: exit.id, vehiclesPerHour: share });
    });
  }
  return { flows, vehicleMix: GUESSED_VEHICLE_MIX };
}

/** Where a raised road passes over another, the two must be at least a vehicle's height apart, or the area is refused. */
function checkLevels(network: Network, points: Point[]): void {
  for (const point of points) {
    const near = network.roads.filter((road) => (nearestHeight(road.points, point)?.distanceM ?? Infinity) < 20);
    // Each pair of roads whose centre lines cross here: the one over must clear the one under.
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const crossing = crossingOf(near[i]!.points, near[j]!.points);
        if (!crossing || stretch(crossing, point) > 20) continue;
        const zi = nearestHeight(near[i]!.points, crossing)!.z;
        const zj = nearestHeight(near[j]!.points, crossing)!.z;
        if (Math.abs(zi - zj) < 3.5) {
          const top = zi >= zj ? near[i]! : near[j]!;
          refuse(
            `road "${top.id}" is a bridge too short to rise over the road beneath it: rising ${RAMP_GRADIENT * 100} m in 100 m from its ends, ` +
              `it is only ${Math.max(zi, zj).toFixed(1)} m up where it crosses.`,
          );
        }
      }
    }
  }
}

function crossingOf(p: Point[], q: Point[]): Point | undefined {
  for (let i = 1; i < p.length; i++) {
    for (let j = 1; j < q.length; j++) {
      const at = properCrossing(p[i - 1]!, p[i]!, q[j - 1]!, q[j]!);
      if (at) return at;
    }
  }
  return undefined;
}

function nearestHeight(points: Point[], to: Point): { distanceM: number; z: number } | undefined {
  let best: { distanceM: number; z: number } | undefined;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const step = stretch(a, b);
    if (step === 0) continue;
    const t = Math.max(0, Math.min(1, ((to.x - a.x) * (b.x - a.x) + (to.y - a.y) * (b.y - a.y)) / (step * step)));
    const distanceM = Math.hypot(to.x - a.x - (b.x - a.x) * t, to.y - a.y - (b.y - a.y) * t);
    if (!best || distanceM < best.distanceM) best = { distanceM, z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t };
  }
  return best;
}

function distanceToLine(points: Point[], to: Point): number {
  return nearestHeight(points, to)?.distanceM ?? Infinity;
}

function pointAlong(points: Point[], alongM: number): Point {
  let left = alongM;
  for (let i = 1; i < points.length; i++) {
    const step = stretch(points[i - 1]!, points[i]!);
    if (left <= step && step > 0) {
      const t = left / step;
      return { x: points[i - 1]!.x + (points[i]!.x - points[i - 1]!.x) * t, y: points[i - 1]!.y + (points[i]!.y - points[i - 1]!.y) * t };
    }
    left -= step;
  }
  return points[points.length - 1]!;
}

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

function linesCross(p: Point[], q: Point[]): boolean {
  for (let i = 1; i < p.length; i++) {
    for (let j = 1; j < q.length; j++) if (properCrossing(p[i - 1]!, p[i]!, q[j - 1]!, q[j]!)) return true;
  }
  return false;
}

/** Where two stretches cross, away from their ends; undefined when they do not. */
function properCrossing(a: Point, b: Point, c: Point, d: Point): Point | undefined {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denominator = r.x * s.y - r.y * s.x;
  if (Math.abs(denominator) < 1e-9) return undefined;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denominator;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denominator;
  if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 1e-6 || u >= 1 - 1e-6) return undefined;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
}

/** Junction vertices, joined into one where a short road (or a road made internal) joins them: each vertex's representative. */
function clustersOf(
  edges: Edge[],
  internal: Set<Edge>,
  ends: Map<number, number>,
  endsAt: Map<number, unknown[]>,
): Map<number, number> {
  const parent = new Map<number, number>();
  const find = (id: number): number => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  // Every vertex where edges end is a node of the graph; those at the edge of the box (negative ids) belong to no junction.
  for (const edge of edges) {
    for (const vertex of [edge.nodes[0]!, edge.nodes[edge.nodes.length - 1]!]) {
      if (vertex >= 0 && !parent.has(vertex)) parent.set(vertex, vertex);
    }
  }
  const isJunction = (vertex: number) => vertex >= 0 && ((endsAt.get(vertex)?.length ?? 0) >= 3 || (ends.get(vertex) ?? 0) >= 3);
  for (const edge of edges) {
    const a = edge.nodes[0]!;
    const b = edge.nodes[edge.nodes.length - 1]!;
    if (a < 0 || b < 0) continue;
    if (internal.has(edge) || (edge.lengthM < CLUSTER_M && isJunction(a) && isJunction(b))) {
      internal.add(edge);
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
    }
  }
  const result = new Map<number, number>();
  for (const vertex of parent.keys()) result.set(vertex, find(vertex));
  return result;
}
