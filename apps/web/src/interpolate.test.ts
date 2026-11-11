import type { Snapshot, VehicleState } from "@traffic-simulator/engine";
import { describe, expect, it } from "vitest";
import { interpolateVehicles } from "./interpolate";

function car(id: number, positionM: number): VehicleState {
  return { id, vehicleClass: "car", roadId: "main", positionM, lateralM: 1.75, speedMps: 10, lengthM: 4.4, widthM: 1.9 };
}

const earlier: Snapshot = { timeS: 0, vehicles: [car(1, 100), car(2, 50)] };
const later: Snapshot = { timeS: 0.2, vehicles: [car(2, 52), car(3, 4.4)] };

describe("drawing vehicles between two snapshots", () => {
  it("places a vehicle part-way between where it was and where it is", () => {
    const drawn = interpolateVehicles(earlier, later, 0.25);
    expect(drawn.find((vehicle) => vehicle.id === 2)!.positionM).toBe(50.5);
  });

  it("draws a vehicle that has just entered where it is now", () => {
    const drawn = interpolateVehicles(earlier, later, 0.25);
    expect(drawn.find((vehicle) => vehicle.id === 3)!.positionM).toBe(4.4);
  });

  it("does not draw a vehicle that has left", () => {
    expect(interpolateVehicles(earlier, later, 0.25).map((vehicle) => vehicle.id)).toEqual([2, 3]);
  });

  it("never draws beyond the later snapshot", () => {
    expect(interpolateVehicles(earlier, later, 3).find((vehicle) => vehicle.id === 2)!.positionM).toBe(52);
  });

  it("draws the first snapshot as it is", () => {
    expect(interpolateVehicles(undefined, later, 0.5)).toEqual(later.vehicles);
  });
});
