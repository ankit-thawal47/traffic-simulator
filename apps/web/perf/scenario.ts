import {
  BENGALURU_VEHICLE_MIX,
  VEHICLE_CLASSES,
  VEHICLE_CLASS_ASSUMPTIONS,
  type InitialVehicle,
  type Road,
  type RunInput,
  type VehicleClass,
} from "@traffic-simulator/engine";

/**
 * The measurement scenarios, built from the engine's public input only.
 *
 * Both are parallel straight one-way roads with no junctions. Each road starts
 * with vehicles already spread along it and receives demand that replaces the
 * vehicles that leave, so the number of vehicles on the network stays near the
 * target for the whole run (it wanders by a few per cent because arrivals are
 * random and the starting spread is not exactly the settled one).
 *
 *   mixed      Mixed traffic, no lane discipline: 1,000 m roads, 10.5 m wide
 *              (3 lanes), the Bengaluru vehicle mix, 6,000 vehicles an hour a
 *              road, about 125 vehicles on a road. Busy but flowing.
 *   cars-only  Cars in single file: 2,000 m roads, 3.5 m wide, 1,200 vehicles
 *              an hour a road, 50 cars on a road. The scenario of the first
 *              measurement, before the engine had mixed traffic.
 *
 * Neither has a signal, a junction or a queue, so neither shows what stopped
 * and filtering traffic costs.
 */
export type MeasurementScenario = "mixed" | "cars-only";

export const SCENARIOS: Record<
  MeasurementScenario,
  {
    description: string;
    roadLengthM: number;
    widthM: number;
    lanes: number;
    vehiclesPerRoad: number;
    vehiclesPerHourPerRoad: number;
    initialSpeedMps: number;
    mixed: boolean;
  }
> = {
  mixed: {
    description:
      "Mixed traffic without lane discipline. Parallel straight one-way roads, 1,000 m long, 10.5 m wide (3 lanes), 25 m apart, speed limit 13.9 m/s, no junctions. One road for every 125 vehicles asked for (8, 24 and 40 roads for 1,000, 3,000 and 5,000 vehicles). Each road starts with 125 vehicles of the Bengaluru vehicle mix in three files at 12 m/s and has a demand of 6,000 vehicles an hour of the same mix, which replaces the vehicles that leave. Traffic is busy but flowing: there is no signal and no queue.",
    roadLengthM: 1000,
    widthM: 10.5,
    lanes: 3,
    vehiclesPerRoad: 125,
    vehiclesPerHourPerRoad: 6000,
    initialSpeedMps: 12,
    mixed: true,
  },
  "cars-only": {
    description:
      "Cars only, single file. Parallel straight one-way roads, 2,000 m long, 3.5 m wide (1 lane), 25 m apart, speed limit 13.9 m/s, no junctions. One road for every 50 vehicles asked for (20, 60 and 100 roads). Each road starts with 50 cars spaced evenly at 13 m/s and has a demand of 1,200 cars an hour.",
    roadLengthM: 2000,
    widthM: 3.5,
    lanes: 1,
    vehiclesPerRoad: 50,
    vehiclesPerHourPerRoad: 1200,
    initialSpeedMps: 13,
    mixed: false,
  },
};

export const ROAD_SPACING_M = 25;
export const SPEED_LIMIT_MPS = 13.9;

/** The k-th vehicle's class, spread evenly through the sequence in the proportions of the vehicle mix. */
function classOf(k: number): VehicleClass {
  const total = VEHICLE_CLASSES.reduce((sum, vehicleClass) => sum + (BENGALURU_VEHICLE_MIX[vehicleClass] ?? 0), 0);
  let u = ((k * 0.6180339887498949) % 1) * total;
  for (const vehicleClass of VEHICLE_CLASSES) {
    u -= BENGALURU_VEHICLE_MIX[vehicleClass] ?? 0;
    if (u < 0) return vehicleClass;
  }
  return "car";
}

export function buildMeasurementScenario(kind: MeasurementScenario, targetVehicles: number, seed: number): RunInput {
  const scenario = SCENARIOS[kind];
  const roadCount = Math.max(1, Math.round(targetVehicles / scenario.vehiclesPerRoad));
  const perRoad = targetVehicles / roadCount;
  const longestM = Math.max(...VEHICLE_CLASSES.map((vehicleClass) => VEHICLE_CLASS_ASSUMPTIONS[vehicleClass].lengthM));
  const roads: Road[] = [];
  const initialVehicles: InitialVehicle[] = [];
  let placed = 0;
  for (let r = 0; r < roadCount; r++) {
    const id = `road-${r}`;
    const y = (r - (roadCount - 1) / 2) * ROAD_SPACING_M;
    roads.push({
      id,
      points: [
        { x: -scenario.roadLengthM / 2, y },
        { x: scenario.roadLengthM / 2, y },
      ],
      widthM: scenario.widthM,
      lanes: scenario.lanes,
      speedLimitMps: SPEED_LIMIT_MPS,
    });
    const onThisRoad = Math.round((r + 1) * perRoad) - placed;
    // Vehicles start in files, one file to a lane, in rows spaced evenly along the road.
    const rows = Math.ceil(onThisRoad / scenario.lanes);
    const spacingM = (scenario.roadLengthM - longestM) / rows;
    for (let i = 0; i < onThisRoad; i++) {
      const row = Math.floor(i / scenario.lanes);
      const lane = i % scenario.lanes;
      initialVehicles.push({
        roadId: id,
        positionM: scenario.roadLengthM - row * spacingM,
        speedMps: scenario.initialSpeedMps,
        vehicleClass: scenario.mixed ? classOf(placed + i) : "car",
        lateralM: ((lane + 0.5) * scenario.widthM) / scenario.lanes,
      });
    }
    placed += onThisRoad;
  }
  return {
    network: { formatVersion: 2, roads },
    demand: {
      flows: roads.map((road) => ({
        entryRoadId: road.id,
        exitRoadId: road.id,
        vehiclesPerHour: scenario.vehiclesPerHourPerRoad,
      })),
      ...(scenario.mixed ? { vehicleMix: BENGALURU_VEHICLE_MIX } : {}),
    },
    seed,
    laneDiscipline: false,
    initialVehicles,
  };
}
