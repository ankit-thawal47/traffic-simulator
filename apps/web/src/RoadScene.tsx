import { positionAlongRoad, type Network, type Road, type Snapshot } from "@traffic-simulator/engine";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { interpolateVehicles } from "./interpolate";
import type { SharedCamera } from "./shared-camera";

/** The two most recent snapshots of a run, and when the later one arrived. */
export interface FrameStore {
  earlier?: Snapshot;
  later?: Snapshot;
  laterArrivedAtMs: number;
  /** Real milliseconds between snapshots, used to pace the movement between them. */
  intervalMs: number;
}

const VEHICLE_HEIGHT_M = 1.5;
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

/**
 * The 3D view: one three.js scene showing the network and each vehicle as a box.
 * Views given the same `sharedCamera` move as one.
 */
export function RoadScene({
  network,
  frames,
  sharedCamera,
}: {
  network: Network;
  frames: FrameStore;
  sharedCamera?: SharedCamera;
}) {
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
      new THREE.MeshLambertMaterial({ color: 0xd9482b }),
      MAX_VEHICLES_DRAWN,
    );
    vehicles.count = 0;
    vehicles.frustumCulled = false;
    scene.add(vehicles);

    const camera = new THREE.PerspectiveCamera(45, 1, 1, extent * 20);
    camera.position.set(centre.x - extent * 0.1, extent * 0.3, centre.z + extent * 0.65);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(centre);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.update();

    // Follow the shared camera, and report this view's own movements to it.
    const view = {};
    let following = false;
    const showPose = () => {
      // Written to the page so that what each view shows can be checked from outside.
      host.dataset.camera = [...camera.position.toArray(), ...controls.target.toArray()]
        .map((value) => value.toFixed(2))
        .join(" ");
    };
    const leaveSharedCamera = sharedCamera?.join(view, (pose) => {
      following = true;
      camera.position.fromArray(pose.position);
      controls.target.fromArray(pose.target);
      controls.update();
      following = false;
      showPose();
    });
    const onCameraMoved = () => {
      if (following) return;
      showPose();
      sharedCamera?.move(view, { position: camera.position.toArray(), target: controls.target.toArray() });
    };
    controls.addEventListener("change", onCameraMoved);
    showPose();

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
        placement.position.set(x, VEHICLE_HEIGHT_M / 2, -y);
        placement.rotation.set(0, Math.atan2(direction.y, direction.x), 0);
        placement.scale.set(vehicle.lengthM, VEHICLE_HEIGHT_M, vehicle.widthM);
        placement.updateMatrix();
        vehicles.setMatrixAt(count++, placement.matrix);
      }
      vehicles.count = count;
      vehicles.instanceMatrix.needsUpdate = true;
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
      leaveSharedCamera?.();
      controls.removeEventListener("change", onCameraMoved);
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [network, frames, sharedCamera]);

  return <div ref={container} className="scene" />;
}
