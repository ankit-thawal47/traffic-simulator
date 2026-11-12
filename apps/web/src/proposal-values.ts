/**
 * What a proposal has now for the things the change controls show: the figure
 * of its change where it has one, and the baseline's where it has none. The
 * controls read these rather than the resolved engine input, which no longer
 * holds a road once it is closed or removed.
 */
import type { VehicleMix } from "@traffic-simulator/engine";
import { greenTimesOf, lanesOf, type Change, type LostWidthReason, type Scenario } from "@traffic-simulator/scenario";

function changeOf<K extends Change["kind"]>(
  proposal: Scenario,
  kind: K,
  matches: (change: Extract<Change, { kind: K }>) => boolean = () => true,
): Extract<Change, { kind: K }> | undefined {
  return proposal.changes.find(
    (change): change is Extract<Change, { kind: K }> => change.kind === kind && matches(change as Extract<Change, { kind: K }>),
  );
}

export interface RoadValues {
  widthM: number;
  lanes: number;
  lanesClosed: number;
  lostWidthM: number;
  lostWidthReason: LostWidthReason;
  closed: boolean;
  today: { widthM: number; lanes: number };
}

export function roadValues(proposal: Scenario, roadId: string): RoadValues | undefined {
  const road = proposal.network.roads.find((one) => one.id === roadId);
  if (!road) return undefined;
  const ofRoad = (change: { roadId: string }) => change.roadId === roadId;
  const lost = changeOf(proposal, "lost-width", ofRoad);
  return {
    widthM: changeOf(proposal, "road-width", ofRoad)?.widthM ?? road.widthM,
    lanes: changeOf(proposal, "road-lanes", ofRoad)?.lanes ?? lanesOf(road),
    lanesClosed: changeOf(proposal, "lane-closure", ofRoad)?.lanesClosed ?? 0,
    lostWidthM: lost?.widthM ?? 0,
    lostWidthReason: lost?.reason ?? "parking",
    closed: changeOf(proposal, "road-closure", ofRoad) !== undefined,
    today: { widthM: road.widthM, lanes: lanesOf(road) },
  };
}

/** Lane discipline in the proposal: its lane discipline change, or the baseline's setting. */
export function laneDisciplineIn(proposal: Scenario): boolean {
  return changeOf(proposal, "lane-discipline")?.on ?? proposal.laneDiscipline;
}

/** The factor all demand is scaled by in the proposal; 1 with no such change. */
export function demandScaleIn(proposal: Scenario): number {
  return changeOf(proposal, "demand-scale")?.factor ?? 1;
}

export function vehicleMixIn(proposal: Scenario): VehicleMix {
  return changeOf(proposal, "vehicle-mix")?.vehicleMix ?? proposal.demand.vehicleMix ?? { car: 1 };
}

/** The vehicles per hour of one flow in the proposal, before all demand is scaled. */
export function flowRateIn(proposal: Scenario, entryRoadId: string, exitRoadId: string): number | undefined {
  const sameFlow = (flow: { entryRoadId: string; exitRoadId: string }) =>
    flow.entryRoadId === entryRoadId && flow.exitRoadId === exitRoadId;
  return changeOf(proposal, "flow-rate", sameFlow)?.vehiclesPerHour ?? proposal.demand.flows.find(sameFlow)?.vehiclesPerHour;
}

/** The green time of each phase of a signal junction in the proposal. */
export function greenTimesIn(proposal: Scenario, junctionId: string): number[] | undefined {
  return (
    changeOf(proposal, "signal-timing", (change) => change.junctionId === junctionId)?.greenS ??
    greenTimesOf(proposal.network, junctionId)
  );
}

/** Whether a flyover road is built in the proposal: its flyover change, or whether it is built today. */
export function flyoverBuiltIn(proposal: Scenario, roadId: string): boolean {
  return changeOf(proposal, "flyover", (change) => change.roadId === roadId)?.built ?? !proposal.unbuiltRoadIds.includes(roadId);
}
