/**
 * The only file of the measurement that reaches into the app. It takes the
 * app's own 3D view, frame store, shared camera and worker, unchanged, so the
 * figures are for the product and not for a copy. If the app moves these, fix it here.
 */
export { RoadScene } from "../src/RoadScene";
export { newFrameStore, receiveSnapshot, type FrameStore } from "../src/frame-store";
export { createSharedCamera } from "../src/shared-camera";
export type { RunCommand, RunFrame } from "../src/run-protocol";

export function createProductWorker(): Worker {
  return new Worker(new URL("../src/run.worker.ts", import.meta.url), { type: "module" });
}
