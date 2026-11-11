/**
 * Consistency checks (benchmark tier 0) that every test scenario must pass:
 * no vehicle lost, no two vehicles overlapping, no negative speed, no vehicle
 * outside its road, and identical results for the same seed.
 *
 * They read only what a run gives back (snapshots and results), never the
 * engine's internals, so they apply unchanged to any network and demand.
 */
import { createRun as createEngineRun } from "./run";
import { roadLengthM } from "./geometry";
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
  const violations: ConsistencyViolation[] = [];
  let previous: { ids: Set<number>; highestId: number; results: Results } | undefined;

  function observe(snapshot: Snapshot, results: Results): void {
    const report = (check: ConsistencyCheck, message: string) =>
      violations.push({ check, timeS: snapshot.timeS, message });

    const byRoad = new Map<string, VehicleState[]>();
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
      if (rearM < -TOLERANCE_M || vehicle.positionM > road.lengthM + TOLERANCE_M) {
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
          const sideBySide =
            Math.abs(ahead.lateralM - behind.lateralM) >= (ahead.widthM + behind.widthM) / 2 - TOLERANCE_M;
          if (!sideBySide) report("no-overlap", `Vehicles ${ahead.id} and ${behind.id} overlap on road "${ahead.roadId}"`);
        }
      }
    }

    if (results.vehiclesOnNetwork !== snapshot.vehicles.length) {
      report(
        "no-vehicle-lost",
        `Results count ${results.vehiclesOnNetwork} vehicles on the network; the snapshot has ${snapshot.vehicles.length}`,
      );
    }
    if (results.vehiclesEntered !== results.vehiclesThrough + results.vehiclesOnNetwork) {
      report(
        "no-vehicle-lost",
        `Entered ${results.vehiclesEntered} is not through ${results.vehiclesThrough} plus on the network ${results.vehiclesOnNetwork}`,
      );
    }
    let highestId = previous?.highestId ?? 0;
    if (previous) {
      let gone = 0;
      for (const id of previous.ids) if (!ids.has(id)) gone++;
      const countedThrough = results.vehiclesThrough - previous.results.vehiclesThrough;
      if (gone !== countedThrough) {
        report("no-vehicle-lost", `${gone} vehicles left the snapshot but ${countedThrough} were counted through`);
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
