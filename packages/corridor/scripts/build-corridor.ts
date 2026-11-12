/**
 * Builds a prepared corridor's data file from its OpenStreetMap extract, its
 * corrections and its demand file:
 *
 *   pnpm --filter @traffic-simulator/corridor build-corridor [hebbal]
 *
 * Writes data/<name>/corridor.json. Stops without writing if the corrections
 * and the extract do not agree.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { roadLengthM } from "@traffic-simulator/engine";
import { prepareCorridor } from "../src/prepared-corridor";

const name = process.argv[2] ?? "hebbal";
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", name);
const read = (file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));

const { corridor, problems } = prepareCorridor(read("osm-extract.json"), read("corrections.json"), read("demand.json"));
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
writeFileSync(join(dir, "corridor.json"), JSON.stringify(corridor, null, 1) + "\n");
for (const road of corridor.network.roads) {
  const highest = Math.max(...road.points.map((point) => point.z ?? 0));
  console.log(
    `${road.id.padEnd(22)} ${roadLengthM(road).toFixed(0).padStart(5)} m  ${road.lanes} lanes  ${road.widthM} m  ` +
      `${highest > 0 ? `raised to ${highest} m` : "ground"}  ${corridor.roadNames[road.id]}`,
  );
}
console.log(`${corridor.network.junctions?.length ?? 0} junctions; ${corridor.demand.flows.length} flows`);
for (const adjustment of corridor.adjustments) console.log(`- ${adjustment}`);
