/**
 * A prepared corridor as one data file: what the importer made of the
 * OpenStreetMap extract and the corrections, with its default demand. A
 * scenario names it by id.
 */
import type { Demand, DemandFlow, Network, VehicleMix } from "@traffic-simulator/engine";
import { importCorridor } from "./import-corridor";
import type { Corrections, CorridorJunction, CorridorRoad, Evidence, OsmExtract } from "./types";

interface PublishedFlow {
  from: string;
  to: string;
  vehiclesPerHour: number;
}

/** The demand file kept beside a corridor's corrections; only the parts the corridor file uses. */
export interface CorridorDemandFile {
  flows: { groundLevel: PublishedFlow[]; needingTheFlyover?: PublishedFlow[] };
  vehicleMix: { mix: VehicleMix };
  /** How the published flows are put on the whole network. */
  wholeNetwork?: {
    /** The entry road for each place a flow comes from. */
    entries: Record<string, string>;
    /** The exit road for each place a flow goes to, but the city. */
    exits: Record<string, string>;
    /** How traffic to the city divides among the exit roads towards it. */
    forkSplit: { shares: Record<string, number> };
    /** Flows with no published volume, assumed. */
    cbiRoad?: { flows: DemandFlow[] };
    defaultScale: { value: number; evidence: Evidence };
  };
}

/** One flow of the default demand, with the published volume it is scaled from. */
export interface CorridorFlow extends DemandFlow {
  /** The published volume, before the default scale; absent for an assumed flow, which is not scaled. */
  publishedVehiclesPerHour?: number;
}

export interface PreparedCorridor {
  id: string;
  name: string;
  /** Shown wherever the corridor is shown. */
  attribution: string;
  licence: string;
  osmFetchedAt: string | null;
  checkedOn: string | null;
  /** Every road as checked by hand, ground-level and raised. */
  roads: CorridorRoad[];
  junctions: CorridorJunction[];
  /** The whole corridor in the engine's network format: what a scenario naming the corridor runs on. */
  network: Network;
  /** A short name for each road of the network, for a planner to read. */
  roadNames: Record<string, string>;
  /** Every place where the network departs from what OpenStreetMap draws, in words. */
  adjustments: string[];
  /** The default demand: the published volumes times `demandScale`, and the assumed flows as they are. */
  demand: Omit<Demand, "flows"> & { flows: CorridorFlow[] };
  /** What the published volumes are multiplied by in the default demand, and why. */
  demandScale: { value: number; evidence: Evidence };
}

export function prepareCorridor(
  osm: OsmExtract & { fetchedAt?: string },
  corrections: Corrections,
  demand: CorridorDemandFile,
): { corridor: PreparedCorridor; problems: string[] } {
  const imported = importCorridor(osm, corrections);
  const problems = [...imported.problems];
  if (!imported.network) problems.push("The corrections do not say how the roads make one network");
  const whole = demand.wholeNetwork;
  if (!whole) problems.push("The demand file does not say how its flows are put on the whole network");
  const corridor: PreparedCorridor = {
    id: imported.corridorId,
    name: imported.name,
    attribution: "© OpenStreetMap contributors",
    licence: "Open Database Licence (ODbL) 1.0, https://www.openstreetmap.org/copyright",
    osmFetchedAt: osm.fetchedAt ?? null,
    checkedOn: corrections.checkedOn ?? null,
    roads: imported.roads,
    junctions: imported.junctions,
    network: imported.network ?? { formatVersion: 4, roads: [] },
    roadNames: imported.roadNames,
    adjustments: imported.adjustments,
    demand: { flows: whole ? defaultFlows(demand, whole, problems) : [], vehicleMix: demand.vehicleMix.mix },
    demandScale: whole?.defaultScale ?? { value: 1, evidence: { state: "assumed", source: "none given" } },
  };
  return { corridor, problems };
}

function defaultFlows(demand: CorridorDemandFile, whole: NonNullable<CorridorDemandFile["wholeNetwork"]>, problems: string[]): CorridorFlow[] {
  const scale = whole.defaultScale.value;
  const flows: CorridorFlow[] = [];
  const add = (entryRoadId: string, exitRoadId: string, published: number): void => {
    const existing = flows.find((flow) => flow.entryRoadId === entryRoadId && flow.exitRoadId === exitRoadId);
    if (existing) {
      problems.push(`The demand has two flows from "${entryRoadId}" to "${exitRoadId}"`);
      return;
    }
    flows.push({
      entryRoadId,
      exitRoadId,
      vehiclesPerHour: Math.round(published * scale),
      publishedVehiclesPerHour: Math.round(published),
    });
  };
  for (const flow of [...demand.flows.groundLevel, ...(demand.flows.needingTheFlyover ?? [])]) {
    const entry = whole.entries[flow.from];
    if (entry === undefined) {
      problems.push(`The demand has no entry road for traffic from ${flow.from}`);
      continue;
    }
    if (flow.to === "City") {
      for (const [exit, share] of Object.entries(whole.forkSplit.shares)) add(entry, exit, flow.vehiclesPerHour * share);
      continue;
    }
    const exit = whole.exits[flow.to];
    if (exit === undefined) problems.push(`The demand has no exit road for traffic to ${flow.to}`);
    else add(entry, exit, flow.vehiclesPerHour);
  }
  for (const flow of whole.cbiRoad?.flows ?? []) flows.push({ ...flow });
  return flows;
}
