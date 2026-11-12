import {
  approachRoadIds,
  positionAlongRoad,
  roadLengthM,
  signalState,
  type Network,
  type SignalJunction,
  type SignalState,
} from "@traffic-simulator/engine";
import * as THREE from "three";
import { junctionSurface } from "./road-drawing";

/** The colour each signal state is drawn in. */
export const SIGNAL_COLOURS: Record<SignalState, string> = {
  green: "#2fa84f",
  amber: "#e5a50a",
  red: "#d43a2f",
};

const STOP_LINE_DEPTH_M = 0.6;
const LAMP_HEIGHT_M = 5;
const LAMP_SIZE_M = 1.2;

export interface JunctionDrawing {
  /** What to add to the scene: the junctions' surfaces, and for each approach a stop line and a signal lamp. */
  objects: THREE.Object3D[];
  /**
   * Colour every stop line and lamp for a moment of the run. Gives what was
   * shown as text ("north-in:green east-in:red"), so it can be checked from outside.
   */
  showSignals(timeS: number): string;
  dispose(): void;
}

const MARKING_COLOUR = 0xf2f2ee;
const DASH_M = 0.6;
const TRIANGLE_LENGTH_M = 3.5;
const TRIANGLE_WIDTH_M = 1.6;
const TRIANGLE_BACK_M = 4;

/**
 * The give-way marking on a side road of a priority junction, named
 * "give-way:<road id>": a broken line across the road at its end, and a
 * triangle painted on the road just before it, pointing at the oncoming driver.
 */
function giveWayMarking(road: Network["roads"][number]): { group: THREE.Group; disposable: { dispose(): void }[] } {
  const group = new THREE.Group();
  group.name = `give-way:${road.id}`;
  const material = new THREE.MeshBasicMaterial({ color: MARKING_COLOUR });
  const disposable: { dispose(): void }[] = [material];
  const { point, direction } = positionAlongRoad(road, roadLengthM(road));
  // In the group's own frame x runs along the road (direction of travel) and z across it, positive to the right.
  group.position.set(point.x, 0.03, -point.y);
  group.rotation.y = Math.atan2(direction.y, direction.x);

  const dash = new THREE.BoxGeometry(STOP_LINE_DEPTH_M, 0.05, DASH_M);
  disposable.push(dash);
  for (let acrossM = -road.widthM / 2 + DASH_M / 2; acrossM <= road.widthM / 2 - DASH_M / 2 + 1e-9; acrossM += 2 * DASH_M) {
    const mesh = new THREE.Mesh(dash, material);
    mesh.position.set(-STOP_LINE_DEPTH_M, 0, acrossM);
    group.add(mesh);
  }

  // The triangle: its point towards the driver, its base towards the line.
  const shape = new THREE.Shape([
    new THREE.Vector2(-TRIANGLE_BACK_M - TRIANGLE_LENGTH_M, 0),
    new THREE.Vector2(-TRIANGLE_BACK_M, TRIANGLE_WIDTH_M / 2),
    new THREE.Vector2(-TRIANGLE_BACK_M, -TRIANGLE_WIDTH_M / 2),
  ]);
  const triangle = new THREE.ShapeGeometry(shape);
  // From the x-y plane of the shape to the ground of the group (y up).
  triangle.rotateX(-Math.PI / 2);
  disposable.push(triangle);
  for (const lane of road.lanes && road.lanes > 1 ? Array.from({ length: road.lanes }, (_, i) => i) : [0]) {
    const lanes = road.lanes ?? 1;
    const mesh = new THREE.Mesh(triangle, material);
    // Lane centres, from the left edge (negative z in the group's frame) to the right.
    mesh.position.z = -road.widthM / 2 + ((lane + 0.5) * road.widthM) / lanes;
    group.add(mesh);
  }
  return { group, disposable };
}

/**
 * The drawing of a network's junctions. Ground coordinates (x east, y north)
 * map to the scene as (x, up, -y), as in RoadScene.
 */
export function createJunctionDrawing(network: Network, surface: THREE.Material): JunctionDrawing {
  const objects: THREE.Object3D[] = [];
  const disposable: { dispose(): void }[] = [];
  const signals: { roadId: string; junction: SignalJunction; material: THREE.MeshBasicMaterial; state?: SignalState }[] = [];
  const roads = new Map(network.roads.map((road) => [road.id, road]));

  for (const junction of network.junctions ?? []) {
    // The surface: the ground swept by each turn, from the road it leaves to the road it joins.
    const swept = junctionSurface(network, junction);
    if (swept.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(swept, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, surface);
      mesh.name = `junction-surface:${junction.id}`;
      objects.push(mesh);
      disposable.push(geometry);
    }

    // A priority junction has no lamps; each side road has a give-way marking where it meets the main road.
    if (junction.control === "priority") {
      for (const roadId of approachRoadIds(junction)) {
        const road = roads.get(roadId);
        if (!road || junction.mainRoadIds.includes(roadId)) continue;
        const marking = giveWayMarking(road);
        objects.push(marking.group);
        disposable.push(...marking.disposable);
      }
      continue;
    }
    // A junction with no signal (where roads divide or join) has no stop line and no lamp.
    if (junction.control !== "signal") continue;
    for (const roadId of approachRoadIds(junction)) {
      const road = roads.get(roadId);
      if (!road) continue;
      const lengthM = roadLengthM(road);
      const { point, direction } = positionAlongRoad(road, lengthM);
      const material = new THREE.MeshBasicMaterial({ color: SIGNAL_COLOURS.red });
      disposable.push(material);

      // The stop line: a bar across the whole approach, just short of its end.
      const lineGeometry = new THREE.BoxGeometry(STOP_LINE_DEPTH_M, 0.06, road.widthM);
      const line = new THREE.Mesh(lineGeometry, material);
      line.position.set(point.x - direction.x * STOP_LINE_DEPTH_M, 0.03, -(point.y - direction.y * STOP_LINE_DEPTH_M));
      line.rotation.y = Math.atan2(direction.y, direction.x);
      objects.push(line);
      disposable.push(lineGeometry);

      // The lamp: on a post at the left edge of the approach (left-hand traffic), by the stop line.
      const toLeftM = road.widthM / 2 + 1;
      const x = point.x - direction.y * toLeftM;
      const y = point.y + direction.x * toLeftM;
      const lampGeometry = new THREE.BoxGeometry(LAMP_SIZE_M, LAMP_SIZE_M, LAMP_SIZE_M);
      const lamp = new THREE.Mesh(lampGeometry, material);
      lamp.position.set(x, LAMP_HEIGHT_M, -y);
      const postGeometry = new THREE.BoxGeometry(0.25, LAMP_HEIGHT_M, 0.25);
      const postMaterial = new THREE.MeshLambertMaterial({ color: 0x33363a });
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(x, LAMP_HEIGHT_M / 2, -y);
      objects.push(lamp, post);
      disposable.push(lampGeometry, postGeometry, postMaterial);

      signals.push({ roadId, junction, material });
    }
  }

  return {
    objects,
    showSignals(timeS) {
      const shown: string[] = [];
      for (const signal of signals) {
        const state = signalState(signal.junction.signalPlan, signal.roadId, timeS);
        if (state !== signal.state) {
          signal.state = state;
          signal.material.color.set(SIGNAL_COLOURS[state]);
        }
        shown.push(`${signal.roadId}:${state}`);
      }
      return shown.join(" ");
    },
    dispose() {
      for (const item of disposable) item.dispose();
    },
  };
}
