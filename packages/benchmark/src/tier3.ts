/**
 * Tier 3 of the benchmark standard: a small network (a flyover, the junction beneath it, and the
 * next junction downstream), cars only, lane discipline on, against SUMO on the same network and
 * demand.
 *
 * The network is the engine's flyover example (packages/engine/examples/flyover.json) with a
 * second signal junction added beyond the north end, so that the flyover's northbound traffic and
 * the junction's meet again downstream. Its demand is cars instead of the example's vehicle mix.
 *
 *  T3.1 hourly flow per link, GEH;  T3.2 mean travel time per origin-destination pair;
 *  T3.3 longest queue per approach;  T3.4 share of through traffic using the flyover.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Network, Road, RunInput, Snapshot } from "@traffic-simulator/engine";
import flyoverExample from "@traffic-simulator/engine/examples/flyover.json";
import { checkDepartures, engineDepartures } from "./demand-replay";
import { runNetwork } from "./network-run";
import { fastestRoute, writeRouteFile } from "./networks";
import { STEP_S } from "./scenario";
import { forEachFcdRow, readTripinfo, roadLength, runSumoNetwork, writeSumoNetwork } from "./sumo-network";
import { sumoSide, type EngineSide, type SumoSide } from "./tier2";

export const T3 = {
  warmUpS: 600,
  measureS: 3600,
  /** Queues are sampled once a second in both engines. */
  queueSampleS: 1,
  /** A vehicle on an approach, short of its stop line, slower than this is queued (the engine's queue speed, 5 km/h). */
  queueSpeedMps: 1.4,
  /** The queue is counted back from the stop line to the first stretch this long with no queued vehicle (the engine's queue break). */
  queueBreakM: 10,
};

/** The flyover example's network, with a signal junction downstream of its north end. */
export function tier3Network(): Network {
  const example = (flyoverExample as unknown as RunInput).network;
  const roads: Road[] = example.roads.map((road) => {
    // The roads at the north end now run to and from the downstream junction (stop lines 15 m from its centre at y = 430).
    if (road.id === "north-exit") return { ...road, points: [{ x: -7, y: 215 }, { x: -7, y: 415 }] };
    if (road.id === "north-entry") return { ...road, points: [{ x: 7, y: 415 }, { x: 7, y: 215 }] };
    return road;
  });
  const lane = (id: string, x0: number, y0: number, x1: number, y1: number, lanes: number): Road => ({
    id,
    points: [{ x: x0, y: y0 }, { x: x1, y: y1 }],
    widthM: lanes * 3.5,
    lanes,
    speedLimitMps: 13.9,
  });
  roads.push(
    lane("far-north-out", -7, 445, -7, 645, 4),
    lane("far-north-in", 7, 645, 7, 445, 4),
    lane("far-west-in", -222, 433.5, -22, 433.5, 2),
    lane("far-east-out", 22, 433.5, 222, 433.5, 2),
    lane("far-east-in", 222, 426.5, 22, 426.5, 2),
    lane("far-west-out", -22, 426.5, -222, 426.5, 2),
  );
  const downstream = {
    id: "downstream",
    control: "signal" as const,
    connections: [
      { fromRoadId: "north-exit", toRoadId: "far-north-out" },
      { fromRoadId: "north-exit", toRoadId: "far-west-out" },
      { fromRoadId: "north-exit", toRoadId: "far-east-out" },
      { fromRoadId: "far-north-in", toRoadId: "north-entry" },
      { fromRoadId: "far-north-in", toRoadId: "far-east-out" },
      { fromRoadId: "far-north-in", toRoadId: "far-west-out" },
      { fromRoadId: "far-west-in", toRoadId: "far-east-out" },
      { fromRoadId: "far-west-in", toRoadId: "far-north-out" },
      { fromRoadId: "far-west-in", toRoadId: "north-entry" },
      { fromRoadId: "far-east-in", toRoadId: "far-west-out" },
      { fromRoadId: "far-east-in", toRoadId: "north-entry" },
      { fromRoadId: "far-east-in", toRoadId: "far-north-out" },
    ],
    signalPlan: {
      phases: [
        { greenRoadIds: ["north-exit", "far-north-in"], greenS: 40 },
        { greenRoadIds: ["far-west-in", "far-east-in"], greenS: 20 },
      ],
      amberS: 3,
      allRedS: 2,
    },
  };
  return { formatVersion: 4, roads, junctions: [...(example.junctions ?? []), downstream] };
}

/** The demand: the example's flows (cars), with the north end's entry moved beyond the new junction, and the new junction's own cross traffic. */
export function tier3Input(seed: number): RunInput {
  const example = flyoverExample as unknown as RunInput;
  const rename = (id: string) => (id === "north-entry" ? "far-north-in" : id === "north-exit" ? "far-north-out" : id);
  const flows = example.demand.flows.map((flow) => ({ ...flow, entryRoadId: rename(flow.entryRoadId), exitRoadId: rename(flow.exitRoadId) }));
  flows.push(
    { entryRoadId: "far-west-in", exitRoadId: "far-east-out", vehiclesPerHour: 300 },
    { entryRoadId: "far-west-in", exitRoadId: "south-exit", vehiclesPerHour: 100 },
    { entryRoadId: "far-east-in", exitRoadId: "far-west-out", vehiclesPerHour: 300 },
    { entryRoadId: "far-east-in", exitRoadId: "far-north-out", vehiclesPerHour: 100 },
  );
  return { network: tier3Network(), demand: { flows }, seed, laneDiscipline: true };
}

export interface Tier3EngineMeasure {
  /** Vehicles entering each road during the measured hour (placed on it, or arriving on it from a junction). */
  flowByRoad: Record<string, number>;
  /** Mean travel time per origin-destination pair ("entry>exit"), from being placed on the network to leaving it, vehicles placed during the measured hour. */
  travelTimeByOd: Record<string, { meanS: number; vehicles: number }>;
  /** Longest queue in the measured hour on each approach, metres, measured by the harness the same way in both engines. */
  longestQueueByApproach: Record<string, number>;
  /** Through traffic (each way) that took the flyover, of that placed during the measured hour. */
  flyoverShare: Record<string, { flyover: number; junction: number }>;
}

export interface T3Result {
  seed: number;
  ours: Tier3EngineMeasure & EngineSide & { engineOwnLongestQueueByApproach: Record<string, number>; waitingToEnter: number };
  sumo: (Tier3EngineMeasure & SumoSide & { waiting: number; teleportsJam: number; teleportsYield: number; teleportsWrongLane: number }) | null;
}

/** Through flows with a choice between the flyover and the junction, and the road that marks the flyover. */
export const THROUGH = {
  "south-entry>far-north-out": "flyover-north",
  "far-north-in>south-exit": "flyover-south",
} as const;

interface QueuedVehicle {
  distanceFromStopLineM: number;
  rearDistanceM: number;
}

/** The engine's queue rule, applied by the harness: from the stop line back to the first gap longer than the queue break with no queued vehicle. */
export function queueLengthM(queued: QueuedVehicle[]): number {
  queued.sort((a, b) => a.distanceFromStopLineM - b.distanceFromStopLineM);
  let reach = 0;
  for (const vehicle of queued) {
    if (vehicle.distanceFromStopLineM - reach > T3.queueBreakM) break;
    reach = Math.max(reach, vehicle.rearDistanceM);
  }
  return reach;
}

export function runT3(job: { seed: number }, context: { workDir: string; sumo: boolean }): T3Result {
  const input = tier3Input(job.seed);
  const network = input.network;
  const from = T3.warmUpS;
  const to = T3.warmUpS + T3.measureS;
  const durationS = to;
  const departures = engineDepartures(input, durationS);
  const lengths = new Map(network.roads.map((road) => [road.id, roadLength(road)]));
  const approaches = new Set((network.junctions ?? []).flatMap((junction) => junction.connections.map((c) => c.fromRoadId)));

  // ---- Our engine.
  const flowByRoad: Record<string, number> = Object.fromEntries(network.roads.map((road) => [road.id, 0]));
  const lastRoad = new Map<number, string>();
  const trip = new Map<number, { entry: string; startS: number; usedFlyover: Set<string> }>();
  const finishedTrips: { entry: string; exit: string; startS: number; endS: number; used: Set<string> }[] = [];
  const longest: Record<string, number> = Object.fromEntries([...approaches].map((id) => [id, 0]));
  let previous = new Map<number, string>();
  const sampleEvery = Math.round(T3.queueSampleS / STEP_S);
  let step = 0;
  const run = runNetwork(input, {
    durationS,
    observe: (snapshot: Snapshot, results) => {
      const t = snapshot.timeS;
      const inWindow = t > from + 1e-9 && t <= to + 1e-9;
      const now = new Map<number, string>();
      const queued = new Map<string, QueuedVehicle[]>();
      for (const vehicle of snapshot.vehicles) {
        now.set(vehicle.id, vehicle.roadId);
        const before = lastRoad.get(vehicle.id);
        if (before !== vehicle.roadId) {
          if (inWindow) flowByRoad[vehicle.roadId]!++;
          lastRoad.set(vehicle.id, vehicle.roadId);
        }
        let current = trip.get(vehicle.id);
        if (!current) {
          current = { entry: vehicle.roadId, startS: t, usedFlyover: new Set() };
          trip.set(vehicle.id, current);
        }
        if (vehicle.roadId.startsWith("flyover")) current.usedFlyover.add(vehicle.roadId);
        if (step % sampleEvery === 0 && approaches.has(vehicle.roadId) && !vehicle.turn && vehicle.speedMps < T3.queueSpeedMps) {
          const length = lengths.get(vehicle.roadId)!;
          if (vehicle.positionM <= length) {
            const list = queued.get(vehicle.roadId) ?? [];
            list.push({ distanceFromStopLineM: length - vehicle.positionM, rearDistanceM: length - vehicle.positionM + vehicle.lengthM });
            queued.set(vehicle.roadId, list);
          }
        }
      }
      if (inWindow && step % sampleEvery === 0) {
        for (const [roadId, list] of queued) longest[roadId] = Math.max(longest[roadId]!, queueLengthM(list));
      }
      for (const [id, roadId] of previous) {
        if (now.has(id)) continue;
        const done = trip.get(id)!;
        finishedTrips.push({ entry: done.entry, exit: roadId, startS: done.startS, endS: t, used: done.usedFlyover });
        trip.delete(id);
        lastRoad.delete(id);
      }
      previous = now;
      if (Math.abs(t - durationS) < STEP_S / 2) checkDepartures(departures, results);
      step++;
    },
  });
  const ownLongest: Record<string, number> = {};
  for (const [roadId, queue] of Object.entries(run.finalResults.longestQueueByApproach)) {
    const minutes = queue.eachMinute.slice(Math.floor(from / 60));
    ownLongest[roadId] = Math.max(0, ...minutes.map((minute) => minute.lengthM));
  }
  const ours = {
    ...summarise(
      flowByRoad,
      // A vehicle that leaves from a road ending at a junction was released as stuck, not through: left out.
      finishedTrips.filter((t) => t.startS > from && t.startS <= to && !approaches.has(t.exit)),
      longest,
    ),
    stuckVehicles: run.stuckVehicles,
    conservationViolations: run.conservationViolations,
    wallClockS: run.wallClockS,
    engineOwnLongestQueueByApproach: ownLongest,
    waitingToEnter: run.finalResults.vehiclesWaitingToEnter,
  };

  // ---- SUMO.
  let sumo: T3Result["sumo"] = null;
  if (context.sumo) {
    const net = writeSumoNetwork(network, context.workDir, { laneDiscipline: true });
    // Through traffic with a choice: SUMO's rerouting device chooses its route once, when it is inserted, from
    // the edges' travel times averaged over the last 60 s (as our engine chooses once, from the last minute).
    const routeChoice = new Map<number, string[][]>();
    input.demand.flows.forEach((flow, index) => {
      const key = `${flow.entryRoadId}>${flow.exitRoadId}` as keyof typeof THROUGH;
      if (!(key in THROUGH)) return;
      const viaJunction = fastestRoute({ ...network, roads: network.roads.filter((road) => road.id !== THROUGH[key]) }, flow.entryRoadId, flow.exitRoadId);
      const viaFlyover = fastestRoute(network, flow.entryRoadId, flow.exitRoadId);
      routeChoice.set(index, [viaFlyover, viaJunction]);
    });
    const routesFile = writeRouteFile(context.workDir, { network, departures, classes: ["car"], sublane: false, routeChoice });
    const edgeData = join(context.workDir, "edgedata.add.xml");
    writeFileSync(
      edgeData,
      `<additional>\n<edgeData id="flow" file="${join(context.workDir, "edgedata.xml")}" begin="${from}" end="${to}" excludeEmpty="false"/>\n</additional>\n`,
    );
    const summary = runSumoNetwork(net, {
      routesFile,
      durationS,
      seed: job.seed,
      additional: [edgeData],
      fcd: { attributes: "id,speed,pos,lane", beginS: from, period: T3.queueSampleS },
      extraArgs: [
        "--device.rerouting.probability", "1",
        "--device.rerouting.period", "0",
        "--device.rerouting.adaptation-interval", "1",
        "--device.rerouting.adaptation-steps", "60",
        "--device.rerouting.with-taz", "false",
      ],
    });
    // Flow per edge: vehicles that entered it, and those inserted on it, in the measured hour.
    const edgeText = readFileSync(join(context.workDir, "edgedata.xml"), "utf8");
    const sumoFlow: Record<string, number> = Object.fromEntries(network.roads.map((road) => [road.id, 0]));
    for (const match of edgeText.matchAll(/<edge\s[^>]*>/g)) {
      const row = match[0];
      const id = /\bid="([^"]*)"/.exec(row)?.[1];
      if (!id || !(id in sumoFlow)) continue;
      const entered = Number(/\bentered="([^"]*)"/.exec(row)?.[1] ?? 0);
      const departed = Number(/\bdeparted="([^"]*)"/.exec(row)?.[1] ?? 0);
      sumoFlow[id] = entered + departed;
    }
    // Queues and flyover use, from the positions every second.
    const sumoLongest: Record<string, number> = Object.fromEntries([...approaches].map((id) => [id, 0]));
    const usedFlyover = new Set<string>();
    let sampleTime = NaN;
    let sample = new Map<string, QueuedVehicle[]>();
    const flush = () => {
      for (const [roadId, list] of sample) sumoLongest[roadId] = Math.max(sumoLongest[roadId]!, queueLengthM(list));
      sample = new Map();
    };
    forEachFcdRow(summary.fcdFile!, (row) => {
      const t = Number(row.time);
      if (t !== sampleTime) {
        flush();
        sampleTime = t;
      }
      const lane = row.lane!;
      const edge = lane.slice(0, lane.lastIndexOf("_"));
      if (edge.startsWith("flyover")) usedFlyover.add(row.id!);
      if (t <= from || !approaches.has(edge) || Number(row.speed) >= T3.queueSpeedMps) return;
      const length = lengths.get(edge)!;
      const list = sample.get(edge) ?? [];
      list.push({ distanceFromStopLineM: length - Number(row.pos), rearDistanceM: length - Number(row.pos) + 4.4 });
      sample.set(edge, list);
    });
    flush();
    const edgeOf = (lane: string) => lane.slice(0, lane.lastIndexOf("_"));
    const trips = readTripinfo(summary.tripinfoFile);
    const tripRows = readFileSync(summary.tripinfoFile, "utf8");
    const lanesById = new Map<string, { depart: string; arrival: string }>();
    for (const match of tripRows.matchAll(/<tripinfo\s[^>]*>/g)) {
      const row = match[0];
      const id = /\bid="([^"]*)"/.exec(row)![1]!;
      lanesById.set(id, { depart: /\bdepartLane="([^"]*)"/.exec(row)?.[1] ?? "", arrival: /\barrivalLane="([^"]*)"/.exec(row)?.[1] ?? "" });
    }
    const sumoTrips = trips
      .filter((t) => t.finished)
      .map((t) => {
        const lanes = lanesById.get(t.id)!;
        return {
          entry: edgeOf(lanes.depart),
          exit: edgeOf(lanes.arrival),
          startS: t.depart,
          endS: t.arrival,
          used: new Set(usedFlyover.has(t.id) ? ["flyover"] : []),
        };
      })
      .filter((t) => t.startS > from && t.startS <= to);
    sumo = {
      ...summarise(sumoFlow, sumoTrips, sumoLongest),
      ...sumoSide(summary),
      waiting: summary.waiting,
      teleportsJam: summary.teleportsJam,
      teleportsYield: summary.teleportsYield,
      teleportsWrongLane: summary.teleportsWrongLane,
    };
  }
  return { seed: job.seed, ours, sumo };
}

function summarise(
  flowByRoad: Record<string, number>,
  trips: { entry: string; exit: string; startS: number; endS: number; used: Set<string> }[],
  longest: Record<string, number>,
): Tier3EngineMeasure {
  const byOd = new Map<string, number[]>();
  const share: Record<string, { flyover: number; junction: number }> = {};
  for (const key of Object.keys(THROUGH)) share[key] = { flyover: 0, junction: 0 };
  for (const t of trips) {
    const key = `${t.entry}>${t.exit}`;
    const list = byOd.get(key) ?? [];
    list.push(t.endS - t.startS);
    byOd.set(key, list);
    if (key in share) {
      if (t.used.size > 0) share[key]!.flyover++;
      else share[key]!.junction++;
    }
  }
  const travelTimeByOd: Record<string, { meanS: number; vehicles: number }> = {};
  for (const [key, list] of [...byOd].sort()) travelTimeByOd[key] = { meanS: list.reduce((a, b) => a + b, 0) / list.length, vehicles: list.length };
  return { flowByRoad, travelTimeByOd, longestQueueByApproach: longest, flyoverShare: share };
}

