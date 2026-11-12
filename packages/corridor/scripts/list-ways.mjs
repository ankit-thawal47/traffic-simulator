#!/usr/bin/env node
// Lists the ways of an OpenStreetMap extract with the tags the corrections file
// has to check (lanes, width, level, one-way, speed limit), for checking by hand.
//
//   node packages/corridor/scripts/list-ways.mjs packages/corridor/data/hebbal/osm-extract.json [way id ...]
import { readFileSync } from "node:fs";

const extract = JSON.parse(readFileSync(process.argv[2], "utf8"));
const only = new Set(process.argv.slice(3).map(Number));
const nodes = new Map();
for (const e of extract.elements) if (e.type === "node") nodes.set(e.id, e);

function lengthM(way) {
  let total = 0;
  for (let i = 1; i < way.nodes.length; i++) {
    const a = nodes.get(way.nodes[i - 1]);
    const b = nodes.get(way.nodes[i]);
    const dy = (a.lat - b.lat) * 111_320;
    const dx = (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
    total += Math.hypot(dx, dy);
  }
  return total;
}

const at = (n) => `${n.lat.toFixed(5)},${n.lon.toFixed(5)}`;
let all = 0;
const tagged = { lanes: 0, width: 0, layer: 0, maxspeed: 0, oneway: 0 };
console.log("way\thighway\tname\tlanes\twidth\tlayer\tbridge\toneway\tmaxspeed\tlengthM\tfirstNode\tlastNode\tfrom\tto");
for (const w of extract.elements) {
  if (w.type !== "way") continue;
  if (only.size > 0 && !only.has(w.id)) continue;
  const t = w.tags ?? {};
  const len = lengthM(w);
  all += len;
  for (const key of Object.keys(tagged)) if (t[key] !== undefined) tagged[key] += len;
  const first = nodes.get(w.nodes[0]);
  const last = nodes.get(w.nodes[w.nodes.length - 1]);
  console.log(
    [w.id, t.highway, t.name ?? "", t.lanes ?? "-", t.width ?? "-", t.layer ?? "-", t.bridge ?? "-", t.oneway ?? "-", t.maxspeed ?? "-", Math.round(len), first.id, last.id, at(first), at(last)].join("\t"),
  );
}
console.log(`\ntotal ${Math.round(all)} m; share of length with the tag:`);
for (const [key, len] of Object.entries(tagged)) console.log(`  ${key}: ${((100 * len) / all).toFixed(0)}%`);
for (const e of extract.elements) {
  if (e.type === "node" && e.tags) console.log(`node ${e.id} ${at(e)} ${JSON.stringify(e.tags)}`);
}
