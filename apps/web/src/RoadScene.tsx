import { createNetworkLayout, vehicleHeightM, vehiclePose, type Network } from "@traffic-simulator/engine";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { closeUpPose } from "./camera-presets";
import type { FrameStore } from "./frame-store";
import { createFlyoverDrawing, isDrawnRaised } from "./flyover-drawing";
import { interpolateVehicles } from "./interpolate";
import { createJunctionDrawing } from "./junction-drawing";
import { kerbTriangles, laneMarkings, roadSurface, stripTriangles } from "./road-drawing";
import { SKY, createGroundTexture, createSky, createVehicleMaterial, vehicleGeometry } from "./scene-parts";
import type { SharedCamera } from "./shared-camera";
import { surroundings } from "./surroundings";
import { vehicleColour, type ColourBy } from "./vehicle-colours";
import { vehicleShape } from "./vehicle-shapes";
import { MAX_VEHICLES_DRAWN, notDrawnNotice } from "./vehicles-drawn";

/** The camera's vertical field of view, in degrees. */
export const CAMERA_FOV_DEGREES = 45;

/**
 * How tall each vehicle class is drawn, in metres, rider or canopy included.
 * Length and width come from the engine with each vehicle; height is for the
 * drawing only, so it lives here.
 */
const VEHICLE_HEIGHT_M: Record<string, number> = {
  "two-wheeler": 1.6,
  car: 1.5,
  "auto-rickshaw": 1.75,
  bus: 3.2,
};
const OTHER_VEHICLE_HEIGHT_M = 1.6;

const ASPHALT = 0x55585d;
const KERB = 0xb9b6ad;
const PAINT = 0xf4f3ec;

/** Sun from the south-west, high in the afternoon sky. Ground (x east, y north) is scene (x, up, -y). */
const SUN_DIRECTION = new THREE.Vector3(-0.42, 0.82, 0.38).normalize();
/** Shadows are drawn only while the camera is near enough for them to be seen. */
const SHADOWS_WITHIN_M = 1100;
/** Below this many frames a second over a few seconds, a view stops drawing shadows, to keep the run smooth. */
const SHADOWS_OFF_BELOW_FPS = 40;

/** Triangle corners as one mesh, lit from above, its normals worked out from its faces. */
function meshOf(positions: number[], material: THREE.Material, disposable: { dispose(): void }[]): THREE.Mesh | undefined {
  if (positions.length === 0) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  disposable.push(geometry);
  return new THREE.Mesh(geometry, material);
}

/**
 * The 3D view: one three.js scene showing the network and its vehicles, each
 * drawn with a shape for its class, to the size the engine gives it.
 * Views given the same `sharedCamera` move as one.
 */
export function RoadScene({
  network,
  frames,
  sharedCamera,
  colourBy = "vehicle-class",
  laneDiscipline = false,
  withSurroundings = false,
}: {
  network: Network;
  frames: FrameStore;
  sharedCamera?: SharedCamera;
  colourBy?: ColourBy;
  /** Whether traffic keeps to marked lanes: lane lines are painted only then. */
  laneDiscipline?: boolean;
  /** A few buildings and trees along the roads, for a real corridor. */
  withSurroundings?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [notDrawn, setNotDrawn] = useState(0);
  const notice = notDrawnNotice(notDrawn);
  // Read on every drawn frame, so a change of colouring shows at once without rebuilding the scene.
  const colouring = useRef(colourBy);
  colouring.current = colourBy;

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const disposable: { dispose(): void }[] = [];

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const bounds = new THREE.Box3();
    for (const road of network.roads) {
      for (const point of road.points) bounds.expandByPoint(new THREE.Vector3(point.x, 0, -point.y));
    }
    const centre = bounds.getCenter(new THREE.Vector3());
    const extent = Math.max(bounds.getSize(new THREE.Vector3()).length(), 50);
    const farM = Math.max(extent * 20, 4000);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY.horizon);
    // Haze towards the horizon, so the ground fades into the sky instead of ending at an edge.
    scene.fog = new THREE.Fog(SKY.horizon, Math.max(extent * 2.5, 900), Math.max(extent * 7, 3200));
    const sky = createSky(farM * 0.8);
    disposable.push(sky.geometry, sky.material as THREE.Material);
    scene.add(sky);
    scene.add(new THREE.HemisphereLight(0xe4eefa, 0xa29d90, 1.5));
    const sun = new THREE.DirectionalLight(0xfff3df, 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    scene.add(sun, sun.target);

    const groundTexture = createGroundTexture();
    const groundSizeM = Math.max(extent * 20, 8000);
    groundTexture.repeat.set(groundSizeM / 90, groundSizeM / 90);
    const groundMaterial = new THREE.MeshLambertMaterial({
      map: groundTexture,
      // Drawn behind what lies on it, so roads far away do not flicker into it.
      polygonOffset: true,
      polygonOffsetFactor: 4,
      polygonOffsetUnits: 4,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSizeM, groundSizeM), groundMaterial);
    disposable.push(groundTexture, groundMaterial, ground.geometry);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(centre.x, -0.05, centre.z);
    ground.receiveShadow = true;
    scene.add(ground);

    // Roads on the ground: the carriageway, kerbs along its edges, and lines where traffic keeps to lanes.
    const roadMaterial = new THREE.MeshLambertMaterial({ color: ASPHALT });
    const kerbMaterial = new THREE.MeshLambertMaterial({ color: KERB, side: THREE.DoubleSide });
    const paintMaterial = new THREE.MeshLambertMaterial({
      color: PAINT,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    disposable.push(roadMaterial, kerbMaterial, paintMaterial);
    const surface: number[] = [];
    const kerbs: number[] = [];
    const paint: number[] = [];
    for (const road of network.roads) {
      if (!isDrawnRaised(road)) {
        surface.push(...roadSurface(road));
        kerbTriangles(road, kerbs);
      }
      for (const mark of laneMarkings(road, laneDiscipline)) stripTriangles(road, mark, isDrawnRaised(road) ? 0.05 : 0.02, paint);
    }
    for (const [positions, material, casts] of [
      [surface, roadMaterial, false],
      [kerbs, kerbMaterial, true],
      [paint, paintMaterial, false],
    ] as const) {
      const mesh = meshOf(positions, material, disposable);
      if (!mesh) continue;
      mesh.receiveShadow = true;
      mesh.castShadow = casts;
      scene.add(mesh);
    }
    // Flyovers: raised roads with their ramps, parapets and pillars.
    const flyovers = createFlyoverDrawing(network, roadMaterial);
    for (const object of flyovers.objects) {
      object.castShadow = true;
      object.receiveShadow = true;
      scene.add(object);
    }
    host.dataset.flyovers = flyovers.summary;
    const hasFlyover = network.roads.some(isDrawnRaised);
    // Junctions: their surface, and a stop line and signal lamp for each approach.
    const junctions = createJunctionDrawing(network, roadMaterial);
    for (const object of junctions.objects) {
      object.receiveShadow = true;
      scene.add(object);
    }
    // Where vehicles are on the ground, on roads and along turning paths inside junctions.
    const layout = createNetworkLayout(network);

    // A few buildings and trees along a real corridor, each kind drawn in one batch.
    if (withSurroundings) {
      const placed = surroundings(network);
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      // Walls in the building's colour; a flat roof in grey concrete, with a darker band at the foot of the walls.
      const shades: number[] = [];
      const boxPositions = box.getAttribute("position");
      const boxNormals = box.getAttribute("normal");
      for (let i = 0; i < boxPositions.count; i++) {
        const roof = boxNormals.getY(i) > 0.5;
        const foot = boxPositions.getY(i) < 0.01 && !roof;
        shades.push(...(roof ? [0.62, 0.62, 0.64] : foot ? [0.8, 0.78, 0.76] : [1, 1, 1]));
      }
      box.setAttribute("color", new THREE.Float32BufferAttribute(shades, 3));
      const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
      const buildings = new THREE.InstancedMesh(box, wallMaterial, Math.max(placed.buildings.length, 1));
      const walls = [0xe7dccb, 0xd9cfc0, 0xc9c2b6, 0xe9e1d2].map((hex) => new THREE.Color(hex));
      placed.buildings.forEach((building, i) => {
        quaternion.setFromAxisAngle(up, building.angleRad);
        matrix.compose(new THREE.Vector3(building.x, 0, -building.y), quaternion, new THREE.Vector3(building.widthM, building.heightM, building.depthM));
        buildings.setMatrixAt(i, matrix);
        buildings.setColorAt(i, walls[building.shade]!);
      });
      buildings.count = placed.buildings.length;
      const trunkGeometry = new THREE.CylinderGeometry(0.18, 0.25, 1, 6).translate(0, 0.5, 0);
      const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
      const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x6b5643 });
      const crownMaterial = new THREE.MeshLambertMaterial({ color: 0x5f8a4a, flatShading: true });
      const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, Math.max(placed.trees.length, 1));
      const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, Math.max(placed.trees.length, 1));
      placed.trees.forEach((tree, i) => {
        const trunkM = tree.heightM - tree.crownM * 1.4;
        matrix.makeScale(1, trunkM, 1).setPosition(tree.x, 0, -tree.y);
        trunks.setMatrixAt(i, matrix);
        matrix.makeScale(tree.crownM, tree.crownM * 0.85, tree.crownM).setPosition(tree.x, trunkM + tree.crownM * 0.6, -tree.y);
        crowns.setMatrixAt(i, matrix);
      });
      trunks.count = crowns.count = placed.trees.length;
      for (const mesh of [buildings, trunks, crowns]) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
      disposable.push(box, wallMaterial, trunkGeometry, crownGeometry, trunkMaterial, crownMaterial);
      host.dataset.surroundings = `${placed.buildings.length} buildings, ${placed.trees.length} trees`;
    }

    // Vehicles: one batch for each vehicle class, each vehicle its class's shape stretched to its size.
    const { material: vehicleMaterial, livery } = createVehicleMaterial();
    disposable.push(vehicleMaterial);
    const white = new THREE.Color(0xffffff);
    const batches = new Map<string, { mesh: THREE.InstancedMesh; count: number }>();
    const batchFor = (vehicleClass: string) => {
      let batch = batches.get(vehicleClass);
      if (!batch) {
        const geometry = vehicleGeometry(vehicleShape(vehicleClass));
        const mesh = new THREE.InstancedMesh(geometry, vehicleMaterial, MAX_VEHICLES_DRAWN);
        // Each vehicle's own colour is set before its first frame, so the material is made with it.
        mesh.setColorAt(0, white);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        disposable.push(geometry, mesh);
        batch = { mesh, count: 0 };
        batches.set(vehicleClass, batch);
      }
      return batch;
    };
    for (const vehicleClass of Object.keys(VEHICLE_HEIGHT_M)) batchFor(vehicleClass);

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, 1, 1, farM);
    const startPose = closeUpPose(network);
    camera.position.fromArray(startPose.position);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.fromArray(startPose.target);
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

    // Shadows: the sun's shadow covers the ground round what the camera looks at, more of it the further away the camera is.
    // They are left out when the camera is too far for them to be seen, and for good if this view cannot keep its frame rate with them.
    let shadowsTooSlow = false;
    const updateShadows = () => {
      const distanceM = camera.position.distanceTo(controls.target);
      const wanted = !shadowsTooSlow && distanceM < SHADOWS_WITHIN_M;
      if (sun.castShadow !== wanted) sun.castShadow = wanted;
      const shown = wanted ? "on" : shadowsTooSlow ? "off: too slow" : "off: too far";
      if (host.dataset.shadows !== shown) host.dataset.shadows = shown;
      if (!wanted) return;
      const halfM = Math.min(Math.max(distanceM * 0.8, 40), 420);
      const shadowCamera = sun.shadow.camera;
      if (shadowCamera.right !== halfM) {
        shadowCamera.left = shadowCamera.bottom = -halfM;
        shadowCamera.right = shadowCamera.top = halfM;
        shadowCamera.near = 1;
        shadowCamera.far = halfM * 8;
        shadowCamera.updateProjectionMatrix();
      }
      // Moved in whole texels of the shadow map, so shadows do not shimmer as the camera moves.
      const texelM = (2 * halfM) / sun.shadow.mapSize.x;
      const x = Math.round(controls.target.x / texelM) * texelM;
      const z = Math.round(controls.target.z / texelM) * texelM;
      sun.target.position.set(x, 0, z);
      sun.position.set(x, 0, z).addScaledVector(SUN_DIRECTION, halfM * 4);
    };
    const recentFrameMs: number[] = [];
    let lastFrameAtMs: number | undefined;
    const watchFrameRate = (nowMs: number) => {
      if (lastFrameAtMs !== undefined) {
        const interval = nowMs - lastFrameAtMs;
        // A long gap is the page hidden or busy elsewhere, not the cost of drawing.
        if (interval < 250) recentFrameMs.push(interval);
      }
      lastFrameAtMs = nowMs;
      if (recentFrameMs.length < 180) return;
      const meanMs = recentFrameMs.reduce((sum, value) => sum + value, 0) / recentFrameMs.length;
      recentFrameMs.length = 0;
      host.dataset.fps = (1000 / meanMs).toFixed(0);
      if (sun.castShadow && 1000 / meanMs < SHADOWS_OFF_BELOW_FPS) shadowsTooSlow = true;
    };

    const placement = new THREE.Object3D();
    const colour = new THREE.Color();
    const coloursDrawn = new Map<string, number>();
    let notDrawnShown = 0;
    setNotDrawn(0);
    const drawVehicles = (nowMs: number) => {
      for (const batch of batches.values()) batch.count = 0;
      if (!frames.later) {
        for (const batch of batches.values()) batch.mesh.count = 0;
        return;
      }
      const colourBySpeed = colouring.current === "speed";
      livery.value = colourBySpeed ? 1 : 0;
      const fraction = (nowMs - frames.laterArrivedAtMs) / frames.intervalMs;
      const drawn = interpolateVehicles(frames.earlier, frames.later, fraction);
      // The signals are shown for the same moment of the run as the vehicles.
      const earlierS = frames.earlier?.timeS ?? frames.later.timeS;
      const shownS = earlierS + (frames.later.timeS - earlierS) * Math.min(1, Math.max(0, fraction));
      const signals = junctions.showSignals(shownS);
      if (host.dataset.signals !== signals) host.dataset.signals = signals;
      let count = 0;
      let inJunctions = 0;
      let raised = 0;
      let notDrawn = 0;
      for (const vehicle of drawn) {
        if (count >= MAX_VEHICLES_DRAWN) {
          notDrawn++;
          continue;
        }
        const pose = vehiclePose(layout, vehicle);
        if (!pose) continue;
        if (vehicle.turn) inJunctions++;
        const { x, y } = pose.centre;
        const direction = pose.direction;
        const heightM = VEHICLE_HEIGHT_M[vehicle.vehicleClass] ?? OTHER_VEHICLE_HEIGHT_M;
        // On a flyover the vehicle stands on the road's surface at its height, tilted with the ramp.
        const frontM = hasFlyover ? vehicleHeightM(layout, vehicle, 0) : 0;
        const rearM = hasFlyover ? vehicleHeightM(layout, vehicle, vehicle.lengthM) : 0;
        const surfaceM = (frontM + rearM) / 2;
        if (surfaceM > 0.5) raised++;
        // The shape stands on its base: placed at the road's surface under its middle.
        placement.position.set(x, surfaceM, -y);
        // Turned about the up axis to face its direction, then about its own sideways axis to climb or descend.
        placement.rotation.set(0, Math.atan2(direction.y, direction.x), Math.atan2(frontM - rearM, vehicle.lengthM), "YZX");
        placement.scale.set(vehicle.lengthM, heightM, vehicle.widthM);
        placement.updateMatrix();
        const hex = vehicleColour(colouring.current, vehicle);
        coloursDrawn.set(hex, (coloursDrawn.get(hex) ?? 0) + 1);
        const batch = batchFor(vehicle.vehicleClass);
        batch.mesh.setColorAt(batch.count, colour.set(hex));
        batch.mesh.setMatrixAt(batch.count++, placement.matrix);
        count++;
      }
      for (const batch of batches.values()) {
        batch.mesh.count = batch.count;
        if (batch.count === 0) continue;
        batch.mesh.instanceMatrix.needsUpdate = true;
        if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      }
      // Written to the page so that what each view draws can be checked from outside.
      const summary = [...coloursDrawn].map(([drawnHex, drawn]) => `${drawnHex}:${drawn}`).join(" ");
      if (host.dataset.vehicleColours !== summary) host.dataset.vehicleColours = summary;
      host.dataset.vehiclesDrawn = String(count);
      host.dataset.vehiclesInJunctions = String(inJunctions);
      host.dataset.vehiclesRaised = String(raised);
      // Said on screen, so the limit on what is drawn is never silent.
      if (notDrawn !== notDrawnShown) {
        notDrawnShown = notDrawn;
        host.dataset.vehiclesNotDrawn = String(notDrawn);
        setNotDrawn(notDrawn);
      }
      coloursDrawn.clear();
    };

    let animation = requestAnimationFrame(function draw(nowMs) {
      watchFrameRate(nowMs);
      drawVehicles(nowMs);
      controls.update();
      updateShadows();
      sky.position.copy(camera.position);
      renderer.render(scene, camera);
      animation = requestAnimationFrame(draw);
    });

    return () => {
      cancelAnimationFrame(animation);
      resizeObserver.disconnect();
      leaveSharedCamera?.();
      controls.removeEventListener("change", onCameraMoved);
      controls.dispose();
      junctions.dispose();
      flyovers.dispose();
      for (const item of disposable) item.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [network, frames, sharedCamera, laneDiscipline, withSurroundings]);

  return (
    <>
      <div ref={container} className="scene" />
      {notice && (
        <p className="scene-notice" data-testid="vehicles-not-drawn" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
