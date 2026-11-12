/**
 * A prepared corridor as one data file: what the importer made of the
 * OpenStreetMap extract and the corrections, with the default demand for the
 * part of it the network format can carry today. A scenario names it by id.
 */
import type { Demand, Network, VehicleMix } from "@traffic-simulator/engine";
import { importCorridor } from "./import-corridor";
import type { Corrections, CorridorJunction, CorridorRoad, OsmExtract } from "./types";

/** The demand file kept beside a corridor's corrections; only the parts the corridor file uses. */
export interface CorridorDemandFile {
  flows: { groundLevel: { entryRoadId: string; exitRoadId: string; vehiclesPerHour: number }[] };
  vehicleMix: { mix: VehicleMix };
}

export interface PreparedCorridor {
  id: string;
  name: string;
  /** Shown wherever the corridor is shown. */
  attribution: string;
  licence: string;
  osmFetchedAt: string | null;
  checkedOn: string | null;
  /** Every road, ground-level and raised. Raised roads are not in the ground network. */
  roads: CorridorRoad[];
  junctions: CorridorJunction[];
  groundNetwork: Network;
  groundDemand: Demand;
}

export function prepareCorridor(
  osm: OsmExtract & { fetchedAt?: string },
  corrections: Corrections,
  demand: CorridorDemandFile,
): { corridor: PreparedCorridor; problems: string[] } {
  const imported = importCorridor(osm, corrections);
  const corridor: PreparedCorridor = {
    id: imported.corridorId,
    name: imported.name,
    attribution: "© OpenStreetMap contributors",
    licence: "Open Database Licence (ODbL) 1.0, https://www.openstreetmap.org/copyright",
    osmFetchedAt: osm.fetchedAt ?? null,
    checkedOn: corrections.checkedOn ?? null,
    roads: imported.roads,
    junctions: imported.junctions,
    groundNetwork: imported.groundNetwork,
    groundDemand: {
      flows: demand.flows.groundLevel.map(({ entryRoadId, exitRoadId, vehiclesPerHour }) => ({ entryRoadId, exitRoadId, vehiclesPerHour })),
      vehicleMix: demand.vehicleMix.mix,
    },
  };
  return { corridor, problems: imported.problems };
}
