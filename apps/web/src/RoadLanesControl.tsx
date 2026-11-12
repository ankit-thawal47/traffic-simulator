/**
 * The control for the lanes change: the number of lanes of a road in the proposal.
 *
 * Lanes and width are independent (see RoadLanesChange in the scenario
 * package): changing the lanes leaves the width as it is, and the lanes share
 * that width equally. What the planner types becomes a change only once it is
 * a whole number of lanes a road can have; whether the engine will run the
 * result is checked by whoever receives onChange.
 */
import { SCENARIO_LIMITS, lanesOf, resolveScenario, withRoadLanes, type Scenario } from "@traffic-simulator/scenario";
import { useState } from "react";

const MOST_LANES = SCENARIO_LIMITS.lanes;

function usableLanes(text: string): number | undefined {
  const lanes = Number(text);
  return text.trim() !== "" && Number.isInteger(lanes) && lanes >= 1 && lanes <= MOST_LANES ? lanes : undefined;
}

function formatMetres(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function RoadLanesControl({ proposal, onChange }: { proposal: Scenario; onChange: (proposal: Scenario) => void }) {
  const roads = proposal.network.roads;
  const [roadId, setRoadId] = useState(roads[0]?.id ?? "");
  const today = roads.find((road) => road.id === roadId);
  const proposed = resolveScenario(proposal).network.roads.find((road) => road.id === roadId);
  // What is typed is kept as text, and becomes a change only once it is a number of lanes a road can have.
  const [typed, setTyped] = useState<string>();
  const text = typed ?? (proposed ? String(lanesOf(proposed)) : "");

  return (
    <div className="change-control">
      <label>
        Road
        <select
          data-testid="change-lanes-road"
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
        Lanes in the proposal
        <input
          data-testid="change-road-lanes"
          type="number"
          min={1}
          max={MOST_LANES}
          step={1}
          value={text}
          aria-invalid={usableLanes(text) === undefined}
          onChange={(event) => {
            const next = event.target.value;
            const lanes = usableLanes(next);
            if (lanes !== undefined) {
              setTyped(undefined);
              onChange(withRoadLanes(proposal, roadId, lanes));
            } else {
              setTyped(next);
            }
          }}
          onBlur={() => setTyped(undefined)}
        />
      </label>
      <span className="hint" data-testid="lanes-hint">
        Baseline: {today ? lanesOf(today) : "?"} lanes. A whole number from 1 to {MOST_LANES}. Lanes and width are set
        separately; the lanes share the width equally
        {proposed && ` (now ${lanesOf(proposed)} of ${formatMetres(proposed.widthM / lanesOf(proposed))} m)`}.{" "}
        {proposal.laneDiscipline
          ? "Lane discipline is on, so every lane must be wide enough for the widest vehicle class in the demand."
          : "Lane discipline is off: the road carries mixed traffic, which takes no notice of lanes, so the number of lanes does not change the estimate."}
      </span>
    </div>
  );
}
