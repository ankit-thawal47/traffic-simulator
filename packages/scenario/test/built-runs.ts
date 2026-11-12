import { describe, expect, it } from "vitest";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import { builtBaseline, resolveScenario, type BuildingBlock } from "../src/index";

/**
 * Every built network runs: each layout here runs for a simulated hour with
 * the consistency checks, in mixed traffic and with lane discipline, with
 * three seeds and the default demand, and no vehicle gets stuck. Shared by
 * the builder-runs-*.test.ts files, which are split so that they run in parallel.
 */
const ONE_HOUR_S = 3600;

export const priority = (block: BuildingBlock): BuildingBlock => (block.kind === "straight" ? block : { ...block, control: "priority" });

export function runsForAnHour(layouts: Record<string, BuildingBlock[]>): void {
  const runs = Object.entries(layouts).flatMap(([name, blocks]) =>
    [false, true].flatMap((laneDiscipline) => [1, 2, 3].map((seed) => ({ name, blocks, laneDiscipline, seed }))),
  );
  describe("a built network runs for an hour with the consistency checks passing and no stuck vehicles", () => {
    it.each(runs)("$name, lane discipline $laneDiscipline, seed $seed", ({ blocks, laneDiscipline, seed }) => {
      const baseline = builtBaseline({ blocks }, seed);
      if (!baseline.ok) throw new Error(baseline.message);

      const report = checkRunConsistency({ ...resolveScenario(baseline.value), laneDiscipline }, { durationS: ONE_HOUR_S });

      expect(report.violations).toEqual([]);
      expect(report.results.stuckVehicles).toBe(0);
      expect(report.results.vehiclesThrough).toBeGreaterThan(1000);
    });
  });
}
