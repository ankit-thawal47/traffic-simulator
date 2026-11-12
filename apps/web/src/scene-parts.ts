/**
 * Pieces of the 3D view's look, generated in code (ADR 0007: no downloaded
 * models, textures or fonts): the sky, the ground's texture, and the
 * material vehicles are drawn with. RoadScene puts them together.
 */
import * as THREE from "three";
import { TINT, type VehicleShape } from "./vehicle-shapes";

export const SKY = { zenith: 0x7fb0dc, horizon: 0xdde7ec };

/** A dome round the camera, pale at the horizon and deeper blue overhead. It follows the camera, so it is never reached. */
export function createSky(radiusM: number): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(SKY.zenith) },
      horizon: { value: new THREE.Color(SKY.horizon) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith;
      uniform vec3 horizon;
      varying vec3 vDirection;
      void main() {
        float up = clamp(vDirection.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, zenith, pow(up, 0.6)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radiusM, 24, 12), material);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

/**
 * The ground: dry grass and bare earth in soft patches, as on open ground in
 * Bengaluru, from a small texture made here from value noise and repeated.
 */
export function createGroundTexture(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  // Value noise on a grid that wraps, so the texture repeats without seams.
  const lattice = (cells: number, seed: number) => {
    const values: number[] = [];
    let state = seed;
    for (let i = 0; i < cells * cells; i++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      values.push(state / 4294967296);
    }
    return (x: number, y: number) => {
      const fx = (x / size) * cells;
      const fy = (y / size) * cells;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const at = (i: number, j: number) => values[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)]!;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
      const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      return top * (1 - sy) + bottom * sy;
    };
  };
  const broad = lattice(4, 7);
  const fine = lattice(16, 11);
  const grain = lattice(64, 13);
  const grass = [122, 146, 92];
  const dry = [150, 154, 106];
  const earth = [148, 134, 106];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const patch = broad(x, y) * 0.65 + fine(x, y) * 0.35;
      const speck = grain(x, y) * 0.16 - 0.08;
      const [a, b, t] = patch < 0.5 ? [grass, dry, patch / 0.5] : [dry, earth, (patch - 0.5) / 0.5];
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, (a[c]! * (1 - t) + b[c]! * t) * (1 + speck)));
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** A vehicle shape as geometry, with its fixed colours and its tint. */
export function vehicleGeometry(shape: VehicleShape): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(shape.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(shape.normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(shape.colours, 3));
  geometry.setAttribute("tint", new THREE.BufferAttribute(shape.tint, 1));
  return geometry;
}

/**
 * The material all vehicles are drawn with. Each corner of a shape either
 * takes the vehicle's own colour (given per vehicle, by class or by speed),
 * keeps its fixed colour, or (livery) keeps it only while `livery` is 0.
 */
export function createVehicleMaterial(): { material: THREE.MeshLambertMaterial; livery: { value: number } } {
  const livery = { value: 0 };
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.livery = livery;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float tint;\nuniform float livery;")
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          float shown = tint > ${(TINT.vehicle + TINT.livery) / 2} ? livery : tint;
          vColor.xyz = mix(color.xyz, instanceColor.xyz, shown);
        #endif`,
      );
  };
  material.customProgramCacheKey = () => "vehicle-tint";
  return { material, livery };
}
