/// <reference lib="webworker" />
/**
 * Measures what it costs to move snapshots from a worker to the page.
 * The engine runs flat out for a fixed number of steps, four ways:
 *
 *   step          the engine alone
 *   snapshot      + build a snapshot object after every step
 *   post-object   + post { type, timeS, runs: [{ snapshot, results }] } after every step
 *                 (today's protocol, with one run in the message)
 *   post-typed    + pack the snapshot into a Float32Array and transfer it (a prototype, not in the product)
 *
 * The differences between the four are the costs of each part.
 */
import { createRun, VEHICLE_CLASSES, type Run } from "@traffic-simulator/engine";
import { measureEngine, type EngineBenchResult } from "./engine-bench";
import { buildMeasurementScenario, type MeasurementScenario } from "./scenario";

export interface ProtocolCommand {
  scenario: MeasurementScenario;
  targetVehicles: number;
  seed: number;
  warmUpSteps: number;
  steps: number;
}

export type ProtocolVariant = "step" | "snapshot" | "post-object" | "post-typed";

export type ProtocolMessage =
  | { type: "begin"; variant: ProtocolVariant }
  | { type: "end"; variant: ProtocolVariant; workerMs: number; steps: number; vehiclesOnNetwork: number }
  | { type: "frame"; timeS: number; runs: { snapshot: unknown; results: unknown }[] }
  | { type: "typed-frame"; timeS: number; count: number; data: Float32Array }
  | { type: "engine"; result: EngineBenchResult }
  | { type: "done" };

const FLOATS_PER_VEHICLE = 6;

function post(message: ProtocolMessage, transfer: Transferable[] = []): void {
  self.postMessage(message, transfer);
}

function runVariant(run: Run, variant: ProtocolVariant, steps: number, roadIndex: Map<string, number>): void {
  post({ type: "begin", variant });
  const startedAt = performance.now();
  for (let i = 0; i < steps; i++) {
    run.step();
    if (variant === "step") continue;
    const snapshot = run.snapshot();
    if (variant === "snapshot") continue;
    if (variant === "post-object") {
      post({ type: "frame", timeS: snapshot.timeS, runs: [{ snapshot, results: run.results() }] });
      continue;
    }
    const data = new Float32Array(snapshot.vehicles.length * FLOATS_PER_VEHICLE);
    let at = 0;
    for (const vehicle of snapshot.vehicles) {
      data[at++] = vehicle.id;
      data[at++] = roadIndex.get(vehicle.roadId) ?? -1;
      data[at++] = vehicle.positionM;
      data[at++] = vehicle.lateralM;
      data[at++] = vehicle.speedMps;
      data[at++] = VEHICLE_CLASSES.indexOf(vehicle.vehicleClass);
    }
    post({ type: "typed-frame", timeS: snapshot.timeS, count: snapshot.vehicles.length, data }, [data.buffer]);
  }
  const workerMs = performance.now() - startedAt;
  post({ type: "end", variant, workerMs, steps, vehiclesOnNetwork: run.results().vehiclesOnNetwork });
}

self.onmessage = (event: MessageEvent<ProtocolCommand>) => {
  const { scenario, targetVehicles, seed, warmUpSteps, steps } = event.data;

  // The engine alone, inside a browser worker, with the same code as the command-line measurement.
  post({
    type: "engine",
    result: measureEngine({ scenario, targetVehicles, seed, warmUpSteps, blocks: 5, stepsPerBlock: steps, snapshotEveryStep: false }),
  });

  const input = buildMeasurementScenario(scenario, targetVehicles, seed);
  const roadIndex = new Map(input.network.roads.map((road, index) => [road.id, index]));
  const run = createRun(input);
  for (let i = 0; i < warmUpSteps; i++) {
    run.step();
    run.snapshot();
  }
  for (const variant of ["step", "snapshot", "post-object", "post-typed"] as const) {
    runVariant(run, variant, steps, roadIndex);
  }
  post({ type: "done" });
};
