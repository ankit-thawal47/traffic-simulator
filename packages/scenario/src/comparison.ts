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

const VEHICLE_CLASS_PLURALS: Record<VehicleClass, string> = {
  "two-wheeler": "two-wheelers",
  car: "cars",
  "auto-rickshaw": "auto-rickshaws",
  bus: "buses",
};

/**
 * The fixed result set (ADR 0005), in the order it is shown: vehicles through,
 * mean travel time, mean delay per vehicle class, longest queue per approach,
 * stuck vehicles. A measure is added here for every scenario, or not at all.
 *
 * Only what the engine reports so far is here. Mean travel time belongs after
 * vehicles through; longest queue per approach and stuck vehicles belong at
 * the end. Each joins as one more entry when the engine comes to report it.
 * The engine's other counts (entered, on the network, waiting to enter) are
 * not part of the set, so they are not results.
 */
export const MEASURES: readonly Measure[] = [
  { id: "vehicles-through", name: "Vehicles through", unit: "vehicles", value: (results) => results.vehiclesThrough },
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

/** One figure over the seeds a scenario ran with. */
export interface AcrossSeeds {
  /** Null when no seed has anything to measure. */
  average: number | null;
  /** The range: the lowest and the highest figure any one seed gave. */
  lowest: number | null;
  highest: number | null;
  /** How many seeds the figures are over. */
  seeds: number;
}

/** The average and range of one figure, given once per seed. A seed with nothing to measure (null) is left out. */
export function acrossSeeds(values: readonly (number | null)[]): AcrossSeeds {
  const measured = values.filter((value): value is number => value !== null);
  if (measured.length === 0) return { average: null, lowest: null, highest: null, seeds: 0 };
  return {
    average: measured.reduce((sum, value) => sum + value, 0) / measured.length,
    lowest: Math.min(...measured),
    highest: Math.max(...measured),
    seeds: measured.length,
  };
}

/** One measure for both scenarios, over the seeds each ran with. */
export interface ComparedMeasureAcrossSeeds {
  id: string;
  name: string;
  unit: string;
  baseline: AcrossSeeds;
  proposal: AcrossSeeds;
  /** The proposal's average minus the baseline's, in the measure's own unit; null when either is. */
  change: number | null;
  /** The change as a percentage of the baseline's average; null when that is zero or there is no change to give. */
  changePercent: number | null;
  estimateLabel: typeof ESTIMATE_LABEL;
}

/**
 * Compare a proposal against the baseline from the results of each seed that
 * has finished (one Results per seed, with the warm-up already left out).
 * The change is between the two averages.
 */
export function compareAcrossSeeds(
  baseline: readonly Results[],
  proposal: readonly Results[],
  measures: readonly Measure[] = MEASURES,
): ComparedMeasureAcrossSeeds[] {
  return measures.map((measure) => {
    const before = acrossSeeds(baseline.map((results) => measure.value(results)));
    const after = acrossSeeds(proposal.map((results) => measure.value(results)));
    const change = before.average === null || after.average === null ? null : after.average - before.average;
    return {
      id: measure.id,
      name: measure.name,
      unit: measure.unit,
      baseline: before,
      proposal: after,
      change,
      changePercent: change === null || !before.average ? null : (100 * change) / before.average,
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
