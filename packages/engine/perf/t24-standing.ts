/**
 * Benchmark test T2.4's set-up (test/four-way.ts: two lanes each way, opposite approaches together, 30 s greens, 1500 veh/h an
 * approach, cars in lanes, 30 minutes) for seeds 1 to 10, for an engine given by the path of its index.ts: the longest any
 * vehicle stood (below 0.1 m/s) on end, how many stood 300 s or more, stuck vehicles released and vehicles through.
 *
 *   pnpm --filter @traffic-simulator/engine exec tsx perf/t24-standing.ts [path/to/engine/src/index.ts]
 */
import { resolve } from "node:path";
import { everyMovement, fourWay, opposingApproachesTogether } from "../test/four-way";

const engine = (await import(resolve(process.argv[2] ?? "src/index.ts"))) as typeof import("../src/index");
for (let seed = 1; seed <= 10; seed++) {
  const run = engine.createRun({
    network: fourWay({ signalPlan: opposingApproachesTogether(30, 3, 2) }),
    demand: everyMovement(1500, false),
    seed,
    laneDiscipline: true,
  });
  const since = new Map<number, number>();
  const stood300 = new Set<number>();
  let longestS = 0;
  while (run.timeS < 1800 - 1e-9) {
    run.step();
    for (const vehicle of run.snapshot().vehicles) {
      if (vehicle.speedMps >= 0.1) {
        since.delete(vehicle.id);
        continue;
      }
      if (!since.has(vehicle.id)) since.set(vehicle.id, run.timeS);
      const stoodS = run.timeS - since.get(vehicle.id)!;
      longestS = Math.max(longestS, stoodS);
      if (stoodS >= 300) stood300.add(vehicle.id);
    }
  }
  const results = run.results();
  console.log(
    `seed ${seed}: longest stood ${Math.round(longestS)} s; ${stood300.size} stood 300 s; ${results.stuckVehicles} released; ${results.vehiclesThrough} through`,
  );
}
