import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import { importArea, type AreaData } from "../src/index";

/**
 * Real places, imported from committed OpenStreetMap extracts exactly as the
 * web app imports them (© OpenStreetMap contributors, ODbL 1.0). The hour-long
 * runs are `pnpm --filter @traffic-simulator/corridor run-area <name>`; their
 * results are in data/areas/README.md. Here each runs five minutes with the
 * consistency checks.
 */
function extract(path: string): AreaData {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as AreaData;
}

const AREAS: { name: string; kind: string; data: () => AreaData }[] = [
  {
    name: "hebbal",
    kind: "a flyover interchange (part of the Hebbal corridor's extract)",
    data: () => ({ ...extract("../data/hebbal/osm-extract.json"), bounds: { south: 13.03, west: 77.585, north: 13.045, east: 77.595 } }),
  },
  { name: "koramangala", kind: "signal junctions in a city grid (Bengaluru)", data: () => extract("../data/areas/koramangala/osm-extract.json") },
  { name: "kolkata-ajc-bose", kind: "a flyover over a city street with signals beneath (Kolkata)", data: () => extract("../data/areas/kolkata-ajc-bose/osm-extract.json") },
  { name: "gemini", kind: "an arterial junction (Chennai, Anna Salai)", data: () => extract("../data/areas/gemini/osm-extract.json") },
  ...["mumbai-eeh-vikhroli"]
    .filter((name) => existsSync(new URL(`../data/areas/${name}/osm-extract.json`, import.meta.url)))
    .map((name) => ({ name, kind: "a highway with its slip roads and the road beside it (Mumbai, Eastern Express Highway at Vikhroli)", data: () => extract(`../data/areas/${name}/osm-extract.json`) })),
];

describe.each(AREAS)("the area $name, $kind", ({ data }) => {
  it("imports, with every guessed value listed, and runs five minutes with the consistency checks passing", () => {
    const imported = importArea(data());
    if (!imported.ok) throw new Error(imported.message);
    const { network, demand, guesses } = imported.value;

    expect(network.roads.length).toBeGreaterThan(5);
    for (const road of network.roads) {
      for (const kind of ["lanes", "width", "speed-limit"]) {
        expect(guesses.some((guess) => guess.kind === kind && guess.roadId === road.id), `${kind} of ${road.id}`).toBe(true);
      }
    }
    for (const junction of network.junctions ?? []) {
      if (junction.control === "none") continue;
      expect(guesses.some((guess) => guess.kind === "control" && guess.junctionId === junction.id), `control of ${junction.id}`).toBe(true);
    }
    const report = checkRunConsistency({ network, demand, seed: 1 }, { durationS: 300 });
    expect(report.violations).toEqual([]);
  }, 120_000);
});

describe("an area that cannot be imported", () => {
  it("is refused with the reason: Gurugram on NH 48, where a road passes under another in an underpass", () => {
    const outcome = importArea(extract("../data/areas/gurugram-nh48/osm-extract.json"));
    expect(outcome).toEqual({ ok: false, message: expect.stringMatching(/underpass or tunnel/) });
  });
});
