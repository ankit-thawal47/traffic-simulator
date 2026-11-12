/**
 * The departures our engine's demand produces, worked out outside the engine so
 * that SUMO can be given the identical ones (benchmark standard, fairness rule 1:
 * identical departures, by time, vehicle class, origin and destination).
 *
 * The engine draws each flow's arrivals and vehicle classes from its own seeded
 * random streams (packages/engine/src/random.ts and the demand part of run.ts).
 * Those are not part of the engine's public interface, so the few lines that
 * produce them are repeated here exactly. Every run that uses this checks the
 * result against the engine: the number of vehicles of each class the engine
 * produced (results().delayByVehicleClass[...].vehicles) must equal the count
 * here, or the job fails (see checkDepartures).
 */
import { VEHICLE_CLASSES, type Results, type RunInput, type VehicleClass } from "@traffic-simulator/engine";

/** One vehicle the demand produces: when, of what class, from where to where. */
export interface FlowDeparture {
  /** The moment the demand produced it (it may then wait to enter), seconds. */
  timeS: number;
  flowIndex: number;
  entryRoadId: string;
  exitRoadId: string;
  vehicleClass: VehicleClass;
}

// --- A copy of packages/engine/src/random.ts (createRandomStream, exponential). ---

function streamState(seed: number, concern: string): number {
  let h = (2166136261 ^ (seed | 0)) >>> 0;
  for (let i = 0; i < concern.length; i++) {
    h ^= concern.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function createRandomStream(seed: number, concern: string): () => number {
  let state = streamState(seed, concern);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LN2 = 0.6931471805599453;

function portableLn(x: number): number {
  let halvings = 0;
  let m = x;
  while (m < 0.5) {
    m *= 2;
    halvings++;
  }
  const z = (m - 1) / (m + 1);
  const z2 = z * z;
  let term = z;
  let sum = 0;
  for (let k = 1; k <= 41; k += 2) {
    sum += term / k;
    term *= z2;
  }
  return 2 * sum - halvings * LN2;
}

function exponential(next: () => number, mean: number): number {
  return -mean * portableLn(1 - next());
}

// --- The demand part of packages/engine/src/run.ts. ---

/**
 * Every vehicle the engine's demand produces up to `untilS` (inclusive of the
 * last step), in order of time. The engine produces a vehicle at the end of the
 * first step whose time is at or after the drawn arrival time; that time is
 * when it first tries to enter. SUMO is given the drawn time itself.
 */
export function engineDepartures(input: RunInput, untilS: number): FlowDeparture[] {
  let cumulative: number[] | undefined;
  const inMix: VehicleClass[] = [];
  if (input.demand.vehicleMix) {
    let total = 0;
    cumulative = [];
    for (const vehicleClass of VEHICLE_CLASSES) {
      const share = input.demand.vehicleMix[vehicleClass] ?? 0;
      if (share > 0) inMix.push(vehicleClass);
      total += share;
      cumulative.push(total);
    }
    cumulative = cumulative.map((share) => share / total);
  } else {
    inMix.push("car");
  }
  const draw = (next: () => number): VehicleClass => {
    if (!cumulative) return "car";
    const u = next();
    for (let i = 0; i < VEHICLE_CLASSES.length; i++) if (u < cumulative[i]!) return VEHICLE_CLASSES[i]!;
    return inMix[inMix.length - 1]!;
  };
  const departures: FlowDeparture[] = [];
  input.demand.flows.forEach((flow, flowIndex) => {
    if (flow.vehiclesPerHour === 0) return;
    const mean = 3600 / flow.vehiclesPerHour;
    const random = createRandomStream(input.seed, `demand:${flowIndex}`);
    const classRandom = createRandomStream(input.seed, `vehicle-class:${flowIndex}`);
    let next = exponential(random, mean);
    while (next <= untilS + 1e-9) {
      departures.push({ timeS: next, flowIndex, entryRoadId: flow.entryRoadId, exitRoadId: flow.exitRoadId, vehicleClass: draw(classRandom) });
      next += exponential(random, mean);
    }
  });
  departures.sort((a, b) => a.timeS - b.timeS || a.flowIndex - b.flowIndex);
  return departures;
}

/**
 * Throws unless the engine produced exactly these departures by the time of `results`:
 * the same number of vehicles of each class (initial vehicles aside, which `placed` gives per class).
 */
export function checkDepartures(departures: FlowDeparture[], results: Results, placed: Partial<Record<VehicleClass, number>> = {}): void {
  // The engine adds a vehicle to the demand at the end of the step whose time has reached its arrival time.
  const produced = departures.filter((departure) => departure.timeS <= results.timeS + 1e-9);
  for (const vehicleClass of VEHICLE_CLASSES) {
    const expected = produced.filter((departure) => departure.vehicleClass === vehicleClass).length;
    const engine = results.delayByVehicleClass[vehicleClass].vehicles - (placed[vehicleClass] ?? 0);
    if (expected !== engine) {
      throw new Error(
        `Departures worked out for SUMO disagree with the engine at ${results.timeS} s: ${expected} ${vehicleClass}s here, ${engine} in the engine`,
      );
    }
  }
}
