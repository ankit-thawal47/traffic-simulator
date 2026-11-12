/**
 * The shape each vehicle class is drawn with: a few boxes, tapered boxes and
 * eight-sided wheels, generated here in code (ADR 0007: low-detail shapes, to
 * scale, no downloaded models). Plain arrays, no three.js, so they can be
 * checked from the command line.
 *
 * Every shape is made in a unit box: x from -0.5 (rear) to 0.5 (front), y from
 * 0 (the ground) to 1 (its top), z from -0.5 to 0.5 across. The 3D view
 * stretches it to each vehicle's length, height and width, so every vehicle is
 * drawn to the size the engine gives it.
 *
 * Each corner carries a colour and a tint: whether it shows the vehicle's own
 * colour (by class or by speed), keeps its fixed colour (tyres, glass, a rider's
 * shirt), or is livery: its fixed colour when vehicles are coloured by class,
 * the vehicle's colour when they are coloured by speed.
 */

export const TINT = { fixed: 0, vehicle: 1, livery: 2 } as const;
export type Tint = (typeof TINT)[keyof typeof TINT];

export interface VehicleShape {
  /** Corners of triangles, three numbers (x, y, z) each, not shared between faces. */
  positions: Float32Array;
  /** The outward direction of each corner's face, for lighting. */
  normals: Float32Array;
  /** The fixed colour of each corner, red, green and blue from 0 to 1. */
  colours: Float32Array;
  /** The tint of each corner (TINT). */
  tint: Float32Array;
  /** The parts it is made of, by name. */
  parts: string[];
  wheels: number;
}

type Rgb = readonly [number, number, number];
const hex = (value: number): Rgb => [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];

const WHITE = hex(0xffffff);
const TYRE = hex(0x1d1f22);
const GLASS = hex(0x2c3a46);
const DARK = hex(0x30333a);
const SHIRT = hex(0x5d6f8c);
const SKIN = hex(0x8d5b3f);
const HEADLAMP = hex(0xfff3c4);
const TAIL_LAMP = hex(0xb3261e);
/** The yellow of a Bengaluru auto-rickshaw, beside its green. */
const AUTO_YELLOW = hex(0xf2c318);

class Builder {
  private positions: number[] = [];
  private normals: number[] = [];
  private colours: number[] = [];
  private tint: number[] = [];
  readonly parts = new Set<string>();
  wheels = 0;

  /** The middle of the part being made: every face is turned to face away from it. */
  private centre = [0, 0, 0];

  private triangle(a: number[], b: number[], c: number[], colour: Rgb, tint: Tint) {
    const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const length = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
    const out = [0, 1, 2].map((i) => a[i]! + b[i]! + c[i]! - 3 * this.centre[i]!);
    let corners = [a, b, c];
    if (n[0]! * out[0]! + n[1]! * out[1]! + n[2]! * out[2]! < 0) {
      // Wound the wrong way round: turned, so it is lit from outside and not culled.
      corners = [a, c, b];
      for (let i = 0; i < 3; i++) n[i] = -n[i]!;
    }
    for (const corner of corners) {
      this.positions.push(corner[0]!, corner[1]!, corner[2]!);
      this.normals.push(n[0]! / length, n[1]! / length, n[2]! / length);
      this.colours.push(...colour);
      this.tint.push(tint);
    }
  }

  /** A four-sided face; corners in order round it, anticlockwise seen from outside. */
  quad(a: number[], b: number[], c: number[], d: number[], colour: Rgb, tint: Tint) {
    this.triangle(a, b, c, colour, tint);
    this.triangle(a, c, d, colour, tint);
  }

  /**
   * A box whose top may be smaller than its bottom (a cabin, a nose): `bottom`
   * and `top` are [x from, x to, z half-width] at its lower and upper face.
   */
  taper(part: string, y0: number, y1: number, bottom: readonly number[], top: readonly number[], colour: Rgb, tint: Tint) {
    this.parts.add(part);
    const [bx0, bx1, bz] = bottom as [number, number, number];
    const [tx0, tx1, tz] = top as [number, number, number];
    this.centre = [(bx0 + bx1 + tx0 + tx1) / 4, (y0 + y1) / 2, 0];
    const p = {
      b00: [bx0, y0, -bz],
      b10: [bx1, y0, -bz],
      b11: [bx1, y0, bz],
      b01: [bx0, y0, bz],
      t00: [tx0, y1, -tz],
      t10: [tx1, y1, -tz],
      t11: [tx1, y1, tz],
      t01: [tx0, y1, tz],
    };
    this.quad(p.t00, p.t01, p.t11, p.t10, colour, tint); // top
    this.quad(p.b00, p.b10, p.b11, p.b01, colour, tint); // bottom
    this.quad(p.b10, p.t10, p.t11, p.b11, colour, tint); // front
    this.quad(p.b00, p.b01, p.t01, p.t00, colour, tint); // rear
    this.quad(p.b01, p.b11, p.t11, p.t01, colour, tint); // side, +z
    this.quad(p.b00, p.t00, p.t10, p.b10, colour, tint); // side, -z
  }

  box(part: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, colour: Rgb, tint: Tint) {
    this.parts.add(part);
    this.centre = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const p = (x: number, y: number, z: number) => [x, y, z];
    this.quad(p(x0, y1, z0), p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), colour, tint);
    this.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), colour, tint);
    this.quad(p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1), colour, tint);
    this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), colour, tint);
    this.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), colour, tint);
    this.quad(p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), p(x1, y0, z0), colour, tint);
  }

  /** An eight-sided wheel standing on the ground, its axle across the vehicle. Radius in units of height and of length. */
  wheel(x: number, radiusY: number, radiusX: number, z0: number, z1: number) {
    this.parts.add("wheels");
    this.wheels++;
    this.centre = [x, radiusY, (z0 + z1) / 2];
    const rim = Array.from({ length: 8 }, (_, i) => {
      const angle = ((i + 0.5) * Math.PI) / 4;
      return [x + Math.cos(angle) * radiusX, radiusY + Math.sin(angle) * radiusY];
    });
    // Flatten the bottom onto the ground, so the wheel touches it.
    const bottom = Math.min(...rim.map(([, y]) => y!));
    for (const corner of rim) if (corner[1] === bottom) corner[1] = 0;
    for (let i = 0; i < 8; i++) {
      const [ax, ay] = rim[i]!;
      const [bx, by] = rim[(i + 1) % 8]!;
      this.quad([ax!, ay!, z0], [ax!, ay!, z1], [bx!, by!, z1], [bx!, by!, z0], TYRE, TINT.fixed);
      this.triangle([x, radiusY, z1], [bx!, by!, z1], [ax!, ay!, z1], TYRE, TINT.fixed);
      this.triangle([x, radiusY, z0], [ax!, ay!, z0], [bx!, by!, z0], TYRE, TINT.fixed);
    }
  }

  done(): VehicleShape {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colours: new Float32Array(this.colours),
      tint: new Float32Array(this.tint),
      parts: [...this.parts],
      wheels: this.wheels,
    };
  }
}

/** A two-wheeler and its rider, seen side on: wheels front and back, the rider upright between them, helmet on top. */
function twoWheeler(): VehicleShape {
  const s = new Builder();
  const r = 0.23;
  s.wheel(-0.32, r, 0.17, -0.07, 0.07);
  s.wheel(0.32, r, 0.17, -0.07, 0.07);
  s.box("body", -0.36, 0.3, 0.22, 0.46, -0.2, 0.2, WHITE, TINT.vehicle);
  s.taper("body", 0.22, 0.6, [0.3, 0.42, 0.16], [0.3, 0.36, 0.12], WHITE, TINT.vehicle);
  s.box("seat", -0.32, 0.08, 0.46, 0.52, -0.17, 0.17, DARK, TINT.fixed);
  s.box("handlebar", 0.27, 0.33, 0.6, 0.65, -0.5, 0.5, DARK, TINT.fixed);
  s.box("rider", -0.1, 0.12, 0.3, 0.52, 0.16, 0.3, DARK, TINT.fixed); // legs
  s.box("rider", -0.1, 0.12, 0.3, 0.52, -0.3, -0.16, DARK, TINT.fixed);
  s.taper("rider", 0.52, 0.86, [-0.2, 0.06, 0.28], [-0.12, 0.06, 0.24], SHIRT, TINT.fixed); // torso
  s.box("rider", 0.02, 0.3, 0.66, 0.74, 0.24, 0.34, SHIRT, TINT.fixed); // arms
  s.box("rider", 0.02, 0.3, 0.66, 0.74, -0.34, -0.24, SHIRT, TINT.fixed);
  s.box("rider", -0.1, 0.0, 0.84, 0.88, -0.08, 0.08, SKIN, TINT.fixed); // neck
  s.box("helmet", -0.14, 0.04, 0.88, 1, -0.16, 0.16, WHITE, TINT.vehicle);
  s.box("lamps", 0.36, 0.42, 0.5, 0.56, -0.06, 0.06, HEADLAMP, TINT.fixed);
  return s.done();
}

/** A car: a long low body, a glass cabin set back, a coloured roof. */
function car(): VehicleShape {
  const s = new Builder();
  const r = 0.2;
  for (const x of [-0.31, 0.3]) {
    s.wheel(x, r, 0.08, 0.38, 0.5);
    s.wheel(x, r, 0.08, -0.5, -0.38);
  }
  s.taper("body", 0.12, 0.5, [-0.5, 0.5, 0.48], [-0.48, 0.47, 0.47], WHITE, TINT.vehicle);
  s.taper("cabin", 0.5, 0.93, [-0.34, 0.22, 0.44], [-0.24, 0.06, 0.38], GLASS, TINT.fixed);
  s.box("roof", -0.25, 0.07, 0.93, 1, -0.385, 0.385, WHITE, TINT.vehicle);
  s.box("lamps", 0.495, 0.505, 0.36, 0.44, 0.28, 0.42, HEADLAMP, TINT.fixed);
  s.box("lamps", 0.495, 0.505, 0.36, 0.44, -0.42, -0.28, HEADLAMP, TINT.fixed);
  s.box("lamps", -0.505, -0.495, 0.36, 0.44, 0.3, 0.44, TAIL_LAMP, TINT.fixed);
  s.box("lamps", -0.505, -0.495, 0.36, 0.44, -0.44, -0.3, TAIL_LAMP, TINT.fixed);
  return s.done();
}

/**
 * An auto-rickshaw: one wheel in front, two behind; a green body with a yellow
 * band and nose, as in Bengaluru, under a canopy on posts. The canopy takes the
 * vehicle's colour, so its class shows from above.
 */
function autoRickshaw(): VehicleShape {
  const s = new Builder();
  const r = 0.14;
  s.wheel(0.36, r, 0.09, -0.06, 0.06);
  s.wheel(-0.3, r, 0.09, 0.38, 0.5);
  s.wheel(-0.3, r, 0.09, -0.5, -0.38);
  s.box("body", -0.48, 0.24, 0.12, 0.38, -0.46, 0.46, WHITE, TINT.vehicle);
  s.box("body", -0.48, 0.24, 0.38, 0.46, -0.46, 0.46, AUTO_YELLOW, TINT.livery);
  s.taper("nose", 0.12, 0.62, [0.24, 0.5, 0.26], [0.24, 0.34, 0.2], AUTO_YELLOW, TINT.livery);
  s.box("windscreen", 0.26, 0.31, 0.62, 0.86, -0.36, 0.36, GLASS, TINT.fixed);
  s.box("seat", -0.46, -0.16, 0.46, 0.68, -0.4, 0.4, DARK, TINT.fixed);
  for (const [x, z] of [
    [0.27, 0.42],
    [0.27, -0.42],
    [-0.46, 0.42],
    [-0.46, -0.42],
  ] as const) {
    s.box("canopy", x - 0.02, x + 0.02, 0.46, 0.88, z - 0.03, z + 0.03, DARK, TINT.fixed);
  }
  s.taper("canopy", 0.86, 1, [-0.5, 0.34, 0.5], [-0.44, 0.24, 0.46], WHITE, TINT.vehicle);
  s.box("lamps", 0.5, 0.505, 0.48, 0.56, -0.05, 0.05, HEADLAMP, TINT.fixed);
  return s.done();
}

/** A bus: a tall box with a band of windows down each side and across the front, a coloured roof. */
function bus(): VehicleShape {
  const s = new Builder();
  const r = 0.11;
  for (const x of [-0.3, 0.32]) {
    s.wheel(x, r, 0.045, 0.42, 0.5);
    s.wheel(x, r, 0.045, -0.5, -0.42);
  }
  s.box("body", -0.5, 0.5, 0.08, 0.96, -0.48, 0.48, WHITE, TINT.vehicle);
  s.box("windows", -0.46, 0.44, 0.55, 0.84, 0.48, 0.49, GLASS, TINT.fixed);
  s.box("windows", -0.46, 0.44, 0.55, 0.84, -0.49, -0.48, GLASS, TINT.fixed);
  s.box("windows", 0.5, 0.505, 0.42, 0.88, -0.44, 0.44, GLASS, TINT.fixed);
  s.box("windows", -0.505, -0.5, 0.6, 0.86, -0.36, 0.36, GLASS, TINT.fixed);
  s.box("lamps", -0.505, -0.5, 0.16, 0.24, 0.3, 0.44, TAIL_LAMP, TINT.fixed);
  s.box("lamps", -0.505, -0.5, 0.16, 0.24, -0.44, -0.3, TAIL_LAMP, TINT.fixed);
  s.box("roof", -0.47, 0.47, 0.96, 1, -0.45, 0.45, WHITE, TINT.vehicle);
  s.box("lamps", 0.5, 0.505, 0.16, 0.24, 0.3, 0.44, HEADLAMP, TINT.fixed);
  s.box("lamps", 0.5, 0.505, 0.16, 0.24, -0.44, -0.3, HEADLAMP, TINT.fixed);
  return s.done();
}

function plainBox(): VehicleShape {
  const s = new Builder();
  s.box("body", -0.5, 0.5, 0, 1, -0.5, 0.5, WHITE, TINT.vehicle);
  return s.done();
}

/** Stretch a shape so it fills its unit box exactly: x and z from -0.5 to 0.5, y from 0 to 1. */
function fitted(shape: VehicleShape): VehicleShape {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < shape.positions.length; i++) {
    const axis = i % 3;
    min[axis] = Math.min(min[axis]!, shape.positions[i]!);
    max[axis] = Math.max(max[axis]!, shape.positions[i]!);
  }
  const low = [-0.5, 0, -0.5];
  for (let i = 0; i < shape.positions.length; i++) {
    const axis = i % 3;
    shape.positions[i] = low[axis]! + (shape.positions[i]! - min[axis]!) / (max[axis]! - min[axis]!);
  }
  return shape;
}

const MAKERS: Record<string, () => VehicleShape> = {
  twowheeler: twoWheeler,
  car,
  autorickshaw: autoRickshaw,
  bus,
};

/** The shape a vehicle class is drawn with; a class it does not know is drawn as a plain box. */
export function vehicleShape(vehicleClass: string): VehicleShape {
  const make = MAKERS[vehicleClass.toLowerCase().replace(/[^a-z]/g, "")] ?? plainBox;
  return fitted(make());
}
