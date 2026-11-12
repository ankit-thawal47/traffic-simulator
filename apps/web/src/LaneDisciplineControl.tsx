import { withLaneDiscipline } from "@traffic-simulator/scenario";
import type { ChangeControlProps } from "./RoadChanges";
import { laneDisciplineIn } from "./proposal-values";

/** The switch for the lane discipline change: lane discipline on or off in the proposal. */
export function LaneDisciplineControl({ proposal, onChange }: ChangeControlProps) {
  return (
    <fieldset className="change-group" data-testid="lane-discipline">
      <legend>Lane discipline</legend>
      <div className="change-control">
        <label className="tick">
          <input
            data-testid="change-lane-discipline"
            type="checkbox"
            checked={laneDisciplineIn(proposal)}
            onChange={(event) => onChange(withLaneDiscipline(proposal, event.target.checked))}
          />
          Lane discipline on
        </label>
        <span className="hint">
          Baseline: {proposal.laneDiscipline ? "on" : "off (mixed traffic)"}. On, vehicles keep to lanes; off, the road
          carries mixed traffic.
        </span>
      </div>
    </fieldset>
  );
}
