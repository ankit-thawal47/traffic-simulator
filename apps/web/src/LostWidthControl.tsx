import { LOST_WIDTH_REASONS, withLostWidth, type LostWidthReason } from "@traffic-simulator/scenario";
import { NumberField } from "./NumberField";
import type { RoadControlProps } from "./RoadChanges";
import { roadValues } from "./proposal-values";

const REASON_NAMES: Record<LostWidthReason, string> = {
  parking: "Parking",
  hawkers: "Hawkers",
  "stopped-vehicles": "Stopped vehicles",
  other: "Other roadside activity",
};

/**
 * The control for width lost to roadside activity: how much of a road's width
 * cannot be driven on in the proposal, and why. It is a change of its own,
 * apart from the road's width: the road stays as wide as it is built.
 */
export function LostWidthControl({ proposal, roadId, onChange }: RoadControlProps) {
  const road = roadValues(proposal, roadId);
  if (!road) return null;
  return (
    <div className="change-control">
      <NumberField
        label="Width lost at the roadside (m)"
        testId="change-lost-width"
        value={road.lostWidthM}
        min={0}
        max={30}
        step={0.5}
        onCommit={(widthM) => onChange(withLostWidth(proposal, roadId, widthM, road.lostWidthReason))}
      />
      <label>
        Lost to
        <select
          data-testid="change-lost-width-reason"
          value={road.lostWidthReason}
          disabled={road.lostWidthM === 0}
          onChange={(event) => onChange(withLostWidth(proposal, roadId, road.lostWidthM, event.target.value as LostWidthReason))}
        >
          {LOST_WIDTH_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {REASON_NAMES[reason]}
            </option>
          ))}
        </select>
      </label>
      <span className="hint">Comes off the width above; the lanes stay as many, each narrower.</span>
    </div>
  );
}
