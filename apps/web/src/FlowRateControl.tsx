import { SCENARIO_LIMITS, withFlowRate } from "@traffic-simulator/scenario";
import { useState } from "react";
import { NumberField } from "./NumberField";
import type { ChangeControlProps } from "./RoadChanges";
import { demandScaleIn, flowRateIn } from "./proposal-values";

/** The control for the flow rate change: the vehicles per hour of one entry-to-exit pair in the proposal. */
export function FlowRateControl({ proposal, onChange }: ChangeControlProps) {
  const flows = proposal.demand.flows;
  const [at, setAt] = useState(0);
  const flow = flows[at];
  if (!flow) return <p className="hint">The demand has no flows.</p>;
  const rate = flowRateIn(proposal, flow.entryRoadId, flow.exitRoadId) ?? flow.vehiclesPerHour;
  const scale = demandScaleIn(proposal);

  return (
    <div className="change-control">
      <label>
        From entry to exit
        <select data-testid="change-flow" className="wide" value={at} onChange={(event) => setAt(Number(event.target.value))}>
          {flows.map((one, index) => (
            <option key={`${one.entryRoadId}→${one.exitRoadId}`} value={index}>
              {one.entryRoadId} → {one.exitRoadId}
            </option>
          ))}
        </select>
      </label>
      <NumberField
        key={at}
        label="Vehicles per hour"
        testId="change-flow-rate"
        value={rate}
        min={0}
        max={SCENARIO_LIMITS.vehiclesPerHour}
        step={50}
        onCommit={(vehiclesPerHour) => onChange(withFlowRate(proposal, flow.entryRoadId, flow.exitRoadId, vehiclesPerHour))}
      />
      <span className="hint">
        Baseline: {flow.vehiclesPerHour}.{scale !== 1 && ` Scaled with all demand: ${Math.round(rate * scale)} an hour enter.`}
      </span>
    </div>
  );
}
