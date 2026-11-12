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

/** Through traffic on the main road, traffic turning off it, and cross traffic, in vehicles per hour. */
export function flyoverDemand(through: number, turning = 0, cross = 0, mixed = true): Demand {
  const flows = [
    { entryRoadId: "south-entry", exitRoadId: "north-exit", vehiclesPerHour: through },
    { entryRoadId: "south-entry", exitRoadId: "east-out", vehiclesPerHour: turning / 2 },
    { entryRoadId: "south-entry", exitRoadId: "west-out", vehiclesPerHour: turning / 2 },
    { entryRoadId: "west-in", exitRoadId: "east-out", vehiclesPerHour: cross / 2 },
    { entryRoadId: "east-in", exitRoadId: "west-out", vehiclesPerHour: cross / 2 },
  ];
  return mixed ? { flows, vehicleMix: BENGALURU_VEHICLE_MIX } : { flows };
}
