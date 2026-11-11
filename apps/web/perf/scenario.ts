import { VEHICLE_CLASS_ASSUMPTIONS, type InitialVehicle, type Road, type RunInput } from "@traffic-simulator/engine";

/**
 * The measurement scenario, built from the engine's public input only.
 *
 * Parallel straight roads, each ROAD_LENGTH_M long, one direction, single file,
 * cars only. Each road starts with VEHICLES_PER_ROAD cars spaced evenly and
 * receives demand that replaces the cars that leave, so the number of vehicles
 * on the network stays near the target for the whole run (it wanders by a few
 * per cent because arrivals are random).
 *
 * This is what the engine can do after ticket 01. It has no junctions, no
 * strips and one vehicle class, so its cost per vehicle is a floor.
 */
export const ROAD_LENGTH_M = 2000;
export const ROAD_SPACING_M = 12;
export const VEHICLES_PER_ROAD = 50;
export const SPEED_LIMIT_MPS = 13.9;
export const INITIAL_SPEED_MPS = 13;
/** Chosen so arrivals roughly balance departures: 50 cars per 2 km at about 13.3 m/s. */
export const VEHICLES_PER_HOUR_PER_ROAD = 1200;

export function buildMeasurementScenario(targetVehicles: number, seed: number): RunInput {
  const roadCount = Math.max(1, Math.round(targetVehicles / VEHICLES_PER_ROAD));
  const perRoad = targetVehicles / roadCount;
  const carLengthM = VEHICLE_CLASS_ASSUMPTIONS.car.lengthM;
  const roads: Road[] = [];
  const initialVehicles: InitialVehicle[] = [];
  let placed = 0;
  for (let r = 0; r < roadCount; r++) {
    const id = `road-${r}`;
    const y = (r - (roadCount - 1) / 2) * ROAD_SPACING_M;
    roads.push({
      id,
      points: [
        { x: -ROAD_LENGTH_M / 2, y },
        { x: ROAD_LENGTH_M / 2, y },
      ],
      widthM: 3.5,
      speedLimitMps: SPEED_LIMIT_MPS,
    });
    const onThisRoad = Math.round((r + 1) * perRoad) - placed;
    placed += onThisRoad;
    const spacingM = (ROAD_LENGTH_M - carLengthM) / onThisRoad;
    for (let i = 0; i < onThisRoad; i++) {
      initialVehicles.push({ roadId: id, positionM: ROAD_LENGTH_M - i * spacingM, speedMps: INITIAL_SPEED_MPS });
    }
  }
  return {
    network: { formatVersion: 1, roads },
    demand: {
      flows: roads.map((road) => ({
        entryRoadId: road.id,
        exitRoadId: road.id,
        vehiclesPerHour: VEHICLES_PER_HOUR_PER_ROAD,
      })),
    },
    seed,
    initialVehicles,
  };
}
