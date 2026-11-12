import { createRun, roadLengthM, signalState, VEHICLE_CLASSES, type RunInput, type VehicleClass } from "../src/index";

/** What a run shows about filtering, measured only from snapshots and results. */
export interface FilteringMeasurement {
  /** How many times an approach's signal turned green. */
  greens: number;
  /**
   * Vehicles standing in the front of the queue at the moment an approach's signal
   * turns green (front bumper within FRONT_M of the stop line), by vehicle class, a green on average.
   */
  atFrontPerGreen: Record<VehicleClass, number>;
  /** Vehicles that crossed a stop line, by vehicle class, a green on average. */
  crossedPerGreen: Record<VehicleClass, number>;
  /** Mean delay by vehicle class at the end of the run, in seconds (null when the class has no vehicles). */
  meanDelayS: Record<VehicleClass, number | null>;
  vehiclesThrough: number;
  stuckVehicles: number;
}

/** Depth of the front of the queue: about one car length and its gap. */
export const FRONT_M = 6;

function zeroes(): Record<VehicleClass, number> {
  return { "two-wheeler": 0, car: 0, "auto-rickshaw": 0, bus: 0 };
}

/** Run a scenario for `seconds` and measure who stands at the front of each signal queue and who crosses. */
export function measureFiltering(input: RunInput, seconds: number): FilteringMeasurement {
  const run = createRun(input);
  const signals = (input.network.junctions ?? []).flatMap((junction) => (junction.control === "signal" ? [junction] : []));
  const approaches = signals.flatMap((junction) =>
    [...new Set(junction.connections.map((connection) => connection.fromRoadId))].map((roadId) => ({
      roadId,
      plan: junction.signalPlan,
      lengthM: roadLengthM(input.network.roads.find((road) => road.id === roadId)!),
      wasGreen: true,
    })),
  );
  const atFront = zeroes();
  const crossed = zeroes();
  const seenCrossing = new Set<number>();
  let greens = 0;
  while (run.timeS < seconds) {
    const snapshot = run.snapshot();
    for (const approach of approaches) {
      const green = signalState(approach.plan, approach.roadId, snapshot.timeS) === "green";
      if (green && !approach.wasGreen) {
        greens++;
        for (const vehicle of snapshot.vehicles) {
          if (vehicle.roadId !== approach.roadId || vehicle.turn) continue;
          if (approach.lengthM - vehicle.positionM <= FRONT_M) atFront[vehicle.vehicleClass]++;
        }
      }
      approach.wasGreen = green;
    }
    for (const vehicle of snapshot.vehicles) {
      if (vehicle.turn && !seenCrossing.has(vehicle.id)) {
        seenCrossing.add(vehicle.id);
        crossed[vehicle.vehicleClass]++;
      }
    }
    run.step();
  }
  const results = run.results();
  const meanDelayS = {} as Record<VehicleClass, number | null>;
  for (const vehicleClass of VEHICLE_CLASSES) {
    meanDelayS[vehicleClass] = results.delayByVehicleClass[vehicleClass].meanDelayS;
    atFront[vehicleClass] /= Math.max(1, greens);
    crossed[vehicleClass] /= Math.max(1, greens);
  }
  return { greens, atFrontPerGreen: atFront, crossedPerGreen: crossed, meanDelayS, vehiclesThrough: results.vehiclesThrough, stuckVehicles: results.stuckVehicles };
}
