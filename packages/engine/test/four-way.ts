import { BENGALURU_VEHICLE_MIX, type Demand, type Network, type Road, type SignalPlan } from "../src/index";

export type Arm = "north" | "east" | "south" | "west";
export const ARMS: readonly Arm[] = ["north", "east", "south", "west"];

export interface FourWayOptions {
  /** Distance of every stop line from the centre of the junction. */
  halfM?: number;
  armLengthM?: number;
  widthM?: number;
  lanes?: number;
  speedLimitMps?: number;
  signalPlan?: SignalPlan;
  /** Width and lanes of single roads, by road id, where they differ from the rest. */
  roads?: Record<string, { widthM: number; lanes: number }>;
}

/** One phase for each approach in turn. */
export function oneApproachAtATime(greenS = 20, amberS = 3, allRedS = 2): SignalPlan {
  return { phases: ARMS.map((arm) => ({ greenRoadIds: [`${arm}-in`], greenS })), amberS, allRedS };
}

/** Two phases: north and south together, then east and west together, so right turns cross oncoming traffic. */
export function opposingApproachesTogether(greenS = 25, amberS = 3, allRedS = 2): SignalPlan {
  return {
    phases: [
      { greenRoadIds: ["north-in", "south-in"], greenS },
      { greenRoadIds: ["east-in", "west-in"], greenS },
    ],
    amberS,
    allRedS,
  };
}

/** A plan that keeps some approaches green for a very long time, starting at the start of the run. */
export function alwaysGreenFor(...roadIds: string[]): SignalPlan {
  const others = ARMS.map((arm) => `${arm}-in`).filter((id) => !roadIds.includes(id));
  return {
    phases: [
      { greenRoadIds: roadIds, greenS: 100000 },
      { greenRoadIds: others, greenS: 1 },
    ],
    amberS: 3,
    allRedS: 2,
  };
}

/** Demand on every approach: a fifth turns left, a fifth turns right, the rest go straight on. */
export function everyMovement(vehiclesPerHourPerApproach: number, mixed = true): Demand {
  const flows = ARMS.flatMap((from, at) => {
    // ARMS runs clockwise seen from above. Facing the junction from the south, the west is on the left.
    const left = ARMS[(at + 1) % 4]!;
    const opposite = ARMS[(at + 2) % 4]!;
    const right = ARMS[(at + 3) % 4]!;
    return [
      { entryRoadId: `${from}-in`, exitRoadId: `${left}-out`, vehiclesPerHour: vehiclesPerHourPerApproach * 0.2 },
      { entryRoadId: `${from}-in`, exitRoadId: `${opposite}-out`, vehiclesPerHour: vehiclesPerHourPerApproach * 0.6 },
      { entryRoadId: `${from}-in`, exitRoadId: `${right}-out`, vehiclesPerHour: vehiclesPerHourPerApproach * 0.2 },
    ];
  });
  return mixed ? { flows, vehicleMix: BENGALURU_VEHICLE_MIX } : { flows };
}

/**
 * A four-way junction in left-hand traffic. Each arm has a road towards the
 * junction ("north-in" comes from the north) and one away from it ("north-out"
 * leaves to the north). Facing the junction, the road towards it is on the left.
 * Every approach connects to the other three arms.
 */
export function fourWay(options: FourWayOptions = {}): Network {
  const half = options.halfM ?? 15;
  const far = half + (options.armLengthM ?? 200);
  const speedLimitMps = options.speedLimitMps ?? 13.9;
  const size = (id: string) => options.roads?.[id] ?? { widthM: options.widthM ?? 7, lanes: options.lanes ?? 2 };
  const road = (id: string, from: [number, number], to: [number, number]): Road => ({
    id,
    points: [
      { x: from[0], y: from[1] },
      { x: to[0], y: to[1] },
    ],
    ...size(id),
    speedLimitMps,
  });
  // Offset of each road's centreline from the middle of its arm.
  const o = (id: string) => size(id).widthM / 2;
  const roads: Road[] = [
    road("south-in", [-o("south-in"), -far], [-o("south-in"), -half]),
    road("north-out", [-o("north-out"), half], [-o("north-out"), far]),
    road("north-in", [o("north-in"), far], [o("north-in"), half]),
    road("south-out", [o("south-out"), -half], [o("south-out"), -far]),
    road("west-in", [-far, o("west-in")], [-half, o("west-in")]),
    road("east-out", [half, o("east-out")], [far, o("east-out")]),
    road("east-in", [far, -o("east-in")], [half, -o("east-in")]),
    road("west-out", [-half, -o("west-out")], [-far, -o("west-out")]),
  ];
  const connections = ARMS.flatMap((from) =>
    ARMS.filter((to) => to !== from).map((to) => ({ fromRoadId: `${from}-in`, toRoadId: `${to}-out` })),
  );
  return {
    formatVersion: 3,
    roads,
    junctions: [{ id: "cross", control: "signal", connections, signalPlan: options.signalPlan ?? oneApproachAtATime() }],
  };
}
