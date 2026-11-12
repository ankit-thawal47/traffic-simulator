import type { Network } from "@traffic-simulator/engine";
import flyover from "@traffic-simulator/engine/examples/flyover.json";
import signalJunction from "@traffic-simulator/engine/examples/signal-junction.json";
import { describe, expect, it } from "vitest";
import { angledPose, closeUpPose, networkBounds, straightDownPose } from "./camera-presets";

/** One road 400 m long from west to east, and a side road running 100 m north from its middle. */
const network: Network = {
  formatVersion: 1,
  roads: [
    {
      id: "main",
      points: [
        { x: -200, y: 0 },
        { x: 200, y: 0 },
      ],
      widthM: 7,
      speedLimitMps: 13.9,
    },
    {
      id: "side",
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
      ],
      widthM: 7,
      speedLimitMps: 13.9,
    },
  ],
};

const FOV_DEGREES = 45;
/** tan of half of 45 degrees. */
const TAN_HALF_FOV = 0.41421356;

describe("the bounds of a network, in the scene's coordinates", () => {
  it("covers every road; north on the ground is negative z in the scene", () => {
    expect(networkBounds(network)).toEqual({ minX: -200, maxX: 200, minZ: -100, maxZ: 0 });
  });
});

describe("the straight-down camera preset", () => {
  it("looks at the middle of the network from directly above it", () => {
    const pose = straightDownPose(networkBounds(network), { fovDegrees: FOV_DEGREES, aspect: 1 });

    expect(pose.target).toEqual([0, 0, -50]);
    expect(pose.position[0]).toBe(0);
    expect(pose.position[2]).toBe(-50);
    expect(pose.position[1]).toBeGreaterThan(0);
  });

  it("is high enough to show the whole network, without leaving it small in the view", () => {
    // In a square view the 400 m length decides: half of it, 200 m, must fit in half the view.
    const square = straightDownPose(networkBounds(network), { fovDegrees: FOV_DEGREES, aspect: 1 });
    const neededM = 200 / TAN_HALF_FOV;
    expect(square.position[1]).toBeGreaterThanOrEqual(neededM);
    expect(square.position[1]).toBeLessThan(neededM * 1.3);

    // A view twice as wide as it is tall shows the length from half the height.
    const wide = straightDownPose(networkBounds(network), { fovDegrees: FOV_DEGREES, aspect: 2 });
    expect(wide.position[1]).toBeCloseTo(square.position[1] / 2, 6);

    // In a tall, narrow view the camera must go higher to keep the length in.
    const narrow = straightDownPose(networkBounds(network), { fovDegrees: FOV_DEGREES, aspect: 0.5 });
    expect(narrow.position[1]).toBeCloseTo(square.position[1] * 2, 6);
  });

  it("in a very wide view, the network's depth from north to south decides the height", () => {
    const pose = straightDownPose(networkBounds(network), { fovDegrees: FOV_DEGREES, aspect: 10 });
    const neededM = 50 / TAN_HALF_FOV;

    expect(pose.position[1]).toBeGreaterThanOrEqual(neededM);
    expect(pose.position[1]).toBeLessThan(neededM * 1.3);
  });

  it("does not sit on top of a very small network", () => {
    const tiny = { minX: 0, maxX: 2, minZ: 0, maxZ: 0 };

    expect(straightDownPose(tiny, { fovDegrees: FOV_DEGREES, aspect: 1 }).position[1]).toBeGreaterThanOrEqual(30);
  });
});

describe("the angled camera the views start with", () => {
  it("looks at the middle of the network from above the ground and to the south", () => {
    const pose = angledPose(networkBounds(network));

    expect(pose.target).toEqual([0, 0, -50]);
    expect(pose.position[1]).toBeGreaterThan(0);
    // South on the ground is positive z in the scene.
    expect(pose.position[2]).toBeGreaterThan(pose.target[2]);
    // Angled, not straight down: further away along the ground than it is high.
    const alongGroundM = Math.hypot(pose.position[0] - pose.target[0], pose.position[2] - pose.target[2]);
    expect(alongGroundM).toBeGreaterThan(pose.position[1]);
  });
});

describe("the close-up camera the views open with", () => {
  it("looks at the first road 50 m from where traffic enters it, from its right-hand side and above", () => {
    const pose = closeUpPose(network);

    // The main road runs east from x = -200 to 200; its right-hand side is the south, positive z in the scene.
    // Vehicles reach a point 50 m along within a few seconds of the start, so the opening view is not of an empty road.
    expect(pose.target).toEqual([-150, 0, 0]);
    expect(pose.position[1]).toBeGreaterThan(10);
    expect(pose.position[2]).toBeGreaterThan(20);
  });

  it("is close enough to tell vehicles apart by size: a 4 m car is over a tenth of the view's height", () => {
    const pose = closeUpPose(network);
    const distanceM = Math.hypot(
      pose.position[0] - pose.target[0],
      pose.position[1] - pose.target[1],
      pose.position[2] - pose.target[2],
    );

    // What the view shows from top to bottom at the road, in metres.
    const shownM = 2 * distanceM * TAN_HALF_FOV;
    expect(shownM).toBeLessThan(40);
    // And not so close that only a vehicle or two fits.
    expect(shownM).toBeGreaterThan(20);
  });

  it("follows the road's direction: for a road running north it stands to the east", () => {
    const north: Network = { formatVersion: 1, roads: [network.roads[1]!] };
    const pose = closeUpPose(north);

    // The side road runs north from (0, 0) to (0, 100): 50 m along is 50 m north, which is z = -50.
    expect(pose.target).toEqual([0, 0, -50]);
    expect(pose.position[0]).toBeGreaterThan(20);
  });

  it("looks at the middle of a road shorter than 100 m", () => {
    const short: Network = {
      formatVersion: 1,
      roads: [{ id: "short", points: [{ x: 0, y: 0 }, { x: 60, y: 0 }], widthM: 7, speedLimitMps: 13.9 }],
    };

    expect(closeUpPose(short).target).toEqual([30, 0, 0]);
  });

  it("looks at the middle of the first junction when the network has one, from the south and above, with the whole junction in view", () => {
    const pose = closeUpPose(signalJunction.network as Network);

    // The example's junction is centred on the origin; its stop lines are 15 m out.
    expect(pose.target).toEqual([0, 0, 0]);
    expect(pose.position[1]).toBeGreaterThan(20);
    expect(pose.position[2]).toBeGreaterThan(20);
    const distanceM = Math.hypot(...pose.position);
    const shownM = 2 * distanceM * TAN_HALF_FOV;
    // All four stop lines, 30 m apart, and some of each queue.
    expect(shownM).toBeGreaterThan(45);
    expect(shownM).toBeLessThan(90);
  });

  it("stands a little further back for a network with a flyover: it looks at the signal junction beneath, with the deck over it in view", () => {
    const pose = closeUpPose(flyover.network as Network);

    // The junction beneath the flyover is centred on the origin; the first junction in the list is a diverge 200 m south.
    expect(pose.target).toEqual([0, 0, 0]);
    const distanceM = Math.hypot(...pose.position);
    // The junction (30 m across), the deck over it and its first pillars either side are in view (ticket 21:
    // the opening view frames the action, not the whole network)...
    expect(2 * distanceM * TAN_HALF_FOV).toBeGreaterThan(70);
    // ...and near enough that a 4 m car is over 4% of the view's height (it was under 3%, which read as specks).
    expect(2 * distanceM * TAN_HALF_FOV).toBeLessThan(90);
    // From the side and above, so that the deck is seen to be raised.
    expect(pose.position[0]).toBeGreaterThan(60);
    expect(pose.position[1]).toBeGreaterThan(40);
  });
});
