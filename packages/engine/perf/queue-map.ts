/**
 * Print a map of an approach's queue the moment its signal turns green: one row
 * per metre back from the stop line, one column per strip (m two-wheeler, C car,
 * A auto-rickshaw, B bus). For looking at filtering by eye.
 *
 *   pnpm --filter @traffic-simulator/engine exec tsx perf/queue-map.ts examples/signal-junction.json south-in [greens] ['{"filtering":false}']
 */
import { readFileSync } from "node:fs";
import { createRun, roadLengthM, signalState, stripsOccupied, type RunInput } from "../src/index";

const [file, roadId = "south-in", greens = "2", extra = "{}"] = process.argv.slice(2);
if (!file) throw new Error("Give an example file");
const input = { ...(JSON.parse(readFileSync(file, "utf8")) as RunInput), ...(JSON.parse(extra) as Partial<RunInput>) };
const road = input.network.roads.find((r) => r.id === roadId)!;
const lengthM = roadLengthM(road);
const plan = input.network.junctions!.find((j) => j.connections.some((c) => c.fromRoadId === roadId))!.signalPlan;
const stripCount = Math.floor(road.widthM / 0.5);
const chars = { "two-wheeler": "m", car: "C", "auto-rickshaw": "A", bus: "B" } as const;
const run = createRun(input);
let wasGreen = true;
let shown = 0;
while (shown < Number(greens) && run.timeS < 3600) {
  const green = signalState(plan, roadId, run.timeS) === "green";
  if (green && !wasGreen) {
    shown++;
    const rows: string[][] = Array.from({ length: 45 }, () => new Array<string>(stripCount).fill("."));
    for (const v of run.snapshot().vehicles) {
      if (v.roadId !== roadId || v.turn) continue;
      const strips = stripsOccupied(v.vehicleClass);
      const strip = Math.round(v.lateralM / 0.5 - strips / 2);
      for (let d = Math.floor(lengthM - v.positionM); d < Math.ceil(lengthM - v.positionM + v.lengthM) && d < 45; d++) {
        for (let s = strip; s < strip + strips; s++) if (rows[d]) rows[d]![s] = chars[v.vehicleClass];
      }
    }
    console.log(`t=${run.timeS}`);
    rows.forEach((r, d) => console.log(String(d).padStart(3), r.join("")));
  }
  wasGreen = green;
  run.step();
}
