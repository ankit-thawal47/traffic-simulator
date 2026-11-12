/**
 * Runs one job of Tiers 2 to 5 in its own process: `tsx src/tiers-job-cli.ts <job.json> <result.json>`.
 * main-tiers.ts starts one of these per job; it can also be run by hand to repeat a single job.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { runTierJob, type TierJob, type TierJobContext } from "./tiers-jobs";

const [jobFile, resultFile] = process.argv.slice(2);
if (!jobFile || !resultFile) {
  console.error("Usage: tsx src/tiers-job-cli.ts <job.json> <result.json>");
  process.exit(2);
}
const { job, context } = JSON.parse(readFileSync(jobFile, "utf8")) as { job: TierJob; context: TierJobContext };
const started = Date.now();
const result = runTierJob(job, context);
writeFileSync(resultFile, JSON.stringify({ job, wallClockS: (Date.now() - started) / 1000, result }));
