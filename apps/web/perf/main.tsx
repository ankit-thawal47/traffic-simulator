/**
 * The measurement page. What it measures is chosen by the address:
 *
 *   ?mode=views&scenario=mixed&n=3000&runs=2&draw=1&speed=5&warm=4&measure=10
 *       `runs` runs of the measurement scenario (as a baseline and a proposal
 *       would be), advanced together in the app's own worker, each drawn
 *       (draw=1) by the app's own 3D view or not drawn (draw=0). Reports the
 *       speed achieved and frames per second.
 *
 *   ?mode=protocol&scenario=mixed&n=3000&steps=300
 *       The cost of moving snapshots from a worker to the page (see protocol.worker.ts).
 *
 * The result is sent to the measuring script with POST /result; the reply names the next address to open.
 */
import { STEP_SECONDS, type Results, type RunInput } from "@traffic-simulator/engine";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createProductWorker,
  createSharedCamera,
  newFrameStore,
  receiveSnapshot,
  RoadScene,
  type RunCommand,
  type RunFrame,
} from "./product";
import type { ProtocolCommand, ProtocolMessage, ProtocolVariant } from "./protocol.worker";
import { buildMeasurementScenario, type MeasurementScenario } from "./scenario";

const params = new URLSearchParams(location.search);
const numberParam = (name: string, fallback: number) => (params.has(name) ? Number(params.get(name)) : fallback);
const scenario: MeasurementScenario = params.get("scenario") === "cars-only" ? "cars-only" : "mixed";

function environment() {
  let renderer = "unknown";
  let vendor = "unknown";
  const gl = document.createElement("canvas").getContext("webgl2");
  if (gl) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) {
      renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
      vendor = String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL));
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return {
    userAgent: navigator.userAgent,
    webglRenderer: renderer,
    webglVendor: vendor,
    devicePixelRatio: window.devicePixelRatio,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    visibilityState: document.visibilityState,
    hardwareConcurrency: navigator.hardwareConcurrency,
    crossOriginIsolated: window.crossOriginIsolated,
  };
}

async function report(result: unknown): Promise<void> {
  const body = JSON.stringify({ address: location.search, environment: environment(), result });
  document.title = "measured";
  try {
    const reply = await fetch("/result", { method: "POST", body, headers: { "content-type": "application/json" } });
    const { next } = (await reply.json()) as { next?: string };
    if (next) location.replace(next);
    else document.body.textContent = "Measurement finished.";
  } catch {
    // Opened by hand, with no measuring script listening: show the result instead.
    document.body.innerHTML = `<pre>${body.replace(/</g, "&lt;")}</pre>`;
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

// ---------------------------------------------------------------- views

interface Probe {
  messages: number;
  /** Real milliseconds the page spent receiving frames (reading the message and storing its snapshots). */
  messageMs: number;
  lastTimeS: number;
  lastArrivedAtMs: number;
  vehiclesOnNetwork: number[];
}

/** The runs, wired as the app wires a baseline and a proposal: one app worker, a frame store and a view for each run, one shared camera. */
function MeasuredRuns(props: { inputs: RunInput[]; speed: number; draw: boolean; probe: Probe }) {
  const { inputs, speed, draw, probe } = props;
  const sharedCamera = useMemo(() => createSharedCamera(), []);
  const stores = useMemo(() => inputs.map(() => newFrameStore()), [inputs]);
  const [frame, setFrame] = useState<{ timeS: number; results: Results[] }>();

  useEffect(() => {
    const worker = createProductWorker();
    worker.onmessage = (event: MessageEvent<RunFrame>) => {
      const startedAt = performance.now();
      const runs = event.data.runs;
      const arrivedAtMs = performance.now();
      runs.forEach((run, i) => receiveSnapshot(stores[i]!, run.snapshot, arrivedAtMs, speed));
      setFrame({ timeS: event.data.timeS, results: runs.map((run) => run.results) });
      probe.messages++;
      probe.lastTimeS = event.data.timeS;
      probe.lastArrivedAtMs = arrivedAtMs;
      probe.vehiclesOnNetwork = runs.map((run) => run.results.vehiclesOnNetwork);
      probe.messageMs += performance.now() - startedAt;
    };
    worker.postMessage({ type: "start", inputs, speed, paused: false } satisfies RunCommand);
    return () => worker.terminate();
  }, [inputs, speed, stores, probe]);

  return (
    <div className="views">
      {inputs.map((input, i) => (
        <div className="view" key={i}>
          {draw ? <RoadScene network={input.network} frames={stores[i]!} sharedCamera={sharedCamera} /> : null}
          <div className="note">
            on the network: {frame ? frame.results[i]?.vehiclesOnNetwork : "–"}, run time{" "}
            {frame ? frame.timeS.toFixed(1) : "–"} s
          </div>
        </div>
      ))}
    </div>
  );
}

function measureViews(): void {
  const targetVehicles = numberParam("n", 1000);
  const runs = numberParam("runs", 1);
  const draw = numberParam("draw", 1) === 1;
  const speed = numberParam("speed", 5);
  const warmS = numberParam("warm", 4);
  const measureS = numberParam("measure", 10);

  // Time spent inside animation-frame callbacks (placing vehicles and issuing the draw calls), for all views together.
  let callbackMs = 0;
  const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    originalRequestAnimationFrame((time) => {
      const startedAt = performance.now();
      callback(time);
      callbackMs += performance.now() - startedAt;
    });

  const frameTimes: number[] = [];
  let recording = false;
  originalRequestAnimationFrame(function tick(time) {
    if (recording) frameTimes.push(time);
    originalRequestAnimationFrame(tick);
  });

  let longTaskMs = 0;
  let longTasks = 0;
  try {
    new PerformanceObserver((list) => {
      if (!recording) return;
      for (const entry of list.getEntries()) {
        longTasks++;
        longTaskMs += entry.duration;
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch {
    // Long tasks are not reported by this browser.
  }

  const probe: Probe = { messages: 0, messageMs: 0, lastTimeS: 0, lastArrivedAtMs: 0, vehiclesOnNetwork: [] };
  const inputs: RunInput[] = [];
  for (let i = 0; i < runs; i++) inputs.push(buildMeasurementScenario(scenario, targetVehicles, i + 1));

  createRoot(document.getElementById("root")!).render(
    <MeasuredRuns inputs={inputs} speed={speed} draw={draw} probe={probe} />,
  );

  setTimeout(() => {
    const before = { ...probe };
    const callbackMsBefore = callbackMs;
    const startedAt = performance.now();
    recording = true;
    setTimeout(() => {
      recording = false;
      const elapsedMs = performance.now() - startedAt;
      const intervals: number[] = [];
      for (let i = 1; i < frameTimes.length; i++) intervals.push(frameTimes[i]! - frameTimes[i - 1]!);
      intervals.sort((a, b) => a - b);
      const frames = frameTimes.length;
      const realS = (probe.lastArrivedAtMs - before.lastArrivedAtMs) / 1000;
      const messages = probe.messages - before.messages;
      void report({
        mode: "views",
        scenario,
        targetVehicles,
        runs,
        draw,
        requestedSpeed: speed,
        warmS,
        measureS,
        elapsedMs,
        achievedSpeed: realS > 0 ? (probe.lastTimeS - before.lastTimeS) / realS : 0,
        framesPerSecond: frames / (elapsedMs / 1000),
        frameIntervalMs: {
          median: percentile(intervals, 0.5),
          p95: percentile(intervals, 0.95),
          max: intervals.length ? intervals[intervals.length - 1] : NaN,
        },
        drawCallbackMsPerFrame: frames ? (callbackMs - callbackMsBefore) / frames : NaN,
        messagesPerSecond: messages / (elapsedMs / 1000),
        receiveMsPerMessage: messages ? (probe.messageMs - before.messageMs) / messages : NaN,
        longTasks,
        longTaskMs,
        canvases: [...document.querySelectorAll("canvas")].map((canvas) => ({ width: canvas.width, height: canvas.height })),
        vehiclesOnNetwork: probe.vehiclesOnNetwork,
        simulatedSecondsAtEnd: probe.lastTimeS,
      });
    }, measureS * 1000);
  }, warmS * 1000);
}

// ---------------------------------------------------------------- protocol

function measureProtocol(): void {
  const command: ProtocolCommand = {
    scenario,
    targetVehicles: numberParam("n", 1000),
    seed: 1,
    warmUpSteps: numberParam("warmsteps", 500),
    steps: numberParam("steps", 300),
  };
  document.getElementById("root")!.textContent = "Measuring the cost of moving snapshots…";

  interface VariantResult {
    variant: ProtocolVariant;
    steps: number;
    /** Real milliseconds the worker took for the steps, including building and posting. */
    workerMs: number;
    /** Real milliseconds from the page seeing the variant begin to seeing it end: the whole pipeline. */
    pageMs: number;
    messages: number;
    /** Real milliseconds the page's thread spent turning messages back into data. */
    pageReadMs: number;
    vehiclesOnNetwork: number;
  }
  const variants: VariantResult[] = [];
  let engine: unknown;
  let current: { beganAt: number; messages: number; readMs: number } | undefined;
  let checksum = 0;

  const worker = new Worker(new URL("./protocol.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<ProtocolMessage>) => {
    const startedAt = performance.now();
    // Reading event.data is where the browser rebuilds the posted value on this thread.
    const message = event.data;
    const readMs = performance.now() - startedAt;
    switch (message.type) {
      case "engine":
        engine = message.result;
        break;
      case "begin":
        current = { beganAt: performance.now(), messages: 0, readMs: 0 };
        break;
      case "frame":
      case "typed-frame":
        if (current) {
          current.messages++;
          current.readMs += readMs;
        }
        if (message.type === "typed-frame") checksum += message.data[2] ?? 0;
        break;
      case "end":
        if (current) {
          variants.push({
            variant: message.variant,
            steps: message.steps,
            workerMs: message.workerMs,
            pageMs: performance.now() - current.beganAt,
            messages: current.messages,
            pageReadMs: current.readMs,
            vehiclesOnNetwork: message.vehiclesOnNetwork,
          });
        }
        break;
      case "done":
        worker.terminate();
        void report({ mode: "protocol", ...command, stepSeconds: STEP_SECONDS, engineInWorker: engine, variants, checksum });
        break;
    }
  };
  worker.postMessage(command);
}

if (params.get("mode") === "protocol") measureProtocol();
else measureViews();
