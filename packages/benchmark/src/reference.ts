/**
 * The reference for Tier 1 (docs/benchmark-standard.md, section 4): the
 * Intelligent Driver Model integrated numerically at a 0.001 s step, and the
 * IDM equilibrium flow-density curve.
 *
 * Written from the published equations (Treiber, Hennecke and Helbing 2000,
 * Phys. Rev. E 62, 1805), independently of the engine's code. It shares no code
 * with the engine; it takes only the parameter values as input.
 *
 *   dv/dt = a [ 1 - (v / v0)^4 - (s* / s)^2 ]
 *   s*    = s0 + max(0, v T + v dv / (2 sqrt(a b)))
 *
 * where s is the bumper-to-bumper gap to the leader and dv = v - v_leader is
 * the approach rate. A vehicle with no leader has no (s* / s)^2 term. A
 * vehicle never reverses: its speed is held at zero once it reaches zero.
 */

export interface IdmParameters {
  /** Desired speed v0, m/s. */
  desiredSpeedMps: number;
  /** Time gap T, s. */
  timeGapS: number;
  /** Standstill gap s0, m. */
  standstillGapM: number;
  /** Maximum acceleration a, m/s2. */
  maxAccelerationMps2: number;
  /** Comfortable deceleration b, m/s2. */
  comfortableDecelerationMps2: number;
  lengthM: number;
}

/** Integration step of the reference, fixed by the benchmark standard. */
export const REFERENCE_STEP_S = 0.001;

export function idmAcceleration(p: IdmParameters, v: number, gapM: number | undefined, approachRate: number): number {
  const free = 1 - Math.pow(v / p.desiredSpeedMps, 4);
  if (gapM === undefined) return p.maxAccelerationMps2 * free;
  const dynamic = v * p.timeGapS + (v * approachRate) / (2 * Math.sqrt(p.maxAccelerationMps2 * p.comfortableDecelerationMps2));
  const desiredGap = p.standstillGapM + Math.max(0, dynamic);
  // A gap of zero or less means contact; the reference keeps the term finite so the run can go on and the contact be reported.
  const gap = Math.max(gapM, 1e-6);
  return p.maxAccelerationMps2 * (free - (desiredGap / gap) * (desiredGap / gap));
}

/** One step of constant acceleration that stops at zero speed. Returns [distance, new speed]. */
function advance(v: number, a: number, dt: number): [number, number] {
  const next = v + a * dt;
  if (next >= 0) return [v * dt + 0.5 * a * dt * dt, next];
  return [a < 0 ? (v * v) / (-2 * a) : 0, 0];
}

/**
 * T2.1: a line of vehicles at rest closes up to a red signal and discharges at green. The red is
 * a standing vehicle whose rear is at the stop line; at `greenAtS` it goes. Returns the moments
 * each vehicle's front bumper crosses the stop line, in seconds after the green, in the line's order.
 */
export function integrateSignalQueue(p: IdmParameters, frontsM: number[], stopLineM: number, greenAtS: number, durationS: number): number[] {
  const n = frontsM.length;
  const x = [...frontsM];
  const v = new Array<number>(n).fill(0);
  const a = new Array<number>(n).fill(0);
  const crossed = new Array<number>(n).fill(NaN);
  const steps = Math.round(durationS / REFERENCE_STEP_S);
  const greenStep = Math.round(greenAtS / REFERENCE_STEP_S);
  for (let k = 0; k < steps; k++) {
    const red = k < greenStep;
    for (let i = 0; i < n; i++) {
      if (i === 0) a[i] = red ? idmAcceleration(p, v[i]!, stopLineM - x[i]!, v[i]!) : idmAcceleration(p, v[i]!, undefined, 0);
      else a[i] = idmAcceleration(p, v[i]!, x[i - 1]! - p.lengthM - x[i]!, v[i]! - v[i - 1]!);
    }
    for (let i = 0; i < n; i++) {
      const before = x[i]!;
      const [distance, speed] = advance(v[i]!, a[i]!, REFERENCE_STEP_S);
      x[i] = before + distance;
      v[i] = speed;
      if (Number.isNaN(crossed[i]!) && before < stopLineM && x[i]! >= stopLineM) {
        crossed[i] = (k + (stopLineM - before) / distance) * REFERENCE_STEP_S - greenAtS;
      }
    }
  }
  return crossed;
}

/** T1.1: time for one vehicle on an empty road to go from rest to a fraction of its desired speed. */
export function timeToReachSpeedFraction(p: IdmParameters, fraction: number): number {
  const target = fraction * p.desiredSpeedMps;
  let v = 0;
  let t = 0;
  for (;;) {
    const a = idmAcceleration(p, v, undefined, 0);
    const next = v + a * REFERENCE_STEP_S;
    if (next >= target) return t + ((target - v) / (next - v)) * REFERENCE_STEP_S;
    v = next;
    t += REFERENCE_STEP_S;
    if (t > 3600) throw new Error("The reference vehicle never reached the target speed");
  }
}

export interface PlatoonVehicle {
  /** Front bumper, m. */
  frontM: number;
  speedMps: number;
  /** Never moves. */
  stationary?: boolean;
  /**
   * Speed prescribed at the sample times (index k is time k * sampleStepS),
   * linear in between. A vehicle with a prescribed speed ignores the model.
   */
  prescribedSpeedMps?: number[];
}

export interface PlatoonTrajectory {
  /** Sample times, s. */
  timesS: number[];
  /** [vehicle][sample]: front bumper position and speed. */
  frontM: number[][];
  speedMps: number[][];
  /** [vehicle]: smallest gap to its leader over the whole run (at every 0.001 s step); Infinity for the first vehicle. */
  minGapM: number[];
}

/**
 * A line of vehicles on one lane, first vehicle in front, each following the
 * one before it. All have the same parameters. Sampled every `sampleStepS`.
 */
export function integratePlatoon(
  p: IdmParameters,
  vehicles: PlatoonVehicle[],
  durationS: number,
  sampleStepS: number,
): PlatoonTrajectory {
  const n = vehicles.length;
  const x = vehicles.map((vehicle) => vehicle.frontM);
  const v = vehicles.map((vehicle) => (vehicle.stationary ? 0 : vehicle.speedMps));
  const a = new Array<number>(n).fill(0);
  const minGap = new Array<number>(n).fill(Infinity);
  const perSample = Math.round(sampleStepS / REFERENCE_STEP_S);
  const samples = Math.round(durationS / sampleStepS);
  const out: PlatoonTrajectory = {
    timesS: [],
    frontM: vehicles.map(() => []),
    speedMps: vehicles.map(() => []),
    minGapM: minGap,
  };
  const record = (k: number) => {
    out.timesS.push(k * sampleStepS);
    for (let i = 0; i < n; i++) {
      out.frontM[i]!.push(x[i]!);
      out.speedMps[i]!.push(v[i]!);
    }
  };
  const noteGaps = () => {
    for (let i = 1; i < n; i++) {
      const gap = x[i - 1]! - p.lengthM - x[i]!;
      if (gap < minGap[i]!) minGap[i] = gap;
    }
  };
  noteGaps();
  record(0);
  for (let k = 0; k < samples; k++) {
    for (let sub = 0; sub < perSample; sub++) {
      for (let i = 0; i < n; i++) {
        const vehicle = vehicles[i]!;
        if (vehicle.stationary) {
          a[i] = 0;
        } else if (vehicle.prescribedSpeedMps) {
          const from = vehicle.prescribedSpeedMps[k] ?? 0;
          const to = vehicle.prescribedSpeedMps[k + 1] ?? from;
          a[i] = (to - from) / sampleStepS;
        } else if (i === 0) {
          a[i] = idmAcceleration(p, v[i]!, undefined, 0);
        } else {
          a[i] = idmAcceleration(p, v[i]!, x[i - 1]! - p.lengthM - x[i]!, v[i]! - v[i - 1]!);
        }
      }
      for (let i = 0; i < n; i++) {
        if (vehicles[i]!.stationary) continue;
        const [distance, speed] = advance(v[i]!, a[i]!, REFERENCE_STEP_S);
        x[i] = x[i]! + distance;
        v[i] = speed;
      }
      noteGaps();
    }
    // A prescribed speed is exact at the sample times, free of accumulated rounding.
    for (let i = 0; i < n; i++) {
      const prescribed = vehicles[i]!.prescribedSpeedMps;
      if (prescribed) v[i] = prescribed[k + 1] ?? v[i]!;
    }
    record(k + 1);
  }
  return out;
}

export interface RingResult {
  /** Mean speed over all vehicles and the whole measuring window, m/s. */
  meanSpeedMps: number;
  /** Density times mean speed, vehicles/h. */
  flowPerHour: number;
  /** Standard deviation of speed over all vehicles and the measuring window, m/s. Zero in a uniform flow. */
  speedSpreadMps: number;
  minGapM: number;
}

/**
 * T1.3: vehicles on one lane of a ring road. `frontM` are positions along the
 * ring in increasing order; each vehicle follows the next one in the list, and
 * the last follows the first around the ring.
 */
export function integrateRing(
  p: IdmParameters,
  ringLengthM: number,
  frontM: number[],
  speedMps: number[],
  durationS: number,
  measureFromS: number,
): RingResult {
  const n = frontM.length;
  const x = Float64Array.from(frontM);
  const v = Float64Array.from(speedMps);
  const a = new Float64Array(n);
  const steps = Math.round(durationS / REFERENCE_STEP_S);
  const measureFrom = Math.round(measureFromS / REFERENCE_STEP_S);
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  let minGap = Infinity;
  for (let step = 0; step < steps; step++) {
    for (let i = 0; i < n; i++) {
      const leader = i + 1 < n ? i + 1 : 0;
      const gap = x[leader]! + (leader === 0 ? ringLengthM : 0) - p.lengthM - x[i]!;
      if (gap < minGap) minGap = gap;
      a[i] = n === 1 ? idmAcceleration(p, v[i]!, undefined, 0) : idmAcceleration(p, v[i]!, gap, v[i]! - v[leader]!);
    }
    for (let i = 0; i < n; i++) {
      const [distance, speed] = advance(v[i]!, a[i]!, REFERENCE_STEP_S);
      x[i] = x[i]! + distance;
      v[i] = speed;
    }
    // Sample once per 0.2 s, at the end of the step, as the engines are sampled.
    if (step + 1 > measureFrom && (step + 1) % 200 === 0) {
      for (let i = 0; i < n; i++) {
        sum += v[i]!;
        sumSquares += v[i]! * v[i]!;
        count++;
      }
    }
  }
  const mean = sum / count;
  return {
    meanSpeedMps: mean,
    flowPerHour: (n / ringLengthM) * mean * 3600,
    speedSpreadMps: Math.sqrt(Math.max(0, sumSquares / count - mean * mean)),
    minGapM: minGap,
  };
}

export interface EquilibriumPoint {
  densityPerKm: number;
  gapM: number;
  speedMps: number;
  flowPerHour: number;
  /**
   * Whether uniform flow at this density is stable against growing stop-and-go
   * waves in the continuous model (linear string stability, Wilson 2008;
   * Treiber and Kesting 2013, ch. 15): with the partial derivatives of the
   * acceleration taken at equilibrium, stable when
   *   ve'(s) <= -a_v / 2 - a_dv ,   ve'(s) = -a_s / a_v .
   */
  stringStable: boolean;
}

/** The IDM equilibrium (all vehicles at one gap and one speed, acceleration zero) at a density. */
export function equilibrium(p: IdmParameters, densityPerKm: number): EquilibriumPoint {
  const gapM = 1000 / densityPerKm - p.lengthM;
  if (!(gapM > p.standstillGapM)) {
    return { densityPerKm, gapM, speedMps: 0, flowPerHour: 0, stringStable: true };
  }
  // The acceleration falls steadily with speed, so bisect for its zero.
  let low = 0;
  let high = p.desiredSpeedMps;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (idmAcceleration(p, mid, gapM, 0) > 0) low = mid;
    else high = mid;
  }
  const speedMps = (low + high) / 2;

  const h = 1e-5;
  const aS = (idmAcceleration(p, speedMps, gapM + h, 0) - idmAcceleration(p, speedMps, gapM - h, 0)) / (2 * h);
  const aV = (idmAcceleration(p, speedMps + h, gapM, 0) - idmAcceleration(p, speedMps - h, gapM, 0)) / (2 * h);
  const aDv = (idmAcceleration(p, speedMps, gapM, h) - idmAcceleration(p, speedMps, gapM, -h)) / (2 * h);
  const stringStable = -aS / aV <= -aV / 2 - aDv;

  return { densityPerKm, gapM, speedMps, flowPerHour: densityPerKm * speedMps * 3.6, stringStable };
}

/** The highest flow on the equilibrium curve, found on a fine grid of densities. */
export function equilibriumCapacity(p: IdmParameters): EquilibriumPoint {
  let best = equilibrium(p, 1);
  for (let density = 1; density < 1000 / (p.lengthM + p.standstillGapM); density += 0.01) {
    const point = equilibrium(p, density);
    if (point.flowPerHour > best.flowPerHour) best = point;
  }
  return best;
}
