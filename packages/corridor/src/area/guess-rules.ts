/**
 * The rules that guess what OpenStreetMap does not say about an imported
 * area. Each rule is stated in words beside its numbers, and every value it
 * produces is listed for the planner as guessed, with the rule (ADR 0003:
 * any-place import is a producer of the one network format).
 */
import type { VehicleMix } from "@traffic-simulator/engine";

export type RoadClass = "motorway" | "trunk" | "primary" | "secondary" | "tertiary" | "link";

/** How major a road class is, for choosing main roads and signals: higher is more major. */
export const CLASS_RANK: Record<RoadClass, number> = { motorway: 5, trunk: 4, primary: 3, secondary: 2, tertiary: 1, link: 0 };

export const CLASS_NAMES: Record<RoadClass, string> = {
  motorway: "motorway",
  trunk: "trunk road",
  primary: "primary road",
  secondary: "secondary road",
  tertiary: "tertiary road",
  link: "slip road",
};

/** The class of an OpenStreetMap highway tag; undefined for a road that is not imported. */
export function roadClassOf(highway: string | undefined): RoadClass | undefined {
  if (!highway) return undefined;
  if (highway.endsWith("_link")) return "link";
  return (["motorway", "trunk", "primary", "secondary", "tertiary"] as const).find((name) => name === highway);
}

/** Lanes in each direction when OpenStreetMap has no lanes tag: [on a one-way road, on a two-way road]. */
export const GUESSED_LANES: Record<RoadClass, [number, number]> = {
  motorway: [3, 2],
  trunk: [3, 2],
  primary: [2, 2],
  secondary: [2, 1],
  tertiary: [2, 1],
  link: [1, 1],
};
export const LANES_RULE =
  "No lanes tag in OpenStreetMap: one-way carriageways of motorways and trunk roads 3 lanes, of primary, secondary and tertiary roads 2, " +
  "slip roads 1; two-way motorways, trunk and primary roads 2 lanes each way, secondary and tertiary roads 1 each way. " +
  "A two-way road's lanes tag is shared equally between the directions, unless lanes:forward and lanes:backward say otherwise.";

export const LANE_WIDTH_M = 3.5;
export const WIDTH_RULE = `No width tag in OpenStreetMap (it is on about 1% of road length in Bengaluru): lanes × ${LANE_WIDTH_M} m.`;

/** Speed limit in km/h when OpenStreetMap has no maxspeed tag. */
export const GUESSED_SPEED_KMH: Record<RoadClass, number> = { motorway: 80, trunk: 60, primary: 50, secondary: 40, tertiary: 30, link: 30 };
export const SPEED_RULE = "No maxspeed tag in OpenStreetMap: motorways 80 km/h, trunk roads 60, primary 50, secondary 40, tertiary and slip roads 30.";

export const DECK_HEIGHT_M = 6;
export const RAMP_GRADIENT = 0.04;
export const LEVEL_RULE =
  `A way tagged as a bridge on layer 1 or above that passes over another imported road is raised: it rises ${RAMP_GRADIENT * 100} m in 100 m ` +
  `from the ground at each end until it is ${DECK_HEIGHT_M} m up (OpenStreetMap has no heights). Every other way is on the ground.`;

/** Two signal nodes this close to a junction's nodes, in metres, make it a signal junction. */
export const SIGNAL_NODE_WITHIN_M = 30;
export const CONTROL_RULE =
  `A signal junction where OpenStreetMap has a traffic_signals node within ${SIGNAL_NODE_WITHIN_M} m, or where roads of primary class or above ` +
  "meet from two directions that cross (a major crossing), or where two approaches come from the same direction (they would " +
  "merge at a shallow angle, which the engine's give-way does not judge); every other junction is a priority junction, the main road being the " +
  "approaches of the most major class (or the straightest pair when all are alike) and the others giving way.";

export const GREEN_S = 30;
export const AMBER_S = 3;
export const ALL_RED_S = 2;
export const SIGNAL_PLAN_RULE =
  `No signal plan is published in OpenStreetMap: one phase for each direction the approaches come from (approaches from opposite ` +
  `directions share a phase), ${GREEN_S} s green each, ${AMBER_S} s amber and ${ALL_RED_S} s all-red after each.`;

/** Vehicles per hour for each lane of an entry road. */
export const DEMAND_PER_LANE_VPH = 150;
export const DEMAND_RULE =
  `No counts: ${DEMAND_PER_LANE_VPH} vehicles per hour for each lane of each road entering the area, shared equally among the roads ` +
  "leaving the area that it can reach (never straight back out the way it came).";

/** The vehicle mix of Bengaluru traffic assumed for an imported area (as in the mixed-traffic example). */
export const GUESSED_VEHICLE_MIX: VehicleMix = { "two-wheeler": 0.65, car: 0.22, "auto-rickshaw": 0.055, bus: 0.04 };
export const VEHICLE_MIX_RULE = "No counts: two-wheelers 65%, cars 22%, auto-rickshaws 5.5%, buses 4%, as in the mixed-traffic example.";

export const JOIN_GAP_M = 12;
export const SIDE_BY_SIDE_MIN_M = 50;
