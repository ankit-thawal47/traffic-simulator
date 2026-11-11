/**
 * Turns a scenario into SUMO inputs and runs SUMO headless on them.
 *
 * How SUMO is set up (benchmark standard, fairness rules 2 and 3), and why:
 *
 * - `carFollowModel="IDM"` with the car's values from the engine's assumptions
 *   table: accel = a, decel = b (SUMO's IDM uses `decel` as the comfortable
 *   deceleration in s*), tau = T, minGap = s0, delta = 4, length, width.
 * - `speedFactor="1" speedDev="0"`: SUMO's default gives every passenger car its
 *   own desired speed (normc(1,0.1,0.2,2)); ours all share one.
 * - `maxSpeed` = the car's desired speed, the edge's speed = the road's speed limit.
 * - `--step-length 0.2`, and `--step-method.ballistic`: SUMO's default update is
 *   Euler (speed constant over the step); the ballistic update (acceleration
 *   constant over the step) is the scheme our engine uses.
 * - `stepping="0.2"`: the internal step of SUMO's IDM. SUMO 1.28 rounds
 *   step-length / stepping to a whole number of internal iterations; this gives one.
 * - `--lefthand` networks.
 * - `--time-to-teleport 300` (SUMO's default) and `--collision.action warn`, so
 *   teleports and collisions happen as SUMO would have them and are counted.
 * - Cars placed at the start use `insertionChecks="none"` so that both engines
 *   start from the identical state.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CAR, LANE_WIDTH_M, STEP_S, type Departure, type Scenario } from "./scenario";

export const SUMO_VERSION = "1.28.0";

export function sumoEnvDir(): string {
  return process.env.SUMO_ENV ?? join(homedir(), ".cache", "traffic-simulator", `sumo-${SUMO_VERSION}`);
}

function bin(name: string): string {
  return join(sumoEnvDir(), "bin", name);
}

/** The version line SUMO prints, or null when SUMO is not installed where expected. */
export function sumoVersionLine(): string | null {
  if (!existsSync(bin("sumo"))) return null;
  try {
    return execFileSync(bin("sumo"), ["--version"], { encoding: "utf8" }).split("\n")[0]!.trim();
  } catch {
    return null;
  }
}

/** The attributes of the SUMO vehicle type that stands for our car. */
export function carTypeAttributes(): Record<string, string> {
  return {
    vClass: "passenger",
    carFollowModel: "IDM",
    length: String(CAR.lengthM),
    width: String(CAR.widthM),
    minGap: String(CAR.standstillGapM),
    accel: String(CAR.maxAccelerationMps2),
    decel: String(CAR.comfortableDecelerationMps2),
    tau: String(CAR.timeGapS),
    delta: "4",
    stepping: String(STEP_S),
    maxSpeed: String(CAR.desiredSpeedMps),
    speedFactor: "1",
    speedDev: "0",
  };
}

function attributes(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
}

export interface SumoInputs {
  dir: string;
  /** SUMO id of each placed car, in the scenario's order. */
  carIds: string[];
  /** SUMO ids per group. */
  groupIds: Map<string, string[]>;
  routeEdges: string[];
}

export interface SumoInputOptions {
  /** Cars departing after the start (the engine's own departure times, replayed). */
  departures?: Departure[];
  /** SUMO's departSpeed for those cars; "avg" unless set. */
  departSpeed?: "avg" | "max";
}

/** Write the network (through netconvert) and the route file of a scenario into a directory. */
export function writeSumoInputs(scenario: Scenario, dir: string, options: SumoInputOptions = {}): SumoInputs {
  mkdirSync(dir, { recursive: true });
  const drop = scenario.laneDrop;
  const nodes = [`<node id="n0" x="0" y="0"/>`];
  const edges: string[] = [];
  const routeEdges = ["main"];
  let connections = "";
  const edge = (id: string, from: string, to: string, lanes: number) =>
    `<edge id="${id}" from="${from}" to="${to}" numLanes="${lanes}" speed="${scenario.speedLimitMps}" width="${LANE_WIDTH_M}"/>`;
  if (drop) {
    nodes.push(`<node id="n1" x="${drop.fromM}" y="0"/>`, `<node id="n2" x="${scenario.roadLengthM}" y="0"/>`);
    edges.push(edge("main", "n0", "n1", scenario.lanes), edge("down", "n1", "n2", scenario.lanes - 1));
    routeEdges.push("down");
    const lines: string[] = [];
    for (let lane = 0; lane < scenario.lanes; lane++) {
      if (lane === drop.lane) continue;
      lines.push(`<connection from="main" to="down" fromLane="${lane}" toLane="${lane < drop.lane ? lane : lane - 1}"/>`);
    }
    connections = `<connections>\n${lines.join("\n")}\n</connections>\n`;
  } else {
    nodes.push(`<node id="n1" x="${scenario.roadLengthM}" y="0"/>`);
    edges.push(edge("main", "n0", "n1", scenario.lanes));
  }
  writeFileSync(join(dir, "net.nod.xml"), `<nodes>\n${nodes.join("\n")}\n</nodes>\n`);
  writeFileSync(join(dir, "net.edg.xml"), `<edges>\n${edges.join("\n")}\n</edges>\n`);
  const netconvertArgs = [
    "--node-files", join(dir, "net.nod.xml"),
    "--edge-files", join(dir, "net.edg.xml"),
    "--lefthand", "true",
    "--no-turnarounds", "true",
    "--offset.disable-normalization", "true",
    "--no-warnings", "true",
    "-o", join(dir, "net.net.xml"),
  ];
  if (drop) {
    writeFileSync(join(dir, "net.con.xml"), connections);
    netconvertArgs.push("--connection-files", join(dir, "net.con.xml"));
  }
  execFileSync(bin("netconvert"), netconvertArgs, { stdio: ["ignore", "ignore", "inherit"] });

  const type = carTypeAttributes();
  const lines: string[] = [
    "<routes>",
    `<vType id="car" ${attributes(type)}/>`,
    // The same type again for the cars whose trajectories are recorded.
    `<vType id="carRecorded" ${attributes(type)}><param key="has.fcd.device" value="true"/></vType>`,
    `<route id="r" edges="${routeEdges.join(" ")}"/>`,
  ];
  const carIds: string[] = [];
  const groupIds = new Map<string, string[]>();
  // SUMO wants vehicles sorted by departure time; all placed cars depart at 0, written front first.
  const order = scenario.cars.map((_, index) => index).sort((a, b) => scenario.cars[b]!.frontM - scenario.cars[a]!.frontM);
  for (let index = 0; index < scenario.cars.length; index++) carIds.push(`c${index}`);
  for (const index of order) {
    const car = scenario.cars[index]!;
    const id = carIds[index]!;
    if (car.group !== undefined) {
      const ids = groupIds.get(car.group);
      if (ids) ids.push(id);
      else groupIds.set(car.group, [id]);
    }
    const common = `id="${id}" type="${car.group !== undefined ? "carRecorded" : "car"}" route="r" depart="0" departLane="${car.lane}"`;
    if (car.stationary) {
      // A car that never moves: it starts on a stop that lasts longer than the run.
      lines.push(
        `<vehicle ${common} departPos="stop" departSpeed="0" insertionChecks="none">` +
          `<stop lane="main_${car.lane}" endPos="${car.frontM}" duration="1000000"/></vehicle>`,
      );
    } else {
      lines.push(`<vehicle ${common} departPos="${car.frontM}" departSpeed="${car.speedMps}" insertionChecks="none"/>`);
    }
  }
  (options.departures ?? []).forEach((departure, index) => {
    // Our engine puts an entering car in the lane with the longest clear road, its rear bumper at the
    // start of the road, at its desired speed or its leader's, whichever is lower, and makes it wait
    // while there is no room. SUMO's nearest settings: the least occupied lane ("free"), the base
    // position, and the speed of the traffic already on the lane ("avg"); SUMO also makes the car wait
    // while there is no room. SUMO's documentation (Simulation/VehicleInsertion) recommends using all
    // lanes and departSpeed "avg" or "last" where a high insertion flow is wanted; with departSpeed
    // "max" SUMO let in under 900 cars/h per lane here and the lane drop was never reached by more
    // traffic than it can carry.
    lines.push(
      `<vehicle id="d${index}" type="car" route="r" depart="${departure.timeS.toFixed(1)}" departLane="free" departPos="base" departSpeed="${options.departSpeed ?? "avg"}"/>`,
    );
  });
  lines.push("</routes>");
  writeFileSync(join(dir, "routes.rou.xml"), lines.join("\n") + "\n");
  return { dir, carIds, groupIds, routeEdges };
}

export interface SumoRunOptions {
  /** Simulated seconds to run for. */
  durationS: number;
  seed: number;
  /** Record the recorded cars from this time on. */
  recordFromS?: number;
  /** Write the cumulative count of arrived vehicles every this many seconds. */
  summaryPeriodS?: number;
  /** Speeds to force on one vehicle through TraCI: index k is the speed at time k * step. */
  prescribed?: { vehicleId: string; speedMps: number[] };
  /** Further SUMO options. */
  extraArgs?: string[];
}

export interface SumoTrajectoryPoint {
  timeS: number;
  /** Distance along the route of the front bumper, metres (lane position, plus the first edge's length on the second edge). */
  frontM: number;
  speedMps: number;
  lane: string;
}

export interface SumoRunSummary {
  /** Vehicles SUMO teleported (its way of freeing stuck vehicles), by reason. */
  teleports: { total: number; jam: number; yield: number; wrongLane: number };
  collisions: number;
  emergencyBraking: number;
  vehicles: { loaded: number; inserted: number; running: number; waiting: number };
  /** arrived = inserted - running, from SUMO's statistics. */
  arrived: number;
  /** Warnings SUMO wrote, first few. */
  warnings: string[];
  warningCount: number;
  /** Recorded cars: id -> points, in time order. */
  trajectories: Map<string, SumoTrajectoryPoint[]>;
  /** [time, cumulative arrived] when a summary period was asked for. */
  arrivedSeries: [number, number][];
  /** Summary rows at which loaded != inserted + waiting or inserted != running + ended (T0.1 for SUMO). */
  summaryConservationViolations: number;
  summaryRows: number;
  /** Negative speeds or positions beyond the lane seen in the recorded trajectories. */
  negativeSpeeds: number;
  /** A hash of the recorded trajectories, to compare two runs of the same seed. */
  trajectoryHash: string;
  wallClockS: number;
  command: string;
}

const here = dirname(fileURLToPath(import.meta.url));

function numberAttribute(text: string, name: string): number {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(text);
  return match ? Number(match[1]) : 0;
}

export function runSumo(inputs: SumoInputs, options: SumoRunOptions): SumoRunSummary {
  const started = Date.now();
  const dir = inputs.dir;
  const args = [
    "--net-file", join(dir, "net.net.xml"),
    "--route-files", join(dir, "routes.rou.xml"),
    "--step-length", String(STEP_S),
    "--step-method.ballistic", "true",
    "--begin", "0",
    // Output for time t is written by the step that starts at t, so run one step past the duration.
    "--end", (options.durationS + STEP_S).toFixed(1),
    "--seed", String(options.seed),
    "--time-to-teleport", "300",
    "--collision.action", "warn",
    "--no-step-log", "true",
    "--duration-log.disable", "true",
    "--precision", "6",
    "--statistic-output", join(dir, "statistics.xml"),
    "--fcd-output", join(dir, "fcd.csv"),
    "--fcd-output.attributes", "id,speed,pos,lane",
    "--device.fcd.probability", "0",
    "--device.fcd.begin", String(options.recordFromS ?? 0),
    "--log", join(dir, "sumo.log"),
    ...(options.extraArgs ?? []),
  ];
  if (options.summaryPeriodS !== undefined) {
    args.push("--summary-output", join(dir, "summary.xml"), "--summary-output.period", String(options.summaryPeriodS));
  }
  let command: string;
  if (options.prescribed) {
    // One vehicle's speed is forced at every step through SUMO's control interface (libsumo).
    writeFileSync(join(dir, "prescribed.json"), JSON.stringify({ args, ...options.prescribed }));
    const script = join(here, "..", "sumo", "prescribed_speed.py");
    command = `${bin("python")} ${script} ${join(dir, "prescribed.json")}`;
    const result = spawnSync(bin("python"), [script, join(dir, "prescribed.json")], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`SUMO (prescribed speed) failed: ${result.stderr}`);
  } else {
    command = `sumo ${args.join(" ")}`;
    const result = spawnSync(bin("sumo"), args, { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`SUMO failed in ${dir}: ${result.stderr}`);
  }

  const statistics = readFileSync(join(dir, "statistics.xml"), "utf8");
  const tag = (name: string) => new RegExp(`<${name}\\b[^>]*>`).exec(statistics)?.[0] ?? "";
  const vehicles = tag("vehicles");
  const teleports = tag("teleports");
  const safety = tag("safety");
  const log = existsSync(join(dir, "sumo.log")) ? readFileSync(join(dir, "sumo.log"), "utf8") : "";
  const warnings = log.split("\n").filter((line) => line.startsWith("Warning") || line.startsWith("Error"));

  const trajectories = new Map<string, SumoTrajectoryPoint[]>();
  let negativeSpeeds = 0;
  let hashA = 2166136261;
  let hashB = 0x9e3779b9;
  if (existsSync(join(dir, "fcd.csv"))) {
    const firstEdgeLengthM = inputs.routeEdges.length > 1 ? edgeLength(dir, "main") : 0;
    const text = readFileSync(join(dir, "fcd.csv"), "utf8");
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      hashA = Math.imul(hashA ^ code, 16777619);
      hashB = Math.imul(hashB + code, 0x85ebca6b) ^ (hashB >>> 13);
    }
    const rows = text.split("\n");
    const header = rows[0]!.split(";");
    const column = (name: string) => header.findIndex((title) => title === name || title.endsWith(`_${name}`));
    const timeAt = column("time");
    const idAt = column("id");
    const speedAt = column("speed");
    const posAt = column("pos");
    const laneAt = column("lane");
    // With no recorded car the file has a time column only.
    const noCars = idAt < 0 && header.length <= 1;
    if (!noCars && (timeAt < 0 || idAt < 0 || speedAt < 0 || posAt < 0 || laneAt < 0)) {
      throw new Error(`Unexpected FCD header: ${rows[0]}`);
    }
    for (let r = 1; !noCars && r < rows.length; r++) {
      const cells = rows[r]!.split(";");
      const id = cells[idAt];
      if (cells.length < header.length || id === undefined || id === "") continue;
      const lane = cells[laneAt]!;
      const speedMps = Number(cells[speedAt]);
      if (speedMps < 0) negativeSpeeds++;
      const point = {
        timeS: Number(cells[timeAt]),
        frontM: Number(cells[posAt]) + (lane.startsWith("down") ? firstEdgeLengthM : 0),
        speedMps,
        lane,
      };
      const list = trajectories.get(id);
      if (list) list.push(point);
      else trajectories.set(id, [point]);
    }
  }

  const arrivedSeries: [number, number][] = [];
  let summaryConservationViolations = 0;
  if (options.summaryPeriodS !== undefined) {
    const summary = readFileSync(join(dir, "summary.xml"), "utf8");
    for (const match of summary.matchAll(/<step\b[^>]*>/g)) {
      const row = match[0];
      arrivedSeries.push([numberAttribute(row, "time"), numberAttribute(row, "arrived")]);
      const loaded = numberAttribute(row, "loaded");
      const insertedNow = numberAttribute(row, "inserted");
      if (loaded !== insertedNow + numberAttribute(row, "waiting") || insertedNow !== numberAttribute(row, "running") + numberAttribute(row, "ended")) {
        summaryConservationViolations++;
      }
    }
  }

  const inserted = numberAttribute(vehicles, "inserted");
  const running = numberAttribute(vehicles, "running");
  return {
    teleports: {
      total: numberAttribute(teleports, "total"),
      jam: numberAttribute(teleports, "jam"),
      yield: numberAttribute(teleports, "yield"),
      wrongLane: numberAttribute(teleports, "wrongLane"),
    },
    collisions: numberAttribute(safety, "collisions"),
    emergencyBraking: numberAttribute(safety, "emergencyBraking"),
    vehicles: { loaded: numberAttribute(vehicles, "loaded"), inserted, running, waiting: numberAttribute(vehicles, "waiting") },
    arrived: inserted - running,
    warnings: warnings.slice(0, 5),
    warningCount: warnings.length,
    trajectories,
    arrivedSeries,
    summaryConservationViolations,
    summaryRows: arrivedSeries.length,
    negativeSpeeds,
    trajectoryHash: `${hashA >>> 0}:${hashB >>> 0}`,
    wallClockS: (Date.now() - started) / 1000,
    command,
  };
}

/** Length of an edge's first lane in the generated network, metres. */
export function edgeLength(dir: string, edgeId: string): number {
  const net = readFileSync(join(dir, "net.net.xml"), "utf8");
  const match = new RegExp(`<lane id="${edgeId}_0"[^>]*\\blength="([^"]*)"`).exec(net);
  if (!match) throw new Error(`Edge ${edgeId} not found in the generated network`);
  return Number(match[1]);
}
