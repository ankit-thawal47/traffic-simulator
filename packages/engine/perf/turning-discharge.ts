/**
 * Turning traffic at junctions (ticket 24): what a saturated four-way signal junction and the junction beneath the
 * flyover discharge, for an engine given by the path of its index.ts (default: this one), so engines can be compared.
 *
 *   pnpm --filter @traffic-simulator/engine exec tsx perf/turning-discharge.ts [path/to/engine/src/index.ts] [seeds]
 *
 * Four-way junction (test/four-way.ts; two lanes each way, 1500 veh/h an approach, more than it can take), cars in
 * lanes and the Bengaluru mix in mixed traffic, under two plans:
 *   one-at-a-time: one approach at a time, 20 s green; no turn meets traffic from another approach;
 *   opposing: north-south together, then east-west (30 s green each; the plan of benchmark test T2.4), so right turns
 *     cross oncoming traffic.
 * Each with every movement (20% left, 60% straight on, 20% right) and with straight on only. Discharge per green is
 * the vehicles whose front bumper crossed an approach's stop line, per green of that approach, after a 300 s warm-up,
 * in a run of 1800 s. The flyover row is the network of benchmark Tier 3 (cars in lanes) for 1800 s: vehicles through,
 * and vehicles let into the junction beneath the flyover.
 */
import { resolve } from "node:path";
import { everyMovement, fourWay, oneApproachAtATime, opposingApproachesTogether, ARMS } from "../test/four-way";
import { tier3Input } from "../../benchmark/src/tier3";

const engine = (await import(resolve(process.argv[2] ?? "src/index.ts"))) as typeof import("../src/index");
const seeds = (process.argv[3] ?? "1,2,3").split(",").map(Number);
const DURATION_S = 1800;
const WARM_UP_S = 300;

function straightOnly(perApproach: number, mixed: boolean): ReturnType<typeof everyMovement> {
  const flows = ARMS.map((from, at) => ({ entryRoadId: `${from}-in`, exitRoadId: `${ARMS[(at + 2) % 4]}-out`, vehiclesPerHour: perApproach }));
  return mixed ? { flows, vehicleMix: everyMovement(1).vehicleMix } : { flows };
}

interface Measure {
  perGreen: number;
  through: number;
  stuck: number;
  longestStandS: number;
}

/** Runs one input, counting stop-line crossings at junction `junctionId` per green of each approach. */
function measure(input: Parameters<typeof engine.createRun>[0], junctionId: string): Measure {
  const run = engine.createRun(input);
  const crossed = new Set<number>();
  const crossings = new Map<string, number>();
  const greens = new Map<string, number>();
  const plan = input.network.junctions!.find((junction) => junction.id === junctionId)!;
  const approaches = new Set(plan.connections.map((connection) => connection.fromRoadId));
  const cycleS =
    plan.control === "signal"
      ? plan.signalPlan.phases.reduce((sum, phase) => sum + phase.greenS + plan.signalPlan.amberS + plan.signalPlan.allRedS, 0)
      : 0;
  // Greens of each approach that start after the warm-up and end before the end of the run.
  if (plan.control === "signal") {
    for (let start = 0; start < DURATION_S; start += cycleS) {
      let at = start;
      for (const phase of plan.signalPlan.phases) {
        if (at >= WARM_UP_S && at + phase.greenS <= DURATION_S) {
          for (const id of phase.greenRoadIds) greens.set(id, (greens.get(id) ?? 0) + 1);
        }
        at += phase.greenS + plan.signalPlan.amberS + plan.signalPlan.allRedS;
      }
    }
  }
  const standingSince = new Map<number, number>();
  let longestStandS = 0;
  while (run.timeS < DURATION_S - 1e-9) {
    run.step();
    const snapshot = run.snapshot();
    for (const vehicle of snapshot.vehicles) {
      if (vehicle.speedMps < 0.1) {
        if (!standingSince.has(vehicle.id)) standingSince.set(vehicle.id, snapshot.timeS);
        longestStandS = Math.max(longestStandS, snapshot.timeS - standingSince.get(vehicle.id)!);
      } else standingSince.delete(vehicle.id);
      const turn = vehicle.turn;
      if (!turn || turn.junctionId !== junctionId || crossed.has(vehicle.id)) continue;
      crossed.add(vehicle.id);
      if (snapshot.timeS > WARM_UP_S && approaches.has(turn.fromRoadId)) crossings.set(turn.fromRoadId, (crossings.get(turn.fromRoadId) ?? 0) + 1);
    }
  }
  let total = 0;
  let greenCount = 0;
  for (const id of approaches) {
    total += crossings.get(id) ?? 0;
    greenCount += greens.get(id) ?? 0;
  }
  const results = run.results();
  return { perGreen: greenCount > 0 ? total / greenCount : total, through: results.vehiclesThrough, stuck: results.stuckVehicles, longestStandS };
}

const rows: { name: string; input: (seed: number) => Parameters<typeof engine.createRun>[0]; junction: string }[] = [];
for (const [planName, plan] of [
  ["one-at-a-time", oneApproachAtATime(20)],
  ["opposing", opposingApproachesTogether(30, 3, 2)],
] as const) {
  for (const lanes of [true, false]) {
    for (const turns of [true, false]) {
      rows.push({
        name: `${planName}, ${lanes ? "cars in lanes" : "mixed traffic"}, ${turns ? "every movement" : "straight on only"}`,
        input: (seed) => ({
          network: fourWay({ signalPlan: plan }),
          demand: turns ? everyMovement(1500, !lanes) : straightOnly(1500, !lanes),
          seed,
          laneDiscipline: lanes,
        }),
        junction: "cross",
      });
    }
  }
}
rows.push({ name: "flyover (Tier 3 network), junction beneath", input: (seed) => tier3Input(seed), junction: "cross" });

console.log(`engine ${resolve(process.argv[2] ?? "src/index.ts")}; seeds ${seeds.join(",")}; ${DURATION_S} s each`);
console.log("| Scenario | Discharge per green | Through | Stuck released | Longest stood (s) |");
console.log("|---|---|---|---|---|");
for (const row of rows) {
  const measures = seeds.map((seed) => measure(row.input(seed), row.junction));
  const mean = (pick: (m: Measure) => number) => measures.reduce((sum, m) => sum + pick(m), 0) / measures.length;
  console.log(
    `| ${row.name} | ${mean((m) => m.perGreen).toFixed(1)} | ${mean((m) => m.through).toFixed(0)} | ` +
      `${measures.reduce((sum, m) => sum + m.stuck, 0)} | ${Math.max(...measures.map((m) => m.longestStandS)).toFixed(0)} |`,
  );
}
