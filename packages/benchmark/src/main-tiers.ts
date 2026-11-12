/**
 * The benchmark command for Tiers 2 to 5 of docs/benchmark-standard.md:
 *
 *   pnpm --filter @traffic-simulator/benchmark bench:tiers                    # run every job, write the results document
 *   ... bench:tiers --only t2.2 --jobs 4                                       # one kind of job (or one job id)
 *   ... bench:tiers --only t5 --jobs 1                                         # Tier 5 alone, one process at a time
 *   ... bench:tiers --report-only                                              # rebuild the document from results/raw/tiers-2-to-5
 *
 * Raw results go to packages/benchmark/results/raw/tiers-2-to-5/<kind>.json, the document to
 * docs/benchmark-results-<date>-tiers-2-to-5.md. Finished jobs are kept in .work/tiers-cache, so
 * an interrupted run resumes where it stopped; --fresh ignores them. Tier 4 needs the Chennai data
 * (scripts/fetch-chennai.sh); Tier 5 should be run with --jobs 1 so its timings are not shared.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { arch, cpus, loadavg, platform, release, totalmem } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chennaiAvailable } from "./chennai";
import { writeTiersReport } from "./report-tiers";
import { sumoVersionLine, SUMO_VERSION } from "./sumo-run";
import { allTierJobs, type TierJob } from "./tiers-jobs";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = join(here, "..");
const repoDir = join(packageDir, "..", "..");
const workDir = join(packageDir, ".work");
const cacheDir = join(workDir, "tiers-cache");
export const TIERS_RAW_DIR = join(packageDir, "results", "raw", "tiers-2-to-5");

export interface TierEntry {
  job: TierJob;
  wallClockS: number;
  result: unknown;
}

function runOne(job: TierJob, sumo: boolean, keepWork: boolean): Promise<TierEntry> {
  const jobFile = join(cacheDir, `${job.id}.job.json`);
  const resultFile = join(cacheDir, `${job.id}.json`);
  writeFileSync(jobFile, JSON.stringify({ job, context: { workDir: join(workDir, "tiers-jobs", job.id), sumo, keepWork } }));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", join(here, "tiers-job-cli.ts"), jobFile, resultFile], {
      cwd: packageDir,
      stdio: ["ignore", "inherit", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) return reject(new Error(`Job ${job.id} failed (exit ${code}):\n${stderr}`));
      resolve(JSON.parse(readFileSync(resultFile, "utf8")) as TierEntry);
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const date = value("--date") ?? new Date().toLocaleDateString("sv-SE");
  const reportFile = join(repoDir, "docs", `benchmark-results-${date}-tiers-2-to-5.md`);
  mkdirSync(TIERS_RAW_DIR, { recursive: true });
  if (flag("--report-only")) {
    writeTiersReport(TIERS_RAW_DIR, reportFile);
    console.log(`Wrote ${reportFile}`);
    return;
  }
  const sumoLine = flag("--no-sumo") ? null : sumoVersionLine();
  if (sumoLine && !sumoLine.includes(SUMO_VERSION)) throw new Error(`Expected SUMO ${SUMO_VERSION}, found: ${sumoLine}`);
  if (!sumoLine) console.log("SUMO not run: its columns will read 'not run'.");
  const parallel = Number(value("--jobs") ?? Math.max(1, cpus().length - 2));
  const only = value("--only");
  mkdirSync(cacheDir, { recursive: true });

  let jobs = allTierJobs().filter((job) => !only || job.kind === only || job.id === only);
  if (!chennaiAvailable()) {
    console.log("The Chennai data is not in data/external/chennai (run scripts/fetch-chennai.sh): T4.1 to T4.4 are left out.");
    jobs = jobs.filter((job) => job.kind !== "t4-field" && job.kind !== "t4-chennai");
  }
  const finished: TierEntry[] = [];
  const queue: TierJob[] = [];
  for (const job of jobs) {
    const cached = join(cacheDir, `${job.id}.json`);
    if (!flag("--fresh") && existsSync(cached)) finished.push(JSON.parse(readFileSync(cached, "utf8")) as TierEntry);
    else queue.push(job);
  }
  console.log(`${jobs.length} jobs: ${finished.length} already done, ${queue.length} to run, ${parallel} at a time. Load average ${loadavg()[0]!.toFixed(1)}.`);
  const started = Date.now();
  let done = 0;
  const total = queue.length;
  const worker = async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      finished.push(await runOne(job, sumoLine !== null, flag("--keep-work")));
      done++;
      if (done % 10 === 0 || done === total) console.log(`  ${done}/${total} jobs, ${((Date.now() - started) / 60000).toFixed(1)} min`);
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));

  // Raw results: one file per kind, merged with what is already there for jobs not run now.
  const order = new Map(allTierJobs().map((job, index) => [job.id, index]));
  for (const kind of new Set(finished.map((entry) => entry.job.kind))) {
    const file = join(TIERS_RAW_DIR, `${kind}.json`);
    const kept = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as TierEntry[]) : [];
    const byId = new Map(kept.map((entry) => [entry.job.id, entry]));
    for (const entry of finished.filter((e) => e.job.kind === kind)) byId.set(entry.job.id, entry);
    const entries = [...byId.values()].filter((e) => order.has(e.job.id)).sort((a, b) => order.get(a.job.id)! - order.get(b.job.id)!);
    writeFileSync(file, JSON.stringify(entries, null, 1) + "\n");
  }
  const git = (...gitArgs: string[]) => execFileSync("git", gitArgs, { cwd: repoDir, encoding: "utf8" }).trim();
  const metaFile = join(TIERS_RAW_DIR, "meta.json");
  const previous = existsSync(metaFile) ? (JSON.parse(readFileSync(metaFile, "utf8")) as { runs?: unknown[] }) : {};
  const run = {
    date,
    only: only ?? "all",
    jobsRun: total,
    parallelJobs: parallel,
    gitCommit: git("rev-parse", "HEAD"),
    engineCommit: git("log", "-1", "--format=%H", "--", "packages/engine"),
    gitDirty: git("status", "--porcelain", "--", "packages/engine", "packages/benchmark/src") !== "",
    sumoVersion: sumoLine,
    machine: `${cpus()[0]?.model ?? "unknown CPU"}, ${cpus().length} cores, ${Math.round(totalmem() / 2 ** 30)} GB, ${platform()} ${release()} ${arch()}`,
    node: process.version,
    loadAverageAtStart: loadavg()[0],
    wallClockMin: (Date.now() - started) / 60000,
  };
  writeFileSync(metaFile, JSON.stringify({ runs: [...(previous.runs ?? []), run] }, null, 1) + "\n");
  if (!flag("--keep-work")) rmSync(join(workDir, "tiers-jobs"), { recursive: true, force: true });
  writeTiersReport(TIERS_RAW_DIR, reportFile);
  console.log(`Wrote ${reportFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
