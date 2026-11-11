/**
 * Seeded randomness. Every random choice in a run comes from the seed, with a
 * separate stream per concern, so adding a new kind of random choice later does
 * not disturb the existing ones.
 *
 * Only integer operations and + - * / are used, so a run repeats exactly on
 * any JavaScript engine (Math.log and friends are not guaranteed bit-identical
 * across engines).
 */
export interface RandomStream {
  /** Uniform in [0, 1). */
  next(): number;
}

/** Mix a seed and a concern name into a 32-bit starting state (FNV-1a over the name, then an avalanche). */
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

/** A mulberry32 generator (public-domain algorithm) seeded for one concern. */
export function createRandomStream(seed: number, concern: string): RandomStream {
  let state = streamState(seed, concern);
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

const LN2 = 0.6931471805599453;

/**
 * Natural logarithm for 0 < x <= 1 using only + - * /, so it gives the same
 * bits everywhere. Range-reduce to [0.5, 1), then ln(m) = 2 atanh((m-1)/(m+1)).
 */
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

/** A draw from the exponential distribution with the given mean. */
export function exponential(stream: RandomStream, mean: number): number {
  // 1 - u is in (0, 1], so the logarithm is finite.
  return -mean * portableLn(1 - stream.next());
}
