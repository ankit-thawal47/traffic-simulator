import type { Scenario } from "@traffic-simulator/scenario";
import { useState } from "react";
import { AreaImport } from "./AreaImport";
import { Builder } from "./Builder";
import { ChangesList } from "./ChangesList";
import { DemandScaleControl } from "./DemandScaleControl";
import { EXAMPLES } from "./examples";
import { FlowRateControl } from "./FlowRateControl";
import { FlyoverControl } from "./FlyoverControl";
import { LaneDisciplineControl } from "./LaneDisciplineControl";
import { RoadChanges } from "./RoadChanges";
import { SaveAndShare } from "./SaveAndShare";
import type { ScenarioStorage } from "./scenario-storage";
import { SignalTimingControl } from "./SignalTimingControl";
import { VehicleMixControl } from "./VehicleMixControl";

/**
 * The proposal: where the planner starts from an example, builds a network
 * from building blocks (the builder) or imports a place from OpenStreetMap, makes each kind of
 * change, reads the list of changes and undoes any one, and saves and shares.
 * Every control hands the proposal with its change made to onPropose, which
 * makes the change only if the engine will run the result.
 */
const BUILDER = "builder";
const IMPORT = "import";

export function ProposalPanel({
  proposal,
  opened,
  refusal,
  storage,
  onPropose,
  onOpen,
}: {
  proposal: Scenario;
  /** Counts the scenarios opened, so the controls start afresh for each. */
  opened: number;
  /** Why the last change was not made. */
  refusal: string | undefined;
  storage: ScenarioStorage;
  onPropose: (proposal: Scenario) => void;
  onOpen: (scenario: Scenario) => void;
}) {
  const controls = { proposal, onChange: onPropose };
  // The builder is picked where an example is; it stays open while the planner builds.
  const [building, setBuilding] = useState<string>();
  const picked =
    building ??
    (proposal.layout !== undefined ? BUILDER : proposal.area !== undefined ? IMPORT : EXAMPLES.find((example) => example.scenario.name === proposal.name)?.id ?? "");

  return (
    <section className="proposal" aria-label="Proposal">
      <h2>Proposal</h2>
      <div className="change-control">
        <label>
          Start from an example, build a network, or import a place
          <select
            data-testid="example"
            className="wide"
            value={picked}
            onChange={(event) => {
              const example = EXAMPLES.find((one) => one.id === event.target.value);
              setBuilding(event.target.value === BUILDER || event.target.value === IMPORT ? event.target.value : undefined);
              if (example) onOpen(example.scenario);
            }}
          >
            <option value="" disabled>
              (a scenario of your own)
            </option>
            {EXAMPLES.map((example) => (
              <option key={example.id} value={example.id}>
                {example.scenario.name}
              </option>
            ))}
            <option value={BUILDER}>Build from building blocks…</option>
            <option value={IMPORT}>Import a place from OpenStreetMap…</option>
          </select>
        </label>
      </div>
      {picked === BUILDER && <Builder key={`builder-${opened}`} from={proposal.layout} onBuild={onOpen} />}
      {picked === IMPORT && <AreaImport onImport={onOpen} />}

      <h3>Changes from the baseline</h3>
      <ChangesList {...controls} />
      {refusal && (
        <p className="refused" data-testid="change-refused" role="alert">
          Not changed. {refusal}.
        </p>
      )}

      <h3>Make a change</h3>
      <div className="change-groups" key={opened}>
        <RoadChanges {...controls} />
        <SignalTimingControl {...controls} />
        <FlyoverControl {...controls} />
        <fieldset className="change-group" data-testid="demand">
          <legend>Demand and vehicle mix</legend>
          <DemandScaleControl {...controls} />
          <FlowRateControl {...controls} />
          <VehicleMixControl {...controls} />
        </fieldset>
        <LaneDisciplineControl {...controls} />
      </div>

      <h3>Save and share</h3>
      <SaveAndShare scenario={proposal} storage={storage} onOpen={onOpen} />
    </section>
  );
}
