/**
 * Results and comparison (ADR 0005): every scenario reports the same fixed
 * set of measures, each as an absolute number and as a change from the
 * baseline, and every result carries the uncalibrated estimate label.
 */
import { VEHICLE_CLASSES, type Results, type VehicleClass } from "@traffic-simulator/engine";

/** The label every result carries. An estimate is never presented as calibrated. */
export const ESTIMATE_LABEL = "Uncalibrated estimate";

/** One measure of the fixed result set: how to read it out of a run's results. */
export interface Measure {
  id: string;
  name: string;
  unit: string;
  /** Null when the results hold nothing to measure, such as the delay of a vehicle class with no vehicles. */
  value(results: Results): number | null;
}

/**
 * The fixed result set, in the order it is shown. A measure is added here for
 * every scenario, or not at all. Mean travel time, longest queue per approach
 * and stuck vehicles join as the engine comes to report them.
 */
const VEHICLE_CLASS_PLURALS: Record<VehicleClass, string> = {
  "two-wheeler": "two-wheelers",
  car: "cars",
  "auto-rickshaw": "auto-rickshaws",
  bus: "buses",
};

export const MEASURES: readonly Measure[] = [
  { id: "vehicles-through", name: "Vehicles through", unit: "vehicles", value: (results) => results.vehiclesThrough },
  { id: "vehicles-entered", name: "Vehicles entered", unit: "vehicles", value: (results) => results.vehiclesEntered },
  {
    id: "vehicles-on-network",
    name: "On the network",
    unit: "vehicles",
    value: (results) => results.vehiclesOnNetwork,
  },
  {
    id: "vehicles-waiting-to-enter",
    name: "Waiting to enter",
    unit: "vehicles",
    value: (results) => results.vehiclesWaitingToEnter,
  },
  ...VEHICLE_CLASSES.map(
    (vehicleClass): Measure => ({
      id: `mean-delay-${vehicleClass}`,
      name: `Mean delay of ${VEHICLE_CLASS_PLURALS[vehicleClass]} (s)`,
      unit: "s",
      value: (results) => results.delayByVehicleClass[vehicleClass].meanDelayS,
    }),
  ),
];

/** One measure for both scenarios. */
export interface ComparedMeasure {
  id: string;
  name: string;
  unit: string;
  /** Null when the scenario's results hold nothing to measure. */
  baseline: number | null;
  proposal: number | null;
  /** Proposal minus baseline, in the measure's own unit; null when either is. */
  change: number | null;
  /** The change as a percentage of the baseline; null when the baseline is zero or there is no change to give. */
  changePercent: number | null;
  estimateLabel: typeof ESTIMATE_LABEL;
}

export function compareResults(
  baseline: Results,
  proposal: Results,
  measures: readonly Measure[] = MEASURES,
): ComparedMeasure[] {
  return measures.map((measure) => {
    const before = measure.value(baseline);
    const after = measure.value(proposal);
    const change = before === null || after === null ? null : after - before;
    return {
      id: measure.id,
      name: measure.name,
      unit: measure.unit,
      baseline: before,
      proposal: after,
      change,
      changePercent: change === null || before === null || before === 0 ? null : (100 * change) / before,
      estimateLabel: ESTIMATE_LABEL,
    };
  });
}

/** A change written with its direction: "+50", "−50", "0". At most one decimal place. */
export function formatChange(change: number): string {
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}`;
}
