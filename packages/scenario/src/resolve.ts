import type { Demand, DemandFlow, Junction, Network, Road, RunInput } from "@traffic-simulator/engine";
import { whyNotSideBySide } from "./side-by-side";
import { isFlyoverRoad, lanesOf, SCENARIO_FORMAT_VERSION, type Change, type Scenario } from "./scenario";

/** What the changes are applied to, one after another. */
interface Resolved {
  network: Network;
  demand: Demand;
  laneDiscipline: boolean;
  /** Roads of the network the engine will not receive: not built, removed or closed. Why, for messages. */
  absentRoads: Map<string, string>;
}

/**
 * The order the kinds of change are applied in, whatever their order in the
 * scenario's list, so that a list of changes has one meaning:
 *
 *  - a road's width is set, then its lanes; closed lanes then come off both,
 *    and width lost to roadside activity comes off what is left;
 *  - flow rates are set before all demand is scaled, so the scale reaches
 *    every flow;
 *  - roads are taken out (a flyover removed, a road closed) last, so every
 *    other change still finds the road it names.
 */
const ORDER: readonly Change["kind"][] = [
  "road-width",
  "road-lanes",
  "lane-closure",
  "lost-width",
  "signal-timing",
  "flow-rate",
  "vehicle-mix",
  "demand-scale",
  "lane-discipline",
  "flyover",
  "road-closure",
];

function roadOf(resolved: Resolved, roadId: string, label: string): Road {
  const road = resolved.network.roads.find((one) => one.id === roadId);
  if (!road) throw new Error(`${label} names a road that is not in the network: "${roadId}"`);
  return road;
}

function withRoad(resolved: Resolved, changed: Road): Resolved {
  return {
    ...resolved,
    network: { ...resolved.network, roads: resolved.network.roads.map((road) => (road.id === changed.id ? changed : road)) },
  };
}

/**
 * Apply one change. Each kind of change has one case here; it returns new
 * values and never writes into the ones it was given. `label` names the
 * change in messages ("Change 2").
 */
function applyChange(resolved: Resolved, change: Change, label: string): Resolved {
  switch (change.kind) {
    case "road-width": {
      const road = roadOf(resolved, change.roadId, label);
      if (!(change.widthM > 0) || !Number.isFinite(change.widthM)) {
        throw new Error(`${label} gives road "${change.roadId}" a width that is not a positive number`);
      }
      return withRoad(resolved, { ...road, widthM: change.widthM });
    }
    case "road-lanes": {
      const road = roadOf(resolved, change.roadId, label);
      if (!Number.isInteger(change.lanes) || change.lanes < 1) {
        throw new Error(
          `${label} gives road "${change.roadId}" a number of lanes that is not a whole number of 1 or more`,
        );
      }
      return withRoad(resolved, { ...road, lanes: change.lanes });
    }
    case "lane-closure": {
      const road = roadOf(resolved, change.roadId, label);
      const lanes = lanesOf(road);
      if (!Number.isInteger(change.lanesClosed) || change.lanesClosed < 1) {
        throw new Error(`${label} closes a number of lanes of road "${change.roadId}" that is not a whole number of 1 or more`);
      }
      if (change.lanesClosed >= lanes) {
        throw new Error(
          `${label} closes ${change.lanesClosed} of the ${lanes} lanes of road "${change.roadId}"; ` +
            "at least one lane must stay open (to close them all, close the road)",
        );
      }
      const open = lanes - change.lanesClosed;
      return withRoad(resolved, { ...road, lanes: open, widthM: (road.widthM * open) / lanes });
    }
    case "lost-width": {
      const road = roadOf(resolved, change.roadId, label);
      if (!(change.widthM > 0) || !Number.isFinite(change.widthM)) {
        throw new Error(`${label} takes a width from road "${change.roadId}" that is not a positive number`);
      }
      if (change.widthM >= road.widthM) {
        throw new Error(
          `${label} takes ${change.widthM} m from road "${change.roadId}", which has ${road.widthM} m; some width must be left`,
        );
      }
      return withRoad(resolved, { ...road, widthM: road.widthM - change.widthM });
    }
    case "flow-rate": {
      const { entryRoadId, exitRoadId, vehiclesPerHour } = change;
      const isTheFlow = (flow: DemandFlow) => flow.entryRoadId === entryRoadId && flow.exitRoadId === exitRoadId;
      if (!resolved.demand.flows.some(isTheFlow)) {
        throw new Error(`${label} names a flow that is not in the demand: from road "${entryRoadId}" to road "${exitRoadId}"`);
      }
      if (!(vehiclesPerHour >= 0) || !Number.isFinite(vehiclesPerHour)) {
        throw new Error(`${label} gives a flow a rate that is not a number of 0 or more`);
      }
      return {
        ...resolved,
        demand: {
          ...resolved.demand,
          flows: resolved.demand.flows.map((flow) => (isTheFlow(flow) ? { ...flow, vehiclesPerHour } : flow)),
        },
      };
    }
    case "demand-scale": {
      if (!(change.factor >= 0) || !Number.isFinite(change.factor)) {
        throw new Error(`${label} scales all demand by a factor that is not a number of 0 or more`);
      }
      return {
        ...resolved,
        demand: {
          ...resolved.demand,
          flows: resolved.demand.flows.map((flow) => ({ ...flow, vehiclesPerHour: flow.vehiclesPerHour * change.factor })),
        },
      };
    }
    case "vehicle-mix": {
      const shares = Object.values(change.vehicleMix ?? {});
      if (!shares.every((share) => share >= 0 && Number.isFinite(share)) || !shares.some((share) => share > 0)) {
        throw new Error(`${label} gives a vehicle mix without a share above zero for at least one vehicle class`);
      }
      return { ...resolved, demand: { ...resolved.demand, vehicleMix: change.vehicleMix } };
    }
    case "lane-discipline": {
      if (typeof change.on !== "boolean") throw new Error(`${label} must switch lane discipline on or off`);
      return { ...resolved, laneDiscipline: change.on };
    }
    case "signal-timing": {
      const junction = resolved.network.junctions?.find((one) => one.id === change.junctionId);
      if (!junction) throw new Error(`${label} names a junction that is not in the network: "${change.junctionId}"`);
      if (junction.control !== "signal") {
        throw new Error(`${label} gives green times to junction "${junction.id}", which has no signal`);
      }
      const phases = junction.signalPlan.phases;
      if (!Array.isArray(change.greenS) || change.greenS.length !== phases.length) {
        throw new Error(
          `${label} gives junction "${junction.id}" ${Array.isArray(change.greenS) ? change.greenS.length : "no"} green times; ` +
            `its signal plan has ${phases.length} phases`,
        );
      }
      if (!change.greenS.every((greenS) => greenS > 0 && Number.isFinite(greenS))) {
        throw new Error(`${label} gives junction "${junction.id}" a green time that is not a number above zero`);
      }
      const retimed: Junction = {
        ...junction,
        signalPlan: {
          ...junction.signalPlan,
          phases: phases.map((phase, at) => ({ ...phase, greenS: change.greenS[at]! })),
        },
      };
      return {
        ...resolved,
        network: {
          ...resolved.network,
          junctions: resolved.network.junctions!.map((one) => (one.id === junction.id ? retimed : one)),
        },
      };
    }
    case "flyover": {
      const road = roadOf(resolved, change.roadId, label);
      if (!isFlyoverRoad(road)) {
        throw new Error(`${label} names a road that is not a flyover road (it is not raised): "${road.id}"`);
      }
      if (typeof change.built !== "boolean") throw new Error(`${label} must say whether the flyover road is built`);
      const absentRoads = new Map(resolved.absentRoads);
      if (change.built) absentRoads.delete(road.id);
      else absentRoads.set(road.id, `is removed (${label.toLowerCase()})`);
      return { ...resolved, absentRoads };
    }
    case "road-closure": {
      const road = roadOf(resolved, change.roadId, label);
      return { ...resolved, absentRoads: new Map(resolved.absentRoads).set(road.id, `is closed (${label.toLowerCase()})`) };
    }
    default:
      // A scenario read from a link or a file may hold anything.
      throw new Error(`${label} is of a kind this version does not know: "${String((change as { kind: unknown }).kind)}"`);
  }
}

/**
 * The network without some of its roads: the roads go, with every connection
 * to or from them, their green in signal plans (a phase left with no approach
 * goes too), and any junction left with no connection. A junction where a
 * road divided keeps its other ways on, so a diverge that lost its flyover
 * leads only to the road beneath. Whether what is left can be run (every
 * flow still has a route) is the engine's to judge.
 */
function withoutRoads(network: Network, absent: ReadonlyMap<string, unknown>): Network {
  if (absent.size === 0) return network;
  const roads = network.roads.filter((road) => !absent.has(road.id));
  if (!network.junctions) return { ...network, roads };
  const junctions = network.junctions.flatMap((junction): Junction[] => {
    const connections = junction.connections.filter(
      (connection) => !absent.has(connection.fromRoadId) && !absent.has(connection.toRoadId),
    );
    if (connections.length === 0) return [];
    if (junction.control !== "signal") return [{ ...junction, connections }];
    // An approach is a road with a connection from it; one whose every way on has gone is no longer an approach.
    const approaches = new Set(connections.map((connection) => connection.fromRoadId));
    const phases = junction.signalPlan.phases
      .map((phase) => ({ ...phase, greenRoadIds: phase.greenRoadIds.filter((roadId) => approaches.has(roadId)) }))
      .filter((phase) => phase.greenRoadIds.length > 0);
    return [{ ...junction, connections, signalPlan: { ...junction.signalPlan, phases } }];
  });
  return { ...network, roads, junctions };
}

/**
 * Resolve a scenario into the engine's input: apply its changes to its
 * network, demand and lane discipline, and pass on its seed. The scenario
 * itself is left untouched. The engine receives only the result and knows
 * nothing of baselines, proposals or changes.
 */
export function resolveScenario(scenario: Scenario): RunInput {
  if (scenario.formatVersion !== SCENARIO_FORMAT_VERSION) {
    throw new Error(`Unsupported scenario format version: ${String(scenario.formatVersion)}`);
  }
  let resolved: Resolved = {
    network: scenario.network,
    demand: scenario.demand,
    laneDiscipline: scenario.laneDiscipline,
    absentRoads: new Map(scenario.unbuiltRoadIds.map((roadId) => [roadId, "is not built today"])),
  };
  const inOrder = scenario.changes
    .map((change, index) => ({ change, label: `Change ${index + 1}`, rank: ORDER.indexOf(change.kind) }))
    // An unknown kind (rank -1) goes first, to be refused; sort() keeps the list's order within a kind.
    .sort((a, b) => a.rank - b.rank);
  for (const { change, label } of inOrder) resolved = applyChange(resolved, change, label);
  // Traffic of the demand is never taken off the network or given another entry or exit: the planner is told instead.
  for (const flow of resolved.demand.flows) {
    for (const [roadId, how] of [
      [flow.entryRoadId, "enters by"],
      [flow.exitRoadId, "leaves by"],
    ] as const) {
      const why = resolved.absentRoads.get(roadId);
      if (why === undefined) continue;
      throw new Error(
        `Road "${roadId}" ${why}, and the demand has traffic that ${how} it ` +
          `(from road "${flow.entryRoadId}" to road "${flow.exitRoadId}"). Traffic is not sent another way or taken off the network`,
      );
    }
  }
  const network = withoutRoads(resolved.network, resolved.absentRoads);
  const notSideBySide = whyNotSideBySide(network, scenario.network);
  if (notSideBySide) throw new Error(notSideBySide);
  return {
    network,
    demand: resolved.demand,
    seed: scenario.seed,
    laneDiscipline: resolved.laneDiscipline,
  };
}
