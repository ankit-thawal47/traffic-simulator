import { positionAlongRoad, type Network, type Road, type Snapshot, type VehicleClass } from "@traffic-simulator/engine";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { interpolateVehicles } from "./interpolate";

/** The two most recent snapshots of a run, and when the later one arrived. */
export interface FrameStore {
  earlier?: Snapshot;
  later?: Snapshot;
  laterArrivedAtMs: number;
  /** Real milliseconds between snapshots, used to pace the movement between them. */
  intervalMs: number;
}

/**
 * How each vehicle class is drawn. Length and width come from the engine with each vehicle;
 * height is for the drawing only, so it lives here. Colours match the swatches in styles.css.
 */
const VEHICLE_CLASS_DRAWING: Record<VehicleClass, { heightM: number; colour: THREE.Color }> = {
  "two-wheeler": { heightM: 1.3, colour: new THREE.Color(0x2f6fd0) },
  car: { heightM: 1.5, colour: new THREE.Color(0xd9482b) },
  "auto-rickshaw": { heightM: 1.7, colour: new THREE.Color(0xe0b020) },
  bus: { heightM: 3.0, colour: new THREE.Color(0x2a9d6a) },
};
const ROAD_THICKNESS_M = 0.2;
const MAX_VEHICLES_DRAWN = 4000;

/**
 * Ground coordinates (x east, y north) map to three.js as (x, up, -y).
 * A direction (dx, dy) on the ground is a rotation of atan2(dy, dx) about the up axis.
 */
function roadMeshes(road: Road, material: THREE.Material): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!;
    const b = road.points[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, ROAD_THICKNESS_M, road.widthM), material);
    mesh.position.set((a.x + b.x) / 2, -ROAD_THICKNESS_M / 2, -(a.y + b.y) / 2);
    mesh.rotation.y = Math.atan2(b.y - a.y, b.x - a.x);
    meshes.push(mesh);
  }
  return meshes;
}

/** The 3D view: one three.js scene showing the network and each vehicle as a box. */
export function RoadScene({ network, frames }: { network: Network; frames: FrameStore }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = container.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe7ea);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f80, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-120, 200, 80);
    scene.add(sun);

    const bounds = new THREE.Box3();
    for (const road of network.roads) {
      for (const point of road.points) bounds.expandByPoint(new THREE.Vector3(point.x, 0, -point.y));
    }
    const centre = bounds.getCenter(new THREE.Vector3());
    const extent = Math.max(bounds.getSize(new THREE.Vector3()).length(), 50);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(extent * 4, extent * 4),
      new THREE.MeshLambertMaterial({ color: 0xb9c4a7 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(centre.x, -ROAD_THICKNESS_M, centre.z);
    scene.add(ground);

    const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4d52 });
    const roadsById = new Map<string, Road>();
    for (const road of network.roads) {
      roadsById.set(road.id, road);
      for (const mesh of roadMeshes(road, roadMaterial)) scene.add(mesh);
    }

    // All vehicles are drawn in one batch: a unit box scaled to each vehicle's size.
    const vehicles = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      // White, so that each vehicle shows its own colour.
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      MAX_VEHICLES_DRAWN,
    );
    vehicles.setColorAt(0, VEHICLE_CLASS_DRAWING.car.colour);
    vehicles.count = 0;
    vehicles.frustumCulled = false;
    scene.add(vehicles);

    const camera = new THREE.PerspectiveCamera(45, 1, 1, extent * 20);
    camera.position.set(centre.x - extent * 0.1, extent * 0.3, centre.z + extent * 0.65);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(centre);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.update();

    const resize = () => {
      const { clientWidth, clientHeight } = host;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const placement = new THREE.Object3D();
    const drawVehicles = (nowMs: number) => {
      if (!frames.later) {
        vehicles.count = 0;
        return;
      }
      const fraction = (nowMs - frames.laterArrivedAtMs) / frames.intervalMs;
      const drawn = interpolateVehicles(frames.earlier, frames.later, fraction);
      let count = 0;
      for (const vehicle of drawn) {
        const road = roadsById.get(vehicle.roadId);
        if (!road || count >= MAX_VEHICLES_DRAWN) continue;
        const { point, direction } = positionAlongRoad(road, vehicle.positionM - vehicle.lengthM / 2);
        // lateralM is measured from the road's left edge; left of (dx, dy) is (-dy, dx).
        const toLeftM = road.widthM / 2 - vehicle.lateralM;
        const x = point.x - direction.y * toLeftM;
        const y = point.y + direction.x * toLeftM;
        const drawing = VEHICLE_CLASS_DRAWING[vehicle.vehicleClass];
        placement.position.set(x, drawing.heightM / 2, -y);
        placement.rotation.set(0, Math.atan2(direction.y, direction.x), 0);
        placement.scale.set(vehicle.lengthM, drawing.heightM, vehicle.widthM);
        placement.updateMatrix();
        vehicles.setColorAt(count, drawing.colour);
        vehicles.setMatrixAt(count++, placement.matrix);
      }
      vehicles.count = count;
      vehicles.instanceMatrix.needsUpdate = true;
      if (vehicles.instanceColor) vehicles.instanceColor.needsUpdate = true;
    };

    let animation = requestAnimationFrame(function draw(nowMs) {
      drawVehicles(nowMs);
      controls.update();
      renderer.render(scene, camera);
      animation = requestAnimationFrame(draw);
    });

    return () => {
      cancelAnimationFrame(animation);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [network, frames]);

  return <div ref={container} className="scene" />;
}
