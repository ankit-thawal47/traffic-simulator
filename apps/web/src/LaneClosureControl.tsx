import { withLaneClosure } from "@traffic-simulator/scenario";
import { NumberField } from "./NumberField";
import type { RoadControlProps } from "./RoadChanges";
import { roadValues } from "./proposal-values";

function formatMetres(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The control for the lane closure change: how many of a road's lanes are closed in the proposal. */
export function LaneClosureControl({ proposal, roadId, onChange }: RoadControlProps) {
  const road = roadValues(proposal, roadId);
  if (!road) return null;
  const laneWidthM = road.widthM / road.lanes;
  return (
    <div className="change-control">
      <NumberField
        label="Lanes closed"
        testId="change-lanes-closed"
        value={road.lanesClosed}
        min={0}
        max={Math.max(0, road.lanes - 1)}
        whole
        disabled={road.lanes < 2}
        onCommit={(lanesClosed) => onChange(withLaneClosure(proposal, roadId, lanesClosed))}
      />
      <span className="hint">
        {road.lanes < 2
          ? "The road has one lane. To close it, close the road."
          : `Each closed lane takes ${formatMetres(laneWidthM)} m off the width, along the whole road. At least one lane stays open.`}
      </span>
    </div>
  );
}
