/// <reference lib="webworker" />
/**
 * Runs the engine off the page's thread, so a slow run cannot freeze the page
 * (ADR 0004). The engine itself never waits for real time; this worker paces it
 * with a timer, and `watch.ts` decides how many steps are due at each tick.
 * All the runs it is given advance together, so they share one clock.
 */
import type { RunCommand, RunFrame } from "./run-protocol";
import type { TogetherFrame } from "./run-together";
import { createWatch, type Watch } from "./watch";

/** Real milliseconds between looks at the clock. Short enough for smooth movement at every speed. */
const TICK_MS = 25;

let watch: Watch | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

function post(frame: TogetherFrame) {
  const message: RunFrame = { type: "frame", ...frame };
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<RunCommand>) => {
  const command = event.data;
  const nowMs = performance.now();
  switch (command.type) {
    case "start": {
      const started = createWatch({ inputs: command.inputs, speed: command.speed, paused: command.paused, nowMs });
      watch = started;
      post(started.frame());
      if (timer === undefined) {
        timer = setInterval(() => {
          const frame = watch?.tick(performance.now());
          if (frame) post(frame);
        }, TICK_MS);
      }
      break;
    }
    case "set-speed":
      watch?.setSpeed(command.speed, nowMs);
      break;
    case "pause":
      watch?.pause(nowMs);
      break;
    case "resume":
      watch?.resume(nowMs);
      break;
    case "watch-again":
      if (watch) post(watch.watchAgain(nowMs));
      break;
  }
};
