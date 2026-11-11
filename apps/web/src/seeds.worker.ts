/// <reference lib="webworker" />
/**
 * Runs every seed unseen, in a worker of its own, so that neither the page
 * nor the watched run (run.worker.ts) waits for them. It runs
 * them flat out and only reports; to stop it, the page ends the worker.
 * What it runs and reports is decided in five-seeds.ts.
 */
import type { RunInput } from "@traffic-simulator/engine";
import { runUnseenSeeds, type UnseenSeedEvent } from "./five-seeds";

/** The one message the page sends: the engine input of each scenario, with the scenario's own seed. */
export interface StartUnseenSeeds {
  inputs: RunInput[];
}

self.onmessage = (event: MessageEvent<StartUnseenSeeds>) => {
  for (const report of runUnseenSeeds(event.data.inputs)) {
    self.postMessage(report satisfies UnseenSeedEvent);
  }
};
