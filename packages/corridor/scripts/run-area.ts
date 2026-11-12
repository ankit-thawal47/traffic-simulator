/**
 * Imports a committed area extract with the any-place importer, exactly as
 * the web app does, runs it in mixed traffic at its guessed demand, and
 * reports vehicles through, stuck vehicles and vehicles standing long; then
 * runs it again with the consistency checks:
 *
 *   pnpm --filter @traffic-simulator/corridor run-area <name> [--duration <seconds>] [--seed <integer>] [--no-checks]
 *
 * Reads data/areas/<name>/osm-extract.json (© OpenStreetMap contributors, ODbL 1.0).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRun, type RunInput } from "@traffic-simulator/engine";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import { importArea } from "../src/area/import-area";
import type { AreaExtract } from "../src/area/overpass";

const args = process.argv.slice(2);
const option = (name: string): number | undefined => {
  const at = args.indexOf(name);
  return at < 0 ? undefined : Number(args[at + 1]);
};
const name = args[0];
if (!name || name.startsWith("--")) {
  console.error("usage: run-area <name> [--duration <seconds>] [--seed <integer>] [--no-checks]");
  process.exit(1);
}
const durationS = option("--duration") ?? 3600;
const seed = option("--seed") ?? 1;
const STANDING_S = 300;

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "areas", name, "osm-extract.json");
const extract = JSON.parse(readFileSync(file, "utf8")) as AreaExtract;
const started = performance.now();
const imported = importArea(extract);
const importMs = performance.now() - started;
if (!imported.ok) {
  console.log(JSON.stringify({ area: name, refused: imported.message }, null, 2));
  process.exit(2);
}
const area = imported.value;
const input: RunInput = { network: area.network, demand: area.demand, seed };

const run = createRun(input);
let engineMs = 0;
const lastMoved = new Map<number, number>();
const standingLong = new Set<number>();
let longestStandS = 0;
while (run.timeS < durationS) {
  const before = performance.now();
  run.step();
  engineMs += performance.now() - before;
  const snapshot = run.snapshot();
  for (const vehicle of snapshot.vehicles) {
    if (vehicle.speedMps > 0.5 || !lastMoved.has(vehicle.id)) lastMoved.set(vehicle.id, snapshot.timeS);
    const standS = snapshot.timeS - lastMoved.get(vehicle.id)!;
    longestStandS = Math.max(longestStandS, standS);
    if (standS >= STANDING_S) standingLong.add(vehicle.id);
  }
}
const results = run.results();
const junctions = area.network.junctions ?? [];
const summary = {
  area: name,
  osmDataTimestamp: extract.osmDataTimestamp,
  roads: area.network.roads.length,
  junctions: {
    signal: junctions.filter((one) => one.control === "signal").length,
    priority: junctions.filter((one) => one.control === "priority").length,
    divideOrJoin: junctions.filter((one) => one.control === "none").length,
  },
  raisedRoads: area.network.roads.filter((road) => road.points.some((point) => (point.z ?? 0) > 0)).length,
  guessed: area.guesses.filter((guess) => guess.guessed).length,
  fromOpenStreetMap: area.guesses.filter((guess) => !guess.guessed).length,
  adjustments: area.adjustments.length,
  leftOut: area.adjustments.filter((text) => / is left out/.test(text)),
  importSeconds: Number((importMs / 1000).toFixed(2)),
  durationS,
  seed,
  demandVehiclesPerHour: area.demand.flows.reduce((sum, flow) => sum + flow.vehiclesPerHour, 0),
  flows: area.demand.flows.length,
  vehiclesEntered: results.vehiclesEntered,
  vehiclesThrough: results.vehiclesThrough,
  stuckVehicles: results.stuckVehicles,
  vehiclesOnNetworkAtEnd: results.vehiclesOnNetwork,
  vehiclesWaitingToEnterAtEnd: results.vehiclesWaitingToEnter,
  vehiclesStanding300sOrMore: standingLong.size,
  longestStandS: Math.round(longestStandS),
  engineTimesRealTime: Math.round(durationS / (engineMs / 1000)),
};
console.log(JSON.stringify(summary, null, 2));

if (!args.includes("--no-checks")) {
  const report = checkRunConsistency(input, { durationS });
  const byCheck: Record<string, number> = {};
  for (const violation of report.violations) byCheck[violation.check] = (byCheck[violation.check] ?? 0) + 1;
  console.log(JSON.stringify({ consistencyViolations: report.violations.length, byCheck, first: report.violations.slice(0, 3) }, null, 2));
  process.exit(report.violations.length === 0 ? 0 : 1);
}
