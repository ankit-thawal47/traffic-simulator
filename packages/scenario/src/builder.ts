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
import { whyRefused, type Outcome } from "./read";
import { createBaseline, type Scenario } from "./scenario";

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

/** The layout with a new block of this kind, with its default settings, at the east end. */
export function withBlockAdded(layout: Layout, kind: BuildingBlockKind): Layout {
  return { blocks: [...layout.blocks, defaultBlock(kind)] };
}

/** The layout with the block at `index` moved one place west (-1) or east (1); at an end of the line, unchanged. */
export function withBlockMoved(layout: Layout, index: number, by: -1 | 1): Layout {
  const to = index + by;
  if (to < 0 || to >= layout.blocks.length) return layout;
  const blocks = [...layout.blocks];
  [blocks[index], blocks[to]] = [blocks[to]!, blocks[index]!];
  return { blocks };
}

/** The layout without the block at `index`. */
export function withoutBlock(layout: Layout, index: number): Layout {
  return { blocks: layout.blocks.filter((_, at) => at !== index) };
}

/** The layout with some settings of the block at `index` changed. A straight road block has no junction settings. */
export function withBlockSettings(
  layout: Layout,
  index: number,
  settings: Partial<Omit<StraightBlock, "kind">> | Partial<Omit<JunctionBlock, "kind">>,
): Layout {
  return {
    blocks: layout.blocks.map((block, at) => (at === index ? ({ ...block, ...settings } as BuildingBlock) : block)),
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

/**
 * A flyover block: the length of road before the carriageway divides (and
 * after it joins again), the flyover's deck height, and how far the deck runs
 * level beyond each side of the junction beneath, in metres.
 */
const FLYOVER_ENTRY_M = 40;
const DECK_HEIGHT_M = 6;
const DECK_BEYOND_JUNCTION_M = 10;

/** The lanes of a carriageway that rise onto a flyover: the median half, rounded down. */
function flyoverLanesOf(lanes: number): number {
  return Math.floor(lanes / 2);
}

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
  const flyoverLanes = block.kind === "flyover" ? flyoverLanesOf(block.lanes) : 0;
  const flyoverWidthM = (w / block.lanes) * flyoverLanes;
  /**
   * One carriageway of the main road. Without a flyover: an approach to the
   * junction and a road leaving it. With one: an entry road as wide as the
   * carriageway divides into the flyover (its median lanes) and the approach
   * beneath (its kerb lanes), and beyond the junction the road leaving and
   * the flyover join side by side into an exit road as wide as both.
   */
  const carriageway = (direction: "eastbound" | "westbound") => {
    const sign = direction === "eastbound" ? 1 : -1;
    const along = (offsetFromStartM: number): number => (sign > 0 ? span.fromX + offsetFromStartM : span.toX - offsetFromStartM);
    const length = span.toX - span.fromX;
    const centre = sign * (c - (sign > 0 ? span.fromX : span.toX));
    const line = (from: number, to: number, y: number): Point[] => [{ x: along(from), y: sign * y }, { x: along(to), y: sign * y }];
    const beneathWidthM = w - flyoverWidthM;
    const beneathY = flyoverWidthM + beneathWidthM / 2;
    const lanesBeneath = block.lanes - flyoverLanes;
    if (block.kind !== "flyover") {
      const into = road(`${id}-${direction}-in`, line(0, centre - hx, w / 2), w, block.lanes);
      const out = road(`${id}-${direction}-out`, line(centre + hx, length, w / 2), w, block.lanes);
      return { first: into, into, out, last: out, all: [into, out] };
    }
    const divideAt = FLYOVER_ENTRY_M;
    const rejoinAt = length - FLYOVER_ENTRY_M;
    const entry = road(`${id}-${direction}-entry`, line(0, divideAt, w / 2), w, block.lanes);
    const into = road(`${id}-${direction}-in`, line(divideAt + JOINT_GAP_M, centre - hx, beneathY), beneathWidthM, lanesBeneath);
    const deckFrom = centre - hx - DECK_BEYOND_JUNCTION_M;
    const deckTo = centre + hx + DECK_BEYOND_JUNCTION_M;
    const flyoverY = sign * (flyoverWidthM / 2);
    const flyover = road(
      `${id}-${direction}-flyover`,
      [
        { x: along(divideAt + JOINT_GAP_M), y: flyoverY },
        { x: along(deckFrom), y: flyoverY, z: DECK_HEIGHT_M },
        { x: along(deckTo), y: flyoverY, z: DECK_HEIGHT_M },
        { x: along(rejoinAt - JOINT_GAP_M), y: flyoverY },
      ],
      flyoverWidthM,
      flyoverLanes,
    );
    const out = road(`${id}-${direction}-out`, line(centre + hx, rejoinAt - JOINT_GAP_M, beneathY), beneathWidthM, lanesBeneath);
    const exit = road(`${id}-${direction}-exit`, line(rejoinAt, length, w / 2), w, block.lanes);
    junctions.push(
      {
        id: `${id}-diverge-${direction}`,
        control: "none",
        connections: [
          { fromRoadId: entry.id, toRoadId: into.id },
          { fromRoadId: entry.id, toRoadId: flyover.id },
        ],
      },
      {
        id: `${id}-merge-${direction}`,
        control: "none",
        connections: [
          { fromRoadId: out.id, toRoadId: exit.id },
          { fromRoadId: flyover.id, toRoadId: exit.id },
        ],
      },
    );
    return { first: entry, into, out, last: exit, all: [entry, into, flyover, out, exit] };
  };
  const eastbound = carriageway("eastbound");
  const westbound = carriageway("westbound");
  arms.push({ entry: eastbound.into, exit: westbound.out, main: true }, { entry: westbound.into, exit: eastbound.out, main: true });
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
  roads.push(...eastbound.all, ...westbound.all);
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
    eastboundFirst: eastbound.first.id,
    eastboundLast: eastbound.last.id,
    westboundFirst: westbound.first.id,
    westboundLast: westbound.last.id,
    sideRoads: arms.filter((arm) => !arm.main).map((arm) => ({ entry: arm.entry.id, exit: arm.exit.id })),
  };
}

/** The limits a layout keeps to, so that every layout the builder accepts can run. */
export const LAYOUT_LIMITS = {
  blocks: 12,
  lanes: 6,
  sideLanes: 4,
  /** Narrowest and widest lane, in metres: the narrowest takes a bus. */
  laneWidthM: { from: 2.5, to: 5 },
  /** Shortest straight road block, and the longest of any block, in metres. */
  straightLengthM: 30,
  lengthM: 5000,
  /**
   * Shortest approach to a junction, and shortest side road, in metres: room
   * for a queue, and for a side-road driver at a priority junction to see
   * oncoming traffic far enough ahead (about 70 m at 50 km/h).
   */
  approachM: 80,
  sideLengthM: { from: 80, to: 2000 },
  /** Narrowest flyover, in metres. */
  flyoverWidthM: 3,
  /** Shortest ramp, in metres: a 6 m rise at 6 %. */
  rampM: 100,
  greenS: { from: 5, to: 180 },
} as const;

/** What a planner calls each kind of building block. */
export const BLOCK_NAMES: Record<BuildingBlockKind, string> = {
  straight: "straight road",
  "t-junction": "T-junction",
  "four-way": "four-way junction",
  flyover: "flyover over a junction",
};

/** A number in metres or seconds as a planner reads it: at most one decimal place. */
function shownNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Why one block cannot be built, as a sentence without its block number, or undefined when it can. */
function whyBlockRefused(block: BuildingBlock): string | undefined {
  const limits = LAYOUT_LIMITS;
  const name = BLOCK_NAMES[block.kind];
  if (!Number.isInteger(block.lanes) || block.lanes < 1 || block.lanes > limits.lanes) {
    return `its road has ${shownNumber(block.lanes)} lanes; a road has from 1 to ${limits.lanes} lanes`;
  }
  const laneWidthM = block.widthM / block.lanes;
  if (!(laneWidthM >= limits.laneWidthM.from)) {
    return (
      `its ${block.lanes} lanes in ${shownNumber(block.widthM)} m would be ${shownNumber(laneWidthM)} m wide each; ` +
      `a lane needs at least ${limits.laneWidthM.from} m`
    );
  }
  if (!(laneWidthM <= limits.laneWidthM.to)) {
    return `its ${block.lanes} lanes in ${shownNumber(block.widthM)} m would be ${shownNumber(laneWidthM)} m wide each; a lane is at most ${limits.laneWidthM.to} m`;
  }
  if (!(block.lengthM <= limits.lengthM)) return `its length is ${shownNumber(block.lengthM)} m; a block is at most ${limits.lengthM} m`;
  if (block.kind === "straight") {
    if (!(block.lengthM >= limits.straightLengthM)) {
      return `its length is ${shownNumber(block.lengthM)} m; a ${name} needs at least ${limits.straightLengthM} m`;
    }
    return undefined;
  }
  if (!Number.isInteger(block.sideLanes) || block.sideLanes < 1 || block.sideLanes > limits.sideLanes) {
    return `its side road has ${shownNumber(block.sideLanes)} lanes; a side road has from 1 to ${limits.sideLanes} lanes`;
  }
  const sideLaneWidthM = block.sideWidthM / block.sideLanes;
  if (!(sideLaneWidthM >= limits.laneWidthM.from && sideLaneWidthM <= limits.laneWidthM.to)) {
    return (
      `its side road's ${block.sideLanes} lanes in ${shownNumber(block.sideWidthM)} m would be ${shownNumber(sideLaneWidthM)} m wide each; ` +
      `a lane is from ${limits.laneWidthM.from} m to ${limits.laneWidthM.to} m`
    );
  }
  if (!(block.sideLengthM >= limits.sideLengthM.from && block.sideLengthM <= limits.sideLengthM.to)) {
    const roads = block.kind === "t-junction" ? "side road is" : "side roads are";
    return `its ${roads} ${shownNumber(block.sideLengthM)} m long; a side road needs at least ${limits.sideLengthM.from} m`;
  }
  const hx = block.sideWidthM + JUNCTION_CLEARANCE_M;
  if (block.kind === "flyover") {
    if (block.lanes < 2) {
      return `its road has 1 lane; a flyover needs at least 2, one to rise onto the flyover and one to go beneath`;
    }
    const flyoverWidthM = (block.widthM / block.lanes) * flyoverLanesOf(block.lanes);
    if (flyoverWidthM < limits.flyoverWidthM) {
      return `its flyover would be ${shownNumber(flyoverWidthM)} m wide; a flyover needs at least ${limits.flyoverWidthM} m. Make the road wider`;
    }
    const leastM = 2 * (FLYOVER_ENTRY_M + JOINT_GAP_M + limits.rampM + DECK_BEYOND_JUNCTION_M + hx) + JOINT_GAP_M;
    if (!(block.lengthM >= leastM)) {
      return `it is ${shownNumber(block.lengthM)} m long; a flyover over this junction needs at least ${shownNumber(leastM)} m for its ramps`;
    }
  } else {
    // Measured as if the block had a neighbour at each end, so a block is accepted wherever it is put.
    const approachM = block.lengthM / 2 - hx - JOINT_GAP_M / 2;
    if (!(approachM >= limits.approachM)) {
      const leastM = 2 * (limits.approachM + hx) + JOINT_GAP_M;
      return (
        `its approaches to the junction would be ${shownNumber(approachM)} m long; a junction needs approaches of at least ${limits.approachM} m, ` +
        `so that queues fit and oncoming traffic can be seen. Make the block at least ${shownNumber(leastM)} m long`
      );
    }
  }
  if (block.control !== "signal" && block.control !== "priority") return `its junction must be a signal junction or a priority junction`;
  for (const [which, greenS] of [
    ["main-road", block.mainGreenS],
    ["side-road", block.sideGreenS],
  ] as const) {
    if (!(greenS >= limits.greenS.from && greenS <= limits.greenS.to)) {
      return `its ${which} green time is ${shownNumber(greenS)} s; a green time must be from ${limits.greenS.from} s to ${limits.greenS.to} s`;
    }
  }
  return undefined;
}

/** Why a layout cannot be built, naming the block and the problem, or undefined when it can. */
function whyLayoutRefused(layout: Layout): string | undefined {
  if (layout.blocks.length === 0) return "A layout needs at least one building block.";
  if (layout.blocks.length > LAYOUT_LIMITS.blocks) {
    return `A layout has at most ${LAYOUT_LIMITS.blocks} building blocks; this one has ${layout.blocks.length}.`;
  }
  for (const [index, block] of layout.blocks.entries()) {
    const why = whyBlockRefused(block);
    if (why) return `Block ${index + 1} (${BLOCK_NAMES[block.kind]}): ${why}.`;
  }
  return undefined;
}

/** Build the network of a layout, with its default demand, or say why it cannot be built. */
export function buildLayout(layout: Layout): Outcome<Built> {
  const refusal = whyLayoutRefused(layout);
  if (refusal) return { ok: false, message: refusal };
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

/**
 * The baseline on a built network: the network built from the layout, with
 * its default demand, ready to run; or why the layout cannot run, naming the
 * block. The engine has the last word (whyRefused()), so the builder can never
 * accept a layout the engine would refuse.
 */
export function builtBaseline(layout: Layout, seed = 1): Outcome<Scenario> {
  const built = buildLayout(layout);
  if (!built.ok) return built;
  const scenario = createBaseline({ name: "Built network", layout, ...built.value, seed });
  const refusal = whyRefused(scenario);
  if (refusal === undefined) return { ok: true, value: scenario };
  const block = /"b(\d+)-/.exec(refusal);
  const kind = block ? layout.blocks[Number(block[1]) - 1]?.kind : undefined;
  return { ok: false, message: kind ? `Block ${block![1]} (${BLOCK_NAMES[kind]}): ${refusal}.` : `${refusal}.` };
}
