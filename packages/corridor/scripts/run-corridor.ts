/**
 * Runs a prepared corridor's whole network in the engine, in mixed traffic,
 * and reports vehicles through, longest queues, vehicles standing long, and
 * engine speed (the engine alone, timed without the checks); then runs it
 * again with the consistency checks:
 *
 *   pnpm --filter @traffic-simulator/corridor run-corridor [hebbal] [--duration <seconds>] [--scale <share of published demand>] [--seed <integer>] [--no-checks]
 *
 * Without --scale the corridor's default demand is used. --scale multiplies
 * the published volumes instead (1 is the published volumes).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRun, type RunInput } from "@traffic-simulator/engine";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import type { PreparedCorridor } from "../src/prepared-corridor";

const args = process.argv.slice(2);
const option = (name: string): number | undefined => {
  const at = args.indexOf(name);
  return at < 0 ? undefined : Number(args[at + 1]);
};
const name = args[0] && !args[0].startsWith("--") ? args[0] : "hebbal";
const durationS = option("--duration") ?? 3600;
const scale = option("--scale");
const seed = option("--seed") ?? 1;
const STANDING_S = 300;

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "data", name, "corridor.json");
const corridor = JSON.parse(readFileSync(file, "utf8")) as PreparedCorridor;
const input: RunInput = {
  network: corridor.network,
  demand: {
    vehicleMix: corridor.demand.vehicleMix,
    flows: corridor.demand.flows.map(({ entryRoadId, exitRoadId, vehiclesPerHour, publishedVehiclesPerHour }) => ({
      entryRoadId,
      exitRoadId,
      vehiclesPerHour: scale === undefined || publishedVehiclesPerHour === undefined ? vehiclesPerHour : publishedVehiclesPerHour * scale,
    })),
  },
  seed,
};

// Engine speed: one plain run, timed. Vehicles standing long are counted from snapshots, outside the timed part.
const run = createRun(input);
let engineMs = 0;
let steps = 0;
let vehicleSteps = 0;
let mostVehicles = 0;
/** For each vehicle, when it last moved at more than walking pace. */
const lastMoved = new Map<number, number>();
const standingLong = new Set<number>();
let longestStandS = 0;
while (run.timeS < durationS) {
  const started = performance.now();
  run.step();
  engineMs += performance.now() - started;
  const snapshot = run.snapshot();
  steps++;
  vehicleSteps += snapshot.vehicles.length;
  mostVehicles = Math.max(mostVehicles, snapshot.vehicles.length);
  for (const vehicle of snapshot.vehicles) {
    if (vehicle.speedMps > 0.5 || !lastMoved.has(vehicle.id)) lastMoved.set(vehicle.id, snapshot.timeS);
    const standS = snapshot.timeS - lastMoved.get(vehicle.id)!;
    longestStandS = Math.max(longestStandS, standS);
    if (standS >= STANDING_S) standingLong.add(vehicle.id);
  }
}
const results = run.results();
/** Where the vehicles standing 300 s or more at the end are: road, and how far short of its end. */
const standingAtEnd: Record<string, number> = {};
for (const vehicle of run.snapshot().vehicles) {
  if (run.timeS - lastMoved.get(vehicle.id)! < STANDING_S) continue;
  const where = vehicle.turn ? `in junction ${vehicle.turn.junctionId}` : vehicle.roadId;
  standingAtEnd[where] = (standingAtEnd[where] ?? 0) + 1;
}
const wallS = engineMs / 1000;
const named = (roadId: string) => corridor.roadNames[roadId] ?? roadId;

const summary = {
  corridor: corridor.id,
  durationS,
  seed,
  demand: scale === undefined ? `default (published x ${corridor.demandScale.value})` : `published x ${scale}`,
  demandVehiclesPerHour: Math.round(input.demand.flows.reduce((sum, flow) => sum + flow.vehiclesPerHour, 0)),
  vehiclesEntered: results.vehiclesEntered,
  vehiclesThrough: results.vehiclesThrough,
  vehiclesOnNetworkAtEnd: results.vehiclesOnNetwork,
  vehiclesWaitingToEnterAtEnd: results.vehiclesWaitingToEnter,
  longestQueueBySignalApproach: Object.fromEntries(
    Object.entries(results.longestQueueByApproach)
      .filter(([roadId]) =>
        corridor.network.junctions?.some(
          (junction) => junction.control === "signal" && junction.connections.some((connection) => connection.fromRoadId === roadId),
        ),
      )
      .map(([roadId, queue]) => [named(roadId), `${Math.round(queue.lengthM)} m, ${queue.vehicles} vehicles`]),
  ),
  vehiclesStanding300sOrMore: standingLong.size,
  longestStandS: Math.round(longestStandS),
  standing300sOrMoreAtEndByRoad: standingAtEnd,
  meanDelayS: Object.fromEntries(
    Object.entries(results.delayByVehicleClass).map(([c, d]) => [c, d.meanDelayS === null ? null : Math.round(d.meanDelayS)]),
  ),
  engine: {
    wallSeconds: Number(wallS.toFixed(2)),
    timesRealTime: Math.round(durationS / wallS),
    meanVehiclesOnNetwork: Math.round(vehicleSteps / steps),
    mostVehiclesOnNetwork: mostVehicles,
  },
};
console.log(JSON.stringify(summary, null, 2));

if (!args.includes("--no-checks")) {
  const report = checkRunConsistency(input, { durationS });
  const byCheck: Record<string, number> = {};
  for (const violation of report.violations) byCheck[violation.check] = (byCheck[violation.check] ?? 0) + 1;
  console.log(JSON.stringify({ consistencyViolations: report.violations.length, byCheck, first: report.violations.slice(0, 5) }, null, 2));
  process.exit(report.violations.length === 0 ? 0 : 1);
}
