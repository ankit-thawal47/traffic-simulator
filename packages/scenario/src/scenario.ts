/**
 * The scenario description: a complete description of one situation to
 * simulate. It is plain data (JSON-safe) and versioned, because links and
 * files made today have to keep loading (ADR 0001).
 *
 * A scenario is an app-level description. The engine never sees it: before a
 * run, resolveScenario() applies the changes and hands the engine only a
 * network, a demand and a seed. Vocabulary follows GLOSSARY.md.
 */
import type { Demand, Network } from "@traffic-simulator/engine";

/** The current version of the scenario description. */
export const SCENARIO_FORMAT_VERSION = 1;

/** Set the usable width of one road, named by its stable identifier. */
export interface RoadWidthChange {
  kind: "road-width";
  roadId: string;
  widthM: number;
}

/**
 * One difference between a proposal and the baseline. Each kind of change is
 * one member of this union, told apart by `kind`; a new kind is added here and
 * given one case in applyChange() (resolve.ts).
 */
export type Change = RoadWidthChange;

export interface Scenario {
  formatVersion: typeof SCENARIO_FORMAT_VERSION;
  name: string;
  /** The network as it is today. Changes are never written into it; they stay in `changes`. */
  network: Network;
  /** Applied in order when the scenario is resolved. Empty for a baseline. */
  changes: Change[];
  demand: Demand;
  /** Any integer. The same scenario and seed always give the same run. */
  seed: number;
}

/** A scenario is plain data, so a copy through JSON is a complete, separate copy. */
function copyOf<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A proposal starts as a separate copy of the baseline; only the changes added to it afterwards differ. */
export function createProposal(baseline: Scenario, name: string): Scenario {
  return { ...copyOf(baseline), name };
}

/** The scenario with one more change. The scenario passed in is left untouched. */
export function withChange(scenario: Scenario, change: Change): Scenario {
  return { ...scenario, changes: [...scenario.changes, copyOf(change)] };
}

/** The scenario without the change at this place in its list (the first change is 0). */
export function withoutChange(scenario: Scenario, index: number): Scenario {
  return { ...scenario, changes: scenario.changes.filter((_, at) => at !== index) };
}

/**
 * The scenario with one road set to a new width. A road has at most one width
 * change: setting it again replaces the earlier one, and setting it back to
 * the width it has today leaves none, so the list of changes always reads as
 * exactly what differs from the baseline.
 */
export function withRoadWidth(scenario: Scenario, roadId: string, widthM: number): Scenario {
  const others = scenario.changes.filter((change) => !(change.kind === "road-width" && change.roadId === roadId));
  const today = scenario.network.roads.find((road) => road.id === roadId);
  if (today && today.widthM === widthM) return { ...scenario, changes: others };
  return { ...scenario, changes: [...others, { kind: "road-width", roadId, widthM }] };
}

/** The baseline: the road as it is today, with no changes. */
export function createBaseline(description: { name: string; network: Network; demand: Demand; seed: number }): Scenario {
  return {
    formatVersion: SCENARIO_FORMAT_VERSION,
    name: description.name,
    network: description.network,
    changes: [],
    demand: description.demand,
    seed: description.seed,
  };
}
