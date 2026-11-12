/**
 * Runs an engine input on a network (junctions, flyovers) through the engine's
 * public interface, for Tiers 2 to 5. Counts what fairness rule 7 asks for:
 * the engine's own stuck vehicles (Results.stuckVehicles, vehicles it released
 * by force) and, at every step, whether vehicles are conserved
 * (entered = through + on the network + released as stuck).
 *
 * The Tier 0 overlap and inside-the-road checks of engine-run.ts are not applied
 * here: they read positions along one road, and a vehicle in a junction is on
 * its turning path. Tier 0 is a separate tier with its own runs.
 */
import { createRun, type Results, type RunInput, type Snapshot } from "@traffic-simulator/engine";
import { STEP_S } from "./scenario";

export interface NetworkRunCounts {
  /** Vehicles the engine released by force (its own count, Results.stuckVehicles). */
  stuckVehicles: number;
  /** Steps at which entered != through + on network + stuck, or the snapshot disagreed with the count. */
  conservationViolations: number;
  steps: number;
}

export interface NetworkRunSummary extends NetworkRunCounts {
  finalResults: Results;
  /** Results at given moments, by time in seconds. */
  resultsAt: Map<number, Results>;
  wallClockS: number;
}

export interface NetworkRunOptions {
  durationS: number;
  /** Called for the starting state and after every step. */
  observe?: (snapshot: Snapshot, results: Results) => void;
  /** Keep results() at these times. */
  keepResultsAt?: number[];
  /** Skip snapshot() and results() on steps where nothing reads them (speed measurement). */
  bare?: boolean;
}

export function runNetwork(input: RunInput, options: NetworkRunOptions): NetworkRunSummary {
  const started = Date.now();
  const run = createRun(input);
  const steps = Math.round(options.durationS / STEP_S);
  let violations = 0;
  const keep = new Set((options.keepResultsAt ?? []).map((time) => Math.round(time / STEP_S)));
  const resultsAt = new Map<number, Results>();
  for (let step = 0; step <= steps; step++) {
    if (step > 0) run.step();
    if (options.bare && !keep.has(step) && step !== steps) continue;
    const results = run.results();
    if (results.vehiclesEntered !== results.vehiclesThrough + results.vehiclesOnNetwork + results.stuckVehicles) violations++;
    if (options.observe) {
      const snapshot = run.snapshot();
      if (snapshot.vehicles.length !== results.vehiclesOnNetwork) violations++;
      options.observe(snapshot, results);
    }
    if (keep.has(step)) resultsAt.set(Math.round(step * STEP_S * 1000) / 1000, results);
  }
  const finalResults = run.results();
  return {
    stuckVehicles: finalResults.stuckVehicles,
    conservationViolations: violations,
    steps,
    finalResults,
    resultsAt,
    wallClockS: (Date.now() - started) / 1000,
  };
}

/**
 * The moment each vehicle's front bumper crosses the end of a road (a stop line), by linear
 * interpolation between steps. In the engine a vehicle in a junction still has the road it came
 * from as its road, with a position beyond the road's length.
 */
export function stopLineCrossings(roadId: string, roadLengthM: number): {
  observe: (snapshot: Snapshot) => void;
  crossings: Map<number, number>;
} {
  const last = new Map<number, { timeS: number; positionM: number }>();
  const crossings = new Map<number, number>();
  return {
    crossings,
    observe(snapshot) {
      for (const vehicle of snapshot.vehicles) {
        if (crossings.has(vehicle.id)) continue;
        const before = last.get(vehicle.id);
        if (vehicle.roadId === roadId) {
          if (vehicle.positionM >= roadLengthM && before && before.positionM < roadLengthM) {
            const fraction = (roadLengthM - before.positionM) / (vehicle.positionM - before.positionM);
            crossings.set(vehicle.id, before.timeS + fraction * (snapshot.timeS - before.timeS));
          } else if (vehicle.positionM < roadLengthM) {
            last.set(vehicle.id, { timeS: snapshot.timeS, positionM: vehicle.positionM });
          }
        } else if (before) {
          // Already past the junction (a very short junction): cross at the last step's end.
          crossings.set(vehicle.id, snapshot.timeS);
        }
      }
    },
  };
}
