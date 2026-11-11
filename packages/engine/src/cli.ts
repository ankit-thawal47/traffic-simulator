/**
 * Run the engine from the command line, with no browser:
 *
 *   pnpm engine [scenario.json] [--duration <seconds>] [--seed <integer>] [--check]
 *
 * The file holds { network, demand, seed, initialVehicles? }. Without a file,
 * the one-road example is run. Prints the results as JSON. With --check, the
 * consistency checks are applied too and a failure sets a non-zero exit code.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkRunConsistency } from "./consistency-checks";
import { createRun } from "./run";
import type { RunInput } from "./types";

function main(argv: string[]): number {
  let file: string | undefined;
  let durationS = 3600;
  let seed: number | undefined;
  let check = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") continue;
    if (arg === "--check") check = true;
    else if (arg === "--duration") durationS = Number(argv[++i]);
    else if (arg === "--seed") seed = Number(argv[++i]);
    else if (arg.startsWith("--")) return fail(`Unknown option: ${arg}`);
    else file = arg;
  }
  if (!(durationS > 0)) return fail("--duration needs a positive number of seconds");
  if (seed !== undefined && !Number.isInteger(seed)) return fail("--seed needs an integer");

  const here = dirname(fileURLToPath(import.meta.url));
  const path = file
    ? resolve(process.env.INIT_CWD ?? process.cwd(), file)
    : resolve(here, "../examples/one-road.json");
  const input = JSON.parse(readFileSync(path, "utf8")) as RunInput;
  if (seed !== undefined) input.seed = seed;

  if (check) {
    const report = checkRunConsistency(input, { durationS });
    console.log(JSON.stringify({ seed: input.seed, results: report.results, violations: report.violations }, null, 2));
    return report.violations.length === 0 ? 0 : 1;
  }

  const run = createRun(input);
  while (run.timeS < durationS) run.step();
  console.log(JSON.stringify({ seed: input.seed, results: run.results() }, null, 2));
  return 0;
}

function fail(message: string): number {
  console.error(message);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
