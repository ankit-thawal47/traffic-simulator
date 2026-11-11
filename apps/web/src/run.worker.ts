/// <reference lib="webworker" />
/**
 * Runs the engine off the page's thread, so a slow run cannot freeze the page
 * (ADR 0004). The engine itself never waits for real time; this worker paces it.
 */
import { createRun, STEP_SECONDS, type Run } from "@traffic-simulator/engine";
import type { RunCommand, RunFrame } from "./run-protocol";

/** If the worker falls behind, catch up by at most this many steps at once, then let the run lag. */
const MAX_STEPS_PER_TICK = 10;

let timer: ReturnType<typeof setInterval> | undefined;

function postFrame(run: Run): void {
  const frame: RunFrame = { type: "frame", snapshot: run.snapshot(), results: run.results() };
  self.postMessage(frame);
}

self.onmessage = (event: MessageEvent<RunCommand>) => {
  const command = event.data;
  if (command.type !== "start") return;

  if (timer !== undefined) clearInterval(timer);
  const run = createRun(command.input);
  const stepIntervalMs = (STEP_SECONDS * 1000) / command.speed;
  let startedAtMs = performance.now();
  let stepsDone = 0;
  postFrame(run);

  timer = setInterval(() => {
    const stepsDue = Math.floor((performance.now() - startedAtMs) / stepIntervalMs) - stepsDone;
    if (stepsDue <= 0) return;
    const steps = Math.min(stepsDue, MAX_STEPS_PER_TICK);
    for (let i = 0; i < steps; i++) run.step();
    stepsDone += steps;
    if (stepsDue > steps) {
      // Too far behind to catch up: restart the pacing from now.
      startedAtMs = performance.now();
      stepsDone = 0;
    }
    postFrame(run);
  }, stepIntervalMs / 2);
};
