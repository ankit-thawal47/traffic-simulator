/**
 * The scenario description: a complete description of one situation to
 * simulate. It is plain data (JSON-safe) and versioned, because links and
 * files made today have to keep loading (ADR 0001).
 *
 * A scenario is an app-level description. The engine never sees it: before a
 * run, resolveScenario() applies the changes and hands the engine only a
 * network, a demand and a seed. Vocabulary follows GLOSSARY.md.
 */
import {
  STANDARD_LANE_WIDTH_M,
  VEHICLE_CLASSES,
  type Demand,
  type Network,
  type Road,
  type VehicleMix,
} from "@traffic-simulator/engine";

/**
 * The current version of the scenario description. It counts changes to this
 * description only, and is separate from the version of the engine's network
 * format (`network.formatVersion`), which the network inside carries itself.
 *
 * Versions so far:
 * 1. name, network, changes (road width), demand, seed.
 * 2. adds lane discipline, and the road lanes change.
 * 3. adds the roads not built today (`unbuiltRoadIds`), and the other kinds
 *    of change: lane closure, road closure, signal timing, flyover, flow
 *    rate, vehicle mix, demand scale, lost width and lane discipline.
 *
 * A new version raises this number, adds one upgrade step (upgrade.ts) and
 * one saved example (test/fixtures); older links and files keep loading.
 */
export const SCENARIO_FORMAT_VERSION = 3;

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
 * Close some of a road's lanes, for roadworks. The road keeps its other lanes
 * at the width they have: closing one of three 3.5 m lanes leaves two lanes
 * and 7 m. The whole length of the road is narrowed; a closure part-way along
 * a road cannot be described. At least one lane must stay open (to close
 * them all, close the road).
 */
export interface LaneClosureChange {
  kind: "lane-closure";
  roadId: string;
  lanesClosed: number;
}

/**
 * Close a road to all traffic. The road, the connections to and from it and
 * its green time are taken out of the network the engine receives. Traffic
 * that used it takes another route when the network has one; when a flow of
 * the demand is left with no route, or enters or leaves by the closed road,
 * the proposal is refused (whyRefused() says which flow).
 */
export interface RoadClosureChange {
  kind: "road-closure";
  roadId: string;
}

/**
 * Set the green times of a signal junction, named by its stable identifier:
 * one green time in seconds for each phase of its signal plan, in the plan's
 * order. Amber and all-red times stay as they are.
 */
export interface SignalTimingChange {
  kind: "signal-timing";
  junctionId: string;
  greenS: number[];
}

/**
 * Build or remove one flyover road (a raised road the network already
 * carries; one direction of a flyover). This turns a drawn flyover on or
 * off; a flyover cannot be drawn freely. `built: false` removes a flyover
 * road that exists today; `built: true` builds one that is drawn in the
 * network but not built today (Scenario.unbuiltRoadIds). Without the flyover
 * road, the junctions where it left and rejoined the main road keep their
 * other connections, and through traffic goes by the junction beneath.
 */
export interface FlyoverChange {
  kind: "flyover";
  roadId: string;
  built: boolean;
}

/** Set the vehicles per hour of one flow of the demand, named by its entry road and exit road. */
export interface FlowRateChange {
  kind: "flow-rate";
  entryRoadId: string;
  exitRoadId: string;
  vehiclesPerHour: number;
}

/** Replace the vehicle mix of the demand. */
export interface VehicleMixChange {
  kind: "vehicle-mix";
  vehicleMix: VehicleMix;
}

/**
 * Scale all demand: every entry-to-exit rate is multiplied by `factor`,
 * together, after any flow rate changes. 1.2 is a fifth more traffic. This is
 * how to ask what happens if a change attracts more traffic: induced demand
 * itself is not modelled (ADR 0006).
 */
export interface DemandScaleChange {
  kind: "demand-scale";
  factor: number;
}

/** Why usable width is lost at the roadside. */
export const LOST_WIDTH_REASONS = ["parking", "hawkers", "stopped-vehicles", "other"] as const;
export type LostWidthReason = (typeof LOST_WIDTH_REASONS)[number];

/**
 * Take usable width from a road for roadside activity (side friction), with
 * the reason. It is kept apart from a width change: the road is as wide as it
 * was built, and this much of it cannot be driven on. The lost width comes
 * off the road's width after any width change and lane closure; the lanes
 * stay as many as they were, so each is narrower.
 */
export interface LostWidthChange {
  kind: "lost-width";
  roadId: string;
  /** The width lost, in metres. */
  widthM: number;
  reason: LostWidthReason;
}

/** Switch lane discipline on or off in the proposal, whatever the baseline has. */
export interface LaneDisciplineChange {
  kind: "lane-discipline";
  on: boolean;
}

/**
 * One difference between a proposal and the baseline. Each kind of change is
 * one member of this union, told apart by `kind`; a new kind is added here,
 * given one case in applyChange() (resolve.ts), one in readChange() (read.ts)
 * and one in describeChange() (describe.ts).
 */
export type Change =
  | RoadWidthChange
  | RoadLanesChange
  | LaneClosureChange
  | LostWidthChange
  | RoadClosureChange
  | FlyoverChange
  | SignalTimingChange
  | FlowRateChange
  | VehicleMixChange
  | DemandScaleChange
  | LaneDisciplineChange;

export interface Scenario {
  formatVersion: typeof SCENARIO_FORMAT_VERSION;
  name: string;
  /** The network as it is today. Changes are never written into it; they stay in `changes`. */
  network: Network;
  /**
   * Roads the network carries that are not built today: flyover roads drawn
   * so that a proposal can build them (a flyover change). The baseline runs
   * without them. Empty when everything in the network exists today.
   */
  unbuiltRoadIds: string[];
  /**
   * What the proposal changes. Empty for a baseline. The order of the list
   * does not alter the result: resolveScenario() applies the kinds in a fixed order.
   */
  changes: Change[];
  demand: Demand;
  /**
   * Lane discipline in the baseline. On: vehicles keep to the road's lanes.
   * Off: the road carries mixed traffic, with vehicles sharing its width strip
   * by strip. A lane discipline change sets it for the proposal.
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
 * What a change is a change to: its kind, and the road, junction or flow it
 * names. A proposal holds at most one change for each (the with…() functions
 * below see to it), so this also tells the changes of a list apart.
 */
export function changeTarget(change: Change): string {
  switch (change.kind) {
    case "road-width":
    case "road-lanes":
    case "lane-closure":
    case "lost-width":
    case "road-closure":
    case "flyover":
      return `${change.kind}:${change.roadId}`;
    case "signal-timing":
      return `${change.kind}:${change.junctionId}`;
    case "flow-rate":
      return `${change.kind}:${JSON.stringify([change.entryRoadId, change.exitRoadId])}`;
    case "vehicle-mix":
    case "demand-scale":
    case "lane-discipline":
      return change.kind;
  }
}

/**
 * The scenario with this change in place of any earlier change to the same
 * thing; with `asToday` true, with no change to that thing at all. So the
 * list of changes always reads as exactly what differs from the baseline.
 */
function withChangeTo(scenario: Scenario, change: Change, asToday: boolean): Scenario {
  const target = changeTarget(change);
  const others = scenario.changes.filter((other) => changeTarget(other) !== target);
  return { ...scenario, changes: asToday ? others : [...others, copyOf(change)] };
}

function roadToday(scenario: Scenario, roadId: string): Road | undefined {
  return scenario.network.roads.find((road) => road.id === roadId);
}

/**
 * The scenario with one road set to a new width. A road has at most one width
 * change: setting it again replaces the earlier one, and setting it back to
 * the width it has today leaves none.
 */
export function withRoadWidth(scenario: Scenario, roadId: string, widthM: number): Scenario {
  return withChangeTo(scenario, { kind: "road-width", roadId, widthM }, roadToday(scenario, roadId)?.widthM === widthM);
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
  const today = roadToday(scenario, roadId);
  return withChangeTo(scenario, { kind: "road-lanes", roadId, lanes }, today !== undefined && lanesOf(today) === lanes);
}

/** The scenario with this many lanes of one road closed; none closed leaves no change. */
export function withLaneClosure(scenario: Scenario, roadId: string, lanesClosed: number): Scenario {
  return withChangeTo(scenario, { kind: "lane-closure", roadId, lanesClosed }, lanesClosed === 0);
}

/** The scenario with one road closed, or open again. */
export function withRoadClosure(scenario: Scenario, roadId: string, closed: boolean): Scenario {
  return withChangeTo(scenario, { kind: "road-closure", roadId }, !closed);
}

/** The scenario with this much width of one road lost to roadside activity; none lost leaves no change. */
export function withLostWidth(scenario: Scenario, roadId: string, widthM: number, reason: LostWidthReason): Scenario {
  return withChangeTo(scenario, { kind: "lost-width", roadId, widthM, reason }, widthM === 0);
}

/** The green time of each phase of a signal junction today; undefined when it is not a signal junction of the network. */
export function greenTimesOf(network: Network, junctionId: string): number[] | undefined {
  const junction = network.junctions?.find((one) => one.id === junctionId);
  return junction?.control === "signal" ? junction.signalPlan.phases.map((phase) => phase.greenS) : undefined;
}

/** The scenario with the green times of one signal junction set, one for each phase; today's green times leave no change. */
export function withSignalTiming(scenario: Scenario, junctionId: string, greenS: readonly number[]): Scenario {
  const today = greenTimesOf(scenario.network, junctionId);
  const asToday = today !== undefined && today.length === greenS.length && today.every((green, at) => green === greenS[at]);
  return withChangeTo(scenario, { kind: "signal-timing", junctionId, greenS: [...greenS] }, asToday);
}

/** A raised road: one with a point above or below the ground. A flyover road is one. */
export function isFlyoverRoad(road: Road): boolean {
  return road.points.some((point) => (point.z ?? 0) !== 0);
}

/** The scenario with one flyover road built or not built in the proposal; as it is today leaves no change. */
export function withFlyover(scenario: Scenario, roadId: string, built: boolean): Scenario {
  const builtToday = !scenario.unbuiltRoadIds.includes(roadId);
  return withChangeTo(scenario, { kind: "flyover", roadId, built }, built === builtToday);
}

/** The scenario with the vehicles per hour of one flow of the demand set; today's rate leaves no change. */
export function withFlowRate(scenario: Scenario, entryRoadId: string, exitRoadId: string, vehiclesPerHour: number): Scenario {
  const today = scenario.demand.flows.find((flow) => flow.entryRoadId === entryRoadId && flow.exitRoadId === exitRoadId);
  return withChangeTo(
    scenario,
    { kind: "flow-rate", entryRoadId, exitRoadId, vehiclesPerHour },
    today?.vehiclesPerHour === vehiclesPerHour,
  );
}

/** The scenario with another vehicle mix in the proposal; today's vehicle mix leaves no change. */
export function withVehicleMix(scenario: Scenario, vehicleMix: VehicleMix): Scenario {
  const today: VehicleMix = scenario.demand.vehicleMix ?? { car: 1 };
  const asToday = VEHICLE_CLASSES.every((vehicleClass) => (today[vehicleClass] ?? 0) === (vehicleMix[vehicleClass] ?? 0));
  return withChangeTo(scenario, { kind: "vehicle-mix", vehicleMix }, asToday);
}

/** The scenario with all demand scaled by a factor; a factor of 1 leaves no change. */
export function withDemandScale(scenario: Scenario, factor: number): Scenario {
  return withChangeTo(scenario, { kind: "demand-scale", factor }, factor === 1);
}

/** The scenario with lane discipline on or off in the proposal; as in the baseline leaves no change. */
export function withLaneDiscipline(scenario: Scenario, on: boolean): Scenario {
  return withChangeTo(scenario, { kind: "lane-discipline", on }, on === scenario.laneDiscipline);
}

/** The baseline: the road as it is today, with no changes. */
export function createBaseline(description: {
  name: string;
  network: Network;
  demand: Demand;
  seed: number;
  /** Off (mixed traffic) unless given. */
  laneDiscipline?: boolean;
  /** Flyover roads drawn in the network but not built today. None unless given. */
  unbuiltRoadIds?: string[];
}): Scenario {
  return {
    formatVersion: SCENARIO_FORMAT_VERSION,
    name: description.name,
    network: description.network,
    unbuiltRoadIds: description.unbuiltRoadIds ?? [],
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
