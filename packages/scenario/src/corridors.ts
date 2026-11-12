/**
 * The prepared corridors (GLOSSARY: Corridor) a scenario can name by id
 * instead of carrying their network, so that links stay short. Each is a
 * data file made by the corridor importer (packages/corridor) and shipped
 * with the product; it is trusted as it is.
 */
import type { PreparedCorridor } from "@traffic-simulator/corridor";
import hebbal from "@traffic-simulator/corridor/data/hebbal/corridor.json";
import { createBaseline, type Scenario } from "./scenario";

export const CORRIDORS: Readonly<Record<string, PreparedCorridor>> = {
  [hebbal.id]: hebbal as unknown as PreparedCorridor,
};

/** The prepared corridor with this id; undefined when the product has none. */
export function corridorById(id: string): PreparedCorridor | undefined {
  return Object.prototype.hasOwnProperty.call(CORRIDORS, id) ? CORRIDORS[id] : undefined;
}

/** The baseline on a prepared corridor: its network, named by id, with its default demand, ready to run. */
export function corridorBaseline(id: string, seed = 1): Scenario {
  const corridor = corridorById(id);
  if (!corridor) throw new Error(`There is no prepared corridor "${id}"`);
  return createBaseline({
    name: corridor.name,
    corridorId: corridor.id,
    network: corridor.network,
    demand: {
      flows: corridor.demand.flows.map(({ entryRoadId, exitRoadId, vehiclesPerHour }) => ({ entryRoadId, exitRoadId, vehiclesPerHour })),
      ...(corridor.demand.vehicleMix ? { vehicleMix: corridor.demand.vehicleMix } : {}),
    },
    seed,
  });
}
