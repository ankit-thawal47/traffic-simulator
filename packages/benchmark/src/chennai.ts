/**
 * The Chennai Saidapet trajectory data (Kanagaraj, Asaithambi, Toledo and Lee, "Trajectory data
 * and flow characteristics of mixed traffic", TRB 2015; legend dated 14 October 2014), read from
 * the two XLSX files that scripts/fetch-chennai.sh downloads into data/external/chennai. The files
 * state no licence and are never committed; only figures computed from them are.
 *
 * Columns (legend): vehicle number, type (1 motorcycle, 2 car, 3 bus, 4 truck, 5 light commercial
 * vehicle, 6 auto-rickshaw), time (s, 0.5 s apart), length, width (m), longitudinal position of the
 * front (m from the upstream end), longitudinal speed, acceleration, lateral position of the centre
 * (m from the left edge), lateral speed, acceleration, flag (1 to 7: corrected by hand for overlap).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VehicleClass } from "@traffic-simulator/engine";

export const CHENNAI_DIR = process.env.CHENNAI_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data", "external", "chennai");
export const CHENNAI_FILES = ["ChennaiTrajectoryData2.45-3.00PM.xlsx", "ChennaiTrajectoryData3.00-3.15PM.xlsx"] as const;

/** The data's six vehicle types, and the engine class each is run as (the engine has four). */
export const CHENNAI_TYPES: Record<number, { name: string; engineClass: VehicleClass }> = {
  1: { name: "motorcycle", engineClass: "two-wheeler" },
  2: { name: "car", engineClass: "car" },
  3: { name: "bus", engineClass: "bus" },
  4: { name: "truck", engineClass: "bus" },
  5: { name: "light commercial vehicle", engineClass: "car" },
  6: { name: "auto-rickshaw", engineClass: "auto-rickshaw" },
};

export interface Observation {
  vehicle: number;
  type: number;
  timeS: number;
  lengthM: number;
  widthM: number;
  frontM: number;
  speedMps: number;
  lateralM: number;
  flag: number;
}

export function chennaiAvailable(): boolean {
  return CHENNAI_FILES.every((name) => existsSync(join(CHENNAI_DIR, name)));
}

/** Every observation in one of the two files, in file order. */
export function readChennai(file: (typeof CHENNAI_FILES)[number]): Observation[] {
  const xml = execFileSync("unzip", ["-p", join(CHENNAI_DIR, file), "xl/worksheets/sheet1.xml"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const shared = execFileSync("unzip", ["-p", join(CHENNAI_DIR, file), "xl/sharedStrings.xml"], { encoding: "utf8" });
  const strings = [...shared.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]!);
  const rows: Observation[] = [];
  let header: string[] | null = null;
  for (const row of xml.matchAll(/<row\b[^>]*>(.*?)<\/row>/gs)) {
    const cells = new Map<string, string>();
    for (const cell of row[1]!.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<v>([^<]*)<\/v>)?<\/c>/g)) {
      const value = cell[3] ?? "";
      cells.set(cell[1]!, /t="s"/.test(cell[2]!) ? strings[Number(value)]! : value);
    }
    if (!header) {
      header = [...cells.values()];
      continue;
    }
    // The two files name two columns differently ("Length (m)" in one, "Length" in the other).
    const col = (title: string) => {
      const index = header!.findIndex((name) => name === title || name === title.replace(/ \(m\)$/, ""));
      if (index < 0) throw new Error(`Chennai file has no column "${title}"`);
      return Number(cells.get(String.fromCharCode(65 + index)));
    };
    rows.push({
      vehicle: col("Vehicle Number"),
      type: col("Vehicle Type"),
      timeS: col("Time (sec)"),
      lengthM: col("Length (m)"),
      widthM: col("Width (m)"),
      frontM: col("Long Distance (m)"),
      speedMps: col("Long Speed (m/sec)"),
      lateralM: col("Lat Distance (m)"),
      flag: col("Flag"),
    });
  }
  return rows;
}
