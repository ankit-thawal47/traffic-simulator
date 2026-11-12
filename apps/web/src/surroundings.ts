/**
 * A few simple buildings and trees along a real corridor's roads, placed in
 * code (no map data, no models): they give a sense of place and of scale, and
 * are not a survey of what stands there. Shown for a prepared corridor only.
 * Placement is fixed by the network alone, so both views and every visit show
 * the same.
 */
import { positionAlongRoad, roadLengthM, type Network, type Point } from "@traffic-simulator/engine";

export interface Building extends Point {
  widthM: number;
  depthM: number;
  heightM: number;
  /** The turn of its front from east, about the up axis, in radians (as a road's direction). */
  angleRad: number;
  /** Which of a few wall colours it is painted (0 to 3). */
  shade: number;
}

export interface Tree extends Point {
  heightM: number;
  /** The radius of its crown. */
  crownM: number;
}

export interface Surroundings {
  buildings: Building[];
  trees: Tree[];
}

/** The distance from a point on the ground to the nearest edge of any road (negative: on the road). */
export function distanceToNearestRoadM(network: Network, point: Point): number {
  let nearest = Infinity;
  for (const road of network.roads) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]!;
      const b = road.points[i]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
      const distance = Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t)) - road.widthM / 2;
      if (distance < nearest) nearest = distance;
    }
  }
  return nearest;
}

/** A small seeded random number generator (mulberry32), so placement is the same every time. */
function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STEP_M = 28;
const MAX_BUILDINGS = 300;
const MAX_TREES = 600;

/** Buildings set back from the roads, trees between them and the kerb. */
export function surroundings(network: Network): Surroundings {
  const random = randomFrom(20261112);
  const buildings: Building[] = [];
  const trees: Tree[] = [];
  const clearOfBuildings = (point: Point, reachM: number) =>
    buildings.every((other) => Math.hypot(other.x - point.x, other.y - point.y) > reachM + Math.hypot(other.widthM, other.depthM) / 2 + 3);

  for (const road of network.roads) {
    const lengthM = roadLengthM(road);
    for (let alongM = STEP_M / 2; alongM < lengthM; alongM += STEP_M) {
      const { point, direction } = positionAlongRoad(road, alongM);
      for (const side of [-1, 1]) {
        const left = { x: -direction.y * side, y: direction.x * side };
        // A tree, a few metres off the edge of the road.
        if (trees.length < MAX_TREES && random() < 0.75) {
          const crownM = 2 + random() * 1.8;
          const outM = road.widthM / 2 + 3 + crownM + random() * 4;
          const along = (random() - 0.5) * STEP_M * 0.6;
          const tree = {
            x: point.x + left.x * outM + direction.x * along,
            y: point.y + left.y * outM + direction.y * along,
            heightM: 6 + random() * 6,
            crownM,
          };
          if (distanceToNearestRoadM(network, tree) - crownM > 1.5) trees.push(tree);
        }
        // A building, set back behind the trees.
        if (buildings.length < MAX_BUILDINGS && random() < 0.45) {
          const widthM = 10 + random() * 16;
          const depthM = 10 + random() * 14;
          const reachM = Math.hypot(widthM, depthM) / 2;
          const outM = road.widthM / 2 + 22 + reachM + random() * 30;
          const building = {
            x: point.x + left.x * outM,
            y: point.y + left.y * outM,
            widthM,
            depthM,
            // Mostly two to five storeys, now and then a taller block.
            heightM: random() < 0.12 ? 22 + random() * 18 : 6 + random() * 12,
            angleRad: Math.atan2(direction.y, direction.x),
            shade: Math.floor(random() * 4),
          };
          if (distanceToNearestRoadM(network, building) - reachM > 8 && clearOfBuildings(building, reachM)) buildings.push(building);
        }
      }
    }
  }
  // A tree is not left standing inside a building.
  const clearTrees = trees.filter((tree) =>
    buildings.every((building) => Math.hypot(building.x - tree.x, building.y - tree.y) > Math.hypot(building.widthM, building.depthM) / 2 + tree.crownM),
  );
  return { buildings, trees: clearTrees };
}
