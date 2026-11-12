import type { Scenario } from "@traffic-simulator/scenario";
import { useState } from "react";
import { LaneClosureControl } from "./LaneClosureControl";
import { LostWidthControl } from "./LostWidthControl";
import { RoadClosureControl } from "./RoadClosureControl";
import { RoadLanesControl } from "./RoadLanesControl";
import { RoadWidthControl } from "./RoadWidthControl";
import { roadName, roadNamesFor } from "./road-names";

/** What every change control is given: the proposal, and where to send the proposal with the change made. */
export interface ChangeControlProps {
  proposal: Scenario;
  onChange: (proposal: Scenario) => void;
}

/** A control for a change to one road. */
export interface RoadControlProps extends ChangeControlProps {
  roadId: string;
}

/** The changes to a road: the planner picks the road once, and each kind of change to it has its own control. */
export function RoadChanges({ proposal, onChange }: ChangeControlProps) {
  const roads = proposal.network.roads;
  const [roadId, setRoadId] = useState(roads[0]?.id ?? "");
  const controls = { proposal, roadId, onChange };
  const names = roadNamesFor(proposal);

  return (
    <fieldset className="change-group" data-testid="road-changes">
      <legend>A road</legend>
      <div className="change-control">
        <label>
          Road
          <select data-testid="change-road" value={roadId} onChange={(event) => setRoadId(event.target.value)}>
            {roads.map((road) => (
              <option key={road.id} value={road.id}>
                {roadName(names, road.id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* Keyed by the road, so a half-typed figure for one road is not carried to the next. */}
      <RoadWidthControl key={`width-${roadId}`} {...controls} />
      <RoadLanesControl key={`lanes-${roadId}`} {...controls} />
      <LaneClosureControl key={`lanes-closed-${roadId}`} {...controls} />
      <LostWidthControl key={`lost-width-${roadId}`} {...controls} />
      <RoadClosureControl key={`closed-${roadId}`} {...controls} />
    </fieldset>
  );
}
