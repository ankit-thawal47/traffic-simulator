import { STEP_SECONDS, type Results, type RunInput } from "@traffic-simulator/engine";
import oneRoad from "@traffic-simulator/engine/examples/one-road.json";
import { useEffect, useMemo, useState } from "react";
import { RoadScene, type FrameStore } from "./RoadScene";
import type { RunCommand, RunFrame } from "./run-protocol";

const scenario = oneRoad as RunInput;
/** Simulated seconds per real second. */
const SPEED = 1;

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function App() {
  const frames = useMemo<FrameStore>(
    () => ({ laterArrivedAtMs: 0, intervalMs: (STEP_SECONDS * 1000) / SPEED }),
    [],
  );
  const [results, setResults] = useState<Results>();

  useEffect(() => {
    const worker = new Worker(new URL("./run.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<RunFrame>) => {
      frames.earlier = frames.later;
      frames.later = event.data.snapshot;
      frames.laterArrivedAtMs = performance.now();
      setResults(event.data.results);
    };
    const start: RunCommand = { type: "start", input: scenario, speed: SPEED };
    worker.postMessage(start);
    return () => {
      worker.terminate();
      frames.earlier = undefined;
      frames.later = undefined;
    };
  }, [frames]);

  return (
    <main>
      <RoadScene network={scenario.network} frames={frames} />
      <section className="results" aria-label="Results">
        <h1>One road, cars only</h1>
        <dl>
          <dt>Vehicles through</dt>
          <dd data-testid="vehicles-through">{results ? results.vehiclesThrough : "–"}</dd>
          <dt>On the network</dt>
          <dd data-testid="vehicles-on-network">{results ? results.vehiclesOnNetwork : "–"}</dd>
          <dt>Run time</dt>
          <dd data-testid="run-time">{results ? formatTime(results.timeS) : "–"}</dd>
        </dl>
        <p className="label">Uncalibrated estimate</p>
      </section>
    </main>
  );
}
