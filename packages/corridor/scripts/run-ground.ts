/**
 * Runs the ground-level network of a prepared corridor in the engine with the
 * consistency checks, and reports vehicles through, longest queues and engine speed:
 *
 *   pnpm --filter @traffic-simulator/corridor run-ground [hebbal] [--duration <seconds>] [--scale <share of demand>] [--seed <integer>]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRun, type RunInput } from "@traffic-simulator/engine";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import type { PreparedCorridor } from "../src/prepared-corridor";

const args = process.argv.slice(2);
const option = (name: string, fallback: number): number => {
  const at = args.indexOf(name);
  return at < 0 ? fallback : Number(args[at + 1]);
};
const name = args[0] && !args[0].startsWith("--") ? args[0] : "hebbal";
const durationS = option("--duration", 3600);
const scale = option("--scale", 1);
const seed = option("--seed", 1);

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "data", name, "corridor.json");
const corridor = JSON.parse(readFileSync(file, "utf8")) as PreparedCorridor;
const input: RunInput = {
  network: corridor.groundNetwork,
  demand: {
    ...corridor.groundDemand,
    flows: corridor.groundDemand.flows.map((flow) => ({ ...flow, vehiclesPerHour: flow.vehiclesPerHour * scale })),
  },
  seed,
};

// Engine speed: one plain run, timed, counting the vehicles on the network as it goes.
const run = createRun(input);
const started = performance.now();
let steps = 0;
let vehicleSteps = 0;
let mostVehicles = 0;
while (run.timeS < durationS) {
  run.step();
  const onNetwork = run.results().vehiclesOnNetwork;
  steps++;
  vehicleSteps += onNetwork;
  mostVehicles = Math.max(mostVehicles, onNetwork);
}
const wallS = (performance.now() - started) / 1000;

// The consistency checks: the same input run twice more, every moment checked.
const report = checkRunConsistency(input, { durationS });
const results = report.results;

console.log(
  JSON.stringify(
    {
      corridor: corridor.id,
      durationS,
      seed,
      shareOfDemand: scale,
      demandVehiclesPerHour: Math.round(input.demand.flows.reduce((sum, flow) => sum + flow.vehiclesPerHour, 0)),
      vehiclesEntered: results.vehiclesEntered,
      vehiclesThrough: results.vehiclesThrough,
      vehiclesOnNetworkAtEnd: results.vehiclesOnNetwork,
      vehiclesWaitingToEnterAtEnd: results.vehiclesWaitingToEnter,
      longestQueueByApproach: Object.fromEntries(
        Object.entries(results.longestQueueByApproach).map(([road, queue]) => [road, { lengthM: Math.round(queue.lengthM), vehicles: queue.vehicles }]),
      ),
      meanDelayS: Object.fromEntries(Object.entries(results.delayByVehicleClass).map(([c, d]) => [c, d.meanDelayS === null ? null : Math.round(d.meanDelayS)])),
      consistencyViolations: report.violations.length,
      firstViolations: report.violations.slice(0, 5),
      engine: {
        wallSeconds: Number(wallS.toFixed(2)),
        timesRealTime: Math.round(durationS / wallS),
        meanVehiclesOnNetwork: Math.round(vehicleSteps / steps),
        mostVehiclesOnNetwork: mostVehicles,
      },
    },
    null,
    2,
  ),
);
process.exit(report.violations.length === 0 ? 0 : 1);
