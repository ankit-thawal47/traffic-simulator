/**
 * The jobs of Tiers 2 to 5, one scenario and seed each, run in processes of their own by
 * main-tiers.ts (through tiers-job-cli.ts), like the jobs of Tiers 0 and 1 in jobs.ts.
 */
import { rmSync } from "node:fs";
import type { VehicleMix } from "@traffic-simulator/engine";
import { CHENNAI_FILES } from "./chennai";
import { runT21, runT22, runT23, runT24, T22, T23 } from "./tier2";
import { runT3 } from "./tier3";
import { chennaiField, runT45, runT46, runT4Chennai } from "./tier4";
import { runT5, T5, type T5Kind } from "./tier5";

export type TierJob =
  | { kind: "t2.1"; id: string }
  | { kind: "t2.2"; id: string; share: number; seed: number }
  | { kind: "t2.3"; id: string; majorFlowPerHour: number; seed: number }
  | { kind: "t2.4"; id: string; seed: number }
  | { kind: "t3"; id: string; seed: number }
  | { kind: "t4-field"; id: string; period: number }
  | { kind: "t4-chennai"; id: string; period: number; seed: number }
  | { kind: "t4.5"; id: string; seed: number }
  | { kind: "t4.6"; id: string; seed: number }
  | { kind: "t5"; id: string; vehicles: number; vehicleKind: T5Kind; engine: "ours" | "sumo" };

export interface TierJobContext {
  workDir: string;
  sumo: boolean;
  keepWork: boolean;
}

export const TIER_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** T2.2: shares of the reference capacity; 1.3 is beyond capacity, run to read each engine's own capacity (report only). */
export const T22_SHARES = [...T22.shares, 1.3];

export function allTierJobs(): TierJob[] {
  const jobs: TierJob[] = [{ kind: "t2.1", id: "t2.1" }];
  for (const share of T22_SHARES) for (const seed of TIER_SEEDS) jobs.push({ kind: "t2.2", id: `t2.2-x${share}-s${seed}`, share, seed });
  for (const q of T23.majorFlows) for (const seed of TIER_SEEDS) jobs.push({ kind: "t2.3", id: `t2.3-q${q}-s${seed}`, majorFlowPerHour: q, seed });
  for (const seed of TIER_SEEDS) jobs.push({ kind: "t2.4", id: `t2.4-s${seed}`, seed });
  for (const seed of TIER_SEEDS) jobs.push({ kind: "t3", id: `t3-s${seed}`, seed });
  for (const period of [0, 1]) jobs.push({ kind: "t4-field", id: `t4-field-p${period}`, period });
  for (const period of [0, 1]) for (const seed of TIER_SEEDS) jobs.push({ kind: "t4-chennai", id: `t4-chennai-p${period}-s${seed}`, period, seed });
  for (const seed of TIER_SEEDS) jobs.push({ kind: "t4.5", id: `t4.5-s${seed}`, seed });
  for (const seed of TIER_SEEDS) jobs.push({ kind: "t4.6", id: `t4.6-s${seed}`, seed });
  for (const vehicles of T5.sizes) {
    for (const vehicleKind of ["cars", "mixed"] as T5Kind[]) {
      for (const engine of ["ours", "sumo"] as const) jobs.push({ kind: "t5", id: `t5-${vehicles}-${vehicleKind}-${engine}`, vehicles, vehicleKind, engine });
    }
  }
  return jobs;
}

const fieldCache = new Map<number, { demandPerHour: number; mix: VehicleMix }>();

export function runTierJob(job: TierJob, context: TierJobContext): unknown {
  try {
    switch (job.kind) {
      case "t2.1":
        return runT21(context);
      case "t2.2":
        return runT22(job, context);
      case "t2.3":
        return runT23(job, context);
      case "t2.4":
        return runT24(job, context);
      case "t3":
        return runT3(job, context);
      case "t4-field":
        return { period: job.period, ...chennaiField(CHENNAI_FILES[job.period]!) };
      case "t4-chennai": {
        let field = fieldCache.get(job.period);
        if (!field) {
          const full = chennaiField(CHENNAI_FILES[job.period]!);
          field = { demandPerHour: full.demandPerHour, mix: full.mix };
          fieldCache.set(job.period, field);
        }
        return runT4Chennai({ period: job.period, seed: job.seed, ...field }, context);
      }
      case "t4.5":
        return runT45(job, context);
      case "t4.6":
        return runT46(job, context);
      case "t5":
        if (job.engine === "sumo" && !context.sumo) return null;
        return runT5({ vehicles: job.vehicles, kind: job.vehicleKind, engine: job.engine }, context);
    }
  } finally {
    if (!context.keepWork) rmSync(context.workDir, { recursive: true, force: true });
  }
}
