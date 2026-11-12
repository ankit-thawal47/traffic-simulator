import { SCENARIO_LIMITS, withDemandScale } from "@traffic-simulator/scenario";
import { NumberField } from "./NumberField";
import type { ChangeControlProps } from "./RoadChanges";
import { demandScaleIn } from "./proposal-values";

/**
 * The control that scales all demand: every entry-to-exit rate of the
 * proposal is multiplied together. It is how a planner asks what happens if a
 * change attracts more traffic, since induced demand is not modelled (ADR 0006).
 */
export function DemandScaleControl({ proposal, onChange }: ChangeControlProps) {
  return (
    <div className="change-control">
      <NumberField
        label="Scale all demand to (%)"
        testId="change-demand-scale"
        value={demandScaleIn(proposal) * 100}
        min={0}
        max={SCENARIO_LIMITS.demandScale * 100}
        step={5}
        onCommit={(percent) => onChange(withDemandScale(proposal, percent / 100))}
      />
      <span className="hint">
        100% is the baseline's demand. Every entry-to-exit rate changes together. Induced demand is not modelled: use
        this to ask what more traffic would do.
      </span>
    </div>
  );
}
