/**
 * The networks of Tiers 2 to 4, written once in the engine's own format. Each is
 * given to the engine as it is and translated for SUMO by sumo-network.ts, so the
 * two engines run on the same roads (fairness rule 1).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Connection, Network, Road, SignalPlan, VehicleClass } from "@traffic-simulator/engine";
import type { FlowDeparture } from "./demand-replay";
import { roadLength, vTypeFor } from "./sumo-network";

export interface CrossOptions {
  lanes: number;
  laneWidthM: number;
  /** Length of every approach and exit road, metres. */
  armLengthM: number;
  /** Distance from the junction's centre to each stop line, metres. */
  halfGapM: number;
  speedLimitMps: number;
  /** Which arms exist; a T-junction leaves one out. */
  arms?: ("north" | "south" | "east" | "west")[];
}

/**
 * Roads of a four-way junction in left-hand traffic: "south-in" runs north on the west half of
 * the north-south road, "west-in" runs east on the north half of the east-west road, and so on
 * (the layout of the engine's signal-junction example).
 */
export function crossRoads(options: CrossOptions): Road[] {
  const w = options.lanes * options.laneWidthM;
  const half = w / 2;
  const g = options.halfGapM;
  const far = g + options.armLengthM;
  const arms = new Set(options.arms ?? ["north", "south", "east", "west"]);
  const road = (id: string, x0: number, y0: number, x1: number, y1: number): Road => ({
    id,
    points: [{ x: x0, y: y0 }, { x: x1, y: y1 }],
    widthM: w,
    lanes: options.lanes,
    speedLimitMps: options.speedLimitMps,
  });
  const roads: Road[] = [];
  if (arms.has("south")) roads.push(road("south-in", -half, -far, -half, -g), road("south-out", half, -g, half, -far));
  if (arms.has("north")) roads.push(road("north-in", half, far, half, g), road("north-out", -half, g, -half, far));
  if (arms.has("west")) roads.push(road("west-in", -far, half, -g, half), road("west-out", -g, -half, -far, -half));
  if (arms.has("east")) roads.push(road("east-in", far, -half, g, -half), road("east-out", g, half, far, half));
  return roads;
}

/** Every movement from every approach to every exit except back the way it came. */
export function allMovements(roads: Road[]): Connection[] {
  const connections: Connection[] = [];
  for (const from of roads.filter((road) => road.id.endsWith("-in"))) {
    for (const to of roads.filter((road) => road.id.endsWith("-out"))) {
      if (from.id.split("-")[0] === to.id.split("-")[0]) continue;
      connections.push({ fromRoadId: from.id, toRoadId: to.id });
    }
  }
  return connections;
}

export function signalNetwork(roads: Road[], connections: Connection[], plan: SignalPlan, id = "cross"): Network {
  return { formatVersion: 4, roads, junctions: [{ id, control: "signal", connections, signalPlan: plan }] };
}

/**
 * The fastest path on empty roads between two roads, as the engine finds it (run.ts,
 * routeBetween): road length at the road's speed limit, plus the straight line across a junction
 * at the speed limit of the road left; ties settle in the network's order of roads.
 */
export function fastestRoute(network: Network, entryRoadId: string, exitRoadId: string): string[] {
  const roads = new Map(network.roads.map((road) => [road.id, road]));
  const next = new Map<string, string[]>();
  for (const junction of network.junctions ?? []) {
    for (const connection of junction.connections) {
      next.set(connection.fromRoadId, [...(next.get(connection.fromRoadId) ?? []), connection.toRoadId]);
    }
  }
  const timeTo = new Map<string, number>([[entryRoadId, 0]]);
  const cameFrom = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let nearest: string | undefined;
    for (const road of network.roads) {
      const time = timeTo.get(road.id);
      if (time === undefined || done.has(road.id)) continue;
      if (nearest === undefined || time < timeTo.get(nearest)!) nearest = road.id;
    }
    if (nearest === undefined) throw new Error(`No route from ${entryRoadId} to ${exitRoadId}`);
    if (nearest === exitRoadId) break;
    done.add(nearest);
    const road = roads.get(nearest)!;
    const leaveAt = timeTo.get(nearest)! + roadLength(road) / road.speedLimitMps;
    for (const toId of next.get(nearest) ?? []) {
      const to = roads.get(toId);
      if (!to) continue;
      const end = road.points[road.points.length - 1]!;
      const start = to.points[0]!;
      const time = leaveAt + Math.hypot(start.x - end.x, start.y - end.y) / road.speedLimitMps;
      const known = timeTo.get(toId);
      if (known === undefined || time < known) {
        timeTo.set(toId, time);
        cameFrom.set(toId, nearest);
      }
    }
  }
  const route = [exitRoadId];
  while (route[0] !== entryRoadId) route.unshift(cameFrom.get(route[0]!)!);
  return route;
}

export interface RouteFileOptions {
  network: Network;
  departures: FlowDeparture[];
  classes: VehicleClass[];
  sublane: boolean;
  /** Vehicles on the network at the start: SUMO ids, edge, lane, front position, speed, class, lateral offset. */
  placed?: { id: string; route: string[]; lane: number; frontM: number; speedMps: number; vehicleClass: VehicleClass; posLatM?: number }[];
  /** SUMO's way of putting an entering vehicle on the road. */
  departLane?: string;
  departPosLat?: string;
  /** Flows whose route SUMO chooses itself (route choice): flow index -> the routes to choose among. */
  routeChoice?: Map<number, string[][]>;
  extraVTypeAttributes?: Partial<Record<VehicleClass, Record<string, string>>>;
}

/**
 * The route file: the engine's departures, each at the moment the engine's demand produced it,
 * with the same vehicle class, entry and exit, on the engine's route. A flow with route choice is
 * given its routes as a route distribution, from which SUMO's rerouting device then chooses.
 */
export function writeRouteFile(dir: string, options: RouteFileOptions): string {
  const lines = ["<routes>"];
  for (const vehicleClass of options.classes) lines.push(vTypeFor(vehicleClass, options.sublane, options.extraVTypeAttributes?.[vehicleClass]));
  const routeIds = new Map<string, string>();
  const routeId = (edges: string[]) => {
    const key = edges.join(" ");
    let id = routeIds.get(key);
    if (!id) {
      id = `r${routeIds.size}`;
      routeIds.set(key, id);
      lines.push(`<route id="${id}" edges="${key}"/>`);
    }
    return id;
  };
  for (const [flowIndex, routes] of options.routeChoice ?? []) {
    lines.push(`<routeDistribution id="choice${flowIndex}">`);
    for (const edges of routes) lines.push(`  <route id="choice${flowIndex}_${routes.indexOf(edges)}" edges="${edges.join(" ")}" probability="1"/>`);
    lines.push("</routeDistribution>");
  }
  for (const vehicle of options.placed ?? []) {
    const lat = vehicle.posLatM !== undefined ? ` departPosLat="${vehicle.posLatM.toFixed(3)}"` : "";
    lines.push(
      `<vehicle id="${vehicle.id}" type="${vehicle.vehicleClass}" route="${routeId(vehicle.route)}" depart="0" departLane="${vehicle.lane}" ` +
        `departPos="${vehicle.frontM}" departSpeed="${vehicle.speedMps}"${lat} insertionChecks="none"/>`,
    );
  }
  const cache = new Map<string, string>();
  options.departures.forEach((departure, index) => {
    let route: string;
    if (options.routeChoice?.has(departure.flowIndex)) {
      route = `choice${departure.flowIndex}`;
    } else {
      const key = `${departure.entryRoadId}>${departure.exitRoadId}`;
      let id = cache.get(key);
      if (!id) {
        id = routeId(fastestRoute(options.network, departure.entryRoadId, departure.exitRoadId));
        cache.set(key, id);
      }
      route = id;
    }
    const lat = options.departPosLat ? ` departPosLat="${options.departPosLat}"` : "";
    lines.push(
      `<vehicle id="v${index}" type="${departure.vehicleClass}" route="${route}" depart="${departure.timeS.toFixed(3)}" ` +
        `departLane="${options.departLane ?? "best"}" departPos="base" departSpeed="avg"${lat}/>`,
    );
  });
  lines.push("</routes>");
  const file = join(dir, "routes.rou.xml");
  writeFileSync(file, lines.join("\n") + "\n");
  return file;
}
