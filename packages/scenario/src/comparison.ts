/**
 * Results and comparison (ADR 0005): every scenario reports the same fixed
 * set of measures, each as an absolute number and as a change from the
 * baseline, and every result carries the uncalibrated estimate label.
 */
import { VEHICLE_CLASSES, type Network, type Results, type VehicleClass } from "@traffic-simulator/engine";

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
 * mean travel time, mean delay per vehicle class, stuck vehicles, longest queue
 * per approach. A measure is added here for every scenario, or not at all.
 *
 * Only what the engine reports so far is here. Mean travel time belongs after
 * vehicles through, and joins as one more entry when the engine comes to
 * report it. The engine's other counts (entered, on the network, waiting to
 * enter) are not part of the set, so they are not results.
 *
 * These are the measures every network has. The longest queue per approach is
 * one measure for each approach of the network, so it cannot be listed here:
 * measuresFor() adds those after these. Stuck vehicles come before the queues
 * rather than after them so that the row is in the same place for every network.
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
  // Vehicles the run released by force because they locked with others; above zero, the run is less reliable.
  { id: "stuck-vehicles", name: "Stuck vehicles", unit: "vehicles", value: (results) => results.stuckVehicles },
];

/**
 * The fixed result set for the network these results came from: MEASURES, then
 * the longest queue on each approach, in metres, in the order the results give
 * the approaches. Pass every set of results that will be compared (each seed
 * of baseline and proposal); an approach that only some of them have is still
 * a measure, with nothing to measure in the others.
 *
 * Pass the networks the results came from (the baseline's and the proposal's)
 * and only the approaches of their signal junctions are measures. The engine
 * also reports a queue for every road that ends where a road divides or roads
 * join; nothing holds traffic there, so those queues are almost always zero
 * and are left out. Without networks, every approach the results have is a measure.
 */
export function measuresFor(results: readonly Results[], networks?: readonly Network[]): Measure[] {
  const atSignals =
    networks &&
    new Set(
      networks.flatMap((network) =>
        (network.junctions ?? [])
          .filter((junction) => junction.control === "signal")
          .flatMap((junction) => junction.connections.map((connection) => connection.fromRoadId)),
      ),
    );
  const approaches: string[] = [];
  for (const one of results) {
    for (const roadId of Object.keys(one.longestQueueByApproach)) {
      if (!approaches.includes(roadId) && (!atSignals || atSignals.has(roadId))) approaches.push(roadId);
    }
  }
  return [
    ...MEASURES,
    ...approaches.map(
      (roadId): Measure => ({
        id: `longest-queue:${roadId}`,
        name: `Longest queue on ${roadId} (m)`,
        unit: "m",
        value: (one) => one.longestQueueByApproach[roadId]?.lengthM ?? null,
      }),
    ),
  ];
}

/**
 * The smallest baseline figure a percentage change is given for, by the
 * measure's unit. Below it only the absolute change is given: against a
 * baseline of zero there is no percentage, and against one close to zero the
 * percentage is enormous and says nothing the absolute change does not (a
 * mean delay of 0.4 s that becomes 19 s is +4650%).
 *
 * The thresholds are a judgement, not a measurement: a mean delay under 5 s
 * is within what one signal cycle's luck gives; a longest queue under 10 m is
 * one or two vehicles; fewer than 10 vehicles is too few to take a share of.
 */
export const SMALLEST_BASELINE_FOR_PERCENT: Readonly<Record<string, number>> = { s: 5, m: 10, vehicles: 10 };

/** The change as a percentage of the baseline, or null when the baseline is too small to carry one. */
function percentOf(change: number | null, baseline: number | null, unit: string): number | null {
  if (change === null || baseline === null) return null;
  // A unit with no threshold of its own still never divides by zero.
  const smallest = SMALLEST_BASELINE_FOR_PERCENT[unit] ?? Number.MIN_VALUE;
  return Math.abs(baseline) < smallest ? null : (100 * change) / baseline;
}

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
  /** The change as a percentage of the baseline; null when the baseline is zero or close to it (SMALLEST_BASELINE_FOR_PERCENT) or there is no change to give. */
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
      changePercent: percentOf(change, before, measure.unit),
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
  /** The change as a percentage of the baseline's average; null when that is zero or close to it (SMALLEST_BASELINE_FOR_PERCENT) or there is no change to give. */
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
      changePercent: percentOf(change, before.average, measure.unit),
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
