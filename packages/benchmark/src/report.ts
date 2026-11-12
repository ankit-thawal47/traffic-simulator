/**
 * Builds the results table (a Markdown document) from the raw results.
 *
 * Every number in the document is read from packages/benchmark/results/raw.
 * The tolerances are those of docs/benchmark-standard.md and are applied here
 * exactly as written. The interpretation written by hand after a run lives in
 * findings.ts and is included as it is.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FINDINGS } from "./findings";
import type { EngineCounts, OpenRoadResult, RingResult, SumoCounts, T11Result, T12PartialResult, T12Result, T15Result, Tier0Result } from "./jobs";
import { LANE_DROP, LEADER_PROFILE, OPEN_ROAD, RING_DURATION_S, RING_MEASURE_FROM_S } from "./jobs";
import type { Meta } from "./main";
import { equilibrium, equilibriumCapacity } from "./reference";
import { CAR, STEP_S } from "./scenario";
import { carTypeAttributes } from "./sumo-run";

/** Tolerances of the benchmark standard, section 4. */
const TOLERANCE = {
  t11: 0.02,
  t12RmseMps: 0.2,
  t13Point: 0.05,
  t13Capacity: 0.03,
  t14: 0.1,
  t15: 0.1,
};

interface Entry<T> {
  job: { kind: string; id: string };
  wallClockS: number;
  result: T;
}

function load<T>(rawDir: string, kind: string): Entry<T>[] {
  const file = join(rawDir, `${kind}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Entry<T>[]) : [];
}

// Student's t for a two-sided 95% interval, by degrees of freedom.
const T95 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131];

interface Stat {
  n: number;
  mean: number;
  /** Half-width of the 95% confidence interval of the mean. */
  ci: number;
  min: number;
  max: number;
}

function stat(values: number[]): Stat {
  const n = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance = n > 1 ? values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / (n - 1) : 0;
  const t = T95[Math.min(n - 1, T95.length - 1)] ?? 1.96;
  return { n, mean, ci: n > 1 ? t * Math.sqrt(variance / n) : 0, min: Math.min(...values), max: Math.max(...values) };
}

const num = (value: number, digits = 1) =>
  value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (value: number, digits = 2) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
const meanCi = (s: Stat, digits = 1) => `${num(s.mean, digits)} ± ${num(s.ci, digits)}`;
const verdict = (ok: boolean) => (ok ? "pass" : "**FAIL**");
const NOT_RUN = "not run";

function table(header: string[], rows: string[][]): string {
  return [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
}

export function writeReport(rawDir: string, reportFile: string): void {
  const tier0 = load<Tier0Result>(rawDir, "tier0").map((entry) => entry.result);
  const t11 = load<T11Result>(rawDir, "t1.1")[0]?.result;
  const t12 = load<T12Result>(rawDir, "t1.2")[0]?.result;
  const t12p = load<T12PartialResult>(rawDir, "t1.2-partial")[0]?.result;
  const ring = load<RingResult>(rawDir, "ring").map((entry) => entry.result);
  const t15 = load<T15Result>(rawDir, "t1.5").map((entry) => entry.result);
  const open = load<OpenRoadResult>(rawDir, "open-road").map((entry) => entry.result);
  const metaFile = join(dirname(rawDir), "meta.json");
  const meta = existsSync(metaFile) ? (JSON.parse(readFileSync(metaFile, "utf8")) as Meta) : undefined;
  const findings = FINDINGS.trim();
  if (!t11 || !t12 || !t12p || ring.length === 0 || t15.length === 0 || tier0.length === 0) {
    console.log("Raw results are incomplete; the table is not written. Run the whole benchmark first.");
    return;
  }
  const sumoRan = t11.sumo !== null;

  // ------------------------------------------------------------------ counts over every run
  const engineRuns: { test: string; counts: EngineCounts }[] = [
    ...tier0.map((result) => ({ test: "Tier 0 scenarios", counts: result as EngineCounts })),
    { test: "T1.1", counts: t11.ours },
    { test: "T1.2 (part)", counts: t12p.ours },
    ...ring.map((result) => ({ test: result.lanes === 1 ? "T1.3" : `T1.4 (${result.lanes} lanes)`, counts: result.ours as EngineCounts })),
    ...t15.map((result) => ({ test: "T1.5", counts: result.ours as EngineCounts })),
    ...open.map((result) => ({ test: "Open road (capacity per lane)", counts: result as EngineCounts })),
  ];
  const sumoRuns: { test: string; counts: SumoCounts }[] = [];
  if (t11.sumo) sumoRuns.push({ test: "T1.1", counts: t11.sumo });
  if (t12.sumo) sumoRuns.push({ test: "T1.2", counts: t12.sumo });
  if (t12p.sumo) sumoRuns.push({ test: "T1.2 (part)", counts: t12p.sumo });
  for (const result of ring) {
    const test = result.lanes === 1 ? "T1.3" : `T1.4 (${result.lanes} lanes)`;
    if (result.sumo) sumoRuns.push({ test, counts: result.sumo });
    if (result.sumoTrueRing) sumoRuns.push({ test: `${test}, true ring`, counts: result.sumoTrueRing });
  }
  for (const result of t15) if (result.sumo) sumoRuns.push({ test: "T1.5", counts: result.sumo });

  const total = (pick: (counts: EngineCounts) => number) => engineRuns.reduce((sum, run) => sum + pick(run.counts), 0);
  const moments = total((counts) => counts.tier0.momentsChecked);
  const conservation = total((counts) => counts.tier0.conservationViolations);
  const overlaps = total((counts) => counts.tier0.overlaps);
  const negative = total((counts) => counts.tier0.negativeSpeeds);
  const outside = total((counts) => counts.tier0.outsideRoad);
  const repeated = tier0.filter((result) => result.repeatedIdentically).length;
  const sumoTotal = (pick: (counts: SumoCounts) => number) => sumoRuns.reduce((sum, run) => sum + pick(run.counts), 0);
  const sumoSummaryRows = t15.reduce((sum, result) => sum + (result.sumo?.summaryRows ?? 0), 0);
  const sumoSummaryViolations = t15.reduce((sum, result) => sum + (result.sumo?.summaryConservationViolations ?? 0), 0);
  const sumoRepeats = [t11.sumoRepeatedIdentically, ...t15.map((result) => result.sumo?.repeatedIdentically ?? null)].filter(
    (value): value is boolean => value !== null,
  );

  // ------------------------------------------------------------------ T1.3 and T1.4
  const densities = [...new Set(ring.map((result) => result.densityPerKm))].sort((a, b) => a - b);
  const seeds = [...new Set(ring.map((result) => result.seed))].sort((a, b) => a - b);
  const at = (lanes: number, density: number) => ring.filter((result) => result.lanes === lanes && result.densityPerKm === density);
  const capacityPerSeed = (lanes: number, pick: (result: RingResult) => number | undefined) =>
    seeds.map((seed) => {
      const flows = ring.filter((result) => result.lanes === lanes && result.seed === seed).map(pick);
      return flows.some((flow) => flow === undefined) ? NaN : Math.max(...(flows as number[]));
    });
  const referenceCapacityOnGrid = Math.max(...densities.map((density) => equilibrium(CAR, density).flowPerHour));
  const continuousCapacity = equilibriumCapacity(CAR);

  const pointRows: string[][] = [];
  let worstOurs = 0;
  let worstSumo = 0;
  let pointsOurs = 0;
  let pointsSumo = 0;
  let stablePoints = 0;
  for (const density of densities) {
    const runs = at(1, density);
    if (runs.length === 0) continue;
    const reference = runs[0]!.equilibriumFlowPerHour;
    const stable = runs[0]!.stringStable;
    const ringReference = stat(runs.map((run) => run.reference?.flowPerHour ?? NaN));
    const ours = stat(runs.map((run) => run.ours.flowPerLaneA));
    const sumo = sumoRan ? stat(runs.map((run) => run.sumo!.flowPerLaneA)) : undefined;
    const oursDiff = ours.mean / reference - 1;
    const sumoDiff = sumo ? sumo.mean / reference - 1 : NaN;
    if (stable) {
      stablePoints++;
      worstOurs = Math.max(worstOurs, Math.abs(oursDiff));
      if (Math.abs(oursDiff) <= TOLERANCE.t13Point) pointsOurs++;
      if (sumo) {
        worstSumo = Math.max(worstSumo, Math.abs(sumoDiff));
        if (Math.abs(sumoDiff) <= TOLERANCE.t13Point) pointsSumo++;
      }
    }
    pointRows.push([
      String(density),
      stable ? "yes" : "no",
      num(reference),
      meanCi(ringReference),
      `${meanCi(ours)} (${pct(oursDiff)})`,
      sumo ? `${meanCi(sumo)} (${pct(sumoDiff)})` : NOT_RUN,
      stable ? verdict(Math.abs(oursDiff) <= TOLERANCE.t13Point) : "report only",
      !sumo ? NOT_RUN : stable ? verdict(Math.abs(sumoDiff) <= TOLERANCE.t13Point) : "report only",
      sumo ? pct(ours.mean / sumo.mean - 1) : NOT_RUN,
    ]);
  }
  const capacityOurs1 = stat(capacityPerSeed(1, (result) => result.ours.flowPerLaneA));
  const capacitySumo1 = sumoRan ? stat(capacityPerSeed(1, (result) => result.sumo?.flowPerLaneA)) : undefined;

  const laneRows: string[][] = [];
  const laneVerdicts = new Map<number, { ours: Stat; sumo?: Stat; diff: number }>();
  for (const lanes of [1, 2, 3]) {
    const ours = stat(capacityPerSeed(lanes, (result) => result.ours.flowPerLaneA));
    const sumo = sumoRan ? stat(capacityPerSeed(lanes, (result) => result.sumo?.flowPerLaneA)) : undefined;
    const trueRing = sumoRan ? stat(capacityPerSeed(lanes, (result) => result.sumoTrueRing?.flowPerLane)) : undefined;
    const diff = sumo ? ours.mean / sumo.mean - 1 : NaN;
    laneVerdicts.set(lanes, { ours, sumo, diff });
    laneRows.push([
      String(lanes),
      meanCi(ours),
      sumo ? meanCi(sumo) : NOT_RUN,
      trueRing ? meanCi(trueRing) : NOT_RUN,
      sumo ? pct(diff) : NOT_RUN,
      lanes === 1 ? "(T1.3)" : sumo ? verdict(Math.abs(diff) <= TOLERANCE.t14) : NOT_RUN,
    ]);
  }
  const perLaneFlowRows = (lanes: number) =>
    densities.map((density) => {
      const runs = at(lanes, density);
      const ours = stat(runs.map((run) => run.ours.flowPerLaneA));
      const sumo = sumoRan ? stat(runs.map((run) => run.sumo!.flowPerLaneA)) : undefined;
      const oursBetween = stat(runs.map((run) => run.ours.betweenLanesShare));
      return [
        String(density),
        num(runs[0]!.equilibriumFlowPerHour),
        meanCi(ours),
        sumo ? meanCi(sumo) : NOT_RUN,
        sumo ? pct(ours.mean / sumo.mean - 1) : NOT_RUN,
        `${(oursBetween.mean * 100).toFixed(2)}%`,
      ];
    });

  // How well the long periodic road stands for the ring.
  const copyGap = (lanes: number, engine: "ours" | "sumo") =>
    Math.max(
      0,
      ...ring
        .filter((result) => result.lanes === lanes && result[engine])
        .map((result) => Math.abs(result[engine]!.flowPerLaneA / result[engine]!.flowPerLaneB - 1)),
    );
  const ringGap = (lanes: number) =>
    Math.max(
      0,
      ...ring
        .filter((result) => result.lanes === lanes && result.sumo && result.sumoTrueRing)
        .map((result) => Math.abs(result.sumo!.flowPerLaneA / result.sumoTrueRing!.flowPerLane - 1)),
    );
  const emulationRows = [1, 2, 3].map((lanes) => [
    String(lanes),
    pct(copyGap(lanes, "ours"), 4),
    sumoRan ? pct(copyGap(lanes, "sumo"), 4) : NOT_RUN,
    sumoRan ? pct(ringGap(lanes), 4) : NOT_RUN,
  ]);

  // ------------------------------------------------------------------ T1.5
  const dropOurs = stat(t15.map((result) => result.ours.dischargePerHour));
  const dropSumo = sumoRan ? stat(t15.map((result) => result.sumo!.dischargePerHour)) : undefined;
  const dropSumoMax = sumoRan ? stat(t15.map((result) => result.sumoDepartSpeedMax!.dischargePerHour)) : undefined;
  const dropDiff = dropSumo ? dropOurs.mean / dropSumo.mean - 1 : NaN;
  const dropStuck = stat(t15.map((result) => result.ours.stuckVehicles));

  // ------------------------------------------------------------------ the summary table
  const t11Ours = t11.oursS === null ? NaN : t11.oursS / t11.referenceS - 1;
  const t11Sumo = t11.sumoS === null ? NaN : t11.sumoS / t11.referenceS - 1;
  const two = laneVerdicts.get(2)!;
  const three = laneVerdicts.get(3)!;
  const ours3 = capacityOurs1.mean / referenceCapacityOnGrid - 1;
  const sumo3 = capacitySumo1 ? capacitySumo1.mean / referenceCapacityOnGrid - 1 : NaN;

  const summary = table(
    ["ID", "Test and metric", "Reference", "Tolerance", "Ours", "SUMO", "Ours", "SUMO", "Ours against SUMO"],
    [
      [
        "T0.1",
        "Vehicle conservation",
        "none",
        "exact, every step",
        `${conservation} violations in ${num(moments, 0)} steps of ${engineRuns.length} runs`,
        sumoRan ? `${sumoSummaryViolations} violations in ${sumoSummaryRows} summary rows (T1.5 runs, every 600 s; not every step)` : NOT_RUN,
        verdict(conservation === 0),
        sumoRan ? `${sumoSummaryViolations === 0 ? "no violation seen" : "**FAIL**"} (partly checked)` : NOT_RUN,
        "",
      ],
      [
        "T0.2",
        "No two vehicles overlap",
        "none",
        "zero in all runs",
        `${overlaps} overlaps`,
        sumoRan ? `${sumoTotal((counts) => counts.collisions)} collisions in ${sumoRuns.length} runs` : NOT_RUN,
        verdict(overlaps === 0),
        sumoRan ? verdict(sumoTotal((counts) => counts.collisions) === 0) : NOT_RUN,
        "",
      ],
      [
        "T0.3",
        "Same scenario and seed, same result",
        "none",
        "bit-identical",
        `${repeated} of ${tier0.length} scenario-seed pairs identical at every step`,
        sumoRan ? `${sumoRepeats.filter(Boolean).length} of ${sumoRepeats.length} repeated runs identical (T1.1; T1.5 seed 1)` : NOT_RUN,
        verdict(repeated === tier0.length),
        sumoRan ? verdict(sumoRepeats.every(Boolean)) : NOT_RUN,
        "",
      ],
      [
        "T0.4",
        "No negative speed, no vehicle outside its road",
        "none",
        "zero",
        `${negative} negative speeds, ${outside} outside the road`,
        sumoRan ? `${sumoTotal((counts) => counts.negativeSpeeds)} negative speeds in recorded cars; position not checked` : NOT_RUN,
        verdict(negative === 0 && outside === 0),
        sumoRan ? `${sumoTotal((counts) => counts.negativeSpeeds) === 0 ? "no violation seen" : "**FAIL**"} (partly checked)` : NOT_RUN,
        "",
      ],
      [
        "T1.1",
        "One car from rest: time to 95% of desired speed",
        `${num(t11.referenceS, 3)} s`,
        "2%, both",
        t11.oursS === null ? "never reached" : `${num(t11.oursS, 3)} s (${pct(t11Ours)})`,
        !sumoRan ? NOT_RUN : t11.sumoS === null ? "never reached" : `${num(t11.sumoS, 3)} s (${pct(t11Sumo)})`,
        verdict(Math.abs(t11Ours) <= TOLERANCE.t11),
        sumoRan ? verdict(Math.abs(t11Sumo) <= TOLERANCE.t11) : NOT_RUN,
        sumoRan && t11.oursS !== null && t11.sumoS !== null ? pct(t11.oursS / t11.sumoS - 1, 4) : "",
      ],
      [
        "T1.2",
        "Follow a leader with a fixed speed profile: speed RMSE",
        "0 (IDM at 0.001 s behind the same leader)",
        "at most 0.2 m/s, both",
        "**not runnable**",
        t12.sumo ? `${num(t12.sumo.speedRmseMps ?? NaN, 4)} m/s` : NOT_RUN,
        "not runnable",
        t12.sumo ? verdict((t12.sumo.speedRmseMps ?? Infinity) <= TOLERANCE.t12RmseMps) : NOT_RUN,
        "",
      ],
      [
        "T1.2",
        "Same run: minimum gap",
        `${num(t12.referenceMinGapM, 3)} m`,
        "never below zero, both",
        "**not runnable**",
        t12.sumo ? `${num(t12.sumo.minGapM ?? NaN, 3)} m` : NOT_RUN,
        "not runnable",
        t12.sumo ? verdict((t12.sumo.minGapM ?? -1) >= 0) : NOT_RUN,
        "",
      ],
      [
        "T1.3",
        `Ring, one lane: flow at each density in the stable range (${stablePoints} densities)`,
        "IDM equilibrium flow",
        "5% per point, both",
        `${pointsOurs} of ${stablePoints} within tolerance; largest difference ${pct(worstOurs).slice(1)}`,
        sumoRan ? `${pointsSumo} of ${stablePoints} within tolerance; largest difference ${pct(worstSumo).slice(1)}` : NOT_RUN,
        verdict(pointsOurs === stablePoints),
        sumoRan ? verdict(pointsSumo === stablePoints) : NOT_RUN,
        "see per-density table",
      ],
      [
        "T1.3",
        "Ring, one lane: capacity",
        `${num(referenceCapacityOnGrid)} veh/h`,
        "3%, both",
        `${meanCi(capacityOurs1)} veh/h (${pct(ours3)})`,
        capacitySumo1 ? `${meanCi(capacitySumo1)} veh/h (${pct(sumo3)})` : NOT_RUN,
        verdict(Math.abs(ours3) <= TOLERANCE.t13Capacity),
        capacitySumo1 ? verdict(Math.abs(sumo3) <= TOLERANCE.t13Capacity) : NOT_RUN,
        capacitySumo1 ? pct(capacityOurs1.mean / capacitySumo1.mean - 1, 4) : "",
      ],
      [
        "T1.4",
        "Ring, 2 lanes: capacity per lane",
        "the other engine",
        "10% between the engines",
        `${meanCi(two.ours)} veh/h`,
        two.sumo ? `${meanCi(two.sumo)} veh/h` : NOT_RUN,
        "between engines",
        "between engines",
        two.sumo ? `${pct(two.diff)}: ${verdict(Math.abs(two.diff) <= TOLERANCE.t14)}` : NOT_RUN,
      ],
      [
        "T1.4",
        "Ring, 3 lanes: capacity per lane",
        "the other engine",
        "10% between the engines",
        `${meanCi(three.ours)} veh/h`,
        three.sumo ? `${meanCi(three.sumo)} veh/h` : NOT_RUN,
        "between engines",
        "between engines",
        three.sumo ? `${pct(three.diff)}: ${verdict(Math.abs(three.diff) <= TOLERANCE.t14)}` : NOT_RUN,
      ],
      [
        "T1.5",
        "Lane drop 3 to 2, demand above capacity: discharge flow downstream",
        "the other engine",
        "10% between the engines",
        `${meanCi(dropOurs)} veh/h; **flagged**: ${num(dropStuck.mean, 0)} stuck vehicles per run`,
        dropSumo ? `${meanCi(dropSumo)} veh/h` : NOT_RUN,
        "between engines",
        "between engines",
        dropSumo ? `${pct(dropDiff)}: ${verdict(Math.abs(dropDiff) <= TOLERANCE.t15)}` : NOT_RUN,
      ],
    ],
  );

  const partRows = (["leader", "follower"] as const).map((who) => [
    who === "leader" ? "Leader (stops behind the stationary car)" : "Follower",
    `${num(t12p.ours[who].speedRmseMps ?? NaN, 4)} m/s`,
    t12p.sumo ? `${num(t12p.sumo[who].speedRmseMps ?? NaN, 4)} m/s` : NOT_RUN,
    `${num(who === "leader" ? t12p.reference.leaderMinGapM : t12p.reference.followerMinGapM, 3)} m`,
    `${num(t12p.ours[who].minGapM ?? NaN, 3)} m`,
    t12p.sumo ? `${num(t12p.sumo[who].minGapM ?? NaN, 3)} m` : NOT_RUN,
  ]);

  // ------------------------------------------------------------------ stuck vehicles and teleports, per test
  const tests = [...new Set([...engineRuns.map((run) => run.test), ...sumoRuns.map((run) => run.test)])];
  const flagRows = tests.map((test) => {
    const ours = engineRuns.filter((run) => run.test === test);
    const sumo = sumoRuns.filter((run) => run.test === test);
    const stuck = ours.reduce((sum, run) => sum + run.counts.stuckVehicles, 0);
    const stuckRuns = ours.filter((run) => run.counts.stuckVehicles > 0).length;
    const teleports = sumo.reduce((sum, run) => sum + run.counts.teleports, 0);
    const teleportRuns = sumo.filter((run) => run.counts.teleports > 0).length;
    return [
      test,
      ours.length ? String(ours.length) : "-",
      ours.length ? `${stuck}${stuck ? ` (in ${stuckRuns} runs) **flagged**` : ""}` : "not runnable",
      sumo.length ? String(sumo.length) : "-",
      sumo.length ? `${teleports}${teleports ? ` (in ${teleportRuns} runs) **flagged**` : ""}` : sumoRan ? "-" : NOT_RUN,
      sumo.length ? String(sumo.reduce((sum, run) => sum + run.counts.collisions, 0)) : "-",
      sumo.length ? String(sumo.reduce((sum, run) => sum + run.counts.emergencyBraking, 0)) : "-",
      sumo.length ? String(sumo.reduce((sum, run) => sum + run.counts.warningCount, 0)) : "-",
    ];
  });

  // ------------------------------------------------------------------ Tier 0 scenarios
  const tier0Rows = [...new Set(tier0.map((result) => result.scenario))].map((scenario) => {
    const runs = tier0.filter((result) => result.scenario === scenario);
    const sum = (pick: (result: Tier0Result) => number) => runs.reduce((value, result) => value + pick(result), 0);
    return [
      scenario,
      String(runs.length),
      num(sum((result) => result.tier0.momentsChecked), 0),
      String(sum((result) => result.tier0.conservationViolations)),
      String(sum((result) => result.tier0.overlaps)),
      `${runs.filter((result) => result.repeatedIdentically).length} of ${runs.length}`,
      String(sum((result) => result.tier0.negativeSpeeds + result.tier0.outsideRoad)),
      String(sum((result) => result.stuckVehicles)),
    ];
  });
  const tier0Examples = engineRuns.flatMap((run) => run.counts.tier0.examples.map((text) => `- ${run.test}: ${text}`)).slice(0, 10);

  // ------------------------------------------------------------------ open road
  const openKeys = [...new Set(open.map((result) => `${result.mix}|${result.laneWidthM}|${result.lanes}`))];
  const openRows = openKeys.map((key) => {
    const runs = open.filter((result) => `${result.mix}|${result.laneWidthM}|${result.lanes}` === key);
    const first = runs[0]!;
    const changeS = runs.map((result) => result.meanLaneChangeS).filter((value): value is number => value !== null);
    return [
      first.mix,
      String(first.lanes),
      num(first.laneWidthM, 1),
      meanCi(stat(runs.map((result) => result.vehiclesThrough)), 0),
      meanCi(stat(runs.map((result) => result.throughPerLane)), 0),
      num(stat(runs.map((result) => result.meanSpeedMps)).mean, 2),
      num(stat(runs.map((result) => result.laneChangesStarted)).mean, 0),
      changeS.length ? num(stat(changeS).mean, 1) : "-",
      `${(stat(runs.map((result) => result.betweenLanesShare)).mean * 100).toFixed(1)}%`,
    ];
  });

  const type = Object.entries(carTypeAttributes())
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  const date = meta?.date ?? "unknown date";

  const text = `# Benchmark results: Tiers 0 and 1 (${date})

Results of Tier 0 and Tier 1 of [the benchmark standard](benchmark-standard.md) for our engine, for SUMO and for the
reference equations. This document is written by \`packages/benchmark\` from the raw results in
\`packages/benchmark/results/raw\`; every number below was measured in the run described here. Failures are in the same
tables as passes. There is no overall score.

Passing these tiers does not make the engine calibrated or validated. Tier 1 is cars only with lane discipline on, the
least Indian case; agreement with SUMO shows the implementation is sane, not that either engine is realistic.

## The run

| | |
|---|---|
| Date | ${date} |
| Our engine | commit \`${meta?.engineCommit ?? "unknown"}\` (last change to \`packages/engine\`); harness at \`${meta?.gitCommit ?? "unknown"}\`${meta?.gitDirty ? ", with uncommitted changes" : ""} |
| SUMO | ${meta?.sumoVersion ?? "not run"} (pinned ${meta?.sumoPinned ?? ""}; \`eclipse-sumo\`, \`libsumo\`, \`traci\` wheels in \`${meta?.sumoEnv ?? ""}\`), headless |
| Machine | ${meta?.machine ?? "unknown"} |
| Runtime | Node ${meta?.node ?? "unknown"}; no browser is involved in these tiers |
| Step | ${STEP_S} s in both engines; reference integrated at 0.001 s |
| Seeds | 10 per stochastic test per engine (seeds 1 to 10), mean ± 95% confidence interval (Student's t), none dropped |
| Work | ${meta ? `${meta.parallelJobs} parallel processes; no timing is reported (the machine slept during the run)` : "unknown"} |

## Results table

The two columns headed "Ours" and "SUMO" after the values are pass or fail of each engine against the reference and
tolerance of the standard; where the standard's tolerance is between the two engines, the verdict is in the last column.
Percentages in brackets are differences from the reference.

${summary}

### Stuck vehicles, teleports and collisions, per test (fairness rule 7)

A run with any stuck vehicle or teleport is flagged. Our engine has no forced release at this commit and reports no such
count, so stuck vehicles are counted from outside: a vehicle, other than one placed as stationary, that stood still for
300 s or more, which is the wait after which SUMO teleports by default. SUMO ran with \`--time-to-teleport 300\` and
\`--collision.action warn\`, and its own statistics give the counts.

${table(["Test", "Our runs", "Our stuck vehicles", "SUMO runs", "SUMO teleports", "SUMO collisions", "SUMO emergency braking", "SUMO warnings"], flagRows)}

## Findings

${findings}

## Details

### Tier 0

The Tier 0 checks are the benchmark's own (they read only snapshots and results) and ran on every step of every run of
our engine in this document: ${engineRuns.length} runs, ${num(moments, 0)} steps. T0.3 ran on the scenarios below, each
run twice per seed for ${tier0[0]?.durationS ?? 0} simulated seconds and compared step by step.

${table(["Scenario", "Seeds", "Steps checked", "T0.1 violations", "T0.2 overlaps", "T0.3 identical", "T0.4 violations", "Stuck vehicles"], tier0Rows)}
${tier0Examples.length ? `\nFirst violations found:\n\n${tier0Examples.join("\n")}\n` : ""}
SUMO's side of Tier 0 is only partly checked, from what SUMO writes: collisions from its statistics (T0.2), a repeated
run compared by its output (T0.3), counts at 600 s intervals in the T1.5 runs (T0.1), and the speeds of recorded cars
(T0.4).

### T1.1 One car accelerates from rest

One car at rest on an empty 1 km road with a ${CAR.desiredSpeedMps} m/s limit. The time at which its speed reaches
${num(t11.targetSpeedMps, 2)} m/s is read from the speeds at each ${STEP_S} s step by linear interpolation. Not
stochastic; one run per engine.

### T1.2 One car follows a leader with a fixed speed profile

Profile: cruise at ${LEADER_PROFILE.cruiseMps} m/s for ${LEADER_PROFILE.cruiseS} s, brake at ${LEADER_PROFILE.brakeMps2} m/s² to a stop,
stand ${LEADER_PROFILE.standS} s, restart at ${LEADER_PROFILE.restartMps2} m/s² back to ${LEADER_PROFILE.cruiseMps} m/s, cruise ${LEADER_PROFILE.finalCruiseS} s.
The follower starts at its equilibrium gap. Not stochastic.

**Our engine: not runnable yet.** The engine's public interface has no vehicle with a prescribed speed. A vehicle is
either stationary for the whole run or driven by the engine's own following rule, and nothing in the interface removes
an obstacle during a run, so a leader cannot be made to stop and restart. SUMO ran the test as written, the leader's
speed being set at every step through SUMO's control interface (libsumo)${t12.sumo ? `; the leader reproduced the profile to ${t12.sumo.leaderSpeedRmseMps.toExponential(1)} m/s RMSE` : ""}.

**The part our engine can run (not the standard's T1.2; no pass line).** The leader's profile is produced by the model
instead of being prescribed: it starts at its desired speed and brakes to a stop behind a stationary car 800 m ahead;
the follower follows it; ${t12p.durationS} s; there is no restart. The reference is the same three cars integrated at
0.001 s. Speed RMSE is against the reference, sampled every step.

${table(["Car", "Our speed RMSE", "SUMO speed RMSE", "Reference minimum gap", "Our minimum gap", "SUMO minimum gap"], partRows)}

### T1.3 Ring road, 1 km, one lane

Each run: ${RING_DURATION_S} s, flow measured over the last ${RING_DURATION_S - RING_MEASURE_FROM_S} s as density times the mean speed of the
cars of one lap. Cars start evenly spaced at the equilibrium speed, each moved by a random share (up to ±10%) of its
spare gap; the seed sets those moves. The engines themselves use no random numbers in this test.

**How the ring is run.** Our engine cannot express a ring road: a road's end does not join its start, and a route is one
road. The ring is instead laid out on a long straight road as the same 1 km of cars repeated many times. A car in one
copy has in front of it exactly what it would have on the ring, for as long as the copy ahead still behaves as a ring;
only the first copy has open road ahead, and that difference travels back by at most one vehicle per step. With at least
as many cars ahead per lane as the run has steps (${Math.round(RING_DURATION_S / STEP_S)}), the measured copy is a ring for the whole run. For more
than one lane the same number of cars is placed behind as well, since a car looks behind before changing lane. Both
engines are given this identical road (${num(Math.min(...ring.map((result) => result.carsOnRoad)), 0)} to ${num(Math.max(...ring.map((result) => result.carsOnRoad)), 0)} cars). Two checks of the method, over all densities and seeds:

${table(["Lanes", "Ours: largest difference between two neighbouring copies", "SUMO: the same", "SUMO: largest difference between this road and a true 1 km ring"], emulationRows)}

**Stable range.** The standard does not define it. Here it is the densities at which uniform flow is linearly
string-stable in the continuous model (computed from the reference equations): ${densities.filter((density) => equilibrium(CAR, density).stringStable).join(", ")} veh/km.
Outside it the flow depends on how far stop-and-go waves have grown in the run, and the rows are reported without a
pass line. "Reference ring" is the ring integrated at 0.001 s from the same starting positions, mean over seeds.

${table(["Density (veh/km)", "Stable", "Equilibrium flow (veh/h)", "Reference ring at 0.001 s (veh/h)", "Ours (veh/h)", "SUMO (veh/h)", "Ours", "SUMO", "Ours against SUMO"], pointRows)}

**Capacity** is the highest flow over the tested densities, taken per seed. The reference is the highest equilibrium
flow over the same densities (${num(referenceCapacityOnGrid)} veh/h); the peak of the continuous curve is ${num(continuousCapacity.flowPerHour)} veh/h at
${num(continuousCapacity.densityPerKm, 1)} veh/km.

### T1.4 The same ring with 2 and 3 lanes

Density is per lane; every lane starts with the same number of cars, staggered against each other. Capacity per lane is
the highest flow per lane over the tested densities, per seed. "SUMO true ring" is SUMO on a real 1 km ring with the
same cars.

${table(["Lanes", "Ours: capacity per lane (veh/h)", "SUMO: capacity per lane (veh/h)", "SUMO true ring (veh/h)", "Ours against SUMO", "Within 10%"], laneRows)}

Flow per lane at each density, 2 lanes ("between lanes" is the share of our cars' time spent changing lane):

${table(["Density per lane (veh/km)", "Equilibrium (veh/h)", "Ours (veh/h per lane)", "SUMO (veh/h per lane)", "Ours against SUMO", "Ours between lanes"], perLaneFlowRows(2))}

3 lanes:

${table(["Density per lane (veh/km)", "Equilibrium (veh/h)", "Ours (veh/h per lane)", "SUMO (veh/h per lane)", "Ours against SUMO", "Ours between lanes"], perLaneFlowRows(3))}

### T1.5 Lane drop, 3 lanes to 2

A ${LANE_DROP.roadLengthM} m road with 3 lanes; lane ${LANE_DROP.droppedLane} (the one furthest from the kerb) ends at ${LANE_DROP.dropAtM} m. Demand ${num(LANE_DROP.demandPerHour, 0)} cars/h
(two lanes' equilibrium capacity is ${num(2 * continuousCapacity.flowPerHour, 0)}). Discharge flow is the cars leaving the end of the road, 1 km
past the drop, over ${LANE_DROP.measureS} s after a ${LANE_DROP.warmUpS} s warm-up.

- **Our engine** has no road whose lane count changes. The dropped lane is expressed with what the interface has:
  stationary cars filling that lane nose to tail from ${LANE_DROP.dropAtM} m to the end of the road.
- **SUMO** gets a real lane drop: a 3-lane edge joined to a 2-lane edge.
- **Departures** are the same in both: the engine draws them from its seed, the harness reads them back (to the step) from
  the engine's results, and SUMO is given those departure times.

${table(
  ["", "Ours", "SUMO (departSpeed avg)", "SUMO (departSpeed max, for comparison)"],
  [
    ["Discharge flow (veh/h)", meanCi(dropOurs), dropSumo ? meanCi(dropSumo) : NOT_RUN, dropSumoMax ? meanCi(dropSumoMax) : NOT_RUN],
    [
      "Cars let onto the road in 40 min",
      meanCi(stat(t15.map((result) => result.ours.entered)), 0),
      sumoRan ? meanCi(stat(t15.map((result) => result.sumo!.entered)), 0) : NOT_RUN,
      sumoRan ? meanCi(stat(t15.map((result) => result.sumoDepartSpeedMax!.entered)), 0) : NOT_RUN,
    ],
    [
      "Our engine at the end of the warm-up: cars standing in the closed lane, upstream of the closure",
      meanCi(stat(t15.map((result) => result.ours.atWarmUp.standingInClosedLane)), 0),
      "-",
      "-",
    ],
    [
      "Our engine at the end of the warm-up: mean speed in the two open lanes, upstream of the closure (m/s)",
      meanCi(stat(t15.map((result) => result.ours.atWarmUp.meanSpeedOpenLanesMps)), 1),
      "-",
      "-",
    ],
    [
      "Our engine: lane changes started in 40 min",
      meanCi(stat(t15.map((result) => result.ours.laneChangesStarted)), 0),
      "-",
      "-",
    ],
    [
      "Stuck vehicles / teleports per run",
      `${meanCi(dropStuck, 0)} stuck`,
      sumoRan ? `${num(stat(t15.map((result) => result.sumo!.teleports)).mean, 1)} teleports` : NOT_RUN,
      sumoRan ? `${num(stat(t15.map((result) => result.sumoDepartSpeedMax!.teleports)).mean, 1)} teleports` : NOT_RUN,
    ],
  ],
)}

### Capacity per lane on an open road (our engine only)

Not a test of the standard: a measurement asked for alongside T1.4. A ${OPEN_ROAD.lengthM} m road, demand ${num(OPEN_ROAD.demandPerHour, 0)} vehicles/h (more than
the road can take), lane discipline on, speed limit ${OPEN_ROAD.speedLimitMps} m/s, one simulated hour with no warm-up; vehicles through the
end of the road in that hour, 10 seeds. "At one desired speed" lowers the speed limit to the slowest class's desired
speed so that every class wants the same speed.

${table(["Vehicle mix", "Lanes", "Lane width (m)", "Vehicles through", "Per lane", "Mean speed (m/s)", "Lane changes started", "Mean lane change (s)", "Vehicle time between lanes"], openRows)}

## How SUMO was set up, and where it could not be made identical

Vehicle type given to SUMO, from the engine's assumptions table for the car:

\`\`\`
<vType id="car" ${type}/>
\`\`\`

Options: \`--step-length ${STEP_S} --step-method.ballistic true --time-to-teleport 300 --collision.action warn\`, networks built by
\`netconvert --lefthand true\`. The generated inputs of five runs are in \`packages/benchmark/results/sumo-inputs\`.

Made the same:

- **Following rule.** \`carFollowModel="IDM"\` with accel = a, decel = b, tau = T, minGap = s0, delta = 4. SUMO 1.28's IDM
  (\`MSCFModel_IDM.cpp\`) uses s* = minGap + max(0, v T + v dv / (2 sqrt(accel decel))), the form the reference uses.
- **Desired speed.** SUMO gives each passenger car its own desired speed by default (\`speedFactor\` normc(1,0.1,0.2,2));
  set to \`speedFactor="1" speedDev="0"\`, with \`maxSpeed\` and the edge speed at the car's desired speed.
- **Update scheme.** SUMO's default is an Euler update (speed constant over a step). \`--step-method.ballistic\`
  (acceleration constant over a step) is what our engine does, so it is switched on.
- **Internal sub-stepping** (limit 4 in section 6 of the standard). SUMO's IDM iterates round(step-length / stepping)
  times within a step; with \`stepping="${STEP_S}"\` (and with its default of 0.25) that is once at a ${STEP_S} s step, so
  there is no sub-stepping in these runs.
- **Starting state.** Placed cars use \`insertionChecks="none"\`, so SUMO starts from the identical positions and speeds.

Not identical:

1. **Lane changing.** SUMO uses its LC2013 model with default parameters; ours is a MOBIL-like rule on lanes. SUMO changes
   lane within one step; our cars take several seconds (3.5 m at the sideways speed cap) and occupy both lanes meanwhile.
   In left-hand networks SUMO also moves cars towards the kerb lane when there is room; ours has no such rule. SUMO's
   documentation warns that IDM with default lane-change parameters is conservative in accepting gaps.
2. **Braking limit.** SUMO bounds the braking of a car at \`emergencyDecel\` (9 m/s² by default) and counts braking
   beyond max(decel, 1.5 m/s²) that it had to apply as emergency braking; ours applies the IDM value unbounded, with its
   own rule that a car never advances further than the clear gap at the start of the step.
3. **Entering traffic (T1.5 only).** The engines decide differently when a waiting car may enter. Ours: the lane with
   the longest clear road, rear bumper at the start, when the gap is at least s0 + v T. SUMO: \`departLane="free"
   departPos="base" departSpeed="avg"\`, following SUMO's documentation for a high insertion flow. With
   \`departSpeed="max"\` SUMO lets in so few cars that the lane drop is never loaded above its capacity; that variant is
   shown beside the result.
4. **The lane drop itself (T1.5).** SUMO has a real one, with a short junction (about 9 m of internal lanes); ours is a
   lane filled with stationary cars. SUMO's network says that the lane does not continue, and its lane-change model can
   act on that; our cars meet the stationary cars as an obstacle and nothing tells them of it before.
5. **Stuck vehicles.** SUMO teleports a vehicle after 300 s of waiting; ours has no forced release yet, so a stuck
   vehicle stays stuck. Both are counted.
6. **The prescribed leader (T1.2)** exists only in SUMO, through libsumo, with the leader's own model switched off
   (speed mode 0).
7. **Departure times** are passed to SUMO to the nearest step (0.2 s), which is also when the engine acts on them.

## Tests that could not be run as written

| Test | Engine | What was done instead | Why |
|---|---|---|---|
| T1.2 | ours | Not run. A part of it (no restart, leader not prescribed) is reported without a pass line. | No vehicle with a prescribed speed in the engine's public interface. |
| T1.3, T1.4 | both | A long periodic road that is provably, and by measurement, the same as the ring; SUMO also on a true ring. | The engine has no ring road. |
| T1.5 | ours | The dropped lane is filled with stationary cars. | The engine has no road whose lane count changes. |
| T0.1, T0.4 | SUMO | Partly checked from SUMO's own outputs. | The standard does not say Tier 0 applies to SUMO; it is given for information. |

## Proposed amendments to the standard

None has been applied; section 7 of the standard is unchanged. These are proposals, dated ${date}, for whoever owns the
standard. No tolerance change is proposed.

1. **T1.3 and T1.4, the ring.** State that the ring may be run as a long periodic road (the 1 km pattern repeated, with
   at least one car ahead per lane per simulated step, and as many behind when there is more than one lane) until the
   engine has ring roads, and that SUMO is then given the same road and is also checked on a true ring.
2. **T1.3, "stable range".** Define it: the densities at which uniform flow is linearly string-stable for the reference
   model and parameters. With the car's current assumptions that is up to about 70 veh/km.
3. **T1.3, the densities and the run.** Fix the list of densities (here 10 to 140 in tens, plus 62), the run length
   (${RING_DURATION_S} s), the measuring time (last ${RING_DURATION_S - RING_MEASURE_FROM_S} s), the starting state and that capacity is the highest flow over the
   listed densities, compared with the equilibrium curve over the same densities.
4. **T1.2.** Either add a vehicle with a prescribed speed profile to the engine's interface, or state that until then
   T1.2 is "not runnable" for our engine. Fix the profile (the one used here is in this document).
5. **T1.5.** Fix the geometry, the demand, the measuring point and time, and how entering traffic is configured in SUMO
   (\`departLane\`, \`departPos\`, \`departSpeed\`), since the result depends on it. State whether a lane closed by stationary
   vehicles is an acceptable stand-in for a lane drop until the engine has one.
6. **Fairness rule 2, update scheme.** Add that SUMO runs with \`--step-method.ballistic\`, the scheme our engine uses,
   and with \`speedFactor="1" speedDev="0"\`.
7. **Fairness rule 7.** Our engine has no forced release yet. Define a stuck vehicle for our engine as one standing for
   300 s (SUMO's teleport time), counted from outside, until the engine reports its own count.
8. **Tier 0 and SUMO.** State whether Tier 0 is scored for SUMO; if so, which SUMO outputs count as the check.

## How to run it again

\`\`\`sh
pnpm install
sh packages/benchmark/scripts/install-sumo.sh           # SUMO ${meta?.sumoPinned ?? ""} into ~/.cache/traffic-simulator, outside the repo; needs uv
pnpm --filter @traffic-simulator/benchmark bench        # everything; writes results/raw and this document
pnpm --filter @traffic-simulator/benchmark bench --report-only   # rebuild this document from results/raw
\`\`\`

The benchmark is not part of \`pnpm test\`. Options: \`--jobs N\` (parallel processes), \`--only <kind or job id>\`,
\`--no-sumo\`, \`--fresh\` (ignore finished jobs kept in \`.work\`), \`--keep-work\` (keep SUMO's files), \`--date\`.
Without SUMO installed the engine and reference parts still run and SUMO's columns read "not run".
`;
  writeFileSync(reportFile, text);
}
