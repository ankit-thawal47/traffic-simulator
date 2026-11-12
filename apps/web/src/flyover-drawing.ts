import { isRaised, junctionOutline, positionAlongRoad, roadHeightM, roadLengthM, type Network, type Point, type Road } from "@traffic-simulator/engine";
import * as THREE from "three";

/** A raised road is cut into pieces of about this length, so a ramp is drawn as a slope. */
const PIECE_M = 10;
/** Where the road is lower than this, what is under it is filled in (the foot of a ramp); higher, it is a deck on pillars. */
const FILLED_BELOW_M = 3;
const DECK_THICKNESS_M = 0.9;
const GROUND_THICKNESS_M = 0.2;
const PARAPET_HEIGHT_M = 0.9;
const PARAPET_WIDTH_M = 0.3;
const PILLAR_EVERY_M = 30;
const PILLAR_SIZE_M = 1.6;
const CROSSHEAD_DEPTH_M = 1.1;
const CROSSHEAD_ALONG_M = 1.8;

export interface FlyoverDrawing {
  /** What to add to the scene: every raised road as a ramp, a deck with parapets, and pillars. */
  objects: THREE.Object3D[];
  /** How many roads were drawn raised, and how many pillars; written to the page so it can be checked from outside. */
  summary: string;
  dispose(): void;
}

/** Whether a road is drawn here (raised) and not as a flat road on the ground. */
export function isDrawnRaised(road: Road): boolean {
  return isRaised(road);
}

function insideOutline(point: Point, outline: Point[]): boolean {
  if (outline.length < 3) return false;
  // The outline goes round anticlockwise: inside is to the left of every edge.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    if ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) < 0) return false;
  }
  return true;
}

/**
 * The drawing of a network's raised roads (flyovers): real raised geometry
 * (ADR 0007). Ground coordinates (x east, y north) and height map to the scene
 * as (x, height, -y), as in RoadScene. Heights come from the network through
 * the engine's roadHeightM(), which also places the vehicles, so the deck is
 * drawn exactly where the vehicles on it are.
 */
export function createFlyoverDrawing(network: Network, surface: THREE.Material): FlyoverDrawing {
  const objects: THREE.Object3D[] = [];
  const disposable: { dispose(): void }[] = [];
  const concrete = new THREE.MeshLambertMaterial({ color: 0xc6c2b8, side: THREE.DoubleSide });
  const surfaceBothSides = surface.clone();
  surfaceBothSides.side = THREE.DoubleSide;
  disposable.push(concrete, surfaceBothSides);
  const outlines = (network.junctions ?? []).map((junction) => junctionOutline(network, junction));

  let raisedRoads = 0;
  let pillars = 0;
  const structure: number[] = [];
  const top: number[] = [];
  /** A four-sided face, as two triangles; corners in scene coordinates. */
  const face = (into: number[], a: number[], b: number[], c: number[], d: number[]) => into.push(...a, ...b, ...c, ...a, ...c, ...d);

  for (const road of network.roads) {
    if (!isDrawnRaised(road)) continue;
    raisedRoads++;
    const lengthM = roadLengthM(road);
    const pieces = Math.max(1, Math.ceil(lengthM / PIECE_M));
    const half = road.widthM / 2;
    /** The scene corners across the road at a distance along it: left and right, on top and underneath. */
    const across = (distanceM: number) => {
      const { point, direction } = positionAlongRoad(road, distanceM);
      const heightM = roadHeightM(road, distanceM);
      const underM = heightM < FILLED_BELOW_M ? -GROUND_THICKNESS_M : heightM - DECK_THICKNESS_M;
      const lx = point.x - direction.y * half;
      const ly = point.y + direction.x * half;
      const rx = point.x + direction.y * half;
      const ry = point.y - direction.x * half;
      return {
        point,
        direction,
        heightM,
        leftTop: [lx, heightM, -ly],
        rightTop: [rx, heightM, -ry],
        leftUnder: [lx, underM, -ly],
        rightUnder: [rx, underM, -ry],
      };
    };
    let before = across(0);
    for (let i = 1; i <= pieces; i++) {
      const after = across((lengthM * i) / pieces);
      // The surface vehicles drive on, a hair above the structure so the two do not flicker.
      const lift = (corner: number[]) => [corner[0]!, corner[1]! + 0.02, corner[2]!];
      face(top, lift(before.leftTop), lift(before.rightTop), lift(after.rightTop), lift(after.leftTop));
      face(structure, before.leftTop, before.rightTop, after.rightTop, after.leftTop);
      face(structure, before.leftUnder, before.rightUnder, after.rightUnder, after.leftUnder);
      face(structure, before.leftTop, after.leftTop, after.leftUnder, before.leftUnder);
      face(structure, before.rightTop, after.rightTop, after.rightUnder, before.rightUnder);
      face(structure, before.leftTop, before.rightTop, before.rightUnder, before.leftUnder);
      face(structure, after.leftTop, after.rightTop, after.rightUnder, after.leftUnder);

      // Parapets along both edges, wherever the road is off the ground.
      if (Math.max(before.heightM, after.heightM) > 0.3) {
        for (const side of [-1, 1]) {
          const out = (at: typeof before, extraM: number, upM: number) => [
            at.point.x + side * at.direction.y * (half + extraM),
            at.heightM + upM,
            -(at.point.y - side * at.direction.x * (half + extraM)),
          ];
          face(structure, out(before, 0, 0), out(after, 0, 0), out(after, 0, PARAPET_HEIGHT_M), out(before, 0, PARAPET_HEIGHT_M));
          face(
            structure,
            out(before, PARAPET_WIDTH_M, 0),
            out(after, PARAPET_WIDTH_M, 0),
            out(after, PARAPET_WIDTH_M, PARAPET_HEIGHT_M),
            out(before, PARAPET_WIDTH_M, PARAPET_HEIGHT_M),
          );
          face(
            structure,
            out(before, 0, PARAPET_HEIGHT_M),
            out(after, 0, PARAPET_HEIGHT_M),
            out(after, PARAPET_WIDTH_M, PARAPET_HEIGHT_M),
            out(before, PARAPET_WIDTH_M, PARAPET_HEIGHT_M),
          );
        }
      }
      before = after;
    }

    // Pillars under the deck, but not standing in a junction beneath it.
    for (let distanceM = PILLAR_EVERY_M / 2; distanceM < lengthM; distanceM += PILLAR_EVERY_M) {
      const heightM = roadHeightM(road, distanceM);
      if (heightM < FILLED_BELOW_M) continue;
      const { point, direction } = positionAlongRoad(road, distanceM);
      if (outlines.some((outline) => insideOutline(point, outline))) continue;
      // A round pier, and on it a crosshead as wide as most of the deck, which the deck rests on.
      const underM = heightM - DECK_THICKNESS_M;
      const pierM = underM - CROSSHEAD_DEPTH_M;
      const geometry = new THREE.CylinderGeometry(PILLAR_SIZE_M / 2, PILLAR_SIZE_M / 2 + 0.1, pierM, 12);
      const pillar = new THREE.Mesh(geometry, concrete);
      pillar.position.set(point.x, pierM / 2, -point.y);
      const crossheadGeometry = new THREE.BoxGeometry(CROSSHEAD_ALONG_M, CROSSHEAD_DEPTH_M, road.widthM * 0.8);
      const crosshead = new THREE.Mesh(crossheadGeometry, concrete);
      crosshead.position.set(point.x, pierM + CROSSHEAD_DEPTH_M / 2, -point.y);
      crosshead.rotation.y = Math.atan2(direction.y, direction.x);
      pillar.name = `pillar:${road.id}`;
      objects.push(pillar, crosshead);
      disposable.push(geometry, crossheadGeometry);
      pillars++;
    }
  }

  for (const [positions, material] of [
    [structure, concrete],
    [top, surfaceBothSides],
  ] as const) {
    if (positions.length === 0) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    objects.push(new THREE.Mesh(geometry, material));
    disposable.push(geometry);
  }

  return {
    objects,
    summary: `${raisedRoads} raised roads, ${pillars} pillars`,
    dispose() {
      for (const item of disposable) item.dispose();
    },
  };
}
