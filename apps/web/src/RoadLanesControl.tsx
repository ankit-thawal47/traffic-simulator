/**
 * The control for the lanes change: the number of lanes of a road in the proposal.
 *
 * Lanes and width are independent (see RoadLanesChange in the scenario
 * package): changing the lanes leaves the width as it is, and the lanes share
 * that width equally. Lanes matter to the estimate only with lane discipline
 * on in the proposal; with it off the control says so in a few words.
 */
import { SCENARIO_LIMITS, withRoadLanes } from "@traffic-simulator/scenario";
import { NumberField } from "./NumberField";
import type { RoadControlProps } from "./RoadChanges";
import { laneDisciplineIn, roadValues } from "./proposal-values";

function formatMetres(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function RoadLanesControl({ proposal, roadId, onChange }: RoadControlProps) {
  const road = roadValues(proposal, roadId);
  if (!road) return null;
  return (
    <div className="change-control">
      <NumberField
        label="Lanes"
        testId="change-road-lanes"
        value={road.lanes}
        min={1}
        max={SCENARIO_LIMITS.lanes}
        whole
        onCommit={(lanes) => onChange(withRoadLanes(proposal, roadId, lanes))}
      />
      <span className="hint" data-testid="lanes-hint">
        Baseline: {road.today.lanes}. Now {road.lanes} of {formatMetres(road.widthM / road.lanes)} m.{" "}
        {laneDisciplineIn(proposal)
          ? "Each lane must be wide enough for the widest vehicle class."
          : "Lane discipline is off, so lanes do not alter the estimate."}
      </span>
    </div>
  );
}
