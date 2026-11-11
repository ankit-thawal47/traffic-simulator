import type { Demand, Network, RunInput } from "@traffic-simulator/engine";
import { SCENARIO_FORMAT_VERSION, type Change, type Scenario } from "./scenario";

/** What the changes are applied to, one after another. */
interface Resolved {
  network: Network;
  demand: Demand;
}

/**
 * Apply one change. Each kind of change has one case here; it returns new
 * values and never writes into the ones it was given. `label` names the
 * change in messages ("Change 2").
 */
function applyChange(resolved: Resolved, change: Change, label: string): Resolved {
  switch (change.kind) {
    case "road-width": {
      if (!resolved.network.roads.some((road) => road.id === change.roadId)) {
        throw new Error(`${label} names a road that is not in the network: "${change.roadId}"`);
      }
      if (!(change.widthM > 0) || !Number.isFinite(change.widthM)) {
        throw new Error(`${label} gives road "${change.roadId}" a width that is not a positive number`);
      }
      return {
        ...resolved,
        network: {
          ...resolved.network,
          roads: resolved.network.roads.map((road) =>
            road.id === change.roadId ? { ...road, widthM: change.widthM } : road,
          ),
        },
      };
    }
    default:
      // A scenario read from a link or a file may hold anything.
      throw new Error(`${label} is of a kind this version does not know: "${String((change as { kind: unknown }).kind)}"`);
  }
}

/**
 * Resolve a scenario into the engine's input: apply its changes, in order, to
 * its network and demand. The scenario itself is left untouched. The engine
 * receives only the result and knows nothing of baselines, proposals or changes.
 */
export function resolveScenario(scenario: Scenario): RunInput {
  if (scenario.formatVersion !== SCENARIO_FORMAT_VERSION) {
    throw new Error(`Unsupported scenario format version: ${String(scenario.formatVersion)}`);
  }
  let resolved: Resolved = { network: scenario.network, demand: scenario.demand };
  scenario.changes.forEach((change, index) => {
    resolved = applyChange(resolved, change, `Change ${index + 1}`);
  });
  return { network: resolved.network, demand: resolved.demand, seed: scenario.seed };
}
