/**
 * Reading a scenario that came from outside: a link, a file, anything the
 * product did not just make itself. Such a value is untrusted. It is checked
 * in full (types, ranges, references to roads that exist, known kinds of
 * change, known versions, and that the engine will run it) and only then
 * handed on, rebuilt from the checked parts alone. A value that fails any
 * check gives a message for the planner and no scenario at all.
 */
import {
  createRun,
  roadLengthM,
  VEHICLE_CLASSES,
  type Connection,
  type Demand,
  type DemandFlow,
  type Junction,
  type Network,
  type Point,
  type Road,
  type SignalPhase,
  type SignalPlan,
  type VehicleClass,
  type VehicleMix,
} from "@traffic-simulator/engine";
import { resolveScenario } from "./resolve";
import { baselineOf, SCENARIO_FORMAT_VERSION, type Change, type Scenario } from "./scenario";
import { UPGRADE_STEPS } from "./upgrade";

/** The outcome of something that can fail with a message meant for the planner. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * The ranges a saved scenario must keep to. They are wide enough for any real
 * road, and narrow enough that a damaged or hostile link cannot ask the page
 * for an absurd amount of work.
 */
export const SCENARIO_LIMITS = {
  nameLength: 200,
  roadIdLength: 100,
  roads: 2000,
  pointsPerRoad: 2000,
  /** Furthest a point may be from the origin along either axis, in metres. */
  coordinateM: 1_000_000,
  roadWidthM: 60,
  lanes: 12,
  speedLimitMps: 60,
  flows: 10_000,
  vehiclesPerHour: 100_000,
  changes: 2000,
  junctions: 500,
  connectionsPerJunction: 500,
  phasesPerJunction: 50,
  /** Longest green, amber or all-red time of a signal plan, in seconds. */
  signalSeconds: 3600,
} as const;

/** Thrown inside this file only; readScenario() turns it into an Outcome. */
class Unreadable extends Error {}

function refuse(message: string): never {
  throw new Unreadable(message);
}

/** How a value reads in a message: short, and never the whole of something large. */
function shown(value: unknown): string {
  if (value === undefined) return "nothing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "object") return "an object";
  const text = typeof value === "string" ? JSON.stringify(value) : String(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

function anObject(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    refuse(`${what} is missing or is not an object (found ${shown(value)})`);
  }
  return value as Record<string, unknown>;
}

function aList(value: unknown, what: string, most: number): unknown[] {
  if (!Array.isArray(value)) refuse(`${what} is missing or is not a list (found ${shown(value)})`);
  if (value.length > most) refuse(`${what} has ${value.length} entries; the most allowed is ${most}`);
  return value;
}

function aString(value: unknown, what: string, longest: number): string {
  if (typeof value !== "string") refuse(`${what} is missing or is not text (found ${shown(value)})`);
  if (value.length > longest) refuse(`${what} is longer than ${longest} characters`);
  return value;
}

function aNumber(value: unknown, what: string, range: { above?: number; from?: number; to: number }): number {
  const fits =
    typeof value === "number" &&
    Number.isFinite(value) &&
    (range.above === undefined || value > range.above) &&
    (range.from === undefined || value >= range.from) &&
    value <= range.to;
  if (!fits) {
    const lowest = range.above !== undefined ? `above ${range.above}` : `from ${range.from}`;
    refuse(`${what} must be a number ${lowest} and up to ${range.to} (found ${shown(value)})`);
  }
  return value as number;
}

function aWholeNumber(value: unknown, what: string, from: number, to: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < from || value > to) {
    refuse(`${what} must be a whole number from ${from} to ${to} (found ${shown(value)})`);
  }
  return value;
}

function readPoint(value: unknown, what: string): Point {
  const point = anObject(value, what);
  const limit = SCENARIO_LIMITS.coordinateM;
  return {
    x: aNumber(point.x, `${what}, x`, { from: -limit, to: limit }),
    y: aNumber(point.y, `${what}, y`, { from: -limit, to: limit }),
  };
}

function readNetwork(value: unknown): Network {
  const network = anObject(value, "The network");
  const formatVersion = network.formatVersion;
  if (formatVersion !== 1 && formatVersion !== 2 && formatVersion !== 3) {
    refuse(`The network uses a network format version this version of the product does not know (${shown(formatVersion)})`);
  }
  const ids = new Set<string>();
  const roads = aList(network.roads, "The network's list of roads", SCENARIO_LIMITS.roads).map((entry, index): Road => {
    const road = anObject(entry, `Road ${index + 1}`);
    const id = aString(road.id, `The identifier of road ${index + 1}`, SCENARIO_LIMITS.roadIdLength);
    if (id === "") refuse(`Road ${index + 1} has an empty identifier`);
    if (ids.has(id)) refuse(`The network has two roads with the identifier "${id}"`);
    ids.add(id);
    const name = `Road "${id}"`;
    const points = aList(road.points, `The points of road "${id}"`, SCENARIO_LIMITS.pointsPerRoad).map(
      (point, at) => readPoint(point, `Point ${at + 1} of road "${id}"`),
    );
    if (points.length < 2) refuse(`${name} needs at least two points`);
    const widthM = aNumber(road.widthM, `The width of road "${id}"`, { above: 0, to: SCENARIO_LIMITS.roadWidthM });
    // A lane count is part of the network format from version 2; a version 1 road may go without.
    const lanes =
      road.lanes !== undefined || formatVersion >= 2
        ? { lanes: aWholeNumber(road.lanes, `The number of lanes of road "${id}"`, 1, SCENARIO_LIMITS.lanes) }
        : {};
    const speedLimitMps = aNumber(road.speedLimitMps, `The speed limit of road "${id}"`, {
      above: 0,
      to: SCENARIO_LIMITS.speedLimitMps,
    });
    // Always built in this order, so that one scenario always gives one text and one link.
    const read: Road = { id, points, widthM, ...lanes, speedLimitMps };
    if (!(roadLengthM(read) > 0)) refuse(`${name} has no length: all its points are in one place`);
    return read;
  });
  if (roads.length === 0) refuse("The network has no roads");
  // Junctions are part of network format version 3. An older network has none.
  if (network.junctions === undefined) return { formatVersion, roads };
  const entries = aList(network.junctions, "The network's list of junctions", SCENARIO_LIMITS.junctions);
  if (formatVersion !== 3) {
    if (entries.length === 0) return { formatVersion, roads };
    refuse(`The network has junctions, which need network format version 3 (it says ${shown(formatVersion)})`);
  }
  const withRoads: Network = { formatVersion, roads };
  const junctionIds = new Set<string>();
  const junctions = entries.map((entry, index): Junction => {
    const junction = anObject(entry, `Junction ${index + 1}`);
    const id = aString(junction.id, `The identifier of junction ${index + 1}`, SCENARIO_LIMITS.roadIdLength);
    if (id === "") refuse(`Junction ${index + 1} has an empty identifier`);
    if (junctionIds.has(id)) refuse(`The network has two junctions with the identifier "${id}"`);
    junctionIds.add(id);
    const name = `junction "${id}"`;
    if (junction.control !== "signal") {
      refuse(`Junction "${id}" is of a kind this version of the product does not know: ${shown(junction.control)}`);
    }
    const connections = aList(junction.connections, `The connections of ${name}`, SCENARIO_LIMITS.connectionsPerJunction).map(
      (value, at): Connection => {
        const what = `Connection ${at + 1} of ${name}`;
        const connection = anObject(value, what);
        return {
          fromRoadId: aRoadOf(withRoads, connection.fromRoadId, what),
          toRoadId: aRoadOf(withRoads, connection.toRoadId, what),
        };
      },
    );
    const plan = anObject(junction.signalPlan, `The signal plan of ${name}`);
    const seconds = SCENARIO_LIMITS.signalSeconds;
    const phases = aList(plan.phases, `The phases of ${name}`, SCENARIO_LIMITS.phasesPerJunction).map((value, at): SignalPhase => {
      const what = `Phase ${at + 1} of ${name}`;
      const phase = anObject(value, what);
      return {
        greenRoadIds: aList(phase.greenRoadIds, `The roads with green in ${what.toLowerCase()}`, SCENARIO_LIMITS.roads).map(
          (roadId) => aRoadOf(withRoads, roadId, what),
        ),
        greenS: aNumber(phase.greenS, `The green time of ${what.toLowerCase()}`, { above: 0, to: seconds }),
      };
    });
    const signalPlan: SignalPlan = {
      phases,
      amberS: aNumber(plan.amberS, `The amber time of ${name}`, { from: 0, to: seconds }),
      allRedS: aNumber(plan.allRedS, `The all-red time of ${name}`, { from: 0, to: seconds }),
      ...(plan.offsetS === undefined
        ? {}
        : { offsetS: aNumber(plan.offsetS, `The signal plan offset of ${name}`, { from: -seconds * 100, to: seconds * 100 }) }),
    };
    // What the parts must add up to (every approach has green, no road ends at two
    // junctions, turns that are not too tight) is the engine's to judge: whyRefused().
    return { id, control: "signal", connections, signalPlan };
  });
  return { formatVersion, roads, junctions };
}

function aRoadOf(network: Network, value: unknown, what: string): string {
  const roadId = aString(value, what, SCENARIO_LIMITS.roadIdLength);
  if (!network.roads.some((road) => road.id === roadId)) {
    refuse(`${what} names a road that is not in the network: "${roadId}"`);
  }
  return roadId;
}

function readVehicleMix(value: unknown): VehicleMix {
  const mix = anObject(value, "The vehicle mix");
  const read: VehicleMix = {};
  for (const key of Object.keys(mix)) {
    if (!VEHICLE_CLASSES.includes(key as VehicleClass)) {
      refuse(`The vehicle mix names a vehicle class this version of the product does not know: "${key}"`);
    }
    read[key as VehicleClass] = aNumber(mix[key], `The share of vehicle class "${key}"`, { from: 0, to: 1_000_000 });
  }
  if (!Object.values(read).some((share) => share > 0)) {
    refuse("The vehicle mix needs a share above zero for at least one vehicle class");
  }
  return read;
}

function readDemand(value: unknown, network: Network): Demand {
  const demand = anObject(value, "The demand");
  const flows = aList(demand.flows, "The demand's list of flows", SCENARIO_LIMITS.flows).map((entry, index): DemandFlow => {
    const what = `Flow ${index + 1} of the demand`;
    const flow = anObject(entry, what);
    return {
      entryRoadId: aRoadOf(network, flow.entryRoadId, `The entry road of flow ${index + 1}`),
      exitRoadId: aRoadOf(network, flow.exitRoadId, `The exit road of flow ${index + 1}`),
      vehiclesPerHour: aNumber(flow.vehiclesPerHour, `The vehicles per hour of flow ${index + 1}`, {
        from: 0,
        to: SCENARIO_LIMITS.vehiclesPerHour,
      }),
    };
  });
  return demand.vehicleMix === undefined ? { flows } : { flows, vehicleMix: readVehicleMix(demand.vehicleMix) };
}

/** One case for each kind of change, as in applyChange() (resolve.ts). */
function readChange(value: unknown, network: Network, label: string): Change {
  const change = anObject(value, label);
  switch (change.kind) {
    case "road-width":
      return {
        kind: "road-width",
        roadId: aRoadOf(network, change.roadId, label),
        widthM: aNumber(change.widthM, `The width in ${label.toLowerCase()}`, {
          above: 0,
          to: SCENARIO_LIMITS.roadWidthM,
        }),
      };
    case "road-lanes":
      return {
        kind: "road-lanes",
        roadId: aRoadOf(network, change.roadId, label),
        lanes: aWholeNumber(change.lanes, `The number of lanes in ${label.toLowerCase()}`, 1, SCENARIO_LIMITS.lanes),
      };
    default:
      return refuse(`${label} is of a kind this version of the product does not know: ${shown(change.kind)}`);
  }
}

/** Bring a saved scenario of any known version up to the current one, one upgrade step at a time. */
function upgraded(saved: Record<string, unknown>): Record<string, unknown> {
  const version = saved.formatVersion;
  if (version === undefined) refuse("It does not say which version of the scenario description it uses");
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    refuse(`It gives a version of the scenario description that is not a version number: ${shown(version)}`);
  }
  if (version > SCENARIO_FORMAT_VERSION) {
    refuse(
      `It was made with a newer version of the product (scenario description version ${version}; ` +
        `this page reads up to version ${SCENARIO_FORMAT_VERSION}). Reload the page to get the latest version and open it again`,
    );
  }
  let current = saved;
  for (let from = version; from < SCENARIO_FORMAT_VERSION; from++) {
    const step = UPGRADE_STEPS[from];
    if (!step) throw new Error(`No upgrade step from scenario description version ${from}`);
    current = step(current);
  }
  return current;
}

/**
 * Why the engine would refuse to run a scenario, as a sentence for the
 * planner, or undefined when it will run it. Both runs are tried: the
 * baseline (the scenario without its changes) and the proposal. Roads too
 * narrow for a vehicle class in the vehicle mix, and lanes too narrow under
 * lane discipline, are found here; the engine itself is the judge, so this
 * can never disagree with it.
 */
export function whyRefused(scenario: Scenario): string | undefined {
  const runs: [string, Scenario][] = [["baseline", baselineOf(scenario)]];
  if (scenario.changes.length > 0) runs.push(["proposal", scenario]);
  for (const [name, toRun] of runs) {
    try {
      createRun(resolveScenario(toRun));
    } catch (error) {
      return `The ${name} cannot be run: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return undefined;
}

/**
 * Read a scenario from an untrusted value (what a link or a file held, after
 * decoding). Older versions are upgraded to the current one. The scenario
 * returned is complete, of the current version, and one the engine will run.
 * Its parts are always in the same order, whatever order they arrived in.
 */
export function readScenario(value: unknown): Outcome<Scenario> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      refuse(`It does not hold a scenario (found ${shown(value)})`);
    }
    const saved = upgraded(value as Record<string, unknown>);
    const network = readNetwork(saved.network);
    const scenario: Scenario = {
      formatVersion: SCENARIO_FORMAT_VERSION,
      name: aString(saved.name, "The scenario's name", SCENARIO_LIMITS.nameLength),
      network,
      changes: aList(saved.changes, "The list of changes", SCENARIO_LIMITS.changes).map((change, index) =>
        readChange(change, network, `Change ${index + 1}`),
      ),
      demand: readDemand(saved.demand, network),
      laneDiscipline:
        typeof saved.laneDiscipline === "boolean"
          ? saved.laneDiscipline
          : refuse(`Lane discipline must be on (true) or off (false) (found ${shown(saved.laneDiscipline)})`),
      seed: aWholeNumber(saved.seed, "The seed", -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    };
    const refusal = whyRefused(scenario);
    if (refusal) refuse(refusal);
    return { ok: true, value: scenario };
  } catch (error) {
    if (error instanceof Unreadable) return { ok: false, message: `${error.message}.` };
    throw error;
  }
}
