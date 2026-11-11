import { STEP_SECONDS, VEHICLE_CLASSES, type Results, type RunInput } from "@traffic-simulator/engine";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import { useEffect, useMemo, useState } from "react";
import { RoadScene, type FrameStore } from "./RoadScene";
import type { RunCommand, RunFrame } from "./run-protocol";

const scenario = mixedTraffic as RunInput;
/** Simulated seconds per real second. */
const SPEED = 1;

const VEHICLE_CLASS_NAMES = {
  "two-wheeler": "Two-wheelers",
  car: "Cars",
  "auto-rickshaw": "Auto-rickshaws",
  bus: "Buses",
} as const;

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
        <h1>One road, mixed traffic</h1>
        <dl>
          <dt>Vehicles through</dt>
          <dd data-testid="vehicles-through">{results ? results.vehiclesThrough : "–"}</dd>
          <dt>On the network</dt>
          <dd data-testid="vehicles-on-network">{results ? results.vehiclesOnNetwork : "–"}</dd>
          <dt>Run time</dt>
          <dd data-testid="run-time">{results ? formatTime(results.timeS) : "–"}</dd>
        </dl>
        <h2>Mean delay per vehicle</h2>
        <dl>
          {VEHICLE_CLASSES.map((vehicleClass) => {
            const delay = results?.delayByVehicleClass[vehicleClass];
            return (
              <div key={vehicleClass} className="vehicle-class">
                <dt>
                  <span className={`swatch ${vehicleClass}`} />
                  {VEHICLE_CLASS_NAMES[vehicleClass]}
                </dt>
                <dd data-testid={`delay-${vehicleClass}`}>
                  {delay && delay.meanDelayS !== null ? `${delay.meanDelayS.toFixed(1)} s` : "–"}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="label">Uncalibrated estimate</p>
      </section>
    </main>
  );
}
