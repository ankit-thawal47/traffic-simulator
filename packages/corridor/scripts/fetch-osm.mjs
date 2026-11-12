#!/usr/bin/env node
// Fetches the OpenStreetMap extract for a prepared corridor from the Overpass API
// and writes it, with the fetch date, to the corridor's data folder.
//
//   node packages/corridor/scripts/fetch-osm.mjs hebbal
//
// The request carries only the query and a generic client name.
// Data (c) OpenStreetMap contributors, Open Database Licence (ODbL) 1.0.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Each corridor: a bounding box (south, west, north, east) and the road classes kept. */
const CORRIDORS = {
  hebbal: {
    bbox: [13.0245, 77.585, 13.0482, 77.595],
    highway: "^(motorway|trunk|primary|secondary|tertiary)(_link)?$",
  },
};

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const id = process.argv[2];
const corridor = CORRIDORS[id];
if (!corridor) {
  console.error(`usage: fetch-osm.mjs <${Object.keys(CORRIDORS).join("|")}> [output file]`);
  process.exit(1);
}
const box = corridor.bbox.join(",");
const query =
  `[out:json][timeout:90];` +
  `(way["highway"~"${corridor.highway}"](${box});` +
  `node["highway"="traffic_signals"](${box}););` +
  `out body;>;out skel qt;`;

let body;
for (const endpoint of ENDPOINTS) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "corridor-importer/0.1",
    },
    body: "data=" + encodeURIComponent(query),
  });
  if (response.ok) {
    body = await response.json();
    break;
  }
  console.error(`${endpoint}: HTTP ${response.status}`);
}
if (!body) process.exit(1);

const extract = {
  corridorId: id,
  source: "OpenStreetMap via the Overpass API",
  attribution: "© OpenStreetMap contributors",
  licence: "ODbL 1.0, https://www.openstreetmap.org/copyright",
  fetchedAt: new Date().toISOString(),
  osmDataTimestamp: body.osm3s?.timestamp_osm_base ?? null,
  query,
  elements: body.elements,
};
const out = process.argv[3] ?? join(here, "..", "data", id, "osm-extract.json");
writeFileSync(out, JSON.stringify(extract) + "\n");
console.log(`${out}: ${extract.elements.length} elements, OSM data as of ${extract.osmDataTimestamp}`);
