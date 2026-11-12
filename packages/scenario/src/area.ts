/**
 * A scenario on an imported area (any-place import, ticket 25). The import
 * itself is the corridor package's (importArea); here the planner's
 * corrections of what was guessed are kept and put into the baseline.
 *
 * Corrections are not changes. A change is what a proposal does differently
 * from today; a correction says what today is, where the import had to
 * guess: a road's lanes and width, and a signal junction's green times. So a
 * correction alters the baseline and the proposal together.
 */
import type { AreaBounds, ImportedArea } from "@traffic-simulator/corridor";
import type { Network } from "@traffic-simulator/engine";
import { createBaseline, type Scenario } from "./scenario";

/** What the planner corrected of an imported area, by road and junction id. */
export interface AreaCorrections {
  roads: Record<string, { lanes?: number; widthM?: number }>;
  /** Green time of each phase, in the plan's order, by signal junction. */
  greenS: Record<string, number[]>;
}

export interface ScenarioArea {
  bounds: AreaBounds;
  corrections: AreaCorrections;
  /**
   * What the import made, before the corrections. A file carries it, so the
   * scenario opens exactly; a link leaves it out, and the area is imported
   * again when the link is opened.
   */
  imported: ImportedArea;
}

export const NO_CORRECTIONS: AreaCorrections = { roads: {}, greenS: {} };

/**
 * The imported network with the planner's corrections. Throws, with a message
 * for the planner, when a correction names a road or junction the network
 * does not have, or gives a signal junction the wrong number of green times.
 */
export function correctedNetwork(network: Network, corrections: AreaCorrections): Network {
  for (const roadId of Object.keys(corrections.roads)) {
    if (!network.roads.some((road) => road.id === roadId)) {
      throw new Error(`A correction names a road that is not in the network: "${roadId}"`);
    }
  }
  for (const [junctionId, greenS] of Object.entries(corrections.greenS)) {
    const junction = network.junctions?.find((one) => one.id === junctionId);
    if (!junction || junction.control !== "signal") {
      throw new Error(`A correction gives green times to "${junctionId}", which is not a signal junction in the network`);
    }
    if (junction.signalPlan.phases.length !== greenS.length) {
      throw new Error(`A correction gives junction "${junctionId}" ${greenS.length} green times; its signal plan has ${junction.signalPlan.phases.length} phases`);
    }
  }
  return {
    ...network,
    roads: network.roads.map((road) => {
      const correction = corrections.roads[road.id];
      return correction ? { ...road, ...correction } : road;
    }),
    ...(network.junctions
      ? {
          junctions: network.junctions.map((junction) => {
            const greenS = corrections.greenS[junction.id];
            if (!greenS || junction.control !== "signal") return junction;
            return { ...junction, signalPlan: { ...junction.signalPlan, phases: junction.signalPlan.phases.map((phase, at) => ({ ...phase, greenS: greenS[at]! })) } };
          }),
        }
      : {}),
  };
}

/** The baseline on an imported area: its network and guessed demand, no corrections, ready to run. */
export function areaBaseline(imported: ImportedArea, seed = 1): Scenario {
  return {
    ...createBaseline({ name: imported.name, network: imported.network, demand: imported.demand, seed }),
    area: { bounds: imported.bounds, corrections: NO_CORRECTIONS, imported },
  };
}

function withCorrections(scenario: Scenario, corrections: AreaCorrections): Scenario {
  const area = scenario.area;
  if (!area) throw new Error("This scenario is not on an imported area");
  return { ...scenario, area: { ...area, corrections }, network: correctedNetwork(area.imported.network, corrections) };
}

/**
 * The scenario with one road's lanes or width corrected. A value equal to
 * the imported one leaves no correction for it.
 */
export function withAreaRoad(scenario: Scenario, roadId: string, values: { lanes?: number; widthM?: number }): Scenario {
  const area = scenario.area;
  if (!area) throw new Error("This scenario is not on an imported area");
  const road = area.imported.network.roads.find((one) => one.id === roadId);
  if (!road) throw new Error(`There is no road "${roadId}" in the imported area`);
  const merged = { ...area.corrections.roads[roadId], ...values };
  const kept: { lanes?: number; widthM?: number } = {};
  if (merged.lanes !== undefined && merged.lanes !== road.lanes) kept.lanes = merged.lanes;
  if (merged.widthM !== undefined && merged.widthM !== road.widthM) kept.widthM = merged.widthM;
  const { [roadId]: _old, ...others } = area.corrections.roads;
  const roads = Object.keys(kept).length > 0 ? { ...others, [roadId]: kept } : others;
  return withCorrections(scenario, { ...area.corrections, roads });
}

/** The scenario with one signal junction's green times corrected; the imported times leave no correction. */
export function withAreaGreenTimes(scenario: Scenario, junctionId: string, greenS: readonly number[]): Scenario {
  const area = scenario.area;
  if (!area) throw new Error("This scenario is not on an imported area");
  const junction = area.imported.network.junctions?.find((one) => one.id === junctionId);
  if (!junction || junction.control !== "signal") throw new Error(`There is no signal junction "${junctionId}" in the imported area`);
  const imported = junction.signalPlan.phases.map((phase) => phase.greenS);
  const same = imported.length === greenS.length && imported.every((green, at) => green === greenS[at]);
  const { [junctionId]: _old, ...others } = area.corrections.greenS;
  return withCorrections(scenario, { ...area.corrections, greenS: same ? others : { ...others, [junctionId]: [...greenS] } });
}
