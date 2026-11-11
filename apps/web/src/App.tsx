import { STEP_SECONDS, VEHICLE_CLASS_ASSUMPTIONS, type Network, type Results } from "@traffic-simulator/engine";
import oneRoad from "@traffic-simulator/engine/examples/one-road.json";
import {
  ESTIMATE_LABEL,
  compareResults,
  createBaseline,
  createProposal,
  formatChange,
  resolveScenario,
  withoutChange,
  withRoadWidth,
  type Change,
  type Scenario,
} from "@traffic-simulator/scenario";
import { useEffect, useMemo, useState } from "react";
import { RoadScene, type FrameStore } from "./RoadScene";
import type { RunCommand, RunFrame } from "./run-protocol";
import { createSharedCamera } from "./shared-camera";

/** Simulated seconds per real second. */
const SPEED = 1;

const baseline = createBaseline({
  name: "One road today",
  network: oneRoad.network as Network,
  demand: oneRoad.demand,
  seed: oneRoad.seed,
});
const baselineInput = resolveScenario(baseline);

/** A road cannot be made narrower than the widest vehicle that uses it, or wider than this. */
const NARROWEST_ROAD_M = Math.max(...Object.values(VEHICLE_CLASS_ASSUMPTIONS).map((assumptions) => assumptions.widthM));
const WIDEST_ROAD_M = 30;

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function describeChange(change: Change, network: Network): string {
  switch (change.kind) {
    case "road-width": {
      const today = network.roads.find((road) => road.id === change.roadId)?.widthM;
      return `Road "${change.roadId}": width ${today ?? "?"} m → ${change.widthM} m`;
    }
  }
}

function newFrameStore(): FrameStore {
  return { laterArrivedAtMs: 0, intervalMs: (STEP_SECONDS * 1000) / SPEED };
}

/** The control for the one kind of change so far: the width of a road in the proposal. */
function RoadWidthControl({ proposal, onChange }: { proposal: Scenario; onChange: (proposal: Scenario) => void }) {
  const roads = proposal.network.roads;
  const [roadId, setRoadId] = useState(roads[0]?.id ?? "");
  const today = roads.find((road) => road.id === roadId)?.widthM;
  const proposed = resolveScenario(proposal).network.roads.find((road) => road.id === roadId)?.widthM;
  // What is typed is kept as text, and becomes a change only once it is a width a road can have.
  const [typed, setTyped] = useState<string>();
  const text = typed ?? String(proposed ?? "");
  const typedWidthM = Number(text);
  const usable = text.trim() !== "" && typedWidthM >= NARROWEST_ROAD_M && typedWidthM <= WIDEST_ROAD_M;

  return (
    <div className="change-control">
      <label>
        Road
        <select
          data-testid="change-road"
          value={roadId}
          onChange={(event) => {
            setRoadId(event.target.value);
            setTyped(undefined);
          }}
        >
          {roads.map((road) => (
            <option key={road.id} value={road.id}>
              {road.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Width in the proposal (m)
        <input
          data-testid="change-road-width"
          type="number"
          min={NARROWEST_ROAD_M}
          max={WIDEST_ROAD_M}
          step={0.5}
          value={text}
          aria-invalid={!usable}
          onChange={(event) => {
            const next = event.target.value;
            const widthM = Number(next);
            if (next.trim() !== "" && widthM >= NARROWEST_ROAD_M && widthM <= WIDEST_ROAD_M) {
              setTyped(undefined);
              onChange(withRoadWidth(proposal, roadId, widthM));
            } else {
              setTyped(next);
            }
          }}
          onBlur={() => setTyped(undefined)}
        />
      </label>
      <span className="hint">
        Baseline: {today ?? "?"} m. A width from {NARROWEST_ROAD_M} m to {WIDEST_ROAD_M} m.
      </span>
    </div>
  );
}

export function App() {
  const [proposal, setProposal] = useState(() => createProposal(baseline, "Proposal"));
  const proposalInput = useMemo(() => resolveScenario(proposal), [proposal]);

  const sharedCamera = useMemo(() => createSharedCamera(), []);
  const baselineFrames = useMemo(newFrameStore, []);
  const proposalFrames = useMemo(newFrameStore, []);
  const [frame, setFrame] = useState<{ timeS: number; baseline: Results; proposal: Results }>();

  // Baseline and proposal run together in one worker, so they share one clock.
  // Any change to the proposal starts both again from the beginning.
  useEffect(() => {
    const worker = new Worker(new URL("./run.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<RunFrame>) => {
      const [baselineRun, proposalRun] = event.data.runs;
      if (!baselineRun || !proposalRun) return;
      const arrivedAtMs = performance.now();
      baselineFrames.earlier = baselineFrames.later;
      baselineFrames.later = baselineRun.snapshot;
      baselineFrames.laterArrivedAtMs = arrivedAtMs;
      proposalFrames.earlier = proposalFrames.later;
      proposalFrames.later = proposalRun.snapshot;
      proposalFrames.laterArrivedAtMs = arrivedAtMs;
      setFrame({ timeS: event.data.timeS, baseline: baselineRun.results, proposal: proposalRun.results });
    };
    const start: RunCommand = { type: "start", inputs: [baselineInput, proposalInput], speed: SPEED };
    worker.postMessage(start);
    return () => {
      worker.terminate();
      for (const frames of [baselineFrames, proposalFrames]) {
        frames.earlier = undefined;
        frames.later = undefined;
      }
      setFrame(undefined);
    };
  }, [proposalInput, baselineFrames, proposalFrames]);

  const rows = frame ? compareResults(frame.baseline, frame.proposal) : [];

  return (
    <main>
      <header>
        <h1>Baseline against proposal</h1>
        <p className="clock">
          Run time <span data-testid="run-time">{frame ? formatTime(frame.timeS) : "–"}</span>
        </p>
      </header>

      <section className="views" aria-label="Baseline and proposal, side by side">
        <figure data-testid="view-baseline">
          <figcaption>Baseline · {baseline.name}</figcaption>
          <RoadScene network={baselineInput.network} frames={baselineFrames} sharedCamera={sharedCamera} />
        </figure>
        <figure data-testid="view-proposal">
          <figcaption>
            Proposal · {proposal.changes.length === 0 ? "no changes yet" : `${proposal.changes.length} change(s)`}
          </figcaption>
          <RoadScene network={proposalInput.network} frames={proposalFrames} sharedCamera={sharedCamera} />
        </figure>
      </section>

      <section className="panels">
        <section className="proposal" aria-label="Proposal">
          <h2>Proposal</h2>
          <RoadWidthControl proposal={proposal} onChange={setProposal} />
          <h3>Changes from the baseline</h3>
          {proposal.changes.length === 0 ? (
            <p className="hint" data-testid="no-changes">
              None. The proposal is a copy of the baseline.
            </p>
          ) : (
            <ol data-testid="changes">
              {proposal.changes.map((change, index) => (
                <li key={`${change.kind}:${change.roadId}`}>
                  {describeChange(change, proposal.network)}{" "}
                  <button type="button" onClick={() => setProposal(withoutChange(proposal, index))}>
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="results" aria-label="Results">
          <h2>Results</h2>
          <table data-testid="results">
            <caption>{ESTIMATE_LABEL}: every figure below is plausible, and none is calibrated.</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Baseline</th>
                <th scope="col">Proposal</th>
                <th scope="col">Change from baseline</th>
                <th scope="col">
                  <span className="visually-hidden">Label</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-testid={`result-${row.id}`}>
                  <th scope="row">{row.name}</th>
                  <td data-testid="baseline">{formatNumber(row.baseline)}</td>
                  <td data-testid="proposal">{formatNumber(row.proposal)}</td>
                  <td data-testid="change">
                    {formatChange(row.change)}
                    {row.changePercent !== null && row.change !== 0 && (
                      <span className="percent"> ({formatChange(row.changePercent)}%)</span>
                    )}
                  </td>
                  <td className="label">{row.estimateLabel}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>Starting the runs…</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
