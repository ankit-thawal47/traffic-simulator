#!/usr/bin/env node
// For checking an extract by hand: lists the ways that pass through given nodes,
// or (with --near lat,lon,radiusM) every way with a node inside the circle.
//
//   node packages/corridor/scripts/ways-at.mjs <extract.json> [more extracts] -- <node id ...>
//   node packages/corridor/scripts/ways-at.mjs <extract.json> -- --near 13.0430,77.5905,60
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const split = args.indexOf("--");
const files = args.slice(0, split);
const rest = args.slice(split + 1);
const nodes = new Map();
const ways = new Map();
for (const file of files) {
  for (const e of JSON.parse(readFileSync(file, "utf8")).elements) {
    if (e.type === "node") nodes.set(e.id, { ...nodes.get(e.id), ...e });
    else if (e.type === "way") ways.set(e.id, e);
  }
}
const distM = (a, lat, lon) =>
  Math.hypot((a.lat - lat) * 111_320, (a.lon - lon) * 111_320 * Math.cos((lat * Math.PI) / 180));

let wanted;
if (rest[0] === "--near") {
  const [lat, lon, r] = rest[1].split(",").map(Number);
  wanted = new Set([...nodes.values()].filter((n) => distM(n, lat, lon) <= r).map((n) => n.id));
} else {
  wanted = new Set(rest.map(Number));
}
for (const w of ways.values()) {
  const hits = w.nodes.map((id, i) => (wanted.has(id) ? `${id}@${i}` : null)).filter(Boolean);
  if (hits.length === 0) continue;
  const t = w.tags ?? {};
  const first = nodes.get(w.nodes[0]);
  const last = nodes.get(w.nodes[w.nodes.length - 1]);
  console.log(
    `${w.id} ${t.highway} "${t.name ?? ""}" lanes=${t.lanes ?? "-"} layer=${t.layer ?? "-"} oneway=${t.oneway ?? "-"} n=${w.nodes.length} ` +
      `${first.id}(${first.lat.toFixed(5)},${first.lon.toFixed(5)}) -> ${last.id}(${last.lat.toFixed(5)},${last.lon.toFixed(5)}) hits: ${hits.join(" ")}`,
  );
}
