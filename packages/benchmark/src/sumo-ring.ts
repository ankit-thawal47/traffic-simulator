/**
 * A true ring road in SUMO: four edges of 250 m on a circle, joined without
 * internal junction lanes, so the ring is exactly 1 km round. Cars drive round
 * it on a route that repeats.
 *
 * Our engine cannot express a ring (see ring.ts), so this network is run in
 * SUMO only, as a check that the periodic long road both engines are given
 * behaves as the ring it stands for.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LANE_WIDTH_M } from "./scenario";
import { carTypeAttributes, sumoEnvDir, type SumoInputs } from "./sumo-run";

export interface RingCar {
  lane: number;
  /** Front bumper, metres along the ring, 0 <= frontM < ring length. */
  frontM: number;
  speedMps: number;
}

const EDGES = 4;

export function writeSumoRing(dir: string, ringLengthM: number, lanes: number, speedLimitMps: number, cars: RingCar[]): SumoInputs {
  mkdirSync(dir, { recursive: true });
  const radius = ringLengthM / (2 * Math.PI);
  const edgeLengthM = ringLengthM / EDGES;
  const at = (angle: number) => `${(radius * Math.cos(angle)).toFixed(3)},${(radius * Math.sin(angle)).toFixed(3)}`;
  const nodes: string[] = [];
  const edges: string[] = [];
  for (let k = 0; k < EDGES; k++) {
    const from = (2 * Math.PI * k) / EDGES;
    const to = (2 * Math.PI * (k + 1)) / EDGES;
    nodes.push(`<node id="n${k}" x="${at(from).split(",")[0]}" y="${at(from).split(",")[1]}"/>`);
    const shape: string[] = [];
    for (let i = 0; i <= 16; i++) shape.push(at(from + ((to - from) * i) / 16));
    edges.push(
      `<edge id="e${k}" from="n${k}" to="n${(k + 1) % EDGES}" numLanes="${lanes}" speed="${speedLimitMps}" width="${LANE_WIDTH_M}" ` +
        `length="${edgeLengthM}" shape="${shape.join(" ")}"/>`,
    );
  }
  writeFileSync(join(dir, "net.nod.xml"), `<nodes>\n${nodes.join("\n")}\n</nodes>\n`);
  writeFileSync(join(dir, "net.edg.xml"), `<edges>\n${edges.join("\n")}\n</edges>\n`);
  execFileSync(
    join(sumoEnvDir(), "bin", "netconvert"),
    [
      "--node-files", join(dir, "net.nod.xml"),
      "--edge-files", join(dir, "net.edg.xml"),
      "--lefthand", "true",
      "--no-turnarounds", "true",
      // No internal junction lanes: a car passes from one edge to the next with no distance in between.
      "--no-internal-links", "true",
      "--junctions.limit-turn-speed", "-1",
      "--offset.disable-normalization", "true",
      "--no-warnings", "true",
      "-o", join(dir, "net.net.xml"),
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  const type = Object.entries(carTypeAttributes())
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  const lines = ["<routes>", `<vType id="carRecorded" ${type}><param key="has.fcd.device" value="true"/></vType>`];
  for (let k = 0; k < EDGES; k++) {
    const order = Array.from({ length: EDGES }, (_, i) => `e${(k + i) % EDGES}`).join(" ");
    lines.push(`<route id="r${k}" edges="${order}" repeat="15"/>`);
  }
  const carIds: string[] = [];
  cars.forEach((car, index) => {
    const edge = Math.min(EDGES - 1, Math.floor(car.frontM / edgeLengthM));
    carIds.push(`c${index}`);
    lines.push(
      `<vehicle id="c${index}" type="carRecorded" route="r${edge}" depart="0" departLane="${car.lane}" ` +
        `departPos="${car.frontM - edge * edgeLengthM}" departSpeed="${car.speedMps}" insertionChecks="none"/>`,
    );
  });
  lines.push("</routes>");
  writeFileSync(join(dir, "routes.rou.xml"), lines.join("\n") + "\n");
  return { dir, carIds, groupIds: new Map([["ring", carIds]]), routeEdges: ["ring"] };
}
