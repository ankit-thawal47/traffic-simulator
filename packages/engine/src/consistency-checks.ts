/**
 * Consistency checks (benchmark tier 0) that every test scenario must pass:
 * no vehicle lost, no two vehicles overlapping, no negative speed, no vehicle
 * outside its road, and identical results for the same seed.
 *
 * They read only what a run gives back (snapshots and results), never the
 * engine's internals, so they apply unchanged to any network and demand.
 *
 * On a road, two vehicles overlap when they overlap both along and across it.
 * Inside a junction, a vehicle's footprint follows its turning path (it is the
 * vehicle's length along the path and its width across it), and two vehicles
 * overlap when their footprints do, whichever turning paths they are on. The
 * shape of a turning path comes from junction-geometry.ts, which the engine
 * uses too: the checks do not have their own idea of where a turning path runs.
 *
 * Where one road passes over another road or over a junction (a flyover),
 * vehicles are also compared across the two: they overlap when they overlap on
 * the plan and are on the same level (level-checks.ts).
 */
import { createLevelCheck } from "./level-checks";
import { createRun as createEngineRun } from "./run";
import { roadLengthM } from "./geometry";
import { convexShapesOverlap, createNetworkLayout, footprintInJunction, turningCurve } from "./junction-geometry";
import type { Network, Results, Run, RunInput, Snapshot, VehicleState } from "./types";

export type ConsistencyCheck = "no-vehicle-lost" | "no-overlap" | "no-negative-speed" | "inside-road" | "repeatable";

export interface ConsistencyViolation {
  check: ConsistencyCheck;
  timeS: number;
  message: string;
}

export interface ConsistencyChecker {
  /** Check one moment of a run. Call it for the starting state and after every step. */
  observe(snapshot: Snapshot, results: Results): void;
  readonly violations: ConsistencyViolation[];
}

/** Slack for floating-point rounding, in metres. */
const TOLERANCE_M = 1e-9;

export function createConsistencyChecker(network: Network): ConsistencyChecker {
  const roads = new Map(network.roads.map((road) => [road.id, { widthM: road.widthM, lengthM: roadLengthM(road) }]));
  const layout = createNetworkLayout(network);
  const levels = createLevelCheck(network, layout);
  const violations: ConsistencyViolation[] = [];
  let previous: { ids: Set<number>; highestId: number; results: Results } | undefined;

  function observe(snapshot: Snapshot, results: Results): void {
    const report = (check: ConsistencyCheck, message: string) =>
      violations.push({ check, timeS: snapshot.timeS, message });

    const byRoad = new Map<string, VehicleState[]>();
    /** Vehicles with any part inside a junction, by junction. */
    const turning = new Map<string, VehicleState[]>();
    const ids = new Set<number>();
    for (const vehicle of snapshot.vehicles) {
      if (ids.has(vehicle.id)) report("no-vehicle-lost", `Vehicle ${vehicle.id} appears twice`);
      ids.add(vehicle.id);

      if (vehicle.speedMps < 0) report("no-negative-speed", `Vehicle ${vehicle.id} has speed ${vehicle.speedMps} m/s`);

      const road = roads.get(vehicle.roadId);
      if (!road) {
        report("inside-road", `Vehicle ${vehicle.id} is on a road that is not in the network: "${vehicle.roadId}"`);
        continue;
      }
      const rearM = vehicle.positionM - vehicle.lengthM;
      // A vehicle on a turning path may reach past the end of the road it came
      // from, or back from the start of the road it is heading for, by no more
      // than the length of its line through the junction.
      let beyondEndM = 0;
      let beforeStartM = 0;
      const turn = vehicle.turn;
      if (turn) {
        const path = layout.turningPath(turn.fromRoadId, turn.toRoadId);
        if (!path || path.junctionId !== turn.junctionId) {
          report(
            "inside-road",
            `Vehicle ${vehicle.id} is on a turning path that is not in the network: "${turn.fromRoadId}" to "${turn.toRoadId}"`,
          );
          continue;
        }
        const turnLengthM = turningCurve(path, turn.fromLateralM, turn.toLateralM).lengthM;
        if (vehicle.roadId === turn.fromRoadId) beyondEndM = turnLengthM;
        else if (vehicle.roadId === turn.toRoadId) beforeStartM = turnLengthM;
        else {
          report("inside-road", `Vehicle ${vehicle.id} is on road "${vehicle.roadId}", which its turning path neither leaves nor joins`);
          continue;
        }
        for (const [roadId, lateralM] of [
          [turn.fromRoadId, turn.fromLateralM],
          [turn.toRoadId, turn.toLateralM],
        ] as const) {
          const widthM = roads.get(roadId)!.widthM;
          if (lateralM - vehicle.widthM / 2 < -TOLERANCE_M || lateralM + vehicle.widthM / 2 > widthM + TOLERANCE_M) {
            report("inside-road", `Vehicle ${vehicle.id} turns ${lateralM} m across road "${roadId}", outside its ${widthM} m width`);
          }
        }
        const inJunction = turning.get(turn.junctionId);
        if (inJunction) inJunction.push(vehicle);
        else turning.set(turn.junctionId, [vehicle]);
      }
      if (rearM < -beforeStartM - TOLERANCE_M || vehicle.positionM > road.lengthM + beyondEndM + TOLERANCE_M) {
        report("inside-road", `Vehicle ${vehicle.id} spans ${rearM} to ${vehicle.positionM} m on a ${road.lengthM} m road`);
      }
      const leftM = vehicle.lateralM - vehicle.widthM / 2;
      const rightM = vehicle.lateralM + vehicle.widthM / 2;
      if (leftM < -TOLERANCE_M || rightM > road.widthM + TOLERANCE_M) {
        report("inside-road", `Vehicle ${vehicle.id} spans ${leftM} to ${rightM} m across a ${road.widthM} m wide road`);
      }
      const onRoad = byRoad.get(vehicle.roadId);
      if (onRoad) onRoad.push(vehicle);
      else byRoad.set(vehicle.roadId, [vehicle]);
    }

    for (const onRoad of byRoad.values()) {
      onRoad.sort((a, b) => b.positionM - a.positionM);
      for (let i = 0; i < onRoad.length; i++) {
        const ahead = onRoad[i]!;
        const rearM = ahead.positionM - ahead.lengthM;
        for (let j = i + 1; j < onRoad.length; j++) {
          const behind = onRoad[j]!;
          // Sorted front first, so once one vehicle is clear of the rear, the rest are too.
          if (behind.positionM <= rearM + TOLERANCE_M) break;
          if (ahead.turn && behind.turn) {
            // Both reach into a junction. Only the stretch they share on the road itself is
            // compared here; inside the junction their footprints are compared below.
            const sharedFromM = Math.max(rearM, behind.positionM - behind.lengthM, 0);
            const sharedToM = Math.min(behind.positionM, roads.get(ahead.roadId)!.lengthM);
            if (sharedToM <= sharedFromM + TOLERANCE_M) continue;
          }
          const sideBySide =
            Math.abs(ahead.lateralM - behind.lateralM) >= (ahead.widthM + behind.widthM) / 2 - TOLERANCE_M;
          if (!sideBySide) report("no-overlap", `Vehicles ${ahead.id} and ${behind.id} overlap on road "${ahead.roadId}"`);
        }
      }
    }

    // Inside each junction: no two vehicles' footprints overlap, whatever turning paths they are on.
    for (const [junctionId, inJunction] of turning) {
      const footprints = inJunction.map((vehicle) => {
        const pieces = footprintInJunction(layout, vehicle);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const piece of pieces) {
          for (const point of piece) {
            if (point.x < minX) minX = point.x;
            if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.y > maxY) maxY = point.y;
          }
        }
        return { vehicle, pieces, minX, minY, maxX, maxY };
      });
      for (let i = 0; i < footprints.length; i++) {
        const a = footprints[i]!;
        for (let j = i + 1; j < footprints.length; j++) {
          const b = footprints[j]!;
          if (a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY) continue;
          if (a.pieces.some((piece) => b.pieces.some((other) => convexShapesOverlap(piece, other)))) {
            report("no-overlap", `Vehicles ${a.vehicle.id} and ${b.vehicle.id} overlap inside junction "${junctionId}"`);
          }
        }
      }
    }

    // Where roads cover common ground without sharing a junction: no overlap unless on different levels.
    for (const message of levels.overlaps(snapshot)) report("no-overlap", message);

    if (results.vehiclesOnNetwork !== snapshot.vehicles.length) {
      report(
        "no-vehicle-lost",
        `Results count ${results.vehiclesOnNetwork} vehicles on the network; the snapshot has ${snapshot.vehicles.length}`,
      );
    }
    // A stuck vehicle is taken off the network and counted as one (stuck-vehicles.ts): it is accounted for, not lost.
    if (results.vehiclesEntered !== results.vehiclesThrough + results.vehiclesOnNetwork + results.stuckVehicles) {
      report(
        "no-vehicle-lost",
        `Entered ${results.vehiclesEntered} is not through ${results.vehiclesThrough} plus on the network ` +
          `${results.vehiclesOnNetwork} plus stuck ${results.stuckVehicles}`,
      );
    }
    let highestId = previous?.highestId ?? 0;
    if (previous) {
      let gone = 0;
      for (const id of previous.ids) if (!ids.has(id)) gone++;
      const countedThrough = results.vehiclesThrough - previous.results.vehiclesThrough;
      const countedStuck = results.stuckVehicles - previous.results.stuckVehicles;
      if (countedStuck < 0) report("no-vehicle-lost", `The count of stuck vehicles went down by ${-countedStuck}`);
      if (gone !== countedThrough + countedStuck) {
        report(
          "no-vehicle-lost",
          `${gone} vehicles left the snapshot but ${countedThrough} were counted through and ${countedStuck} as stuck`,
        );
      }
      let arrived = 0;
      for (const id of ids) {
        if (previous.ids.has(id)) continue;
        arrived++;
        if (id <= previous.highestId) report("no-vehicle-lost", `Vehicle id ${id} came back or was reused`);
      }
      const countedEntered = results.vehiclesEntered - previous.results.vehiclesEntered;
      if (arrived !== countedEntered) {
        report("no-vehicle-lost", `${arrived} vehicles appeared but ${countedEntered} were counted as entered`);
      }
    }
    for (const id of ids) if (id > highestId) highestId = id;
    previous = { ids, highestId, results };
  }

  return { observe, violations };
}

export interface RunConsistencyOptions {
  /** Simulated seconds to run for. */
  durationS: number;
  /** The engine entry point to check; defaults to the engine's own createRun. */
  createRun?: (input: RunInput) => Run;
}

export interface RunConsistencyReport {
  violations: ConsistencyViolation[];
  /** Results at the end of the run, for the caller's own assertions. */
  results: Results;
}

/**
 * Run a scenario twice with the same seed. Apply every per-moment check to the
 * first run, and require the second to match it exactly, moment by moment.
 */
export function checkRunConsistency(input: RunInput, options: RunConsistencyOptions): RunConsistencyReport {
  const createRun = options.createRun ?? createEngineRun;
  const checker = createConsistencyChecker(input.network);

  const first = createRun(input);
  const moments: string[] = [];
  const record = (run: Run): string => {
    const snapshot = run.snapshot();
    const results = run.results();
    if (run === first) checker.observe(snapshot, results);
    return fingerprint(JSON.stringify([snapshot, results]));
  };
  moments.push(record(first));
  while (first.timeS < options.durationS) {
    first.step();
    moments.push(record(first));
  }

  const violations = [...checker.violations];
  const second = createRun(input);
  for (let i = 0; i < moments.length; i++) {
    if (i > 0) second.step();
    if (record(second) !== moments[i]) {
      violations.push({
        check: "repeatable",
        timeS: second.timeS,
        message: "A second run with the same seed gave a different snapshot or results",
      });
      break;
    }
  }

  return { violations, results: first.results() };
}

/** A short stand-in for a long string, so a whole run's moments can be kept and compared. */
function fingerprint(text: string): string {
  let a = 2166136261;
  let b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 16777619);
    b = Math.imul(b + code, 0x85ebca6b) ^ (b >>> 13);
  }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}
