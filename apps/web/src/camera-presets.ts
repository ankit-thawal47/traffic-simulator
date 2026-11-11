import type { Network } from "@traffic-simulator/engine";
import type { CameraPose } from "./shared-camera";

/**
 * Camera presets (ADR 0007): places the camera can be sent to. After a preset
 * the camera is still free to orbit, pan and zoom.
 *
 * Ground coordinates (x east, y north) map to the scene as (x, up, -y).
 */
export interface SceneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function networkBounds(network: Network): SceneBounds {
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const road of network.roads) {
    for (const point of road.points) {
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      // `0 -` and not a plain minus, so that a point at y = 0 gives 0 and not -0.
      bounds.minZ = Math.min(bounds.minZ, 0 - point.y);
      bounds.maxZ = Math.max(bounds.maxZ, 0 - point.y);
    }
  }
  return bounds;
}

function centreOf(bounds: SceneBounds): [number, number, number] {
  return [(bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2];
}

/** Room left around the network in the straight-down view, as a share of its size. */
const MARGIN = 1.15;
const LOWEST_STRAIGHT_DOWN_M = 30;

/**
 * Straight down on the whole network, with north at the top, so that gaps and
 * queues are seen without perspective hiding them. `aspect` is the view's
 * width divided by its height; `fovDegrees` is the camera's vertical field of view.
 */
export function straightDownPose(bounds: SceneBounds, view: { fovDegrees: number; aspect: number }): CameraPose {
  const target = centreOf(bounds);
  const tanHalfFov = Math.tan((view.fovDegrees * Math.PI) / 360);
  const halfWidthM = (bounds.maxX - bounds.minX) / 2;
  const halfDepthM = (bounds.maxZ - bounds.minZ) / 2;
  const heightM = Math.max(
    (halfWidthM * MARGIN) / (tanHalfFov * view.aspect),
    (halfDepthM * MARGIN) / tanHalfFov,
    LOWEST_STRAIGHT_DOWN_M,
  );
  return { position: [target[0], heightM, target[2]], target };
}

/** The angled view from the south that the views start with. */
export function angledPose(bounds: SceneBounds): CameraPose {
  const target = centreOf(bounds);
  const extentM = Math.max(Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ), 50);
  return { position: [target[0] - extentM * 0.1, extentM * 0.3, target[2] + extentM * 0.65], target };
}
