import {
  STRIP_WIDTH_M,
  stripsOccupied,
  VEHICLE_CLASSES,
  type Demand,
  type Network,
} from "@traffic-simulator/engine";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import {
  createBaseline,
  createProposal,
  resolveScenario,
  withoutChange,
  withRoadWidth,
  type Change,
  type Scenario,
} from "@traffic-simulator/scenario";
import { useEffect, useMemo, useRef, useState } from "react";
import { angledPose, closeUpPose, networkBounds, straightDownPose } from "./camera-presets";
import { clearSnapshots, newFrameStore, receiveSnapshot } from "./frame-store";
import { ResultsPanel } from "./ResultsPanel";
import { formatClock } from "./results-text";
import { CAMERA_FOV_DEGREES, RoadScene } from "./RoadScene";
import type { RunCommand, RunFrame } from "./run-protocol";
import { createSharedCamera } from "./shared-camera";
import { useFiveSeeds } from "./use-five-seeds";
import { legendFor, type ColourBy } from "./vehicle-colours";
import { WATCH_SPEEDS, fasterSpeed, formatSpeed, slowerSpeed } from "./watch-clock";

const baseline = createBaseline({
  name: "One road today",
  network: mixedTraffic.network as Network,
  demand: mixedTraffic.demand as Demand,
  seed: mixedTraffic.seed,
});
const baselineInput = resolveScenario(baseline);

/** A road cannot be made narrower than the strips the widest vehicle class occupies, or wider than this. */
const NARROWEST_ROAD_M = Math.max(...VEHICLE_CLASSES.map(stripsOccupied)) * STRIP_WIDTH_M;
const WIDEST_ROAD_M = 30;

function describeChange(change: Change, network: Network): string {
  switch (change.kind) {
    case "road-width": {
      const today = network.roads.find((road) => road.id === change.roadId)?.widthM;
      return `Road "${change.roadId}": width ${today ?? "?"} m → ${change.widthM} m`;
    }
  }
}

const SLOWEST_SPEED = Math.min(...WATCH_SPEEDS);
const FASTEST_SPEED = Math.max(...WATCH_SPEEDS);

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
  // Five seeds per scenario: the watched run below is the first; the others run unseen.
  const { collected, takeWatchedFrame } = useFiveSeeds(baselineInput, proposalInput);
  const watched = collected.watched;

  // How the planner watches. None of this reaches the engine's inputs, so none of it can change the results.
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [colourBy, setColourBy] = useState<ColourBy>("vehicle-class");
  const watching = useRef({ speed, paused });
  watching.current = { speed, paused };
  const worker = useRef<Worker>();
  const send = (command: RunCommand) => worker.current?.postMessage(command);
  const baselineView = useRef<HTMLElement>(null);

  // Baseline and proposal run together in one worker, so they share one clock.
  // Any change to the proposal starts both again from the beginning.
  useEffect(() => {
    const started = new Worker(new URL("./run.worker.ts", import.meta.url), { type: "module" });
    worker.current = started;
    started.onmessage = (event: MessageEvent<RunFrame>) => {
      const [baselineRun, proposalRun] = event.data.runs;
      if (!baselineRun || !proposalRun) return;
      const arrivedAtMs = performance.now();
      receiveSnapshot(baselineFrames, baselineRun.snapshot, arrivedAtMs, watching.current.speed);
      receiveSnapshot(proposalFrames, proposalRun.snapshot, arrivedAtMs, watching.current.speed);
      takeWatchedFrame(event.data);
    };
    started.postMessage({
      type: "start",
      inputs: [baselineInput, proposalInput],
      ...watching.current,
    } satisfies RunCommand);
    return () => {
      started.terminate();
      worker.current = undefined;
      clearSnapshots(baselineFrames);
      clearSnapshots(proposalFrames);
    };
  }, [proposalInput, baselineFrames, proposalFrames, takeWatchedFrame]);

  const changeSpeed = (next: number) => {
    setSpeed(next);
    send({ type: "set-speed", speed: next });
  };
  const togglePaused = () => {
    setPaused(!paused);
    send({ type: paused ? "resume" : "pause" });
  };

  // A camera preset moves the one shared camera, so both views go to it together.
  const moveCamera = (preset: "close-up" | "straight-down" | "angled") => {
    const bounds = networkBounds(baselineInput.network);
    const view = baselineView.current;
    const aspect = view && view.clientHeight > 0 ? view.clientWidth / view.clientHeight : 1;
    sharedCamera.move(
      "preset",
      preset === "close-up"
        ? closeUpPose(baselineInput.network)
        : preset === "straight-down"
          ? straightDownPose(bounds, { fovDegrees: CAMERA_FOV_DEGREES, aspect })
          : angledPose(bounds),
    );
  };

  const legend = legendFor(colourBy, VEHICLE_CLASSES);

  return (
    <main>
      <header>
        <h1>Baseline against proposal</h1>
        <p className="clock">
          <span
            data-testid="run-time"
            data-run-time-s={watched?.timeS.toFixed(1)}
            data-warming-up={watched?.warmingUp}
            data-finished={watched?.finished}
          >
            {watched ? formatClock(watched, collected.plan) : "Starting the runs…"}
          </span>
          {paused && <em data-testid="paused"> · paused</em>}
        </p>
      </header>

      <section className="watch-controls" aria-label="Watch controls">
        <div className="control-group" role="group" aria-label="Speed">
          <button type="button" data-testid="pause" aria-pressed={paused} onClick={togglePaused}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            data-testid="slower"
            disabled={speed <= SLOWEST_SPEED}
            onClick={() => changeSpeed(slowerSpeed(speed))}
          >
            Slower
          </button>
          <output data-testid="speed" aria-label="Speed, as a multiple of real time">
            {formatSpeed(speed)}
          </output>
          <button
            type="button"
            data-testid="faster"
            disabled={speed >= FASTEST_SPEED}
            onClick={() => changeSpeed(fasterSpeed(speed))}
          >
            Faster
          </button>
          <button type="button" data-testid="watch-again" onClick={() => send({ type: "watch-again" })}>
            Watch again
          </button>
        </div>

        <div className="control-group" role="group" aria-label="Camera">
          <span className="group-name">Camera</span>
          <button type="button" data-testid="camera-close-up" onClick={() => moveCamera("close-up")}>
            Close up
          </button>
          <button type="button" data-testid="camera-straight-down" onClick={() => moveCamera("straight-down")}>
            Straight down
          </button>
          <button type="button" data-testid="camera-angled" onClick={() => moveCamera("angled")}>
            Angled
          </button>
          <span className="hint">Drag to orbit, right-drag to pan, scroll to zoom. Both views move together.</span>
        </div>

        <div className="control-group">
          <label>
            <span className="group-name">Colour vehicles by</span>{" "}
            <select
              data-testid="colour-by"
              value={colourBy}
              onChange={(event) => setColourBy(event.target.value === "speed" ? "speed" : "vehicle-class")}
            >
              <option value="vehicle-class">Vehicle class</option>
              <option value="speed">Speed</option>
            </select>
          </label>
          <ul className="legend" data-testid="legend" aria-label="What the colours mean">
            {legend.map((entry) => (
              <li key={entry.label}>
                <span className="swatch" style={{ background: entry.colour }} />
                {entry.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="views" aria-label="Baseline and proposal, side by side">
        <figure data-testid="view-baseline" ref={baselineView}>
          <figcaption>Baseline · {baseline.name}</figcaption>
          <RoadScene
            network={baselineInput.network}
            frames={baselineFrames}
            sharedCamera={sharedCamera}
            colourBy={colourBy}
          />
        </figure>
        <figure data-testid="view-proposal">
          <figcaption>
            Proposal · {proposal.changes.length === 0 ? "no changes yet" : `${proposal.changes.length} change(s)`}
          </figcaption>
          <RoadScene
            network={proposalInput.network}
            frames={proposalFrames}
            sharedCamera={sharedCamera}
            colourBy={colourBy}
          />
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

        <ResultsPanel collected={collected} />
      </section>
    </main>
  );
}
