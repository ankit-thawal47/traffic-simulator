import { VEHICLE_CLASSES, type VehicleClass } from "@traffic-simulator/engine";
import { describeVehicleMix, withVehicleMix } from "@traffic-simulator/scenario";
import { NumberField } from "./NumberField";
import type { ChangeControlProps } from "./RoadChanges";
import { vehicleMixIn } from "./proposal-values";

const SHARE_OF: Record<VehicleClass, string> = {
  "two-wheeler": "Two-wheelers",
  car: "Cars",
  "auto-rickshaw": "Auto-rickshaws",
  bus: "Buses",
};

/**
 * The control for the vehicle mix change: the share of each vehicle class in
 * the proposal's demand. Shares are used in proportion and need not add up to
 * anything; the hint shows them as percentages.
 */
export function VehicleMixControl({ proposal, onChange }: ChangeControlProps) {
  const mix = vehicleMixIn(proposal);
  return (
    <div className="change-control">
      {VEHICLE_CLASSES.map((vehicleClass) => (
        <NumberField
          key={vehicleClass}
          label={`${SHARE_OF[vehicleClass]} (share)`}
          testId={`change-mix-${vehicleClass}`}
          value={mix[vehicleClass] ?? 0}
          min={0}
          max={1000}
          step={0.05}
          onCommit={(share) => onChange(withVehicleMix(proposal, { ...mix, [vehicleClass]: share }))}
        />
      ))}
      <span className="hint" data-testid="mix-hint">
        Shares are used in proportion. Now: {describeVehicleMix(mix)}.
      </span>
    </div>
  );
}
