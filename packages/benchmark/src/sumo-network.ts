/**
 * SUMO inputs for a network of our engine's own format (roads, junctions with a
 * signal, junctions with no signal where roads divide or join), and a SUMO run
 * over them. Used by Tiers 2 to 5. The network is written once, in the engine's
 * format, and translated here; nothing about it is decided twice.
 *
 * How the translation goes (each a point where the two engines could differ):
 *
 * - Every road is an edge with the road's own centreline as its shape
 *   (`spreadType="center"`), its plan length as `length`, its lane count and
 *   lane width (width / lanes), and its speed limit. In mixed traffic (no lane
 *   discipline) a road is one lane as wide as the road, and SUMO runs its sublane
 *   model across it (`--lateral-resolution`).
 * - A junction is a node at the middle of the ends of its roads; SUMO builds the
 *   junction's area from where the edges' shapes stop, as our engine does.
 * - A junction with a signal is a `traffic_light` node whose program is replaced
 *   by one written from the engine's plan: for each phase, green ('G') for every
 *   link from its approaches, then amber ('y') for those links for the amber
 *   time, then red ('r') everywhere for the all-red time.
 * - A junction with no signal (a diverge or a merge) is a `priority` node whose
 *   connections join the lanes that line up across the two roads, as the
 *   engine's strips do.
 * - Only the engine's connections exist: any other that netconvert adds is deleted.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  VEHICLE_CLASS_ASSUMPTIONS,
  type Network,
  type Road,
  type SignalJunction,
  type VehicleClass,
} from "@traffic-simulator/engine";
import { STEP_S } from "./scenario";
import { sumoEnvDir } from "./sumo-run";

function bin(name: string): string {
  return join(sumoEnvDir(), "bin", name);
}

export function roadLength(road: Road): number {
  let length = 0;
  for (let i = 1; i < road.points.length; i++) {
    length += Math.hypot(road.points[i]!.x - road.points[i - 1]!.x, road.points[i]!.y - road.points[i - 1]!.y);
  }
  return length;
}

export interface SumoNetwork {
  dir: string;
  netFile: string;
  /** The traffic-light programmes, written from the engine's signal plans. */
  tlsFile: string | null;
  /** Number of lanes of each edge in the SUMO network. */
  lanes: Map<string, number>;
  /** Length of each edge's lanes in the SUMO network (should equal the road's plan length). */
  edgeLengthM: Map<string, number>;
  /** Length of the internal lanes of each (from, to) connection, the longest of its lanes. */
  connectionLengthM: Map<string, number>;
}

/** The SUMO vClass that stands for each of our vehicle classes. */
const SUMO_VCLASS: Record<VehicleClass, string> = {
  "two-wheeler": "motorcycle",
  car: "passenger",
  // SUMO has no auto-rickshaw class; a three-wheeler is a passenger vehicle of its own size.
  "auto-rickshaw": "passenger",
  bus: "bus",
};

/**
 * The vType of one of our vehicle classes: the same following rule (IDM, delta 4) with the
 * class's values from the engine's assumptions table, one desired speed for every vehicle of
 * the class, the same step. With `sublane`, the class's sideways values are given to SUMO's
 * sublane model where SUMO has the same concept: the sideways clearance (minGapLat) and the
 * sideways speed cap (maxSpeedLat).
 */
export function vTypeFor(vehicleClass: VehicleClass, sublane: boolean, extra: Record<string, string> = {}): string {
  const a = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass];
  const values: Record<string, string> = {
    id: vehicleClass,
    vClass: SUMO_VCLASS[vehicleClass],
    carFollowModel: "IDM",
    length: String(a.lengthM),
    width: String(a.widthM),
    minGap: String(a.standstillGapM),
    accel: String(a.maxAccelerationMps2),
    decel: String(a.comfortableDecelerationMps2),
    tau: String(a.timeGapS),
    delta: "4",
    stepping: String(STEP_S),
    maxSpeed: String(a.desiredSpeedMps),
    speedFactor: "1",
    speedDev: "0",
    ...(sublane ? { laneChangeModel: "SL2015", minGapLat: String(a.sideClearanceM), maxSpeedLat: String(a.maxSidewaysSpeedMps) } : {}),
    ...extra,
  };
  return `<vType ${Object.entries(values).map(([key, value]) => `${key}="${value}"`).join(" ")}/>`;
}

interface NodeSpec {
  id: string;
  x: number;
  y: number;
  type: string;
}

/** Translate an engine network into a SUMO network (and signal programmes) in `dir`. */
export interface SumoNetworkOptions {
  laneDiscipline: boolean;
  /**
   * Junctions to be SUMO priority junctions (our engine's ticket 08), by id, with the roads that
   * are the main road: those edges are ranked above the others, so traffic from the others yields.
   */
  priorityRoads?: Record<string, string[]>;
}

export function writeSumoNetwork(network: Network, dir: string, options: SumoNetworkOptions): SumoNetwork {
  mkdirSync(dir, { recursive: true });
  // Heights (flyovers) are left out: our engine measures lengths on the plan, and a raised road
  // shares no junction with what it crosses, which in SUMO is simply edges that share no node.
  const endsAt = new Map<string, string>();
  const startsAt = new Map<string, string>();
  const nodes: NodeSpec[] = [];
  for (const junction of network.junctions ?? []) {
    if (junction.control === "signal" && (junction as SignalJunction).signalPlan.offsetS) {
      throw new Error(`Signal offsets are not translated to SUMO (junction ${junction.id})`);
    }
    const points: { x: number; y: number }[] = [];
    for (const connection of junction.connections) {
      endsAt.set(connection.fromRoadId, junction.id);
      startsAt.set(connection.toRoadId, junction.id);
    }
    for (const road of network.roads) {
      if (endsAt.get(road.id) === junction.id) points.push(road.points[road.points.length - 1]!);
      if (startsAt.get(road.id) === junction.id) points.push(road.points[0]!);
    }
    nodes.push({
      id: junction.id,
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      type: junction.control === "signal" ? "traffic_light" : "priority",
    });
  }
  const lanesOf = (road: Road) => (options.laneDiscipline ? road.lanes ?? 1 : 1);
  const edges: string[] = [];
  for (const road of network.roads) {
    const first = road.points[0]!;
    const last = road.points[road.points.length - 1]!;
    const from = startsAt.get(road.id) ?? `${road.id}.start`;
    const to = endsAt.get(road.id) ?? `${road.id}.end`;
    if (!startsAt.has(road.id)) nodes.push({ id: from, x: first.x, y: first.y, type: "dead_end" });
    if (!endsAt.has(road.id)) nodes.push({ id: to, x: last.x, y: last.y, type: "dead_end" });
    const lanes = lanesOf(road);
    const main = Object.values(options.priorityRoads ?? {}).some((ids) => ids.includes(road.id));
    const priority = options.priorityRoads ? ` priority="${main ? 2 : 1}"` : "";
    const shape = road.points.map((point) => `${point.x},${point.y}`).join(" ");
    edges.push(
      `<edge id="${road.id}" from="${from}" to="${to}" numLanes="${lanes}" width="${road.widthM / lanes}" speed="${road.speedLimitMps}" ` +
        `length="${roadLength(road)}" shape="${shape}" spreadType="center"${priority}/>`,
    );
  }
  writeFileSync(join(dir, "net.nod.xml"), `<nodes>\n${nodes.map((n) => `<node id="${n.id}" x="${n.x}" y="${n.y}" type="${n.type}"/>`).join("\n")}\n</nodes>\n`);
  writeFileSync(join(dir, "net.edg.xml"), `<edges>\n${edges.join("\n")}\n</edges>\n`);

  // Connections: lane by lane where roads divide or join (the lanes that line up), road by road at a signal.
  const roads = new Map(network.roads.map((road) => [road.id, road]));
  const connectionLines: string[] = [];
  const wanted = new Set<string>();
  for (const junction of network.junctions ?? []) {
    for (const connection of junction.connections) {
      wanted.add(`${connection.fromRoadId}>${connection.toRoadId}`);
      if (junction.control === "none" && !options.priorityRoads?.[junction.id]) {
        for (const [fromLane, toLane] of linedUpLanes(roads.get(connection.fromRoadId)!, roads.get(connection.toRoadId)!, lanesOf)) {
          connectionLines.push(`<connection from="${connection.fromRoadId}" to="${connection.toRoadId}" fromLane="${fromLane}" toLane="${toLane}"/>`);
        }
      } else {
        connectionLines.push(`<connection from="${connection.fromRoadId}" to="${connection.toRoadId}"/>`);
      }
    }
  }
  const netFile = join(dir, "net.net.xml");
  const build = (deletes: string[]) => {
    writeFileSync(join(dir, "net.con.xml"), `<connections>\n${[...connectionLines, ...deletes].join("\n")}\n</connections>\n`);
    execFileSync(
      bin("netconvert"),
      [
        "--node-files", join(dir, "net.nod.xml"),
        "--edge-files", join(dir, "net.edg.xml"),
        "--connection-files", join(dir, "net.con.xml"),
        "--lefthand", "true",
        "--no-turnarounds", "true",
        "--offset.disable-normalization", "true",
        "--junctions.join", "false",
        "--no-warnings", "true",
        "-o", netFile,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
  };
  build([]);
  const extra = [...new Set(parseConnections(readFileSync(netFile, "utf8")).map((c) => `${c.from}>${c.to}`))].filter((key) => !wanted.has(key));
  if (extra.length > 0) {
    build(extra.map((key) => `<delete from="${key.split(">")[0]}" to="${key.split(">")[1]}"/>`));
  }
  const net = readFileSync(netFile, "utf8");
  const connections = parseConnections(net);
  const present = new Set(connections.map((c) => `${c.from}>${c.to}`));
  for (const key of wanted) if (!present.has(key)) throw new Error(`netconvert left out the connection ${key}`);
  for (const key of present) if (!wanted.has(key)) throw new Error(`netconvert added the connection ${key}`);

  // Signal programmes.
  let tlsFile: string | null = null;
  const signals = (network.junctions ?? []).filter((junction): junction is SignalJunction => junction.control === "signal");
  if (signals.length > 0) {
    const lines = ["<additional>"];
    for (const junction of signals) {
      const links = connections.filter((c) => c.tl === junction.id);
      const size = Math.max(...links.map((c) => c.linkIndex)) + 1;
      const state = (char: (link: ParsedConnection) => string) => {
        const chars = new Array<string>(size).fill("r");
        for (const link of links) chars[link.linkIndex] = char(link);
        return chars.join("");
      };
      lines.push(`<tlLogic id="${junction.id}" type="static" programID="engine-plan" offset="0">`);
      const plan = junction.signalPlan;
      for (const phase of plan.phases) {
        const green = new Set(phase.greenRoadIds);
        // Where opposite approaches share a green, the turn across oncoming traffic (a right turn in
        // left-hand traffic) is permitted, not protected: 'g', it yields to the oncoming 'G'.
        const shared = green.size > 1;
        const go = (link: ParsedConnection) => (shared && link.dir === "r" ? "g" : "G");
        lines.push(`  <phase duration="${phase.greenS}" state="${state((link) => (green.has(link.from) ? go(link) : "r"))}"/>`);
        if (plan.amberS > 0) lines.push(`  <phase duration="${plan.amberS}" state="${state((link) => (green.has(link.from) ? "y" : "r"))}"/>`);
        if (plan.allRedS > 0) lines.push(`  <phase duration="${plan.allRedS}" state="${state(() => "r")}"/>`);
      }
      lines.push("</tlLogic>");
    }
    lines.push("</additional>");
    tlsFile = join(dir, "tls.add.xml");
    writeFileSync(tlsFile, lines.join("\n") + "\n");
  }

  const lanes = new Map<string, number>();
  const edgeLengthM = new Map<string, number>();
  for (const road of network.roads) {
    const match = new RegExp(`<lane id="${road.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_0"[^>]*\\blength="([^"]*)"`).exec(net);
    edgeLengthM.set(road.id, match ? Number(match[1]) : NaN);
    lanes.set(road.id, lanesOf(road));
  }
  const connectionLengthM = new Map<string, number>();
  for (const c of connections) {
    if (!c.via) continue;
    const match = new RegExp(`<lane id="${c.via.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*\\blength="([^"]*)"`).exec(net);
    const key = `${c.from}>${c.to}`;
    connectionLengthM.set(key, Math.max(connectionLengthM.get(key) ?? 0, match ? Number(match[1]) : 0));
  }
  return { dir, netFile, tlsFile, lanes, edgeLengthM, connectionLengthM };
}

interface ParsedConnection {
  from: string;
  to: string;
  fromLane: number;
  toLane: number;
  tl: string | null;
  linkIndex: number;
  via: string | null;
  dir: string;
}

function parseConnections(net: string): ParsedConnection[] {
  const out: ParsedConnection[] = [];
  for (const match of net.matchAll(/<connection\s[^>]*>/g)) {
    const text = match[0];
    const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(text)?.[1] ?? null;
    const from = attr("from")!;
    if (from.startsWith(":")) continue; // from an internal lane
    out.push({
      from,
      to: attr("to")!,
      fromLane: Number(attr("fromLane")),
      toLane: Number(attr("toLane")),
      tl: attr("tl"),
      linkIndex: Number(attr("linkIndex") ?? -1),
      via: attr("via"),
      dir: attr("dir") ?? "",
    });
  }
  return out;
}

/**
 * Where a road divides or joins side by side: the lanes of the wider road that the narrower one
 * lines up with, from where the narrower road starts (or ends) across the wider one. Lane 0 is
 * the leftmost, facing the direction of travel (SUMO's left-hand networks number lanes from the kerb).
 */
function linedUpLanes(from: Road, to: Road, lanesOf: (road: Road) => number): [number, number][] {
  const fromEnd = from.points[from.points.length - 1]!;
  const fromBefore = from.points[from.points.length - 2]!;
  const toStart = to.points[0]!;
  const dx = fromEnd.x - fromBefore.x;
  const dy = fromEnd.y - fromBefore.y;
  const norm = Math.hypot(dx, dy);
  // The left of the direction of travel.
  const left = { x: -dy / norm, y: dx / norm };
  // Centre of `to` measured across `from`, from from's left edge.
  const centreOfTo = from.widthM / 2 - ((toStart.x - fromEnd.x) * left.x + (toStart.y - fromEnd.y) * left.y);
  const fromLanes = lanesOf(from);
  const toLanes = lanesOf(to);
  const fromLaneW = from.widthM / fromLanes;
  const toLaneW = to.widthM / toLanes;
  const pairs: [number, number][] = [];
  if (from.widthM >= to.widthM) {
    // A diverge: `to` takes part of from's width.
    const toLeft = centreOfTo - to.widthM / 2;
    for (let k = 0; k < toLanes; k++) {
      const lane = Math.round((toLeft + (k + 0.5) * toLaneW) / fromLaneW - 0.5);
      if (lane >= 0 && lane < fromLanes) pairs.push([lane, k]);
    }
  } else {
    // A merge: `from` arrives onto part of to's width. Measure across `to`, from its left edge.
    const toEnd = to.points[0]!;
    const toNext = to.points[1]!;
    const ex = toNext.x - toEnd.x;
    const ey = toNext.y - toEnd.y;
    const en = Math.hypot(ex, ey);
    const leftTo = { x: -ey / en, y: ex / en };
    const centreOfFrom = to.widthM / 2 - ((fromEnd.x - toEnd.x) * leftTo.x + (fromEnd.y - toEnd.y) * leftTo.y);
    const fromLeft = centreOfFrom - from.widthM / 2;
    for (let k = 0; k < fromLanes; k++) {
      const lane = Math.round((fromLeft + (k + 0.5) * fromLaneW) / toLaneW - 0.5);
      if (lane >= 0 && lane < toLanes) pairs.push([k, lane]);
    }
  }
  if (pairs.length === 0) throw new Error(`Roads ${from.id} and ${to.id} do not line up`);
  return pairs;
}

export interface SumoNetworkRunOptions {
  routesFile: string;
  durationS: number;
  seed: number;
  /** Mixed traffic: SUMO's sublane model with sublanes of this width, metres. */
  lateralResolutionM?: number;
  /** Write the positions of every vehicle at every step (needed for queues, sideways positions). */
  fcd?: { attributes: string; beginS?: number; period?: number };
  /** Additional files besides the signal programmes (detectors, edge data). */
  additional?: string[];
  extraArgs?: string[];
  /** Run SUMO under /usr/bin/time -l to read its peak memory. */
  measureMemory?: boolean;
}

export interface SumoNetworkRunSummary {
  teleports: number;
  teleportsJam: number;
  teleportsYield: number;
  teleportsWrongLane: number;
  collisions: number;
  emergencyBraking: number;
  loaded: number;
  inserted: number;
  running: number;
  waiting: number;
  warningCount: number;
  warnings: string[];
  wallClockS: number;
  /** Peak resident memory of the SUMO process, bytes, when measured. */
  peakMemoryBytes: number | null;
  /** SUMO's own measure of its simulation time, from its statistics output (null when absent). */
  command: string;
  tripinfoFile: string;
  fcdFile: string | null;
}

function numberAttribute(text: string, name: string): number {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(text);
  return match ? Number(match[1]) : 0;
}

export function runSumoNetwork(network: SumoNetwork, options: SumoNetworkRunOptions): SumoNetworkRunSummary {
  const dir = network.dir;
  const additional = [...(network.tlsFile ? [network.tlsFile] : []), ...(options.additional ?? [])];
  const tripinfoFile = join(dir, "tripinfo.xml");
  const fcdFile = options.fcd ? join(dir, "fcd.csv") : null;
  const args = [
    "--net-file", network.netFile,
    "--route-files", options.routesFile,
    ...(additional.length > 0 ? ["--additional-files", additional.join(",")] : []),
    "--step-length", String(STEP_S),
    "--step-method.ballistic", "true",
    "--begin", "0",
    "--end", (options.durationS + STEP_S).toFixed(1),
    "--seed", String(options.seed),
    "--time-to-teleport", "300",
    "--collision.action", "warn",
    "--no-step-log", "true",
    "--duration-log.disable", "true",
    "--precision", "4",
    "--statistic-output", join(dir, "statistics.xml"),
    "--tripinfo-output", tripinfoFile,
    "--tripinfo-output.write-unfinished", "true",
    "--log", join(dir, "sumo.log"),
    ...(options.lateralResolutionM !== undefined ? ["--lateral-resolution", String(options.lateralResolutionM)] : []),
    ...(options.extraArgs ?? []),
  ];
  if (options.fcd && fcdFile) {
    args.push("--fcd-output", fcdFile, "--fcd-output.attributes", options.fcd.attributes);
    if (options.fcd.beginS !== undefined) args.push("--device.fcd.begin", String(options.fcd.beginS));
    if (options.fcd.period !== undefined) args.push("--device.fcd.period", String(options.fcd.period));
  }
  const started = Date.now();
  let peakMemoryBytes: number | null = null;
  let command = `sumo ${args.join(" ")}`;
  if (options.measureMemory) {
    const result = spawnSync("/usr/bin/time", ["-l", bin("sumo"), ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
    if (result.status !== 0) throw new Error(`SUMO failed in ${dir}: ${result.stderr}`);
    const match = /(\d+)\s+maximum resident set size/.exec(result.stderr);
    peakMemoryBytes = match ? Number(match[1]) : null;
    command = `/usr/bin/time -l ${command}`;
  } else {
    const result = spawnSync(bin("sumo"), args, { encoding: "utf8", maxBuffer: 1 << 26 });
    if (result.status !== 0) throw new Error(`SUMO failed in ${dir}: ${result.stderr}`);
  }
  const wallClockS = (Date.now() - started) / 1000;
  const statistics = readFileSync(join(dir, "statistics.xml"), "utf8");
  const tag = (name: string) => new RegExp(`<${name}\\b[^>]*>`).exec(statistics)?.[0] ?? "";
  const vehicles = tag("vehicles");
  const teleports = tag("teleports");
  const safety = tag("safety");
  const log = existsSync(join(dir, "sumo.log")) ? readFileSync(join(dir, "sumo.log"), "utf8") : "";
  const warnings = log.split("\n").filter((line) => line.startsWith("Warning") || line.startsWith("Error"));
  return {
    teleports: numberAttribute(teleports, "total"),
    teleportsJam: numberAttribute(teleports, "jam"),
    teleportsYield: numberAttribute(teleports, "yield"),
    teleportsWrongLane: numberAttribute(teleports, "wrongLane"),
    collisions: numberAttribute(safety, "collisions"),
    emergencyBraking: numberAttribute(safety, "emergencyBraking"),
    loaded: numberAttribute(vehicles, "loaded"),
    inserted: numberAttribute(vehicles, "inserted"),
    running: numberAttribute(vehicles, "running"),
    waiting: numberAttribute(vehicles, "waiting"),
    warningCount: warnings.length,
    warnings: warnings.slice(0, 5),
    wallClockS,
    peakMemoryBytes,
    command,
    tripinfoFile,
    fcdFile,
  };
}

export interface TripInfo {
  id: string;
  vType: string;
  depart: number;
  departDelay: number;
  arrival: number;
  duration: number;
  timeLoss: number;
  routeLength: number;
  /** False for a vehicle still on the network (or waiting) when the run ended. */
  finished: boolean;
}

export function readTripinfo(file: string): TripInfo[] {
  const text = readFileSync(file, "utf8");
  const out: TripInfo[] = [];
  for (const match of text.matchAll(/<tripinfo\s[^>]*>/g)) {
    const row = match[0];
    const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(row)?.[1] ?? "";
    out.push({
      id: attr("id"),
      vType: attr("vType"),
      depart: Number(attr("depart")),
      departDelay: Number(attr("departDelay")),
      arrival: Number(attr("arrival")),
      duration: Number(attr("duration")),
      timeLoss: Number(attr("timeLoss")),
      routeLength: Number(attr("routeLength")),
      finished: Number(attr("arrival")) >= 0 && !/\bvaporized="end"/.test(row),
    });
  }
  return out;
}

/** Read SUMO's FCD output (CSV) row by row without holding the whole table. */
export function forEachFcdRow(file: string, onRow: (row: Record<string, string>) => void): void {
  const text = readFileSync(file, "utf8");
  let start = text.indexOf("\n");
  const header = text.slice(0, start).split(";").map((title) => title.replace(/^.*_/, ""));
  start++;
  while (start < text.length) {
    let end = text.indexOf("\n", start);
    if (end < 0) end = text.length;
    const cells = text.slice(start, end).split(";");
    start = end + 1;
    if (cells.length < header.length) continue;
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]!] = cells[i]!;
    if (row.id === undefined || row.id === "") continue;
    onRow(row);
  }
}
