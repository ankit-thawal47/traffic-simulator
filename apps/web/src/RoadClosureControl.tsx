import { withRoadClosure } from "@traffic-simulator/scenario";
import type { RoadControlProps } from "./RoadChanges";
import { roadValues } from "./proposal-values";

/** The control for the road closure change: a road closed to all traffic in the proposal. */
export function RoadClosureControl({ proposal, roadId, onChange }: RoadControlProps) {
  const road = roadValues(proposal, roadId);
  if (!road) return null;
  return (
    <div className="change-control">
      <label className="tick">
        <input
          data-testid="change-road-closed"
          type="checkbox"
          checked={road.closed}
          onChange={(event) => onChange(withRoadClosure(proposal, roadId, event.target.checked))}
        />
        Road closed
      </label>
      <span className="hint">
        Traffic that used it takes another route if the network has one. A closure that leaves traffic with no route is
        not made.
      </span>
    </div>
  );
}
