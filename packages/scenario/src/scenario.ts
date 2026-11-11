/**
 * The scenario description: a complete description of one situation to
 * simulate. It is plain data (JSON-safe) and versioned, because links and
 * files made today have to keep loading (ADR 0001).
 *
 * A scenario is an app-level description. The engine never sees it: before a
 * run, resolveScenario() applies the changes and hands the engine only a
 * network, a demand and a seed. Vocabulary follows GLOSSARY.md.
 */
import { STANDARD_LANE_WIDTH_M, type Demand, type Network, type Road } from "@traffic-simulator/engine";

/** The current version of the scenario description. */
/**
 * The current version of the scenario description. It counts changes to this
 * description only, and is separate from the version of the engine's network
 * format (`network.formatVersion`), which the network inside carries itself.
 *
 * Versions so far:
 * 1. name, network, changes (road width), demand, seed.
 * 2. adds lane discipline, and the road lanes change.
 *
 * A new version raises this number, adds one upgrade step (upgrade.ts) and
 * one saved example (test/fixtures); older links and files keep loading.
 */
export const SCENARIO_FORMAT_VERSION = 2;

/** Set the usable width of one road, named by its stable identifier. */
export interface RoadWidthChange {
  kind: "road-width";
  roadId: string;
  widthM: number;
}

/**
 * Set the number of marked lanes of one road, named by its stable identifier.
 *
 * Lanes and width are independent: this change leaves the road's width as it
 * is, and a width change leaves its lane count as it is. The lanes share the
 * width equally. With lane discipline on, a lane must be wide enough for every
 * vehicle class in the vehicle mix, or the engine refuses the scenario
 * (see whyRefused()). With lane discipline off the road carries mixed traffic,
 * which takes no notice of lanes, so this change does not alter the estimate.
 */
export interface RoadLanesChange {
  kind: "road-lanes";
  roadId: string;
  lanes: number;
}

/**
 * One difference between a proposal and the baseline. Each kind of change is
 * one member of this union, told apart by `kind`; a new kind is added here and
 * given one case in applyChange() (resolve.ts).
 */
export type Change = RoadWidthChange | RoadLanesChange;

export interface Scenario {
  formatVersion: typeof SCENARIO_FORMAT_VERSION;
  name: string;
  /** The network as it is today. Changes are never written into it; they stay in `changes`. */
  network: Network;
  /** Applied in order when the scenario is resolved. Empty for a baseline. */
  changes: Change[];
  demand: Demand;
  /**
   * Lane discipline. On: vehicles keep to the road's lanes. Off: the road
   * carries mixed traffic, with vehicles sharing its width strip by strip.
   */
  laneDiscipline: boolean;
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

/**
 * The lanes a road has. A road of network format version 1 has no lane count;
 * like the engine, give it as many lanes of the standard width as fit its
 * width, and at least one.
 */
export function lanesOf(road: Road): number {
  return road.lanes ?? Math.max(1, Math.floor(road.widthM / STANDARD_LANE_WIDTH_M + 1e-9));
}

/**
 * The scenario with one road set to a new number of lanes. As with width, a
 * road has at most one lanes change, and setting it back to the lanes it has
 * today leaves none.
 */
export function withRoadLanes(scenario: Scenario, roadId: string, lanes: number): Scenario {
  const others = scenario.changes.filter((change) => !(change.kind === "road-lanes" && change.roadId === roadId));
  const today = scenario.network.roads.find((road) => road.id === roadId);
  if (today && lanesOf(today) === lanes) return { ...scenario, changes: others };
  return { ...scenario, changes: [...others, { kind: "road-lanes", roadId, lanes }] };
}

/** The baseline: the road as it is today, with no changes. */
export function createBaseline(description: {
  name: string;
  network: Network;
  demand: Demand;
  seed: number;
  /** Off (mixed traffic) unless given. */
  laneDiscipline?: boolean;
}): Scenario {
  return {
    formatVersion: SCENARIO_FORMAT_VERSION,
    name: description.name,
    network: description.network,
    changes: [],
    demand: description.demand,
    laneDiscipline: description.laneDiscipline ?? false,
    seed: description.seed,
  };
}

/**
 * The baseline a scenario is compared against: the same scenario with no
 * changes. One scenario description therefore holds the planner's whole
 * comparison, and the proposal cannot differ from the baseline by anything
 * but its changes.
 */
export function baselineOf(scenario: Scenario): Scenario {
  return { ...scenario, changes: [] };
}
