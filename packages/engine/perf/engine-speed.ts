/**
 * Engine speed: the engine alone (no consistency checker, no drawing) on an
 * example, in simulated seconds per real second.
 *
 *   pnpm --filter @traffic-simulator/engine exec tsx perf/engine-speed.ts examples/signal-junction.json [simulated seconds] [repeats]
 */
import { readFileSync } from "node:fs";
import { createRun, type RunInput } from "../src/index";

const [file, seconds = "3600", repeats = "3"] = process.argv.slice(2);
if (!file) throw new Error("Give an example file");
const input = JSON.parse(readFileSync(file, "utf8")) as RunInput;
const durationS = Number(seconds);
const rates: number[] = [];
let vehicles = 0;
for (let i = 0; i < Number(repeats); i++) {
  const run = createRun(input);
  const start = performance.now();
  while (run.timeS < durationS) run.step();
  rates.push(durationS / ((performance.now() - start) / 1000));
  vehicles = run.results().vehiclesOnNetwork;
}
rates.sort((a, b) => a - b);
console.log(
  `${file}: ${Math.round(rates[rates.length >> 1]!)} simulated seconds per real second ` +
    `(median of ${rates.length}; ${durationS} s simulated; ${vehicles} vehicles on the network at the end)`,
);
