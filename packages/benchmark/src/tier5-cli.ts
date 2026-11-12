/**
 * One Tier 5 measurement of our engine in a process of its own (so its peak memory is its own):
 * `tsx src/tier5-cli.ts <vehicles> <cars|mixed>`. Prints one line of JSON.
 */
import { createRun } from "@traffic-simulator/engine";
import { T5, t5Input, type T5Kind } from "./tier5";

const [vehicles, kind] = process.argv.slice(2);
const input = t5Input(Number(vehicles), kind as T5Kind);
const setupStarted = performance.now();
const run = createRun(input);
const setupS = (performance.now() - setupStarted) / 1000;
const steps = Math.round(T5.durationS / 0.2);
const started = performance.now();
for (let i = 0; i < steps; i++) run.step();
const stepS = (performance.now() - started) / 1000;
console.log(JSON.stringify({ setupS, stepS, vehiclesAtEnd: run.results().vehiclesOnNetwork }));
