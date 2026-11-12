// Vehicles standing 300 s on end in an hour of the weaving scenario of diverge-sorting.test.ts, for several seeds,
// for an engine given by the path of its index.ts.
import { resolve } from "node:path";
import { flyoverNetworkWithSplitExit, weavingDemand } from "../test/flyover-network";

const engine = (await import(resolve(process.argv[2] ?? "src/index.ts"))) as typeof import("../src/index");
const seeds = (process.argv[3] ?? "81,82,83,84,85,86").split(",").map(Number);
const extra = JSON.parse(process.argv[4] ?? "{}");
for (const seed of seeds) {
  const run = engine.createRun({ network: flyoverNetworkWithSplitExit(), demand: weavingDemand(3000, 600), seed, laneDiscipline: false, ...extra });
  const since = new Map<number, number>();
  const stood = new Set<number>();
  while (run.timeS < 3600 - 1e-9) {
    run.step();
    if (Math.round(run.timeS * 5) % 5 !== 0) continue;
    for (const vehicle of run.snapshot().vehicles) {
      if (vehicle.speedMps >= 0.1) {
        since.delete(vehicle.id);
        continue;
      }
      if (!since.has(vehicle.id)) since.set(vehicle.id, run.timeS);
      if (run.timeS - since.get(vehicle.id)! >= 300) stood.add(vehicle.id);
    }
  }
  console.log(`seed ${seed}: ${stood.size} stood 300 s; ${run.results().vehiclesThrough} through; ${run.results().stuckVehicles} released`);
}
