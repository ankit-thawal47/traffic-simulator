import { VEHICLE_CLASSES } from "@traffic-simulator/engine";
import { baselineOf, resolveScenario, whyRefused, type Scenario } from "@traffic-simulator/scenario";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { angledPose, closeUpPose, networkBounds, straightDownPose } from "./camera-presets";
import { corridorNotice } from "./corridor-notice";
import { CorridorNoticePanel } from "./CorridorNoticePanel";
import { EXAMPLES } from "./examples";
import { clearSnapshots, newFrameStore, receiveSnapshot } from "./frame-store";
import { ProposalPanel } from "./ProposalPanel";
import { ResultsPanel } from "./ResultsPanel";
import { formatClock } from "./results-text";
import { CAMERA_FOV_DEGREES, RoadScene } from "./RoadScene";
import type { RunCommand, RunFrame } from "./run-protocol";
import { createBrowserStorage } from "./scenario-storage";
import { createSharedCamera } from "./shared-camera";
import { useFiveSeeds } from "./use-five-seeds";
import { legendFor, type ColourBy } from "./vehicle-colours";
import { WATCH_SPEEDS, fasterSpeed, formatSpeed, slowerSpeed } from "./watch-clock";

/** The scenario the page opens with, until the planner opens one from a link or a file. */
const exampleScenario = EXAMPLES[0]!.scenario;

const SLOWEST_SPEED = Math.min(...WATCH_SPEEDS);
const FASTEST_SPEED = Math.max(...WATCH_SPEEDS);

export function App() {
  // One scenario description holds the whole comparison: it is the proposal, and the baseline is the same
  // description without its changes. It is what a link or a file saves.
  const [proposal, setProposal] = useState(exampleScenario);
  const { name, corridorId, layout, network, unbuiltRoadIds, demand, laneDiscipline, seed } = proposal;
  const baseline = useMemo(
    () => baselineOf({ ...exampleScenario, name, corridorId, layout, network, unbuiltRoadIds, demand, laneDiscipline, seed }),
    [name, corridorId, layout, network, unbuiltRoadIds, demand, laneDiscipline, seed],
  );
  // A prepared corridor shown on the page brings its attribution, its licence and its road names.
  const notice = useMemo(() => corridorNotice(corridorId), [corridorId]);
  const baselineInput = useMemo(() => resolveScenario(baseline), [baseline]);
  const proposalInput = useMemo(() => resolveScenario(proposal), [proposal]);

  const storage = useMemo(createBrowserStorage, []);
  // Counts the scenarios opened from a link or a file, so the change controls start afresh for each.
  const [opened, setOpened] = useState(0);
  // Why the last change was not made: the engine would refuse to run the proposal with it.
  const [refusal, setRefusal] = useState<string>();
  const propose = (next: Scenario) => {
    const why = whyRefused(next);
    setRefusal(why);
    if (!why) setProposal(next);
  };
  const open = (scenario: Scenario) => {
    setProposal(scenario);
    setRefusal(undefined);
    setOpened((count) => count + 1);
  };

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
  }, [baselineInput, proposalInput, baselineFrames, proposalFrames, takeWatchedFrame]);

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
    <main className={notice ? "with-corridor" : undefined}>
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
        <AssumptionsPanel />
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
      {corridorId !== undefined && notice && <CorridorNoticePanel corridorId={corridorId} notice={notice} />}

      <section className="panels">
        <ProposalPanel
          proposal={proposal}
          opened={opened}
          refusal={refusal}
          storage={storage}
          onPropose={propose}
          onOpen={open}
        />

        <ResultsPanel
          collected={collected}
          networks={[baselineInput.network, proposalInput.network]}
          roadNames={notice?.roadNames}
        />
      </section>
    </main>
  );
}
