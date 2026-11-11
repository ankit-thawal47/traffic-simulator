/**
 * The benchmark command: runs Tier 0 and Tier 1 of docs/benchmark-standard.md
 * against our engine, SUMO and the reference, and writes the results table.
 *
 *   pnpm --filter @traffic-simulator/benchmark bench            # run everything, write the table
 *   ... bench --report-only                                     # rebuild the table from the committed raw results
 *   ... bench --only t1.5 --jobs 4                              # run one kind of job (results of the others are kept)
 *   ... bench --no-sumo                                         # our engine and the reference only
 *
 * Raw results go to packages/benchmark/results/raw/, the table to
 * docs/benchmark-results-<date>.md. Finished jobs are kept in .work/cache so an
 * interrupted run can be resumed; --fresh ignores them.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TIER0_SCENARIO_NAMES, type Job, type JobContext, type JobResult, type OpenRoadMix } from "./jobs";
import { writeReport } from "./report";
import { sumoEnvDir, sumoVersionLine, SUMO_VERSION } from "./sumo-run";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = join(here, "..");
const repoDir = join(packageDir, "..", "..");
const workDir = join(packageDir, ".work");
const cacheDir = join(workDir, "cache");
const rawDir = join(packageDir, "results", "raw");

export const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Densities of T1.3 and T1.4, vehicles/km per lane: 10 to 140 in tens, and 62, the whole number nearest the peak of the equilibrium curve. */
export const DENSITIES = [10, 20, 30, 40, 50, 60, 62, 70, 80, 90, 100, 110, 120, 130, 140];

export interface FinishedJob {
  job: Job;
  wallClockS: number;
  result: JobResult;
}

export interface Meta {
  date: string;
  gitCommit: string;
  /** The last commit that changed the engine. */
  engineCommit: string;
  gitDirty: boolean;
  sumoVersion: string | null;
  sumoPinned: string;
  sumoEnv: string;
  machine: string;
  node: string;
  parallelJobs: number;
  totalWallClockS: number;
}

function allJobs(): Job[] {
  const jobs: Job[] = [];
  for (const scenario of TIER0_SCENARIO_NAMES) {
    for (const seed of SEEDS) jobs.push({ kind: "tier0", id: `tier0-${TIER0_SCENARIO_NAMES.indexOf(scenario)}-s${seed}`, scenario, seed });
  }
  jobs.push({ kind: "t1.1", id: "t1.1" }, { kind: "t1.2", id: "t1.2" }, { kind: "t1.2-partial", id: "t1.2-partial" });
  for (const seed of SEEDS) jobs.push({ kind: "t1.5", id: `t1.5-s${seed}`, seed });
  const openRoad = (mix: OpenRoadMix, lanes: number, laneWidthM: number) => {
    for (const seed of SEEDS) {
      jobs.push({ kind: "open-road", id: `open-${mix.replace(/ /g, "_")}-l${lanes}-w${laneWidthM}-s${seed}`, mix, lanes, laneWidthM, seed });
    }
  };
  const mixes: OpenRoadMix[] = ["cars", "bengaluru", "two-wheeler", "auto-rickshaw", "bus", "two-wheelers and cars", "bengaluru at one desired speed"];
  for (const mix of mixes) for (const lanes of [1, 2, 3]) openRoad(mix, lanes, 3.5);
  for (const laneWidthM of [2.5, 5, 7]) openRoad("bengaluru", 3, laneWidthM);
  // The largest jobs last, three-lane first among them so the pool stays full to the end.
  for (const lanes of [1, 3, 2]) {
    for (const densityPerKm of DENSITIES) {
      for (const seed of SEEDS) jobs.push({ kind: "ring", id: `ring-l${lanes}-d${densityPerKm}-s${seed}`, lanes, densityPerKm, seed });
    }
  }
  return jobs;
}

/** Jobs whose SUMO input files are copied into results/sumo-inputs as examples of what SUMO was given. */
const KEEP_INPUTS_OF = new Set(["t1.1", "t1.2", "t1.2-partial", "t1.5-s1", "ring-l1-d60-s1"]);

function runOne(job: Job, sumo: boolean, keepWork: boolean): Promise<FinishedJob> {
  const jobWork = join(workDir, "jobs", job.id);
  const keep = keepWork || KEEP_INPUTS_OF.has(job.id);
  const context: JobContext = { workDir: jobWork, sumo, keepWork: keep };
  const jobFile = join(cacheDir, `${job.id}.job.json`);
  const resultFile = join(cacheDir, `${job.id}.json`);
  writeFileSync(jobFile, JSON.stringify({ job, context }));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", join(here, "job-cli.ts"), jobFile, resultFile], {
      cwd: packageDir,
      stdio: ["ignore", "inherit", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) return reject(new Error(`Job ${job.id} failed (exit ${code}):\n${stderr}`));
      if (KEEP_INPUTS_OF.has(job.id) && sumo) copyInputs(jobWork, join(packageDir, "results", "sumo-inputs", job.id));
      if (!keepWork) rmSync(jobWork, { recursive: true, force: true });
      resolve(JSON.parse(readFileSync(resultFile, "utf8")) as FinishedJob);
    });
  });
}

/** Copy the small SUMO files (inputs, statistics, command) of a job, leaving out trajectories and anything large. */
function copyInputs(from: string, to: string): void {
  if (!existsSync(from)) return;
  for (const name of readdirSync(from)) {
    const path = join(from, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      copyInputs(path, join(to, name));
    } else if (stats.size < 60_000 && !name.startsWith("fcd") && !name.endsWith(".log")) {
      mkdirSync(to, { recursive: true });
      // Paths inside the files point into the working directory; keep them relative.
      const text = readFileSync(path, "utf8").split(from).join(".");
      writeFileSync(join(to, name), text);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const date = value("--date") ?? new Date().toLocaleDateString("sv-SE");
  const reportFile = join(repoDir, "docs", `benchmark-results-${date}.md`);

  if (flag("--report-only")) {
    writeReport(rawDir, reportFile);
    console.log(`Wrote ${reportFile}`);
    return;
  }

  const sumoLine = flag("--no-sumo") ? null : sumoVersionLine();
  if (!sumoLine) {
    console.log(
      flag("--no-sumo")
        ? "SUMO switched off: its columns will read 'not run'."
        : `SUMO ${SUMO_VERSION} not found in ${sumoEnvDir()} (run scripts/install-sumo.sh). Its columns will read 'not run'.`,
    );
  } else if (!sumoLine.includes(SUMO_VERSION)) {
    throw new Error(`Expected SUMO ${SUMO_VERSION}, found: ${sumoLine}`);
  }
  const parallel = Number(value("--jobs") ?? Math.max(1, cpus().length - 2));
  const only = value("--only");
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });

  const jobs = allJobs().filter((job) => !only || job.kind === only || job.id === only);
  const finished: FinishedJob[] = [];
  const queue: Job[] = [];
  for (const job of jobs) {
    const cached = join(cacheDir, `${job.id}.json`);
    if (!flag("--fresh") && existsSync(cached)) finished.push(JSON.parse(readFileSync(cached, "utf8")) as FinishedJob);
    else queue.push(job);
  }
  console.log(`${jobs.length} jobs: ${finished.length} already done, ${queue.length} to run, ${parallel} at a time.`);

  const started = Date.now();
  let done = 0;
  const total = queue.length;
  const worker = async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      finished.push(await runOne(job, sumoLine !== null, flag("--keep-work")));
      done++;
      if (done % 10 === 0 || done === total) {
        console.log(`  ${done}/${total} jobs, ${((Date.now() - started) / 60000).toFixed(1)} min`);
      }
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));

  // Raw results, one file per kind of job, in a fixed order.
  const order = new Map(allJobs().map((job, index) => [job.id, index]));
  finished.sort((a, b) => order.get(a.job.id)! - order.get(b.job.id)!);
  const kinds = new Set(finished.map((entry) => entry.job.kind));
  for (const kind of kinds) {
    const entries = finished.filter((entry) => entry.job.kind === kind);
    writeFileSync(join(rawDir, `${kind}.json`), JSON.stringify(entries, null, 1) + "\n");
  }

  const git = (...gitArgs: string[]) => execFileSync("git", gitArgs, { cwd: repoDir, encoding: "utf8" }).trim();
  const meta: Meta = {
    date,
    gitCommit: git("rev-parse", "HEAD"),
    engineCommit: git("log", "-1", "--format=%H", "--", "packages/engine"),
    gitDirty:
      git("status", "--porcelain", "--", "packages/engine", "packages/benchmark/src", "packages/benchmark/sumo", ":(exclude)packages/benchmark/src/report.ts") !== "",
    sumoVersion: sumoLine,
    sumoPinned: SUMO_VERSION,
    sumoEnv: sumoEnvDir().replace(process.env.HOME ?? "~", "~"),
    machine: `${cpus()[0]?.model ?? "unknown CPU"}, ${cpus().length} cores, ${Math.round(totalmem() / 2 ** 30)} GB, ${platform()} ${release()} ${arch()}`,
    node: process.version,
    parallelJobs: parallel,
    totalWallClockS: Math.round(finished.reduce((sum, entry) => sum + entry.wallClockS, 0)),
  };
  if (!only) writeFileSync(join(packageDir, "results", "meta.json"), JSON.stringify(meta, null, 1) + "\n");

  writeReport(rawDir, reportFile);
  console.log(`Wrote ${reportFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
