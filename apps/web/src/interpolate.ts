import type { Snapshot, VehicleState } from "@traffic-simulator/engine";

/**
 * Where to draw each vehicle between two snapshots, so movement looks smooth
 * although the engine advances in steps. `fraction` runs from 0 (the earlier
 * snapshot) to 1 (the later one). Only vehicles in the later snapshot are
 * drawn; one that was not in the earlier snapshot is drawn where it is now.
 */
export function interpolateVehicles(earlier: Snapshot | undefined, later: Snapshot, fraction: number): VehicleState[] {
  if (!earlier) return later.vehicles;
  const f = Math.min(1, Math.max(0, fraction));
  const before = new Map(earlier.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  return later.vehicles.map((vehicle) => {
    const was = before.get(vehicle.id);
    if (!was || was.roadId !== vehicle.roadId) return vehicle;
    return {
      ...vehicle,
      positionM: was.positionM + (vehicle.positionM - was.positionM) * f,
      lateralM: was.lateralM + (vehicle.lateralM - was.lateralM) * f,
      speedMps: was.speedMps + (vehicle.speedMps - was.speedMps) * f,
    };
  });
}
