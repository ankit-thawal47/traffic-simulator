/**
 * Fetches the OpenStreetMap extract of an area from the Overpass API, with the
 * same request the web app makes (src/area/overpass.ts), and writes it with
 * the fetch date and the attribution:
 *
 *   pnpm --filter @traffic-simulator/corridor fetch-area <name> <south> <west> <north> <east>
 *
 * Written to data/areas/<name>/osm-extract.json. The request carries only the
 * query and a generic client name. One request per run.
 * Data © OpenStreetMap contributors, Open Database Licence (ODbL) 1.0.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchArea } from "../src/area/overpass";

const [name, ...corners] = process.argv.slice(2);
const [south, west, north, east] = corners.map(Number);
if (!name || corners.length !== 4) {
  console.error("usage: fetch-area <name> <south> <west> <north> <east>");
  process.exit(1);
}
const fetched = await fetchArea({ south: south!, west: west!, north: north!, east: east! }, (url, init) =>
  fetch(url, { ...init, headers: { ...init.headers, "User-Agent": "corridor-importer/0.1" } } as RequestInit),
);
if (!fetched.ok) {
  console.error(fetched.message);
  process.exit(1);
}
const folder = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "areas", name);
mkdirSync(folder, { recursive: true });
const file = join(folder, "osm-extract.json");
writeFileSync(file, `${JSON.stringify({ name, ...fetched.value })}\n`);
console.log(`${file}: ${fetched.value.elements.length} elements, OpenStreetMap data as of ${fetched.value.osmDataTimestamp}`);
