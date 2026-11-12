import { STRIP_WIDTH_M, stripsOccupied, VEHICLE_CLASSES } from "@traffic-simulator/engine";
import { withRoadWidth } from "@traffic-simulator/scenario";
import { NumberField } from "./NumberField";
import type { RoadControlProps } from "./RoadChanges";
import { roadValues } from "./proposal-values";

/** A road cannot be made narrower than the strips the widest vehicle class occupies, or wider than this. */
export const NARROWEST_ROAD_M = Math.max(...VEHICLE_CLASSES.map(stripsOccupied)) * STRIP_WIDTH_M;
export const WIDEST_ROAD_M = 30;

/** The control for the width change: the width of a road in the proposal. */
export function RoadWidthControl({ proposal, roadId, onChange }: RoadControlProps) {
  const road = roadValues(proposal, roadId);
  if (!road) return null;
  return (
    <div className="change-control">
      <NumberField
        label="Width (m)"
        testId="change-road-width"
        value={road.widthM}
        min={NARROWEST_ROAD_M}
        max={WIDEST_ROAD_M}
        step={0.5}
        onCommit={(widthM) => onChange(withRoadWidth(proposal, roadId, widthM))}
      />
      <span className="hint">
        Baseline: {road.today.widthM} m. From {NARROWEST_ROAD_M} m to {WIDEST_ROAD_M} m.
      </span>
    </div>
  );
}
