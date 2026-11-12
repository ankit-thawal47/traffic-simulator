/**
 * The builder (GLOSSARY: Builder): turns a line of building blocks along one
 * main road, with their settings, into a network in the engine's format and a
 * default demand for it (ADR 0003). The engine is not told the network was
 * built; it runs it as it runs any other.
 *
 * Plain logic only, no browser: the layout (the list of blocks and their
 * settings) is what a scenario saves, and the network is built from it again
 * whenever the scenario is read.
 */
import type { Demand, DemandFlow, Junction, Network, Point, Road } from "@traffic-simulator/engine";
import type { Outcome } from "./read";

export const BUILDING_BLOCK_KINDS = ["straight", "t-junction", "four-way", "flyover"] as const;
export type BuildingBlockKind = (typeof BUILDING_BLOCK_KINDS)[number];

/** A straight road: the main road, one carriageway each way. */
export interface StraightBlock {
  kind: "straight";
  /** Lanes of each carriageway of the main road. */
  lanes: number;
  /** Width of each carriageway of the main road, in metres. */
  widthM: number;
  /** Length of the block along the main road, in metres. */
  lengthM: number;
}

export type JunctionControl = "signal" | "priority";

/**
 * A block with a junction at its middle: a T-junction (one side road, to the
 * right of eastbound traffic), a four-way junction (a side road each side), or
 * a flyover over a four-way junction (the median lanes of the main road rise
 * over the junction; the kerb lanes go through it).
 */
export interface JunctionBlock {
  kind: "t-junction" | "four-way" | "flyover";
  lanes: number;
  widthM: number;
  lengthM: number;
  /** Lanes, width (each carriageway) and length of each side road, from the junction outwards. */
  sideLanes: number;
  sideWidthM: number;
  sideLengthM: number;
  control: JunctionControl;
  /** Signal timing: the green time of each main-road approach and of each side-road approach, in seconds. Unused at a priority junction. */
  mainGreenS: number;
  sideGreenS: number;
}

export type BuildingBlock = StraightBlock | JunctionBlock;

/** A line of building blocks, joined end to end along the main road from west to east. */
export interface Layout {
  blocks: BuildingBlock[];
}

/** A built network and its default demand. */
export interface Built {
  network: Network;
  demand: Demand;
}

/** 50 km/h, the usual urban limit. */
const SPEED_LIMIT_MPS = 13.9;

/** Bengaluru's mix (as the examples use). */
const VEHICLE_MIX = { "two-wheeler": 0.65, car: 0.22, "auto-rickshaw": 0.055, bus: 0.04 };

/** Settings for a new block: an Indian urban arterial with three lanes each way, and two-lane side roads. */
export function defaultBlock(kind: "straight"): StraightBlock;
export function defaultBlock(kind: JunctionBlock["kind"]): JunctionBlock;
export function defaultBlock(kind: BuildingBlockKind): BuildingBlock;
export function defaultBlock(kind: BuildingBlockKind): BuildingBlock {
  if (kind === "straight") return { kind, lanes: 3, widthM: 10.5, lengthM: 300 };
  return {
    kind,
    lanes: 3,
    widthM: 10.5,
    lengthM: kind === "flyover" ? 600 : 400,
    sideLanes: 2,
    sideWidthM: 7,
    sideLengthM: 200,
    control: "signal",
    mainGreenS: 30,
    sideGreenS: 20,
  };
}

/** The gap left between two blocks, where each carriageway runs straight on from one to the next (a junction with no signal). */
const JOINT_GAP_M = 15;

function road(id: string, points: Point[], widthM: number, lanes: number): Road {
  return { id, points, widthM, lanes, speedLimitMps: SPEED_LIMIT_MPS };
}

/** Where a block meets the rest of the network: its roads at each end of the main road, and its side roads. */
interface BlockEnds {
  /** Eastbound: the road entering the block at its west end, and the road leaving it at its east end. */
  eastboundFirst: string;
  eastboundLast: string;
  /** Westbound: the road entering at its east end, and the road leaving at its west end. */
  westboundFirst: string;
  westboundLast: string;
  /** Side roads: for each, the road where traffic enters the network and the road where it leaves. */
  sideRoads: SideRoad[];
}

interface SideRoad {
  entry: string;
  exit: string;
}

/** The ground a block covers along the main road, in metres east of the start of the layout. */
interface Span {
  id: string;
  fromX: number;
  toX: number;
  /** The middle of the block, where a junction block's junction is. */
  centreX: number;
}

function straightBlock(block: StraightBlock, span: Span, roads: Road[]): BlockEnds {
  const y = block.widthM / 2;
  const east = `${span.id}-eastbound`;
  const west = `${span.id}-westbound`;
  roads.push(road(east, [{ x: span.fromX, y }, { x: span.toX, y }], block.widthM, block.lanes));
  roads.push(road(west, [{ x: span.toX, y: -y }, { x: span.fromX, y: -y }], block.widthM, block.lanes));
  return { eastboundFirst: east, eastboundLast: east, westboundFirst: west, westboundLast: west, sideRoads: [] };
}

/** Room left between a road's edge and the end of the roads that cross it at a junction, for the turning paths, in metres. */
const JUNCTION_CLEARANCE_M = 8;

/** Signal plan times between greens, in seconds. */
const AMBER_S = 3;
const ALL_RED_S = 2;

/**
 * A junction at the middle of a block. Each main-road carriageway arrives on
 * an approach and leaves on a road beyond. Side roads run north and south.
 * Every approach connects to every road leaving, but not back the way it came.
 */
function junctionBlock(block: JunctionBlock, span: Span, roads: Road[], junctions: Junction[]): BlockEnds {
  const { id, centreX: c } = span;
  const w = block.widthM;
  const s = block.sideWidthM;
  const hx = s + JUNCTION_CLEARANCE_M;
  const hy = w + JUNCTION_CLEARANCE_M;
  // An arm is one way into the junction: the road arriving by it and the road leaving by it.
  const arms: { entry: Road; exit: Road; main: boolean }[] = [];
  const carriageway = (direction: "eastbound" | "westbound"): [Road, Road] => {
    const east = direction === "eastbound";
    const y = east ? w / 2 : -w / 2;
    const [from, to] = east ? [span.fromX, span.toX] : [span.toX, span.fromX];
    const [stop, start] = east ? [c - hx, c + hx] : [c + hx, c - hx];
    return [
      road(`${id}-${direction}-in`, [{ x: from, y }, { x: stop, y }], w, block.lanes),
      road(`${id}-${direction}-out`, [{ x: start, y }, { x: to, y }], w, block.lanes),
    ];
  };
  const [eastboundIn, eastboundOut] = carriageway("eastbound");
  const [westboundIn, westboundOut] = carriageway("westbound");
  arms.push({ entry: eastboundIn, exit: westboundOut, main: true }, { entry: westboundIn, exit: eastboundOut, main: true });
  const side = (arm: "south" | "north"): void => {
    const sign = arm === "south" ? -1 : 1;
    const near = sign * hy;
    const far = sign * (hy + block.sideLengthM);
    // Traffic keeps left: arriving from the south it runs north on the west carriageway.
    const inX = c - (sign * s) / 2;
    const outX = c + (sign * s) / 2;
    arms.push({
      entry: road(`${id}-${arm}-in`, [{ x: inX, y: far }, { x: inX, y: near }], s, block.sideLanes),
      exit: road(`${id}-${arm}-out`, [{ x: outX, y: near }, { x: outX, y: far }], s, block.sideLanes),
      main: false,
    });
  };
  side("south");
  if (block.kind !== "t-junction") side("north");
  roads.push(eastboundIn, eastboundOut, westboundIn, westboundOut);
  for (const arm of arms.filter((one) => !one.main)) roads.push(arm.entry, arm.exit);

  const connections = arms.flatMap((from) =>
    arms.filter((to) => to !== from).map((to) => ({ fromRoadId: from.entry.id, toRoadId: to.exit.id })),
  );
  const junctionId = `${id}-junction`;
  if (block.control === "priority") {
    const mainRoadIds = arms.filter((arm) => arm.main).map((arm) => arm.entry.id);
    junctions.push({ id: junctionId, control: "priority", connections, mainRoadIds });
  } else {
    const phases = arms.map((arm) => ({ greenRoadIds: [arm.entry.id], greenS: arm.main ? block.mainGreenS : block.sideGreenS }));
    junctions.push({ id: junctionId, control: "signal", connections, signalPlan: { phases, amberS: AMBER_S, allRedS: ALL_RED_S } });
  }
  return {
    eastboundFirst: eastboundIn.id,
    eastboundLast: eastboundOut.id,
    westboundFirst: westboundIn.id,
    westboundLast: westboundOut.id,
    sideRoads: arms.filter((arm) => !arm.main).map((arm) => ({ entry: arm.entry.id, exit: arm.exit.id })),
  };
}

/** Build the network of a layout, with its default demand, or say why it cannot be built. */
export function buildLayout(layout: Layout): Outcome<Built> {
  const roads: Road[] = [];
  const junctions: Junction[] = [];
  const ends: BlockEnds[] = [];
  let startX = 0;
  for (const [index, block] of layout.blocks.entries()) {
    const last = index === layout.blocks.length - 1;
    const span: Span = {
      id: `b${index + 1}`,
      fromX: startX + (index === 0 ? 0 : JOINT_GAP_M / 2),
      toX: startX + block.lengthM - (last ? 0 : JOINT_GAP_M / 2),
      centreX: startX + block.lengthM / 2,
    };
    if (block.kind === "straight") ends.push(straightBlock(block, span, roads));
    else ends.push(junctionBlock(block, span, roads, junctions));
    startX += block.lengthM;
  }
  for (let at = 1; at < ends.length; at++) {
    junctions.push({
      id: `joint-${at}-${at + 1}`,
      control: "none",
      connections: [
        { fromRoadId: ends[at - 1]!.eastboundLast, toRoadId: ends[at]!.eastboundFirst },
        { fromRoadId: ends[at]!.westboundLast, toRoadId: ends[at - 1]!.westboundFirst },
      ],
    });
  }
  const network: Network = { formatVersion: 5, roads, ...(junctions.length > 0 ? { junctions } : {}) };
  return { ok: true, value: { network, demand: defaultDemand(ends) } };
}

/**
 * Default vehicles per hour: from one end of the main road to the other, from
 * a main-road end to each side road, from a side road to each main-road end,
 * and across from one side road to the other.
 */
const THROUGH_PER_HOUR = 800;
const MAIN_TO_SIDE_PER_HOUR = 60;
const SIDE_TO_MAIN_PER_HOUR = 100;
const ACROSS_PER_HOUR = 50;

/** Default demand: traffic enters at both ends of the main road and every side road, and leaves at the others. */
function defaultDemand(ends: BlockEnds[]): Demand {
  const first = ends[0]!;
  const last = ends[ends.length - 1]!;
  const sideRoads = ends.flatMap((block) => block.sideRoads);
  const flow = (entryRoadId: string, exitRoadId: string, vehiclesPerHour: number): DemandFlow => ({ entryRoadId, exitRoadId, vehiclesPerHour });
  const fromEnd = (entry: string, exit: string): DemandFlow[] => [
    flow(entry, exit, THROUGH_PER_HOUR),
    ...sideRoads.map((side) => flow(entry, side.exit, MAIN_TO_SIDE_PER_HOUR)),
  ];
  const flows: DemandFlow[] = [
    ...fromEnd(first.eastboundFirst, last.eastboundLast),
    ...fromEnd(last.westboundFirst, first.westboundLast),
    ...ends.flatMap((block) =>
      block.sideRoads.flatMap((side) => [
        flow(side.entry, last.eastboundLast, SIDE_TO_MAIN_PER_HOUR),
        flow(side.entry, first.westboundLast, SIDE_TO_MAIN_PER_HOUR),
        ...block.sideRoads.filter((other) => other !== side).map((other) => flow(side.entry, other.exit, ACROSS_PER_HOUR)),
      ]),
    ),
  ];
  return { flows, vehicleMix: VEHICLE_MIX };
}
