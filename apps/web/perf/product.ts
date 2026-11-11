/**
 * The only file of the measurement that reaches into the app. It takes the
 * app's own 3D view, frame store, shared camera and workers, unchanged, so the
 * figures are for the product and not for a copy. If the app moves these, fix it here.
 */
export { RoadScene } from "../src/RoadScene";
export { newFrameStore, receiveSnapshot, type FrameStore } from "../src/frame-store";
export { createSharedCamera } from "../src/shared-camera";
export type { RunCommand, RunFrame } from "../src/run-protocol";

/** The worker that runs every seed unseen and flat out while the planner watches. It is sent { inputs }. */
export function createUnseenSeedsWorker(): Worker {
  return new Worker(new URL("../src/seeds.worker.ts", import.meta.url), { type: "module" });
}

export function createProductWorker(): Worker {
  return new Worker(new URL("../src/run.worker.ts", import.meta.url), { type: "module" });
}
