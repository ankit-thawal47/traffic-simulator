import { describe, expect, it } from "vitest";
import { createRun, type Results, type Snapshot, type VehicleState } from "../src/index";
import { createConsistencyChecker } from "../src/consistency-checks";
import { fourWay } from "./four-way";

/**
 * The junction of fourWay(): stop lines 15 m from the centre, approaches 200 m
 * long and 7 m wide. "south-in" runs north along x = -7 to 0; "west-in" runs
 * east along y = 0 to 7.
 */
const network = fourWay();
const emptyResults = createRun({ network, demand: { flows: [] }, seed: 1 }).results();

/** A car whose front bumper is `alongM` past the stop line of `from`, on its way to `to`, `lateralM` from the left edge. */
function carInJunction(id: number, from: string, to: string, alongM: number, lateralM = 2.25): VehicleState {
  return {
    id,
    vehicleClass: "car",
    roadId: from,
    positionM: 200 + alongM,
    lateralM,
    speedMps: 5,
    lengthM: 4.4,
    widthM: 1.9,
    turn: { junctionId: "cross", fromRoadId: from, toRoadId: to, fromLateralM: lateralM, toLateralM: lateralM },
  };
}

/** A car whose front bumper is `positionM` along the road it has turned onto, with its rear still in the junction. */
function carLeavingJunction(id: number, from: string, to: string, positionM: number, lateralM = 2.25): VehicleState {
  return { ...carInJunction(id, from, to, 0, lateralM), roadId: to, positionM };
}

function frame(vehicles: VehicleState[]): [Snapshot, Results] {
  return [
    { timeS: 0, vehicles },
    { ...emptyResults, vehiclesEntered: vehicles.length, vehiclesOnNetwork: vehicles.length },
  ];
}

function checksFailedBy(vehicles: VehicleState[]): string[] {
  const checker = createConsistencyChecker(network);
  checker.observe(...frame(vehicles));
  return [...new Set(checker.violations.map((violation) => violation.check))];
}

describe("consistency checks inside a junction, on hand-made frames", () => {
  it("accept two vehicles on crossing paths that are apart", () => {
    // One 10 m into the junction from the south, one 3 m in from the west.
    expect(checksFailedBy([carInJunction(1, "south-in", "north-out", 10), carInJunction(2, "west-in", "east-out", 3)])).toEqual([]);
  });

  it("report two vehicles on crossing paths that overlap where the paths cross", () => {
    // From the south: x from -5.7 to -3.8, y from 2.6 to 7. From the west: x from -7.4 to -3, y from 3.8 to 5.7.
    expect(checksFailedBy([carInJunction(1, "south-in", "north-out", 22), carInJunction(2, "west-in", "east-out", 12)])).toEqual([
      "no-overlap",
    ]);
  });

  it("report a turning vehicle that overlaps one going straight on", () => {
    // The right turn from the south sweeps across the path of traffic from the north.
    const turning = carInJunction(1, "south-in", "east-out", 14, 4.75);
    const oncoming = carInJunction(2, "north-in", "south-out", 20, 4.75);
    expect(checksFailedBy([turning, oncoming])).toEqual(["no-overlap"]);
    expect(checksFailedBy([turning, carInJunction(2, "north-in", "south-out", 5, 4.75)])).toEqual([]);
  });

  it("report one vehicle run into the back of another on the same turning path, and accept them side by side", () => {
    expect(checksFailedBy([carInJunction(1, "south-in", "west-out", 12), carInJunction(2, "south-in", "west-out", 9)])).toEqual([
      "no-overlap",
    ]);
    expect(
      checksFailedBy([carInJunction(1, "south-in", "west-out", 12, 1.25), carInJunction(2, "south-in", "west-out", 12, 4.25)]),
    ).toEqual([]);
  });

  it("accept two vehicles from one approach that have gone different ways, though both are the same distance in", () => {
    // Side by side at the stop line, one turns left and one right: 12 m in they are far apart.
    expect(
      checksFailedBy([carInJunction(1, "south-in", "west-out", 12, 1.25), carInJunction(2, "south-in", "east-out", 12, 1.25)]),
    ).toEqual([]);
  });

  it("report a vehicle half across the stop line that overlaps the vehicle behind it on the approach", () => {
    const behind: VehicleState = { ...carInJunction(2, "south-in", "north-out", 0), positionM: 199, turn: undefined };
    expect(checksFailedBy([carInJunction(1, "south-in", "north-out", 2), behind])).toEqual(["no-overlap"]);
  });

  it("accept a vehicle with its front on the next road and its rear still in the junction, and check it against that road", () => {
    const leaving = carLeavingJunction(1, "south-in", "north-out", 2);
    expect(checksFailedBy([leaving])).toEqual([]);
    const ahead: VehicleState = { ...leaving, id: 2, positionM: 5, turn: undefined };
    expect(checksFailedBy([leaving, ahead])).toEqual(["no-overlap"]);
  });

  it("report a vehicle beyond the end of its road that is not on a turning path", () => {
    const stray: VehicleState = { ...carInJunction(1, "south-in", "north-out", 5), turn: undefined };
    expect(checksFailedBy([stray])).toEqual(["inside-road"]);
    const behindTheStart: VehicleState = { ...carLeavingJunction(1, "south-in", "north-out", 2), turn: undefined };
    expect(checksFailedBy([behindTheStart])).toEqual(["inside-road"]);
  });

  it("report a vehicle on a turning path the network does not have, or beyond the end of its turning path", () => {
    expect(checksFailedBy([carInJunction(1, "south-in", "south-out", 5)])).toEqual(["inside-road"]);
    // Straight on is 30 m from stop line to the next road.
    expect(checksFailedBy([carInJunction(1, "south-in", "north-out", 31)])).toEqual(["inside-road"]);
    expect(checksFailedBy([carLeavingJunction(1, "south-in", "north-out", 2), carInJunction(2, "west-in", "north-out", 5)])).toEqual(
      [],
    );
    const wrongRoad: VehicleState = { ...carInJunction(1, "south-in", "north-out", 5), roadId: "west-in" };
    expect(checksFailedBy([wrongRoad])).toEqual(["inside-road"]);
  });
});
