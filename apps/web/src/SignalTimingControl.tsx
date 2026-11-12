import type { SignalJunction } from "@traffic-simulator/engine";
import { SCENARIO_LIMITS, withSignalTiming } from "@traffic-simulator/scenario";
import { useState } from "react";
import { NumberField } from "./NumberField";
import type { ChangeControlProps } from "./RoadChanges";
import { greenTimesIn } from "./proposal-values";

/** The control for the signal timing change: the green time of each phase of a signal junction in the proposal. */
export function SignalTimingControl({ proposal, onChange }: ChangeControlProps) {
  const junctions = (proposal.network.junctions ?? []).filter(
    (junction): junction is SignalJunction => junction.control === "signal",
  );
  const [junctionId, setJunctionId] = useState(junctions[0]?.id ?? "");
  const junction = junctions.find((one) => one.id === junctionId);
  const greenS = greenTimesIn(proposal, junctionId);

  return (
    <fieldset className="change-group" data-testid="signal-timing">
      <legend>Signal timing</legend>
      {!junction || !greenS ? (
        <p className="hint">This network has no signal junction.</p>
      ) : (
        <div className="change-control">
          <label>
            Signal junction
            <select data-testid="change-signal-junction" value={junctionId} onChange={(event) => setJunctionId(event.target.value)}>
              {junctions.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.id}
                </option>
              ))}
            </select>
          </label>
          {junction.signalPlan.phases.map((phase, at) => (
            <NumberField
              key={`${junctionId}-${at}`}
              label={`Green for ${phase.greenRoadIds.join(", ")} (s)`}
              testId={`change-green-${at}`}
              value={greenS[at]!}
              min={1}
              max={SCENARIO_LIMITS.signalSeconds}
              onCommit={(seconds) =>
                onChange(withSignalTiming(proposal, junctionId, greenS.map((green, index) => (index === at ? seconds : green))))
              }
            />
          ))}
          <span className="hint">
            Baseline: {junction.signalPlan.phases.map((phase) => phase.greenS).join(", ")} s. Amber ({junction.signalPlan.amberS}{" "}
            s) and all-red ({junction.signalPlan.allRedS} s) stay as they are.
          </span>
        </div>
      )}
    </fieldset>
  );
}
