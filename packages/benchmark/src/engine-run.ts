/**
 * Runs a scenario through our engine's public interface (createRun, step,
 * snapshot, results) and applies the Tier 0 checks to every step.
 *
 * The Tier 0 checks here are the benchmark's own: they read only snapshots and
 * results and share no code with the engine or with the engine's own
 * consistency checker.
 */
import { createRun, type Results, type RunInput, type Snapshot, type VehicleState } from "@traffic-simulator/engine";
import { CAR, LANE_WIDTH_M, type Scenario } from "./scenario";

/** A vehicle that has stood still this long counts as stuck: the time after which SUMO teleports a vehicle by default. */
export const STUCK_AFTER_S = 300;

export interface Tier0Counts {
  /** T0.1: moments at which entered != left + still inside, or the snapshot disagrees with the counts. */
  conservationViolations: number;
  /** T0.2: pairs of vehicles overlapping, counted at every step they overlap. */
  overlaps: number;
  /** T0.4: vehicles with a negative (or non-finite) speed, counted at every step. */
  negativeSpeeds: number;
  /** T0.4: vehicles not wholly inside their road, counted at every step. */
  outsideRoad: number;
  /** Steps checked, including the starting state. */
  momentsChecked: number;
  /** The first few violations in words. */
  examples: string[];
}

export interface EngineRunSummary {
  tier0: Tier0Counts;
  /** Vehicles (other than those placed as stationary) that stood still for STUCK_AFTER_S or longer. */
  stuckVehicles: number;
  /**
   * Forced releases reported by the engine. The engine at this commit has no
   * forced-release mechanism and reports no such count, so this is always null.
   */
  forcedReleases: null;
  /** A fingerprint of every snapshot and results of the run, when asked for (T0.3). */
  fingerprint?: string;
  finalResults: Results;
  wallClockS: number;
}

/** Slack for floating-point rounding, metres. */
const SLACK_M = 1e-9;

export function toEngineInput(scenario: Scenario): { input: RunInput; stationaryIds: Set<number>; groupIds: Map<string, number[]> } {
  const initialVehicles: NonNullable<RunInput["initialVehicles"]> = [];
  const stationaryIds = new Set<number>();
  const groupIds = new Map<string, number[]>();
  // The engine numbers vehicles from 1 in the order it is given them.
  for (const car of scenario.cars) {
    const id = initialVehicles.length + 1;
    initialVehicles.push({
      roadId: "main",
      positionM: car.frontM,
      speedMps: car.speedMps,
      vehicleClass: "car",
      lateralM: (car.lane + 0.5) * LANE_WIDTH_M,
      stationary: car.stationary === true ? true : undefined,
    });
    if (car.stationary) stationaryIds.add(id);
    if (car.group !== undefined) {
      const ids = groupIds.get(car.group);
      if (ids) ids.push(id);
      else groupIds.set(car.group, [id]);
    }
  }
  if (scenario.laneDrop) {
    // The engine has no road whose lane count changes. A lane that ends is
    // expressed as stationary cars filling that lane, nose to tail, to the end of the road.
    const { lane, fromM } = scenario.laneDrop;
    for (let front = fromM + CAR.lengthM; front <= scenario.roadLengthM + SLACK_M; front += CAR.lengthM) {
      initialVehicles.push({
        roadId: "main",
        positionM: Math.min(front, scenario.roadLengthM),
        speedMps: 0,
        vehicleClass: "car",
        lateralM: (lane + 0.5) * LANE_WIDTH_M,
        stationary: true,
      });
      stationaryIds.add(initialVehicles.length);
    }
  }
  const input: RunInput = {
    network: {
      formatVersion: 2,
      roads: [
        {
          id: "main",
          points: [
            { x: 0, y: 0 },
            { x: scenario.roadLengthM, y: 0 },
          ],
          widthM: scenario.lanes * LANE_WIDTH_M,
          lanes: scenario.lanes,
          speedLimitMps: scenario.speedLimitMps,
        },
      ],
    },
    demand: {
      flows: scenario.demandPerHour ? [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour: scenario.demandPerHour }] : [],
    },
    seed: scenario.seed,
    laneDiscipline: true,
    initialVehicles,
  };
  return { input, stationaryIds, groupIds };
}

export interface RunObserver {
  /** Called for the starting state and after every step. */
  (snapshot: Snapshot, results: Results): void;
}

export interface EngineRunOptions {
  durationS: number;
  /** Ids of vehicles placed as stationary; they are not counted as stuck. */
  stationaryIds?: Set<number>;
  /** Also fingerprint every snapshot and results (slower). */
  fingerprint?: boolean;
  observe?: RunObserver;
}

/** Run any engine input for a duration with the Tier 0 checks on. */
export function runEngine(input: RunInput, options: EngineRunOptions): EngineRunSummary {
  const started = Date.now();
  const roads = new Map(
    input.network.roads.map((road) => {
      let lengthM = 0;
      for (let i = 1; i < road.points.length; i++) {
        lengthM += Math.hypot(road.points[i]!.x - road.points[i - 1]!.x, road.points[i]!.y - road.points[i - 1]!.y);
      }
      return [road.id, { lengthM, widthM: road.widthM }];
    }),
  );
  const tier0: Tier0Counts = {
    conservationViolations: 0,
    overlaps: 0,
    negativeSpeeds: 0,
    outsideRoad: 0,
    momentsChecked: 0,
    examples: [],
  };
  const example = (timeS: number, text: string) => {
    if (tier0.examples.length < 5) tier0.examples.push(`t=${timeS.toFixed(1)} s: ${text}`);
  };

  let previousIds = new Set<number>();
  let previousResults: Results | undefined;
  const standingSince = new Map<number, number>();
  const countedStuck = new Set<number>();
  let hashA = 2166136261;
  let hashB = 0x9e3779b9;
  let hashLength = 0;

  const check = (snapshot: Snapshot, results: Results) => {
    tier0.momentsChecked++;
    const t = snapshot.timeS;
    const ids = new Set<number>();
    const byRoad = new Map<string, VehicleState[]>();
    for (const vehicle of snapshot.vehicles) {
      if (ids.has(vehicle.id)) {
        tier0.conservationViolations++;
        example(t, `vehicle ${vehicle.id} appears twice`);
      }
      ids.add(vehicle.id);
      if (!(vehicle.speedMps >= 0) || !Number.isFinite(vehicle.speedMps)) {
        tier0.negativeSpeeds++;
        example(t, `vehicle ${vehicle.id} has speed ${vehicle.speedMps}`);
      }
      const road = roads.get(vehicle.roadId);
      const inside =
        road !== undefined &&
        vehicle.positionM - vehicle.lengthM >= -SLACK_M &&
        vehicle.positionM <= road.lengthM + SLACK_M &&
        vehicle.lateralM - vehicle.widthM / 2 >= -SLACK_M &&
        vehicle.lateralM + vehicle.widthM / 2 <= road.widthM + SLACK_M;
      if (!inside) {
        tier0.outsideRoad++;
        example(t, `vehicle ${vehicle.id} is outside road "${vehicle.roadId}" (front ${vehicle.positionM}, lateral ${vehicle.lateralM})`);
      }
      const list = byRoad.get(vehicle.roadId);
      if (list) list.push(vehicle);
      else byRoad.set(vehicle.roadId, [vehicle]);

      // Stuck vehicles: standing still for STUCK_AFTER_S without being a placed stationary vehicle.
      if (vehicle.speedMps === 0 && !options.stationaryIds?.has(vehicle.id)) {
        const since = standingSince.get(vehicle.id);
        if (since === undefined) standingSince.set(vehicle.id, t);
        else if (t - since >= STUCK_AFTER_S) countedStuck.add(vehicle.id);
      } else {
        standingSince.delete(vehicle.id);
      }
    }

    // T0.2: two vehicles overlap when their rectangles share area.
    for (const list of byRoad.values()) {
      list.sort((a, b) => b.positionM - a.positionM);
      for (let i = 0; i < list.length; i++) {
        const ahead = list[i]!;
        const rear = ahead.positionM - ahead.lengthM;
        for (let j = i + 1; j < list.length; j++) {
          const behind = list[j]!;
          if (behind.positionM <= rear + SLACK_M) break;
          if (Math.abs(ahead.lateralM - behind.lateralM) < (ahead.widthM + behind.widthM) / 2 - SLACK_M) {
            tier0.overlaps++;
            example(t, `vehicles ${ahead.id} and ${behind.id} overlap`);
          }
        }
      }
    }

    // T0.1: entered = left + still inside, and the snapshot agrees with the counts, at every step.
    let lost = false;
    if (results.vehiclesEntered !== results.vehiclesThrough + results.vehiclesOnNetwork) lost = true;
    if (results.vehiclesOnNetwork !== snapshot.vehicles.length) lost = true;
    if (previousResults) {
      let gone = 0;
      for (const id of previousIds) if (!ids.has(id)) gone++;
      let arrived = 0;
      for (const id of ids) if (!previousIds.has(id)) arrived++;
      if (gone !== results.vehiclesThrough - previousResults.vehiclesThrough) lost = true;
      if (arrived !== results.vehiclesEntered - previousResults.vehiclesEntered) lost = true;
    }
    if (lost) {
      tier0.conservationViolations++;
      example(
        t,
        `entered ${results.vehiclesEntered}, through ${results.vehiclesThrough}, on network ${results.vehiclesOnNetwork}, in snapshot ${snapshot.vehicles.length}`,
      );
    }
    previousIds = ids;
    previousResults = results;

    if (options.fingerprint) {
      const text = JSON.stringify([snapshot, results]);
      hashLength += text.length;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        hashA = Math.imul(hashA ^ code, 16777619);
        hashB = Math.imul(hashB + code, 0x85ebca6b) ^ (hashB >>> 13);
      }
    }
  };

  const run = createRun(input);
  const steps = Math.round(options.durationS / 0.2);
  for (let step = 0; step <= steps; step++) {
    if (step > 0) run.step();
    const snapshot = run.snapshot();
    const results = run.results();
    check(snapshot, results);
    options.observe?.(snapshot, results);
  }

  return {
    tier0,
    stuckVehicles: countedStuck.size,
    forcedReleases: null,
    fingerprint: options.fingerprint ? `${hashLength}:${hashA >>> 0}:${hashB >>> 0}` : undefined,
    finalResults: run.results(),
    wallClockS: (Date.now() - started) / 1000,
  };
}

export function addTier0(into: Tier0Counts, from: Tier0Counts): void {
  into.conservationViolations += from.conservationViolations;
  into.overlaps += from.overlaps;
  into.negativeSpeeds += from.negativeSpeeds;
  into.outsideRoad += from.outsideRoad;
  into.momentsChecked += from.momentsChecked;
  for (const text of from.examples) if (into.examples.length < 5) into.examples.push(text);
}
