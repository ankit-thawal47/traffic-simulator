import { isFlyoverRoad, withFlyover } from "@traffic-simulator/scenario";
import type { ChangeControlProps } from "./RoadChanges";
import { flyoverBuiltIn } from "./proposal-values";
import { roadName, roadNamesFor } from "./road-names";

/**
 * The control for the flyover change: each flyover road the network has drawn
 * is built or not built in the proposal. A flyover cannot be drawn here; one
 * the network carries is turned on or off, one direction at a time.
 */
export function FlyoverControl({ proposal, onChange }: ChangeControlProps) {
  const flyoverRoads = proposal.network.roads.filter(isFlyoverRoad);
  const names = roadNamesFor(proposal);

  return (
    <fieldset className="change-group" data-testid="flyover">
      <legend>Flyover</legend>
      {flyoverRoads.length === 0 ? (
        <p className="hint">This network has no flyover drawn, so none can be added or removed.</p>
      ) : (
        <div className="change-control">
          {flyoverRoads.map((road) => (
            <label key={road.id} className="tick">
              <input
                data-testid={`change-flyover-${road.id}`}
                type="checkbox"
                checked={flyoverBuiltIn(proposal, road.id)}
                onChange={(event) => onChange(withFlyover(proposal, road.id, event.target.checked))}
              />
              {roadName(names, road.id)} built{" "}
              <span className="hint">({proposal.unbuiltRoadIds.includes(road.id) ? "not built" : "built"} in the baseline)</span>
            </label>
          ))}
          <span className="hint">
            Each flyover road is one direction. Without it, through traffic goes by the junction beneath.
          </span>
        </div>
      )}
    </fieldset>
  );
}
