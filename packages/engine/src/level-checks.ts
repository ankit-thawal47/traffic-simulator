/**
 * The no-overlap check where one road passes over another, or over a junction.
 *
 * Vehicles on one road, and vehicles inside one junction, are compared by the
 * checks in consistency-checks.ts. Those never compare a vehicle on one road
 * with a vehicle on another, because roads that only meet at junctions cover
 * no common ground. A flyover does: on the plan it lies across the junction
 * beneath it. So here every place where a road's ground overlaps another
 * road's, or a junction's that it is not part of, is found once from the
 * network, and at each such place vehicles are compared across the two.
 * Two vehicles that overlap on the plan overlap unless they are on different
 * levels: their heights differ by SAME_LEVEL_WITHIN_M or more.
 *
 * It reads only the network and snapshots, like the other checks.
 */
import { positionAlongRoad } from "./geometry";
import { convexShapesOverlap, footprintInJunction, junctionOutline, type NetworkLayout } from "./junction-geometry";
import { roadHeightM, SAME_LEVEL_WITHIN_M, vehicleHeightM } from "./levels";
import type { Network, Point, Road, Snapshot, VehicleState } from "./types";

interface Footprint {
  vehicle: VehicleState;
  pieces: Point[][];
  heightM: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The ground a road covers, one four-sided piece for each stretch between two of its points. */
function roadPieces(road: Road): Point[][] {
  const pieces: Point[][] = [];
  const half = road.widthM / 2;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!;
    const b = road.points[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const nx = (-(b.y - a.y) / length) * half;
    const ny = ((b.x - a.x) / length) * half;
    pieces.push([
      { x: a.x + nx, y: a.y + ny },
      { x: b.x + nx, y: b.y + ny },
      { x: b.x - nx, y: b.y - ny },
      { x: a.x - nx, y: a.y - ny },
    ]);
  }
  return pieces;
}

function anyOverlap(a: Point[][], b: Point[][]): boolean {
  return a.some((piece) => b.some((other) => convexShapesOverlap(piece, other)));
}

function withBounds(vehicle: VehicleState, pieces: Point[][], heightM: number): Footprint {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const piece of pieces) {
    for (const point of piece) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }
  return { vehicle, pieces, heightM, minX, minY, maxX, maxY };
}

export interface LevelCheck {
  /** Every overlap, at one moment, between vehicles on two roads, or on a road and in a junction, that cover common ground. */
  overlaps(snapshot: Snapshot): string[];
}

export function createLevelCheck(network: Network, layout: NetworkLayout): LevelCheck {
  const ground = new Map(network.roads.map((road) => [road.id, roadPieces(road)]));
  const roadPairs: [string, string][] = [];
  for (let i = 0; i < network.roads.length; i++) {
    for (let j = i + 1; j < network.roads.length; j++) {
      const a = network.roads[i]!.id;
      const b = network.roads[j]!.id;
      if (anyOverlap(ground.get(a)!, ground.get(b)!)) roadPairs.push([a, b]);
    }
  }
  const junctionPairs: [string, string][] = [];
  for (const junction of network.junctions ?? []) {
    const own = new Set(junction.connections.flatMap((connection) => [connection.fromRoadId, connection.toRoadId]));
    const outline = junctionOutline(network, junction);
    if (outline.length < 3) continue;
    for (const road of network.roads) {
      if (!own.has(road.id) && anyOverlap([outline], ground.get(road.id)!)) junctionPairs.push([junction.id, road.id]);
    }
  }
  const roadsToWatch = new Set([...roadPairs.flat(), ...junctionPairs.map(([, roadId]) => roadId)]);
  const junctionsToWatch = new Set(junctionPairs.map(([junctionId]) => junctionId));

  /** The part of a vehicle that is on its road itself (not in a junction), as a rectangle. */
  function onRoad(vehicle: VehicleState): Footprint | undefined {
    const road = layout.roads.get(vehicle.roadId);
    if (!road) return undefined;
    const frontM = Math.min(vehicle.positionM, road.lengthM);
    const rearM = Math.max(vehicle.positionM - vehicle.lengthM, 0);
    if (frontM <= rearM) return undefined;
    const at = positionAlongRoad(road.road, (frontM + rearM) / 2);
    const across = vehicle.lateralM - road.road.widthM / 2;
    // To the right of the direction of travel.
    const rx = at.direction.y;
    const ry = -at.direction.x;
    const cx = at.point.x + rx * across;
    const cy = at.point.y + ry * across;
    const fx = (at.direction.x * (frontM - rearM)) / 2;
    const fy = (at.direction.y * (frontM - rearM)) / 2;
    const sx = (rx * vehicle.widthM) / 2;
    const sy = (ry * vehicle.widthM) / 2;
    const piece = [
      { x: cx + fx - sx, y: cy + fy - sy },
      { x: cx + fx + sx, y: cy + fy + sy },
      { x: cx - fx + sx, y: cy - fy + sy },
      { x: cx - fx - sx, y: cy - fy - sy },
    ];
    return withBounds(vehicle, [piece], roadHeightM(road.road, (frontM + rearM) / 2));
  }

  function overlaps(snapshot: Snapshot): string[] {
    if (roadsToWatch.size === 0) return [];
    const byRoad = new Map<string, Footprint[]>();
    const byJunction = new Map<string, Footprint[]>();
    for (const vehicle of snapshot.vehicles) {
      if (roadsToWatch.has(vehicle.roadId)) {
        const footprint = onRoad(vehicle);
        if (footprint) {
          const list = byRoad.get(vehicle.roadId);
          if (list) list.push(footprint);
          else byRoad.set(vehicle.roadId, [footprint]);
        }
      }
      if (vehicle.turn && junctionsToWatch.has(vehicle.turn.junctionId)) {
        const pieces = footprintInJunction(layout, vehicle);
        if (pieces.length > 0) {
          const footprint = withBounds(vehicle, pieces, vehicleHeightM(layout, vehicle));
          const list = byJunction.get(vehicle.turn.junctionId);
          if (list) list.push(footprint);
          else byJunction.set(vehicle.turn.junctionId, [footprint]);
        }
      }
    }
    const found: string[] = [];
    const compare = (these: Footprint[] | undefined, those: Footprint[] | undefined, where: string) => {
      if (!these || !those) return;
      for (const a of these) {
        for (const b of those) {
          if (a.vehicle.id === b.vehicle.id) continue;
          if (a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY) continue;
          // On different levels: one passes over the other.
          if (Math.abs(a.heightM - b.heightM) >= SAME_LEVEL_WITHIN_M) continue;
          if (anyOverlap(a.pieces, b.pieces)) found.push(`Vehicles ${a.vehicle.id} and ${b.vehicle.id} overlap where ${where}`);
        }
      }
    };
    for (const [a, b] of roadPairs) compare(byRoad.get(a), byRoad.get(b), `road "${a}" crosses road "${b}"`);
    for (const [junctionId, roadId] of junctionPairs) {
      compare(byRoad.get(roadId), byJunction.get(junctionId), `road "${roadId}" crosses junction "${junctionId}"`);
    }
    return found;
  }

  return { overlaps };
}
