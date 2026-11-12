/**
 * The corridor importer's inputs and outputs. All plain data (JSON-safe).
 * Vocabulary follows GLOSSARY.md: a corridor is a real place prepared as a
 * network, imported from OpenStreetMap and checked by hand (ADR 0003).
 */
import type { Network, Point, SignalPlan } from "@traffic-simulator/engine";

export interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OsmWay {
  type: "way";
  id: number;
  /** Node ids, in the way's own direction. */
  nodes: number[];
  tags?: Record<string, string>;
}

export type OsmElement = OsmNode | OsmWay;

/** OpenStreetMap data as the Overpass API returns it (out:json). Other fields, such as the fetch date, ride along. */
export interface OsmExtract {
  elements: OsmElement[];
}

/**
 * How far a value can be trusted. Confirmed: found by us in the primary
 * document or in the OpenStreetMap data itself. Assumed: our own choice, with
 * the reason. Not reached: the source could not be opened.
 */
export type EvidenceState = "confirmed" | "secondary-source" | "assumed" | "not-reached";

export interface Evidence {
  state: EvidenceState;
  /** Where the value comes from and where in it, or the reason for the assumption. */
  source: string;
}

/** Ground: on the ground plane. Raised: on a flyover or a ramp, passing over what is beneath without meeting it. */
export type Level = "ground" | "raised";

/** The tags of one way that the corrections replace or rely on, as they were when the road was checked by hand. A tag left out was absent. */
export interface OsmAsChecked {
  wayId: number;
  lanes?: string;
  width?: string;
  layer?: string;
  bridge?: string;
  oneway?: string;
  maxspeed?: string;
}

export interface RoadEvidence {
  lanes: Evidence;
  widthM: Evidence;
  level: Evidence;
  oneWay: Evidence;
  speedLimit: Evidence;
}

/**
 * One road of the corridor, checked by hand: one carriageway in one direction,
 * made of OpenStreetMap ways end to end, with the values the network uses.
 */
export interface RoadCorrection {
  id: string;
  /** What the road is, in words. */
  name?: string;
  /** A short name a planner can read in a list, such as "Bellary Road from the airport". */
  shortName?: string;
  /** The ways that make up the road, in the direction of travel. */
  wayIds: number[];
  /** Start the road at this node rather than at the first node of the first way. */
  fromNodeId?: number;
  /** End the road at this node rather than at the last node of the last way. */
  toNodeId?: number;
  /** Keep only this much of the road, counted back from its end (for a long approach). */
  keepLastM?: number;
  /** Keep only this much of the road, counted from its start (for a long exit). */
  keepFirstM?: number;
  /** The road runs against the direction the ways are drawn in: the other direction of a two-way way. */
  reversed?: boolean;
  /** Move the centre line this far to the left of the direction of travel: a two-way way is drawn along the middle of both directions. */
  offsetLeftM?: number;
  level: Level;
  lanes: number;
  /** Usable width, in metres. */
  widthM: number;
  speedLimitKmh: number;
  evidence: RoadEvidence;
  /** The ways' tags as found when the road was checked. The importer reports any that have changed. */
  osmAsChecked?: OsmAsChecked[];
}

export interface ConnectionCorrection {
  fromRoadId: string;
  toRoadId: string;
  /** The movement in the published signal plan, or another note on the connection. */
  movement?: string;
}

/**
 * A junction of the corridor, checked by hand. While its control is
 * unconfirmed it has no place in the network: its roads are imported and the
 * junction itself is carried for the follow-up.
 */
export interface JunctionCorrection {
  id: string;
  name: string;
  control: "signal" | "unconfirmed";
  connections: ConnectionCorrection[];
  /**
   * Cut every road of the junction back this far from where it meets the
   * junction, in the whole network: needed where OpenStreetMap draws all the
   * roads to one node, so that stop lines stand back and turns have room.
   */
  setBackM?: number;
  /** Needed for a signal junction. */
  signalPlan?: SignalPlan;
  /** The plan as its source gives it, before it was fitted to the network format. */
  publishedPlan?: PublishedSignalPlan;
  evidence?: Record<string, Evidence>;
}

/** A fixed-time signal plan as published: which movements run in each phase, and each phase's time in each period of the day. */
export interface PublishedSignalPlan {
  citation: string;
  control: string;
  /** The source's letter for each road, and where the road comes from. */
  roads: Record<string, string>;
  phases: { phase: number; movements: string[] }[];
  periods: { days: string; from: string; to: string; phaseS: number[]; cycleS: number }[];
}

export interface Corrections {
  /** Stable identifier of the corridor: a scenario names a prepared corridor by it. */
  corridorId: string;
  name: string;
  /** The day the corrections were checked against the extract. */
  checkedOn?: string;
  attribution?: string;
  /** The place that becomes (0, 0). x grows east, y grows north. */
  origin: { lat: number; lon: number };
  roads: RoadCorrection[];
  junctions: JunctionCorrection[];
  /** How the roads are put together into one network for the engine. Without it only the ground-level network is made. */
  network?: NetworkCorrections;
}

/**
 * How the checked roads become one network in the engine's format (version 4).
 * Everything here is an adjustment of what OpenStreetMap draws, made by the
 * importer and never by hand in its output; each carries its reason.
 */
export interface NetworkCorrections {
  /** Height of a raised road above the ground once it has finished rising, in metres. OpenStreetMap has no heights. */
  deckHeightM: number;
  /** How steeply a raised road rises from, and comes down to, the ground: height gained for each metre along. */
  rampGradient: number;
  /** The room left between two roads at a junction with no signal, for the path between them, in metres. */
  joinGapM: number;
  /** The least length of the one wide road made where a road divides or roads join, in metres. */
  sideBySideMinM: number;
  evidence: Evidence | Record<string, Evidence>;
  /**
   * Roads made of several checked roads end to end, which must agree in
   * lanes, width and speed limit. Every other checked road is a road of the
   * network under its own id.
   */
  roads: NetworkRoadCorrection[];
  joins: JoinCorrection[];
}

export interface NetworkRoadCorrection {
  id: string;
  /** A short name a planner can read in a list. */
  name: string;
  /** The checked roads it is made of, in the direction of travel. */
  parts: string[];
}

/** The one wide road made where a road divides or roads join. */
export interface SharedSection {
  id: string;
  name: string;
}

/**
 * A join that is not a signal junction. Road ids are those of the network.
 *
 * Diverge: `mainRoadId` and `otherRoadId` start at the same node. From the
 * node, for as long as the two would overlap at their widths (and at least
 * `sideBySideMinM`), they are one road as wide as both (`shared`); beyond it
 * each starts beside the other. `fromRoadId` is the road that arrives at the
 * node, if the corridor has one. Merge: the same, mirrored, with `ontoRoadId`
 * the road that leaves the node. Continue: one road simply follows another.
 */
export type JoinCorrection =
  | { id: string; kind: "diverge"; fromRoadId?: string; mainRoadId: string; otherRoadId: string; shared: SharedSection; reason: string }
  | { id: string; kind: "merge"; mainRoadId: string; otherRoadId: string; ontoRoadId?: string; shared: SharedSection; reason: string }
  | { id: string; kind: "continue"; fromRoadId: string; toRoadId: string; reason: string };

/** A road of the corridor after import, whatever its level. */
export interface CorridorRoad {
  id: string;
  name?: string;
  level: Level;
  /** Centre line in metres, in the direction of travel. */
  points: Point[];
  lengthM: number;
  widthM: number;
  lanes: number;
  speedLimitMps: number;
  wayIds: number[];
  /** The OpenStreetMap nodes the road starts and ends at; absent at an end cut by length. Roads that share a node meet there. */
  fromNodeId?: number;
  toNodeId?: number;
}

export type CorridorJunction = JunctionCorrection;

export interface ImportedCorridor {
  corridorId: string;
  name: string;
  /** Every road of the corridor, ground-level and raised. */
  roads: CorridorRoad[];
  junctions: CorridorJunction[];
  /**
   * The ground-level part in the engine's network format: the ground-level
   * roads, and the signal junctions between them. Raised roads wait for the
   * network format to carry levels.
   */
  groundNetwork: Network;
  /**
   * The whole corridor as one network in the engine's format: ground-level
   * and raised roads, signal junctions, and the joins with no signal. Absent
   * when the corrections do not say how the roads are put together.
   */
  network?: Network;
  /** A short name for each road of the whole network, for a planner to read. */
  roadNames: Record<string, string>;
  /** Every place where the whole network departs from what OpenStreetMap draws, in words. */
  adjustments: string[];
  /** What does not hold between the corrections and the extract. Empty when the corridor is sound. */
  problems: string[];
}
