/**
 * Runs one job in its own process: `tsx src/job-cli.ts <job.json> <result.json>`.
 * main.ts starts one of these per job; it can also be run by hand to repeat a single job.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { runJob, type Job, type JobContext } from "./jobs";

const [jobFile, resultFile] = process.argv.slice(2);
if (!jobFile || !resultFile) {
  console.error("Usage: tsx src/job-cli.ts <job.json> <result.json>");
  process.exit(2);
}
const { job, context } = JSON.parse(readFileSync(jobFile, "utf8")) as { job: Job; context: JobContext };
const started = Date.now();
const result = runJob(job, context);
writeFileSync(resultFile, JSON.stringify({ job, wallClockS: (Date.now() - started) / 1000, result }));
