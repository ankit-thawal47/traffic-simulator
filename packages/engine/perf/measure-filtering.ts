/**
 * Measures filtering: who stands at the front of a signal queue, delay by
 * vehicle class and vehicles across the stop line a green, in mixed traffic
 * with filtering on and off, and with lane discipline.
 * Run from packages/engine with: pnpm exec tsx perf/measure-filtering.ts [seconds]
 */
import { VEHICLE_CLASSES, type RunInput } from "../src/index";
import { everyMovement, fourWay, oneApproachAtATime } from "../test/four-way";
import { measureFiltering } from "../test/filtering-measure";

const seeds = [1, 2, 3, 4, 5];
const seconds = Number(process.argv[2] ?? 1800);

function report(title: string, input: Omit<RunInput, "seed">): void {
  const sums = { front: [0, 0, 0, 0], crossed: [0, 0, 0, 0], delay: [0, 0, 0, 0], through: 0, stuck: 0 };
  for (const seed of seeds) {
    const m = measureFiltering({ ...input, seed }, seconds);
    VEHICLE_CLASSES.forEach((vehicleClass, i) => {
      sums.front[i]! += m.atFrontPerGreen[vehicleClass] / seeds.length;
      sums.crossed[i]! += m.crossedPerGreen[vehicleClass] / seeds.length;
      sums.delay[i]! += (m.meanDelayS[vehicleClass] ?? 0) / seeds.length;
    });
    sums.through += m.vehiclesThrough / seeds.length;
    sums.stuck += m.stuckVehicles / seeds.length;
  }
  const row = (values: number[]) => values.map((value) => value.toFixed(2).padStart(9)).join("");
  console.log(`${title}\n  vehicle class:    ${VEHICLE_CLASSES.map((c) => c.slice(0, 8).padStart(9)).join("")}`);
  console.log(`  at front / green: ${row(sums.front)}`);
  console.log(`  crossed / green:  ${row(sums.crossed)}`);
  console.log(`  mean delay, s:    ${row(sums.delay)}`);
  console.log(`  vehicles through: ${sums.through.toFixed(1)}; stuck vehicles: ${sums.stuck.toFixed(1)}`);
}

const variants: [string, Partial<RunInput>][] = [
  ["mixed traffic, filtering on (the default)", {}],
  ["mixed traffic, filtering off", { filtering: false }],
  ["lane discipline", { laneDiscipline: true }],
];

const perApproachList = (process.argv[3] ?? "500,800,1500").split(",").map(Number);
for (const perApproach of perApproachList) {
  const base = { network: fourWay({ signalPlan: oneApproachAtATime(25) }), demand: everyMovement(perApproach) };
  for (const [name, variant] of variants) {
    report(`${perApproach} veh/h an approach, ${seconds} s, mean of seeds ${seeds.join(",")}: ${name}`, { ...base, ...variant });
  }
}
