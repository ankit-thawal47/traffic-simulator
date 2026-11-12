/**
 * Stuck vehicles released in a simulated hour on the examples and the Hebbal
 * corridor, for an engine given by the path of its index.ts (default: this one).
 * Used to compare stuck-vehicle counts before and after an engine change.
 *
 *   pnpm --filter @traffic-simulator/engine exec tsx perf/stuck-counts.ts [path/to/engine/src/index.ts] [extra RunInput JSON]
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunInput } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const enginePath = resolve(process.argv[2] ?? join(here, "..", "src", "index.ts"));
const extra = JSON.parse(process.argv[3] ?? "{}") as Partial<RunInput>;
const engine = (await import(enginePath)) as typeof import("../src/index");

const examples = ["signal-junction", "flyover", "priority-junction"].map((name) => ({
  name,
  input: JSON.parse(readFileSync(join(here, "..", "examples", `${name}.json`), "utf8")) as RunInput,
}));
const corridor = JSON.parse(readFileSync(join(here, "..", "..", "corridor", "data", "hebbal", "corridor.json"), "utf8")) as {
  network: RunInput["network"];
  demand: RunInput["demand"];
};
examples.push({ name: "hebbal", input: { network: corridor.network, demand: corridor.demand, seed: 1 } });

for (const { name, input } of examples) {
  const run = engine.createRun({ ...input, ...extra });
  while (run.timeS < 3600) run.step();
  const results = run.results();
  console.log(`${name}: ${results.stuckVehicles} stuck vehicles in 3600 s; ${results.vehiclesThrough} through`);
}
