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
for (const road of corridor.roads) {
  console.log(`${road.level.padEnd(6)} ${road.id.padEnd(22)} ${road.lengthM.toFixed(0).padStart(5)} m  ${road.lanes} lanes  ${road.widthM} m`);
}
const total = (level: string) => corridor.roads.filter((r) => r.level === level).reduce((sum, r) => sum + r.lengthM, 0);
console.log(`ground ${total("ground").toFixed(0)} m, raised ${total("raised").toFixed(0)} m, ${corridor.groundNetwork.junctions?.length ?? 0} signal junction(s) in the ground network`);
