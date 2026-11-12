/**
 * Tier 5 of the benchmark standard: engineering measures, report only.
 *
 *  T5.1 simulated seconds per wall-clock second at 1,000, 5,000 and 20,000 vehicles;
 *  T5.2 peak memory at those sizes; T5.3 the largest count measured that still ran faster than
 *  real time; T5.4 feature coverage (a checklist, written in the report).
 *
 * The scenario: the vehicles are on the network from the start, spread evenly at 25 per km per
 * lane on parallel 10 km roads of four lanes (1,000 vehicles a road), at the speed of uniform
 * traffic at that density, and the run lasts 60 simulated seconds, so the count stays the same
 * throughout. Two kinds: cars keeping to lanes (SUMO's ordinary model) and the Bengaluru vehicle
 * mix in mixed traffic (our strips; SUMO's sublane model at 0.5 m on 14 m lanes).
 *
 * Each measurement runs in a process of its own under /usr/bin/time -l, which gives its peak
 * resident memory. The speed is over the stepping alone in both: ours is timed around the steps
 * (the run is created first; snapshots and results are not read), SUMO's is the "Duration" it
 * prints itself, which leaves loading out. Setting up (ours) and loading (SUMO's wall-clock time
 * less its duration) are reported apart.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BENGALURU_VEHICLE_MIX, VEHICLE_CLASSES, VEHICLE_CLASS_ASSUMPTIONS, type Network, type RunInput, type VehicleClass } from "@traffic-simulator/engine";
import { equilibrium } from "./reference";
import { CAR, seededRandom } from "./scenario";
import { sumoEnvDir } from "./sumo-run";
import { vTypeFor, writeSumoNetwork } from "./sumo-network";

export const T5 = {
  sizes: [1000, 5000, 20000],
  perRoad: 1000,
  roadLengthM: 10000,
  /** Road beyond the last vehicle, so none reaches the end in the run. */
  clearAheadM: 1000,
  lanes: 4,
  durationS: 60,
};

export type T5Kind = "cars" | "mixed";

/** The scenario of a size and kind, in the engine's format. */
export function t5Input(vehicles: number, kind: T5Kind): RunInput {
  const roads = Math.ceil(vehicles / T5.perRoad);
  const network: Network = {
    formatVersion: 4,
    roads: Array.from({ length: roads }, (_, r) => ({
      id: `r${r}`,
      points: [{ x: 0, y: r * 100 }, { x: T5.roadLengthM + T5.clearAheadM, y: r * 100 }],
      widthM: T5.lanes * 3.5,
      lanes: T5.lanes,
      speedLimitMps: 13.9,
    })),
  };
  const perLane = T5.perRoad / T5.lanes;
  const spacing = T5.roadLengthM / perLane;
  const speed = Math.min(13.9, equilibrium(CAR, 1000 / spacing).speedMps);
  const random = seededRandom(7);
  const classes: VehicleClass[] = [];
  for (const c of VEHICLE_CLASSES) for (let i = 0; i < Math.round(1000 * (BENGALURU_VEHICLE_MIX[c] ?? 0)); i++) classes.push(c);
  const initialVehicles: NonNullable<RunInput["initialVehicles"]> = [];
  for (let v = 0; v < vehicles; v++) {
    const road = Math.floor(v / T5.perRoad);
    const k = v % T5.perRoad;
    const lane = k % T5.lanes;
    const slot = Math.floor(k / T5.lanes);
    const vehicleClass = kind === "cars" ? "car" : classes[Math.floor(random() * classes.length)]!;
    initialVehicles.push({
      roadId: `r${road}`,
      positionM: T5.roadLengthM - 5 - slot * spacing - lane * (spacing / T5.lanes),
      speedMps: Math.min(speed, VEHICLE_CLASS_ASSUMPTIONS[vehicleClass].desiredSpeedMps),
      vehicleClass,
      lateralM: (lane + 0.5) * 3.5,
    });
  }
  return { network, demand: { flows: [] }, seed: 1, laneDiscipline: kind === "cars", initialVehicles };
}

export interface T5Measure {
  vehicles: number;
  kind: T5Kind;
  engine: "ours" | "sumo";
  /** Simulated seconds per wall-clock second over the stepping (ours) or the whole run (SUMO). */
  speedRatio: number;
  /** Wall-clock seconds: setting up the run, and stepping it. */
  setupS: number;
  stepS: number;
  peakMemoryBytes: number | null;
  /** The machine's one-minute load average when the measurement started. */
  loadAverage: number;
  vehiclesAtEnd: number;
}

const here = dirname(fileURLToPath(import.meta.url));

export function runT5(job: { vehicles: number; kind: T5Kind; engine: "ours" | "sumo" }, context: { workDir: string }): T5Measure {
  mkdirSync(context.workDir, { recursive: true });
  const load = loadavg()[0]!;
  if (job.engine === "ours") {
    const result = spawnSync("/usr/bin/time", ["-l", process.execPath, "--import", "tsx", join(here, "tier5-cli.ts"), String(job.vehicles), job.kind], {
      encoding: "utf8",
      cwd: join(here, ".."),
      maxBuffer: 1 << 26,
    });
    if (result.status !== 0) throw new Error(`T5 run failed: ${result.stderr}`);
    const out = JSON.parse(result.stdout.trim().split("\n").pop()!) as { setupS: number; stepS: number; vehiclesAtEnd: number };
    const rss = /(\d+)\s+maximum resident set size/.exec(result.stderr);
    return { ...job, speedRatio: T5.durationS / out.stepS, setupS: out.setupS, stepS: out.stepS, peakMemoryBytes: rss ? Number(rss[1]) : null, loadAverage: load, vehiclesAtEnd: out.vehiclesAtEnd };
  }
  const input = t5Input(job.vehicles, job.kind);
  const net = writeSumoNetwork(input.network, context.workDir, { laneDiscipline: job.kind === "cars" });
  const lines = ["<routes>"];
  const classes = job.kind === "cars" ? (["car"] as VehicleClass[]) : [...VEHICLE_CLASSES];
  for (const c of classes) lines.push(vTypeFor(c, job.kind === "mixed", job.kind === "mixed" ? { latAlignment: "arbitrary" } : {}));
  for (let r = 0; r < input.network.roads.length; r++) lines.push(`<route id="r${r}" edges="r${r}"/>`);
  input.initialVehicles!.forEach((v, i) => {
    const lane = job.kind === "cars" ? Math.round(v.lateralM! / 3.5 - 0.5) : 0;
    const lat = job.kind === "mixed" ? ` departPosLat="${(v.lateralM! - (T5.lanes * 3.5) / 2).toFixed(2)}"` : "";
    lines.push(`<vehicle id="v${i}" type="${v.vehicleClass}" route="${v.roadId}" depart="0" departLane="${lane}" departPos="${v.positionM.toFixed(2)}" departSpeed="${v.speedMps.toFixed(3)}"${lat} insertionChecks="none"/>`);
  });
  lines.push("</routes>");
  const routes = join(context.workDir, "routes.rou.xml");
  writeFileSync(routes, lines.join("\n") + "\n");
  const args = [
    "-l", join(sumoEnvDir(), "bin", "sumo"),
    "--net-file", net.netFile, "--route-files", routes,
    "--step-length", "0.2", "--step-method.ballistic", "true", "--end", String(T5.durationS),
    "--no-step-log", "true", "--duration-log.statistics", "true", "--time-to-teleport", "300",
    ...(job.kind === "mixed" ? ["--lateral-resolution", "0.5"] : []),
  ];
  const started = Date.now();
  const result = spawnSync("/usr/bin/time", args, { encoding: "utf8", maxBuffer: 1 << 26 });
  const wall = (Date.now() - started) / 1000;
  if (result.status !== 0) throw new Error(`SUMO T5 run failed: ${result.stderr}`);
  const rss = /(\d+)\s+maximum resident set size/.exec(result.stderr);
  const running = /Vehicles:[\s\S]*?Running:\s*(\d+)/.exec(result.stdout + result.stderr);
  // SUMO's own "Duration" is its stepping time, loading left out: the same span as ours.
  const duration = /Duration:\s*([\d.]+)(ms|s)/.exec(result.stdout + result.stderr);
  if (!duration) throw new Error("SUMO printed no duration");
  const stepS = Number(duration[1]) / (duration[2] === "ms" ? 1000 : 1);
  return { ...job, speedRatio: T5.durationS / stepS, setupS: wall - stepS, stepS, peakMemoryBytes: rss ? Number(rss[1]) : null, loadAverage: load, vehiclesAtEnd: running ? Number(running[1]) : -1 };
}
