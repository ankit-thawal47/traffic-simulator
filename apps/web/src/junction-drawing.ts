import {
  approachRoadIds,
  junctionOutline,
  positionAlongRoad,
  roadLengthM,
  signalState,
  type Network,
  type SignalState,
} from "@traffic-simulator/engine";
import * as THREE from "three";

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

/**
 * The drawing of a network's junctions. Ground coordinates (x east, y north)
 * map to the scene as (x, up, -y), as in RoadScene.
 */
export function createJunctionDrawing(network: Network, surface: THREE.Material): JunctionDrawing {
  const objects: THREE.Object3D[] = [];
  const disposable: { dispose(): void }[] = [];
  const signals: { roadId: string; junction: NonNullable<Network["junctions"]>[number]; material: THREE.MeshBasicMaterial; state?: SignalState }[] =
    [];
  const roads = new Map(network.roads.map((road) => [road.id, road]));

  for (const junction of network.junctions ?? []) {
    // The surface: the outline round the ends of the junction's roads, laid flat.
    const outline = junctionOutline(network, junction);
    if (outline.length >= 3) {
      const shape = new THREE.Shape(outline.map((point) => new THREE.Vector2(point.x, point.y)));
      const geometry = new THREE.ShapeGeometry(shape);
      // The shape is in the x-y plane; turned about x it lies on the ground with y pointing to -z.
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, surface);
      mesh.position.y = -0.01;
      objects.push(mesh);
      disposable.push(geometry);
    }

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
