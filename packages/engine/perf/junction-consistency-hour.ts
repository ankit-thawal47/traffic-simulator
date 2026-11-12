/**
 * Consistency checks (consistency-checks.ts) through a simulated hour at saturating demand at signal junctions with
 * turning traffic, several seeds, mixed traffic and lane discipline: the four-way junction with opposite approaches
 * together (right turns cross oncoming traffic) and one approach at a time, 1500 veh/h an approach, and the flyover
 * example. Prints the violations found (the first five) and the stuck vehicles released.
 *
 *   pnpm --filter @traffic-simulator/engine exec tsx perf/junction-consistency-hour.ts [seeds]
 */
import { readFileSync } from "node:fs";
import { checkRunConsistency } from "../src/consistency-checks";
import type { RunInput } from "../src/index";
import { everyMovement, fourWay, oneApproachAtATime, opposingApproachesTogether } from "../test/four-way";

const seeds = (process.argv[2] ?? "1,2,3").split(",").map(Number);
const flyover = JSON.parse(readFileSync(new URL("../examples/flyover.json", import.meta.url), "utf8")) as RunInput;
const cases: { name: string; input: (seed: number) => RunInput }[] = [];
for (const laneDiscipline of [true, false]) {
  const traffic = laneDiscipline ? "cars in lanes" : "mixed traffic";
  cases.push({
    name: `four-way, opposite approaches together, ${traffic}`,
    input: (seed) => ({ network: fourWay({ signalPlan: opposingApproachesTogether(30, 3, 2) }), demand: everyMovement(1500, !laneDiscipline), seed, laneDiscipline }),
  });
  cases.push({
    name: `four-way, one approach at a time, ${traffic}`,
    input: (seed) => ({ network: fourWay({ signalPlan: oneApproachAtATime(20) }), demand: everyMovement(1500, !laneDiscipline), seed, laneDiscipline }),
  });
}
cases.push({ name: "flyover example (mixed traffic)", input: (seed) => ({ ...flyover, seed }) });

let failed = false;
for (const { name, input } of cases) {
  for (const seed of seeds) {
    const report = checkRunConsistency(input(seed), { durationS: 3600 });
    failed ||= report.violations.length > 0;
    console.log(
      `${name}, seed ${seed}: ${report.violations.length} violations${report.violations.length ? ` ${JSON.stringify(report.violations.slice(0, 5))}` : ""}; ` +
        `${report.results.vehiclesThrough} through; ${report.results.stuckVehicles} stuck released`,
    );
  }
}
process.exitCode = failed ? 1 : 0;
