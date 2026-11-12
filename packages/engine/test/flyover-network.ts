import { BENGALURU_VEHICLE_MIX, type Demand, type Network, type Road } from "../src/index";

export interface FlyoverOptions {
  /** Height of the flyover's deck, in metres. 0 puts it on the ground, through the junction: a broken network. */
  deckHeightM?: number;
  /** Green time of the main road's approach and of the cross road, in seconds. */
  mainGreenS?: number;
  crossGreenS?: number;
  speedLimitMps?: number;
  /** Width of the exit road. 14 m (the default) takes the two roads side by side; 7 m makes them share its width. */
  exitWidthM?: number;
}

/**
 * A northbound main road with a flyover over a signal junction, and a cross
 * road. The entry road (four lanes) divides at "diverge": its left two lanes
 * go on at ground level to the signal junction "cross", its right two rise
 * onto the flyover. Beyond the junction the two join side by side at "merge"
 * into the four-lane exit road.
 */
export function flyoverNetwork(options: FlyoverOptions = {}): Network {
  const { deckHeightM = 6, mainGreenS = 25, crossGreenS = 25, speedLimitMps = 13.9, exitWidthM = 14 } = options;
  const road = (id: string, points: Road["points"], widthM = 7): Road => ({
    id,
    points,
    widthM,
    lanes: Math.round(widthM / 3.5),
    speedLimitMps,
  });
  return {
    formatVersion: 4,
    roads: [
      road("south-entry", [{ x: -7, y: -400 }, { x: -7, y: -215 }], 14),
      road("south-in", [{ x: -10.5, y: -200 }, { x: -10.5, y: -20 }]),
      road("flyover", [
        { x: -3.5, y: -200 },
        { x: -3.5, y: -100, z: deckHeightM },
        { x: -3.5, y: 100, z: deckHeightM },
        { x: -3.5, y: 200 },
      ]),
      road("north-out", [{ x: -10.5, y: 20 }, { x: -10.5, y: 200 }]),
      road("north-exit", [{ x: -7, y: 215 }, { x: -7, y: 400 }], exitWidthM),
      road("west-in", [{ x: -220, y: 3.5 }, { x: -20, y: 3.5 }]),
      road("east-out", [{ x: 20, y: 3.5 }, { x: 220, y: 3.5 }]),
      road("east-in", [{ x: 220, y: -3.5 }, { x: 20, y: -3.5 }]),
      road("west-out", [{ x: -20, y: -3.5 }, { x: -220, y: -3.5 }]),
    ],
    junctions: [
      {
        id: "diverge",
        control: "none",
        connections: [
          { fromRoadId: "south-entry", toRoadId: "south-in" },
          { fromRoadId: "south-entry", toRoadId: "flyover" },
        ],
      },
      {
        id: "cross",
        control: "signal",
        connections: [
          { fromRoadId: "south-in", toRoadId: "north-out" },
          { fromRoadId: "south-in", toRoadId: "east-out" },
          { fromRoadId: "south-in", toRoadId: "west-out" },
          { fromRoadId: "west-in", toRoadId: "east-out" },
          { fromRoadId: "west-in", toRoadId: "north-out" },
          { fromRoadId: "east-in", toRoadId: "west-out" },
          { fromRoadId: "east-in", toRoadId: "north-out" },
        ],
        signalPlan: {
          phases: [
            { greenRoadIds: ["south-in"], greenS: mainGreenS },
            { greenRoadIds: ["west-in", "east-in"], greenS: crossGreenS },
          ],
          amberS: 3,
          allRedS: 2,
        },
      },
      {
        id: "merge",
        control: "none",
        connections: [
          { fromRoadId: "north-out", toRoadId: "north-exit" },
          { fromRoadId: "flyover", toRoadId: "north-exit" },
        ],
      },
    ],
  };
}

/**
 * The same network with a road before the entry road, "south-feed", joined to
 * it end to end at "feed". Traffic entering on it reaches the entry road in
 * whatever part of the width it happens to be, and has to sort itself for the
 * diverge on the 185 m of the entry road.
 */
export function flyoverNetworkWithFeed(options: FlyoverOptions = {}): Network {
  const network = flyoverNetwork(options);
  const entry = network.roads[0]!;
  return {
    ...network,
    roads: [{ ...entry, id: "south-feed", points: [{ x: -7, y: -700 }, { x: -7, y: -415 }] }, ...network.roads],
    junctions: [
      { id: "feed", control: "none", connections: [{ fromRoadId: "south-feed", toRoadId: "south-entry" }] },
      ...network.junctions!,
    ],
  };
}

/**
 * The same network with the exit road dividing again, 185 m after the merge,
 * into "exit-left" and "exit-right". Traffic off the flyover arrives on the
 * right of the exit road and traffic from the junction on its left, whichever
 * of the two exits each is bound for, so the exit road is a weaving section:
 * vehicles have to cross each other's paths to sort themselves for the split.
 */
export function flyoverNetworkWithSplitExit(options: FlyoverOptions = {}): Network {
  const network = flyoverNetwork(options);
  const lane = network.roads.find((road) => road.id === "north-out")!;
  return {
    ...network,
    roads: [
      ...network.roads,
      { ...lane, id: "exit-left", points: [{ x: -10.5, y: 415 }, { x: -10.5, y: 700 }] },
      { ...lane, id: "exit-right", points: [{ x: -3.5, y: 415 }, { x: -3.5, y: 700 }] },
    ],
    junctions: [
      ...network.junctions!,
      {
        id: "split",
        control: "none",
        connections: [
          { fromRoadId: "north-exit", toRoadId: "exit-left" },
          { fromRoadId: "north-exit", toRoadId: "exit-right" },
        ],
      },
    ],
  };
}

/** Demand for the network with a split exit: main-road traffic to each exit, and cross-road traffic turning north to each. */
export function weavingDemand(toEachExit: number, fromEachCrossRoad = 0): Demand {
  const flows = ["exit-left", "exit-right"].flatMap((exitRoadId) => [
    { entryRoadId: "south-entry", exitRoadId, vehiclesPerHour: toEachExit },
    { entryRoadId: "west-in", exitRoadId, vehiclesPerHour: fromEachCrossRoad / 2 },
    { entryRoadId: "east-in", exitRoadId, vehiclesPerHour: fromEachCrossRoad / 2 },
  ]);
  return { flows, vehicleMix: BENGALURU_VEHICLE_MIX };
}

/** Through traffic on the main road, traffic turning off it, and cross traffic, in vehicles per hour. */
export function flyoverDemand(through: number, turning = 0, cross = 0, mixed = true, entry = "south-entry"): Demand {
  const flows = [
    { entryRoadId: entry, exitRoadId: "north-exit", vehiclesPerHour: through },
    { entryRoadId: entry, exitRoadId: "east-out", vehiclesPerHour: turning / 2 },
    { entryRoadId: entry, exitRoadId: "west-out", vehiclesPerHour: turning / 2 },
    { entryRoadId: "west-in", exitRoadId: "east-out", vehiclesPerHour: cross / 2 },
    { entryRoadId: "east-in", exitRoadId: "west-out", vehiclesPerHour: cross / 2 },
  ];
  return mixed ? { flows, vehicleMix: BENGALURU_VEHICLE_MIX } : { flows };
}
