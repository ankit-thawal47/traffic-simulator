import { VEHICLE_CLASSES } from "@traffic-simulator/engine";
import { describe, expect, it } from "vitest";
import { TINT, vehicleShape } from "./vehicle-shapes";

function extent(values: Float32Array, axis: number) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = axis; i < values.length; i += 3) {
    min = Math.min(min, values[i]!);
    max = Math.max(max, values[i]!);
  }
  return { min, max };
}

describe("the shape each vehicle class is drawn with", () => {
  it.each(VEHICLE_CLASSES)("%s fills exactly its unit box, standing on the ground, so it is drawn to the engine's length, width and height", (vehicleClass) => {
    const shape = vehicleShape(vehicleClass);
    expect(extent(shape.positions, 0)).toEqual({ min: -0.5, max: 0.5 });
    expect(extent(shape.positions, 1)).toEqual({ min: 0, max: 1 });
    const across = extent(shape.positions, 2);
    expect(across.min).toBeCloseTo(-0.5, 6);
    expect(across.max).toBeCloseTo(0.5, 6);
  });

  it("has its wheels: two for a two-wheeler, three for an auto-rickshaw, four for a car", () => {
    expect(vehicleShape("two-wheeler").wheels).toBe(2);
    expect(vehicleShape("auto-rickshaw").wheels).toBe(3);
    expect(vehicleShape("car").wheels).toBe(4);
    expect(vehicleShape("bus").wheels).toBeGreaterThanOrEqual(4);
  });

  it("puts a rider on a two-wheeler, a canopy on an auto-rickshaw, a cabin on a car and windows on a bus", () => {
    expect(vehicleShape("two-wheeler").parts).toContain("rider");
    expect(vehicleShape("auto-rickshaw").parts).toContain("canopy");
    expect(vehicleShape("car").parts).toContain("cabin");
    expect(vehicleShape("bus").parts).toContain("windows");
  });

  it("is tinted by the vehicle's colour where it is seen from above, and keeps fixed colours for tyres and glass", () => {
    for (const vehicleClass of VEHICLE_CLASSES) {
      const { tint, positions } = vehicleShape(vehicleClass);
      expect(tint.length * 3).toBe(positions.length);
      // The highest point of every shape is tinted, so a vehicle's colour shows in the straight-down view.
      let topTint = -1;
      let topY = -Infinity;
      for (let v = 0; v < tint.length; v++) {
        if (positions[v * 3 + 1]! > topY) {
          topY = positions[v * 3 + 1]!;
          topTint = tint[v]!;
        }
      }
      expect(topTint).toBe(TINT.vehicle);
      expect([...tint]).toContain(TINT.fixed);
    }
  });

  it("gives an auto-rickshaw Bengaluru's yellow beside its green", () => {
    const { tint, colours } = vehicleShape("auto-rickshaw");
    const livery = [...tint].findIndex((value) => value === TINT.livery);
    expect(livery).toBeGreaterThanOrEqual(0);
    const [r, g, b] = [colours[livery * 3]!, colours[livery * 3 + 1]!, colours[livery * 3 + 2]!];
    expect(r).toBeGreaterThan(0.8);
    expect(g).toBeGreaterThan(0.6);
    expect(b).toBeLessThan(0.3);
  });

  it("stays low in detail: each shape is a few hundred triangles at most, so thousands can be drawn", () => {
    for (const vehicleClass of VEHICLE_CLASSES) expect(vehicleShape(vehicleClass).positions.length / 9).toBeLessThanOrEqual(400);
  });

  it("draws a vehicle class it does not know as a plain box", () => {
    expect(vehicleShape("tractor").positions.length / 9).toBe(12);
  });
});

describe("the faces of each shape", () => {
  it("a box's top faces up and its bottom faces down", () => {
    const { positions, normals } = vehicleShape("tractor");
    let up = 0;
    for (let v = 0; v < positions.length / 3; v++) {
      if (normals[v * 3 + 1] === 1) {
        up++;
        expect(positions[v * 3 + 1]).toBe(1);
      }
      if (normals[v * 3 + 1] === -1) expect(positions[v * 3 + 1]).toBe(0);
    }
    expect(up).toBe(6);
  });
});
