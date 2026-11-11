/**
 * The only file of the measurement that reaches into the app. It takes the
 * app's own 3D view and the app's own worker, unchanged, so the figures are
 * for the product and not for a copy. If the app moves these, fix it here.
 */
export { RoadScene, type FrameStore } from "../src/RoadScene";
export type { RunCommand, RunFrame } from "../src/run-protocol";

export function createProductWorker(): Worker {
  return new Worker(new URL("../src/run.worker.ts", import.meta.url), { type: "module" });
}
