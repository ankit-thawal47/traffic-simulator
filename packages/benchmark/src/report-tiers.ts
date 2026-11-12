/**
 * Builds the results document of Tiers 2 to 5 from the raw results in
 * packages/benchmark/results/raw/tiers-2-to-5. Every number in its tables is read from there; the
 * tolerances are those of docs/benchmark-standard.md, applied as written. The prose written by
 * hand after the run lives in findings-tiers.ts and is included as it is.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VEHICLE_CLASSES, type VehicleClass } from "@traffic-simulator/engine";
import { CHENNAI_TYPES } from "./chennai";
import { FINDINGS_TIERS, NOT_IDENTICAL, PROPOSED_AMENDMENTS } from "./findings-tiers";
import {
  carCriticalGapS,
  gapAcceptanceCapacity,
  T21,
  T22,
  T22_CYCLE_S,
  t22Capacity,
  T23,
  T24,
  websterDelayS,
  type T21Result,
  type T22Result,
  type T23Result,
  type T24Result,
} from "./tier2";
import { T3, THROUGH, type T3Result } from "./tier3";
import {
  CHENNAI,
  earthMoversM,
  INDO_HCM_4LANE_CAPACITY_PER_DIRECTION,
  INDO_HCM_MIDBLOCK_PCU,
  INDO_HCM_SIGNAL_PCU,
  indoHcmSaturationFlow,
  T45,
  T46,
  type ChennaiField,
  type SectionMeasure,
  type T45Result,
  type T46Result,
  type T4ChennaiResult,
} from "./tier4";
import { T5, type T5Measure } from "./tier5";
import { CAR } from "./scenario";

/** Tolerances of the benchmark standard, section 4, Tiers 2 to 4. */
const TOLERANCE = {
  t21: 0.05,
  t22: 0.15,
  t22UpToShare: 0.9,
  t23: 0.2,
  t31Geh: 5,
  t31Share: 0.85,
  t32: 0.15,
  t33: 0.25,
  t34Points: 5,
  t41: 0.15,
  t42: 0.1,
  t45: 0.15,
  t46: 0.2,
};

interface Entry<T> {
  job: { kind: string; id: string };
  wallClockS: number;
  result: T;
}

function load<T>(rawDir: string, kind: string): T[] {
  const file = join(rawDir, `${kind}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Entry<T>[]).map((entry) => entry.result) : [];
}

const T95 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131];

interface Stat {
  n: number;
  mean: number;
  ci: number;
}

function stat(values: number[]): Stat {
  const n = values.length;
  if (n === 0) return { n, mean: NaN, ci: NaN };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (n - 1) : 0;
  return { n, mean, ci: n > 1 ? (T95[Math.min(n - 1, T95.length - 1)] ?? 1.96) * Math.sqrt(variance / n) : 0 };
}

const num = (value: number, digits = 1) =>
  Number.isFinite(value) ? value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : String(value);
const pct = (value: number, digits = 1) => (Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%` : "-");
const mci = (s: Stat, digits = 1) => (s.n === 0 ? "not run" : `${num(s.mean, digits)} ± ${num(s.ci, digits)}`);
const verdict = (ok: boolean) => (ok ? "pass" : "**FAIL**");
const rel = (value: number, reference: number) => value / reference - 1;

function table(header: string[], rows: string[][]): string {
  return [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
}

function closer(ours: number, sumo: number, reference: number): string {
  if (!Number.isFinite(ours) || !Number.isFinite(sumo)) return "-";
  const a = Math.abs(ours - reference);
  const b = Math.abs(sumo - reference);
  if (Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(reference))) return "equal";
  return a < b ? "ours" : "SUMO";
}

export function writeTiersReport(rawDir: string, reportFile: string): void {
  const t21 = load<T21Result>(rawDir, "t2.1")[0];
  const t22 = load<T22Result>(rawDir, "t2.2");
  const t23 = load<T23Result>(rawDir, "t2.3");
  const t24 = load<T24Result>(rawDir, "t2.4");
  const t3 = load<T3Result>(rawDir, "t3");
  const fields = load<ChennaiField & { period: number }>(rawDir, "t4-field").sort((a, b) => a.period - b.period);
  const t4 = load<T4ChennaiResult>(rawDir, "t4-chennai");
  const t45 = load<T45Result>(rawDir, "t4.5");
  const t46 = load<T46Result>(rawDir, "t4.6");
  const t5 = load<T5Measure | null>(rawDir, "t5").filter((m): m is T5Measure => m !== null);
  const metaFile = join(rawDir, "meta.json");
  const meta = existsSync(metaFile) ? (JSON.parse(readFileSync(metaFile, "utf8")) as { runs: Record<string, unknown>[] }) : { runs: [] };

  const rows: string[][] = [];
  const header = ["ID", "Test and metric", "Reference", "Tolerance", "Ours", "SUMO", "Ours", "SUMO", "Ours against SUMO, or closer to the reference (Tier 4)"];
  const details: string[] = [];
  const stuckRows: string[][] = [];
  const stuck = (test: string, ours: { stuckVehicles: number; conservationViolations: number }[], sumo: { teleports: number; collisions: number; emergencyBraking: number }[]) => {
    const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
    stuckRows.push([
      test,
      String(ours.length),
      String(sum(ours.map((o) => o.stuckVehicles))),
      String(ours.filter((o) => o.stuckVehicles > 0).length),
      String(sum(ours.map((o) => o.conservationViolations))),
      sumo.length ? String(sumo.length) : "-",
      sumo.length ? String(sum(sumo.map((s) => s.teleports))) : "-",
      sumo.length ? String(sumo.filter((s) => s.teleports > 0).length) : "-",
      sumo.length ? String(sum(sumo.map((s) => s.collisions))) : "-",
      sumo.length ? String(sum(sumo.map((s) => s.emergencyBraking))) : "-",
    ]);
  };

  // ------------------------------------------------------------------ T2.1
  if (t21) {
    const ref = t21.reference.saturationFlowPerHour;
    const ours = t21.ours?.saturationFlowPerHour ?? NaN;
    const sumo = t21.sumo?.saturationFlowPerHour ?? NaN;
    rows.push([
      "T2.1",
      "Queue discharge at a signal, one lane: saturation flow (headways from the 5th car to the 30th)",
      `SUMO; IDM at 0.001 s through the same red and green: ${num(ref, 0)} veh/h`,
      "5%",
      `${num(ours, 0)} veh/h (${pct(rel(ours, ref))} from IDM)`,
      `${num(sumo, 0)} veh/h (${pct(rel(sumo, ref))} from IDM)`,
      `${verdict(Math.abs(rel(ours, sumo)) <= TOLERANCE.t21)} against SUMO; ${verdict(Math.abs(rel(ours, ref)) <= TOLERANCE.t21)} against IDM`,
      `${verdict(Math.abs(rel(sumo, ref)) <= TOLERANCE.t21)} against IDM`,
      pct(rel(ours, sumo), 2),
    ]);
    stuck("T2.1", t21.ours ? [t21.ours] : [], t21.sumo ? [t21.sumo] : []);
    const m = (d: { saturationHeadwayS: number; saturationFlowPerHour: number; lastTenHeadwayS: number; startUpLostS: number; crossingsS: number[] } | null) =>
      d ? [num(d.saturationHeadwayS, 3), num(d.saturationFlowPerHour, 0), num(d.lastTenHeadwayS, 3), num(d.startUpLostS, 2), num(d.crossingsS[0]!, 2)] : ["-", "-", "-", "-", "-"];
    details.push(`### T2.1 Queue discharge at a signal, one lane

${T21.queueLength} cars stand at rest ${T21.startSpacingM} m apart (front to front) on a one-lane approach ${T21.armLengthM} m long,
the first ${CAR.standstillGapM} m short of the stop line, and close up to the red under each engine's own rules. The main road's
green starts at ${T21.greenStartS} s. The moment each front bumper crosses the stop line is read from every step (interpolated);
saturation flow is 3600 over the mean headway from the ${T21.firstCountedVehicle}th car to the last. Not stochastic: one run per engine.
The reference is the IDM integrated at 0.001 s from the same places through the same red (a standing vehicle whose rear is
at the stop line) and green. "Ideal queue" is the IDM from a queue at exactly the standstill gap, for information: a queue
that formed during a red is looser than that, and discharges more slowly.

${table(
  ["", "Saturation headway (s)", "Saturation flow (veh/h)", "Mean headway, last ten (s)", "Start-up lost time (s)", "First car crosses (s after green)"],
  [
    ["IDM reference, same start", ...m(t21.reference)],
    ["IDM, ideal queue (information)", ...m(t21.referenceIdealQueue)],
    ["Ours", ...m(t21.ours)],
    ["SUMO", ...m(t21.sumo)],
  ],
)}

The junction is ${t21.junctionPathM} m across in our engine; SUMO's internal lane through it is ${t21.sumo ? num(t21.sumo.internalLaneLengthM, 2) : "-"} m.
SUMO's first car moves up to the stop line itself during the red; ours stands its standstill gap short of it.`);
  }

  // ------------------------------------------------------------------ T2.2
  if (t22.length > 0) {
    const cap = t22Capacity();
    const shares = [...new Set(t22.map((r) => r.share))].sort((a, b) => a - b);
    const detailRows: string[][] = [];
    for (const share of shares) {
      const runs = t22.filter((r) => r.share === share);
      const flow = runs[0]!.flowPerHour;
      const webster = websterDelayS(T22_CYCLE_S, cap.effectiveGreenS, flow, cap.saturationFlowPerHour);
      const ours = stat(runs.map((r) => r.ours.meanDelayS));
      const sumo = stat(runs.filter((r) => r.sumo).map((r) => r.sumo!.meanDelayS));
      const scored = share <= TOLERANCE.t22UpToShare + 1e-9;
      const beyond = share > 1;
      if (!beyond) {
        rows.push([
          "T2.2",
          `Fixed-time signal at ${Math.round(share * 100)}% of capacity (${num(flow, 0)} veh/h): mean delay`,
          Number.isFinite(webster) ? `Webster: ${num(webster, 1)} s; SUMO` : "Webster: no finite delay at x = 1; SUMO",
          scored ? "15% up to 90% of capacity" : "report only above 90%",
          `${mci(ours)} s (${Number.isFinite(webster) ? pct(rel(ours.mean, webster)) : "-"})`,
          `${mci(sumo)} s (${Number.isFinite(webster) ? pct(rel(sumo.mean, webster)) : "-"})`,
          scored ? verdict(Math.abs(rel(ours.mean, webster)) <= TOLERANCE.t22) : "report only",
          scored ? verdict(Math.abs(rel(sumo.mean, webster)) <= TOLERANCE.t22) : "report only",
          `${pct(rel(ours.mean, sumo.mean))}${scored ? `: ${verdict(Math.abs(rel(ours.mean, sumo.mean)) <= TOLERANCE.t22)}` : ""}`,
        ]);
      }
      detailRows.push([
        `${Math.round(share * 100)}%`,
        num(flow, 0),
        Number.isFinite(webster) ? num(webster, 1) : "infinite",
        mci(ours),
        mci(sumo),
        mci(stat(runs.map((r) => r.ours.throughPerHour)), 0),
        mci(stat(runs.filter((r) => r.sumo).map((r) => r.sumo!.throughPerHour)), 0),
        `${runs.reduce((s, r) => s + r.ours.unfinished, 0)} / ${runs.reduce((s, r) => s + (r.sumo?.unfinished ?? 0), 0)}`,
      ]);
    }
    stuck("T2.2", t22.map((r) => r.ours), t22.filter((r) => r.sumo).map((r) => r.sumo!));
    details.push(`### T2.2 Fixed-time signal, demand from 30% to 100% of capacity

One lane, cars, Poisson arrivals at the given share of the reference capacity. Signal: main road ${T22.plan.phases[0]!.greenS} s
green, cross road ${T22.plan.phases[1]!.greenS} s, amber ${T22.plan.amberS} s, all-red ${T22.plan.allRedS} s: cycle ${T22_CYCLE_S} s. Ten seeds per share per engine;
warm-up ${T22.warmUpS} s, then the vehicles the demand produced in the next ${T22.measureS} s are followed until they leave (up to
${T22.drainS} s more). A vehicle's delay is its waiting to enter plus, for each step on the network, the step times
(1 - speed / desired speed): in SUMO, departDelay + timeLoss from its trip record, the same quantity.

**Webster's inputs**, fixed before the runs from the T2.1 reference: saturation flow ${num(cap.saturationFlowPerHour, 0)} veh/h; effective
green = green + amber - start-up lost time = ${num(cap.effectiveGreenS, 2)} s (the amber taken as used to its end); capacity
${num(cap.capacityPerHour, 1)} veh/h. Webster (1958): d = c(1-λ)²/(2(1-λx)) + x²/(2q(1-x)) - 0.65 (c/q²)^(1/3) x^(2+5λ).
The last row (130%) is beyond capacity: it is run only to read each engine's own capacity (vehicles through an hour).

${table(
  ["Share of capacity", "Flow (veh/h)", "Webster (s)", "Ours: mean delay (s)", "SUMO: mean delay (s)", "Ours: through (veh/h)", "SUMO: through (veh/h)", "Vehicles not out by the end, ours / SUMO (all seeds)"],
  detailRows,
)}`);
  }

  // ------------------------------------------------------------------ T2.3
  if (t23.length > 0) {
    const flows = [...new Set(t23.map((r) => r.majorFlowPerHour))].sort((a, b) => a - b);
    const tc = carCriticalGapS();
    const tf = T23.followUpShareOfCriticalGap * tc;
    const oursMeans: number[] = [];
    const sumoMeans: number[] = [];
    const detailRows: string[][] = [];
    for (const q of flows) {
      const runs = t23.filter((r) => r.majorFlowPerHour === q);
      const formula = gapAcceptanceCapacity(q, tc, tf);
      const ours = stat(runs.filter((r) => r.ours).map((r) => r.ours!.minorThroughPerHour));
      const sumo = stat(runs.filter((r) => r.sumo).map((r) => r.sumo!.minorThroughPerHour));
      oursMeans.push(ours.mean);
      sumoMeans.push(sumo.mean);
      rows.push([
        "T2.3",
        `Priority junction, main road ${q} veh/h: side-road capacity`,
        `Gap acceptance (Siegloch), tc ${num(tc, 1)} s, tf ${num(tf, 2)} s: ${num(formula, 0)} veh/h; SUMO`,
        "20%",
        ours.n ? `${mci(ours, 0)} veh/h (${pct(rel(ours.mean, formula))})` : `not runnable: ${runs[0]!.oursNotRunnable}`,
        `${mci(sumo, 0)} veh/h (${pct(rel(sumo.mean, formula))})`,
        ours.n ? verdict(Math.abs(rel(ours.mean, formula)) <= TOLERANCE.t23) : "not runnable",
        verdict(Math.abs(rel(sumo.mean, formula)) <= TOLERANCE.t23),
        ours.n ? `${pct(rel(ours.mean, sumo.mean))}: ${verdict(Math.abs(rel(ours.mean, sumo.mean)) <= TOLERANCE.t23)}` : "-",
      ]);
      detailRows.push([String(q), num(formula, 0), mci(ours, 0), mci(sumo, 0), String(runs.reduce((s, r) => s + (r.sumo?.teleportsYield ?? 0), 0))]);
    }
    const falling = (list: number[]) => list.every((v, i) => i === 0 || v < list[i - 1]!);
    rows.push(["T2.3", "Side-road capacity falls as main-road flow rises (means over seeds)", "-", "must fall monotonically", "", "", oursMeans.every(Number.isFinite) ? verdict(falling(oursMeans)) : "not runnable", verdict(falling(sumoMeans)), ""]);
    stuck("T2.3", t23.filter((r) => r.ours).map((r) => r.ours!), t23.filter((r) => r.sumo).map((r) => r.sumo!));
    details.push(`### T2.3 Priority junction

A T-junction in left-hand traffic built the way the engine's own tests build it: the main road east-west, one lane each way,
its flow split equally between the two directions; the side road from the south, ${T23.minorDemandPerHour} veh/h (more than it can take),
half turning each way. Cars, lane discipline on. Network format 5: \`control: "priority"\`, main-road approaches named. In SUMO
a \`priority\` node whose main-road edges are ranked above the side road's, with SUMO's default junction model.
Side-road vehicles crossing the stop line in ${T23.measureS} s after a ${T23.warmUpS} s warm-up; ten seeds each.

The standard names "the gap-acceptance capacity formula" without its inputs. Here: Siegloch's c = q e^(-q(tc - tf/2)) / (1 - e^(-q tf)),
q the whole main-road flow, tc = the engine's accepted gap for a car (${num(tc, 1)} s, Kota et al. 2025, read from the engine's assumptions
table), and tf = ${T23.followUpShareOfCriticalGap} tc = ${num(tf, 2)} s, a rule of thumb: neither the standard nor the engine gives a follow-up time.

${table(["Main-road flow (veh/h)", "Formula (veh/h)", "Ours (veh/h)", "SUMO (veh/h)", "SUMO teleports for yielding (all seeds)"], detailRows)}`);
  }

  // ------------------------------------------------------------------ T2.4
  if (t24.length > 0) {
    const oursStuck = t24.map((r) => r.ours.stuckVehicles);
    const sumoTp = t24.filter((r) => r.sumo).map((r) => r.sumo!.teleports);
    rows.push([
      "T2.4",
      "Four-way junction, all approaches saturated, 30 min: stuck vehicles (ours) and teleports (SUMO)",
      "none",
      "zero; otherwise report the count",
      `${oursStuck.reduce((a, b) => a + b, 0)} in ${t24.length} runs`,
      `${sumoTp.reduce((a, b) => a + b, 0)} in ${sumoTp.length} runs`,
      verdict(oursStuck.every((v) => v === 0)),
      sumoTp.length ? verdict(sumoTp.every((v) => v === 0)) : "not run",
      "",
    ]);
    stuck("T2.4", t24.map((r) => r.ours), t24.filter((r) => r.sumo).map((r) => r.sumo!));
    details.push(`### T2.4 Four-way junction, all approaches saturated

Two lanes each way on every arm (${T24.armLengthM} m), stop lines ${T24.halfGapM} m from the centre. Two phases: north-south together, then
east-west together (${T24.plan.phases[0]!.greenS} s green each, amber ${T24.plan.amberS} s, all-red ${T24.plan.allRedS} s), so turns across oncoming traffic meet it; in SUMO
those turns have a permissive green ('g') and yield. Demand ${T24.perApproachPerHour} veh/h per approach (20% left, 60% straight on,
20% right), more than an approach can take. Cars, lane discipline on, ${T24.durationS / 60} minutes, ten seeds.

${table(
  ["", "Vehicles through (mean ± 95%)", "Vehicles let onto the network", "Still waiting to enter at the end", "Stuck vehicles / teleports (all seeds)"],
  [
    ["Ours", mci(stat(t24.map((r) => r.ours.through)), 0), mci(stat(t24.map((r) => r.ours.entered)), 0), mci(stat(t24.map((r) => r.ours.waitingToEnter)), 0), String(oursStuck.reduce((a, b) => a + b, 0))],
    [
      "SUMO",
      mci(stat(t24.filter((r) => r.sumo).map((r) => r.sumo!.through)), 0),
      mci(stat(t24.filter((r) => r.sumo).map((r) => r.sumo!.inserted)), 0),
      mci(stat(t24.filter((r) => r.sumo).map((r) => r.sumo!.waiting)), 0),
      String(sumoTp.reduce((a, b) => a + b, 0)),
    ],
  ],
)}`);
  }

  // ------------------------------------------------------------------ Tier 3
  if (t3.length > 0) {
    const withSumo = t3.filter((r) => r.sumo);
    const meanOf = (pick: (r: T3Result) => number | undefined, list = t3) => stat(list.map(pick).filter((v): v is number => v !== undefined && Number.isFinite(v)));
    const links = Object.keys(t3[0]!.ours.flowByRoad);
    const gehRows: string[][] = [];
    let gehOk = 0;
    for (const link of links) {
      const m = meanOf((r) => r.ours.flowByRoad[link]).mean;
      const c = meanOf((r) => r.sumo?.flowByRoad[link], withSumo).mean;
      const geh = Math.sqrt((2 * (m - c) ** 2) / (m + c || 1));
      if (geh < TOLERANCE.t31Geh) gehOk++;
      gehRows.push([link, num(m, 0), num(c, 0), num(geh, 2), geh < TOLERANCE.t31Geh ? "yes" : "no"]);
    }
    const perSeedShares = withSumo.map((r) => {
      let ok = 0;
      for (const link of links) {
        const m = r.ours.flowByRoad[link]!;
        const c = r.sumo!.flowByRoad[link]!;
        if (Math.sqrt((2 * (m - c) ** 2) / (m + c || 1)) < TOLERANCE.t31Geh) ok++;
      }
      return ok / links.length;
    });
    rows.push([
      "T3.1",
      "Small network: hourly flow per link, GEH (mean flows over ten seeds)",
      "SUMO",
      "GEH < 5 on at least 85% of links",
      `${gehOk} of ${links.length} links (${num((100 * gehOk) / links.length, 0)}%); per seed ${num(100 * Math.min(...perSeedShares), 0)}% to ${num(100 * Math.max(...perSeedShares), 0)}%`,
      "(reference)",
      verdict(gehOk / links.length >= TOLERANCE.t31Share),
      "-",
      "",
    ]);
    const ods = [...new Set(t3.flatMap((r) => [...Object.keys(r.ours.travelTimeByOd), ...Object.keys(r.sumo?.travelTimeByOd ?? {})]))].sort();
    const odRows: string[][] = [];
    let odOk = 0;
    let odBoth = 0;
    for (const od of ods) {
      const o = meanOf((r) => r.ours.travelTimeByOd[od]?.meanS);
      const s = meanOf((r) => r.sumo?.travelTimeByOd[od]?.meanS, withSumo);
      const n = t3.reduce((a, r) => a + (r.ours.travelTimeByOd[od]?.vehicles ?? 0), 0);
      const ns = withSumo.reduce((a, r) => a + (r.sumo!.travelTimeByOd[od]?.vehicles ?? 0), 0);
      const d = rel(o.mean, s.mean);
      if (o.n && s.n) {
        odBoth++;
        if (Math.abs(d) <= TOLERANCE.t32) odOk++;
      }
      odRows.push([od.replace(">", " to "), `${mci(o)} (${n})`, `${mci(s)} (${ns})`, pct(d), o.n && s.n ? (Math.abs(d) <= TOLERANCE.t32 ? "yes" : "no") : "-"]);
    }
    rows.push(["T3.2", "Mean travel time per origin-destination pair", "SUMO", "15%", `${odOk} of ${odBoth} pairs within 15%`, "(reference)", verdict(odOk === odBoth), "-", ""]);
    const approaches = Object.keys(t3[0]!.ours.longestQueueByApproach);
    const qRows: string[][] = [];
    let qOk = 0;
    let qScored = 0;
    for (const a of approaches) {
      const o = meanOf((r) => r.ours.longestQueueByApproach[a]);
      const own = meanOf((r) => r.ours.engineOwnLongestQueueByApproach[a]);
      const s = meanOf((r) => r.sumo?.longestQueueByApproach[a], withSumo);
      const both0 = o.mean === 0 && s.mean === 0;
      const d = rel(o.mean, s.mean);
      if (!both0) {
        qScored++;
        if (Math.abs(d) <= TOLERANCE.t33) qOk++;
      }
      qRows.push([a, mci(o), mci(own), mci(s), both0 ? "both 0" : pct(d), both0 ? "-" : Math.abs(d) <= TOLERANCE.t33 ? "yes" : "no"]);
    }
    rows.push(["T3.3", "Longest queue per approach (an approach with no queue in either engine is not scored)", "SUMO", "25%", `${qOk} of ${qScored} approaches within 25%`, "(reference)", verdict(qOk === qScored), "-", ""]);
    const shareRows: string[][] = [];
    for (const key of Object.keys(THROUGH)) {
      const o = meanOf((r) => r.ours.flyoverShare[key]!.flyover / (r.ours.flyoverShare[key]!.flyover + r.ours.flyoverShare[key]!.junction));
      const s = meanOf((r) => (r.sumo ? r.sumo.flyoverShare[key]!.flyover / (r.sumo.flyoverShare[key]!.flyover + r.sumo.flyoverShare[key]!.junction) : undefined), withSumo);
      const points = 100 * (o.mean - s.mean);
      rows.push([
        "T3.4",
        `Share of through traffic ${key.replace(">", " to ")} taking the flyover`,
        "SUMO",
        "5 percentage points",
        `${num(100 * o.mean, 1)}% ± ${num(100 * o.ci, 1)}`,
        `${num(100 * s.mean, 1)}% ± ${num(100 * s.ci, 1)}`,
        `${verdict(Math.abs(points) <= TOLERANCE.t34Points)} (${points >= 0 ? "+" : ""}${num(points, 1)} points)`,
        "-",
        "",
      ]);
      shareRows.push([key.replace(">", " to "), `${num(100 * o.mean, 1)}% ± ${num(100 * o.ci, 1)}`, `${num(100 * s.mean, 1)}% ± ${num(100 * s.ci, 1)}`]);
    }
    stuck("Tier 3", t3.map((r) => r.ours), withSumo.map((r) => r.sumo!));
    details.push(`## Tier 3 details

The engine's flyover example (\`packages/engine/examples/flyover.json\`): a flyover each way over a signal junction (four phases of
20 s, one approach at a time), the diverges and merges where it leaves and rejoins the main road; with a second signal junction
added 215 m beyond the north end (two phases: north-south 40 s, east-west 20 s; amber 3 s, all-red 2 s), its own east-west arms,
and the north entry and exit moved beyond it. Cars only, lane discipline on (the example runs the Bengaluru mix in mixed traffic;
here the mix is replaced by cars so that SUMO's ordinary lane model applies). The example's flows, with the new junction's own
cross traffic (300 straight on and 100 turning, each way). Warm-up ${T3.warmUpS} s, measured ${T3.measureS} s, ten seeds.

Route choice: the through flows can take the flyover or the junction beneath. Our engine chooses once per vehicle, when it
enters, by its Kirchhoff split on travel times measured over the last minute. SUMO is given both routes and its rerouting device
(\`--device.rerouting.probability 1\`, \`period 0\`: routed once, when the vehicle is inserted; edge travel times averaged over
the last 60 s), which takes the fastest route at that moment.

**T3.1 Flow per link** (vehicles entering the road in the measured hour, mean over seeds; SUMO's \`entered + departed\` from its edge data):

${table(["Road", "Ours (veh/h)", "SUMO (veh/h)", "GEH", "Below 5"], gehRows)}

**T3.2 Mean travel time per origin-destination pair**, from being placed on the network to leaving it (waiting to enter left out),
vehicles placed in the measured hour that left by its end (count in brackets, all seeds). A vehicle our engine released as stuck is
left out.

${table(["From, to", "Ours (s)", "SUMO (s)", "Ours against SUMO", "Within 15%"], odRows)}

**T3.3 Longest queue per approach** in the measured hour, sampled once a second in both engines with the engine's own rule (a
vehicle on the approach, short of the stop line, below 1.4 m/s is queued; counted back from the stop line to the first gap
over 10 m), applied by the harness to both. "Ours, engine's own" is the engine's own longestQueueByApproach (every step) for comparison.

${table(["Approach", "Ours (m)", "Ours, engine's own (m)", "SUMO (m)", "Ours against SUMO", "Within 25%"], qRows)}

**T3.4 Through traffic taking the flyover**, vehicles placed in the measured hour that left by its end:

${table(["Through flow", "Ours", "SUMO"], shareRows)}`);
  }

  // ------------------------------------------------------------------ Tier 4: Chennai
  if (fields.length === 2 && t4.length > 0) {
    const seeds = [...new Set(t4.map((r) => r.seed))].sort((a, b) => a - b);
    const bySeed = (side: "ours" | "sumo", pick: (m: SectionMeasure, period: number) => number) =>
      stat(
        seeds
          .map((seed) => {
            const values = [0, 1].map((p) => {
              const r = t4.find((x) => x.seed === seed && x.period === p);
              const m = r?.[side];
              return m ? pick(m, p) : NaN;
            });
            return (values[0]! + values[1]!) / 2;
          })
          .filter(Number.isFinite),
      );
    const field = (pick: (m: SectionMeasure, f: ChennaiField) => number) => (pick(fields[0]!.measure, fields[0]!) + pick(fields[1]!.measure, fields[1]!)) / 2;
    for (const c of VEHICLE_CLASSES) {
      const f = field((m) => m.meanSpeedByClass[c] ?? NaN);
      const o = bySeed("ours", (m) => m.meanSpeedByClass[c] ?? NaN);
      const s = bySeed("sumo", (m) => m.meanSpeedByClass[c] ?? NaN);
      rows.push([
        "T4.1",
        `Chennai section: mean speed, ${c}`,
        `field (from positions): ${num(f, 2)} m/s`,
        "15% from field",
        `${mci(o, 2)} m/s (${pct(rel(o.mean, f))})`,
        `${mci(s, 2)} m/s (${pct(rel(s.mean, f))})`,
        verdict(Math.abs(rel(o.mean, f)) <= TOLERANCE.t41),
        verdict(Math.abs(rel(s.mean, f)) <= TOLERANCE.t41),
        closer(o.mean, s.mean, f),
      ]);
    }
    {
      const f = field((m) => m.throughputPerHour);
      const o = bySeed("ours", (m) => m.throughputPerHour);
      const s = bySeed("sumo", (m) => m.throughputPerHour);
      rows.push([
        "T4.2",
        "Chennai section: throughput (front bumpers past 200 m)",
        `field: ${num(f, 0)} veh/h`,
        "10% from field",
        `${mci(o, 0)} veh/h (${pct(rel(o.mean, f))})`,
        `${mci(s, 0)} veh/h (${pct(rel(s.mean, f))})`,
        verdict(Math.abs(rel(o.mean, f)) <= TOLERANCE.t42),
        verdict(Math.abs(rel(s.mean, f)) <= TOLERANCE.t42),
        closer(o.mean, s.mean, f),
      ]);
    }
    for (const c of VEHICLE_CLASSES) {
      const emd = (side: "ours" | "sumo") =>
        bySeed(side, (m, p) => {
          const fh = fields[p]!.measure.lateralHistogramByClass[c];
          const mh = m.lateralHistogramByClass[c];
          return fh && mh ? earthMoversM(fh, mh) : NaN;
        });
      const o = emd("ours");
      const s = emd("sumo");
      rows.push(["T4.3", `Chennai section: sideways positions, ${c}: earth mover's distance to the field's`, "field", "report; no pass line", `${mci(o, 2)} m`, `${mci(s, 2)} m`, "report", "report", closer(o.mean, s.mean, 0)]);
    }
    {
      const rmse = (side: "ours" | "sumo") =>
        stat(
          seeds
            .map((seed) => {
              let sum = 0;
              let n = 0;
              for (const p of [0, 1]) {
                const m = t4.find((x) => x.seed === seed && x.period === p)?.[side];
                if (!m) return NaN;
                m.minutes.forEach((minute, i) => {
                  sum += (minute.speedMps - fields[p]!.measure.minutes[i]!.speedMps) ** 2;
                  n++;
                });
              }
              return Math.sqrt(sum / n);
            })
            .filter(Number.isFinite),
        );
      const o = rmse("ours");
      const s = rmse("sumo");
      rows.push(["T4.4", "Chennai section: speed each minute against the field's same minute, RMSE", "field", "report RMSE; no pass line", `${mci(o, 2)} m/s`, `${mci(s, 2)} m/s`, "report", "report", closer(o.mean, s.mean, 0)]);
    }
    // The speed column of the data, for comparison (the figures the paper reports).
    const speedColumnRows: string[][] = VEHICLE_CLASSES.map((c) => {
      const f = ((fields[0]!.speedColumnMeanByClass[c] ?? NaN) + (fields[1]!.speedColumnMeanByClass[c] ?? NaN)) / 2;
      const o = bySeed("ours", (m) => m.meanSpeedByClass[c] ?? NaN);
      const s = bySeed("sumo", (m) => m.meanSpeedByClass[c] ?? NaN);
      return [c, num(f, 2), `${num(o.mean, 2)} (${pct(rel(o.mean, f))})`, `${num(s.mean, 2)} (${pct(rel(s.mean, f))})`, closer(o.mean, s.mean, f)];
    });
    const fieldRows: string[][] = [];
    const fieldItem = (name: string, pick: (f: ChennaiField) => string) => fieldRows.push([name, pick(fields[0]!), pick(fields[1]!)]);
    fieldItem("File", (f) => `\`${f.file}\``);
    fieldItem("Vehicles (trajectories)", (f) => num(f.vehicles, 0));
    fieldItem("Observations (rows)", (f) => num(f.observations, 0));
    fieldItem("Observations flagged as corrected by hand", (f) => `${num(f.flaggedObservations, 0)} (${num((100 * f.flaggedObservations) / f.observations, 1)}%)`);
    fieldItem("Vehicles by type", (f) => Object.entries(f.vehiclesByType).map(([t, n]) => `${CHENNAI_TYPES[Number(t)]!.name} ${n}`).join(", "));
    fieldItem("Furthest front bumper (m)", (f) => num(f.maxFrontM, 1));
    fieldItem("Sideways positions, least and greatest (m)", (f) => `${num(f.minLateralM, 2)} to ${num(f.maxLateralM, 2)}`);
    fieldItem("Last time stamp (s)", (f) => num(f.lastTimeS, 1));
    fieldItem("Flow: vehicles in the file per hour", (f) => num(f.demandPerHour, 0));
    fieldItem("Speed column: mean of all observations (m/s)", (f) => num(f.speedColumnMeanAll, 3));
    fieldItem("Speed column, by type (m/s)", (f) => Object.entries(f.speedColumnMeanByType).map(([t, v]) => `${CHENNAI_TYPES[Number(t)]!.name} ${num(v, 2)}`).join(", "));
    fieldItem("Speed from positions: mean over successive observations 0.5 s apart (m/s)", (f) => num(f.positionSpeedMeanAll, 3));
    fieldItem("Speed from positions in 30-220 m, by engine class (m/s)", (f) => VEHICLE_CLASSES.map((c) => `${c} ${num(f.measure.meanSpeedByClass[c] ?? NaN, 2)}`).join(", "));
    fieldItem("Mix given to the engines", (f) => VEHICLE_CLASSES.map((c) => `${c} ${num(100 * (f.mix[c] ?? 0), 1)}%`).join(", "));
    const allVehicles = fields[0]!.vehicles + fields[1]!.vehicles;
    stuck("T4.1-T4.4", t4.map((r) => r.ours), t4.filter((r) => r.sumo).map((r) => r.sumo!));
    const minuteRows = fields[0]!.measure.minutes.map((m, i) => {
      const o = stat(t4.filter((r) => r.period === 0).map((r) => r.ours.minutes[i]!.speedMps));
      const s = stat(t4.filter((r) => r.period === 0 && r.sumo).map((r) => r.sumo!.minutes[i]!.speedMps));
      const od = stat(t4.filter((r) => r.period === 0).map((r) => r.ours.minutes[i]!.densityPerKm));
      const sd = stat(t4.filter((r) => r.period === 0 && r.sumo).map((r) => r.sumo!.minutes[i]!.densityPerKm));
      return [String(i + 1), num(m.densityPerKm, 0), num(m.speedMps, 2), `${num(od.mean, 0)} / ${num(o.mean, 2)}`, `${num(sd.mean, 0)} / ${num(s.mean, 2)}`];
    });
    details.push(`## Tier 4 details

### The Chennai data, as read here

Fetched by \`packages/benchmark/scripts/fetch-chennai.sh\` into \`data/external/chennai\` (ignored by git; not committed). Every figure
below was computed by \`src/chennai.ts\` and \`chennaiField()\` in \`src/tier4.ts\` from the two downloaded files: ${num(allVehicles, 0)} vehicles in all.

${table(["", "2:45 to 3:00 pm", "3:00 to 3:15 pm"], fieldRows)}

**The speed column disagrees with the positions by a factor of about two.** Between two successive observations of a vehicle,
0.5 s apart by the time column, the front bumper moves on average ${num(fields[0]!.positionSpeedMeanAll, 2)} and
${num(fields[1]!.positionSpeedMeanAll, 2)} m/s; the speed column of the same observations averages ${num(fields[0]!.speedColumnMeanAll, 2)} and
${num(fields[1]!.speedColumnMeanAll, 2)} m/s (the paper's 5.88 m/s overall is the speed column). The positions and the time column agree with
the counted flow: about 6,000 vehicles an hour at about 150 vehicles per km in the stretch is a speed near 11 m/s, not 6. Which
column is wrong is not known; the legend gives no help. **Decided before any model run was looked at:** T4.1 is scored against
speeds from the positions (distance covered over time taken in the stretch 30 to 220 m), because the throughput and the density
the engines are given and scored on come from the same positions and times. The speed column's figures are shown below for comparison.

The engines' four classes stand for the data's six: motorcycle as two-wheeler, car and light commercial vehicle as car, bus and
truck as bus, auto-rickshaw as auto-rickshaw. The field's figures are grouped the same way.

### T4.1 to T4.4 Replay of the section

**Not a replay of the observed arrivals.** The engine's interface takes a demand as flows (Poisson arrivals at a rate) and cannot
be given an arrival schedule. Each 15-minute period is run with its observed rate and vehicle mix as the demand, on an empty road
245 m x ${CHENNAI.widthM} m (mixed traffic; three nominal lanes, which mixed traffic ignores), speed limit ${CHENNAI.speedLimitMps} m/s so that each class's own
desired speed applies; SUMO gets the identical departures. Ten seeds per period per engine; the rows above average the two
periods. Measured in the stretch ${CHENNAI.zoneFromM} to ${CHENNAI.zoneToM} m (where every vehicle in the data is tracked); throughput where front bumpers cross
${CHENNAI.countAtM} m. Engines sampled once a second; the field at its 0.5 s. Sideways positions: the time each class spends in each 0.2 m
across the road, compared as an earth mover's distance (metres of sideways shift needed to turn one distribution into the other).
T4.2's throughput is close to the demand by construction whenever the section is not congested: it shows the section carries the
demand, not that the engine reproduces the field's flow.

Against the speed column instead of the positions (mean of the two periods; m/s):

${table(["Class", "Field, speed column", "Ours", "SUMO", "Closer"], speedColumnRows)}

Each minute of the first period, density (veh/km) and speed (m/s), engines' means over ten seeds:

${table(["Minute", "Field density", "Field speed", "Ours density / speed", "SUMO density / speed"], minuteRows)}`);
  }

  // ------------------------------------------------------------------ T4.5 and T4.6
  if (t45.length > 0) {
    const ref = INDO_HCM_4LANE_CAPACITY_PER_DIRECTION;
    const o = stat(t45.map((r) => r.ours.pcuPerHour));
    const s = stat(t45.filter((r) => r.sumo).map((r) => r.sumo!.pcuPerHour));
    rows.push([
      "T4.5",
      "Mid-block capacity, one carriageway of a 4-lane divided road (7.5 m), Bengaluru mix",
      `Indo-HCM 2017 base capacity ${num(ref, 0)} PCU/h (secondary)`,
      "15%",
      `${mci(o, 0)} PCU/h (${pct(rel(o.mean, ref))})`,
      `${mci(s, 0)} PCU/h (${pct(rel(s.mean, ref))})`,
      verdict(Math.abs(rel(o.mean, ref)) <= TOLERANCE.t45),
      verdict(Math.abs(rel(s.mean, ref)) <= TOLERANCE.t45),
      closer(o.mean, s.mean, ref),
    ]);
    stuck("T4.5", t45.map((r) => r.ours), t45.filter((r) => r.sumo).map((r) => r.sumo!));
    const cls = (side: "ours" | "sumo") => VEHICLE_CLASSES.map((c) => `${c} ${num(stat(t45.filter((r) => r[side]).map((r) => r[side]!.byClassPerHour[c] ?? 0)).mean, 0)}`).join(", ");
    details.push(`### T4.5 Mid-block capacity

One carriageway ${T45.widthM} m wide (Indo-HCM's nominal width of a 4-lane divided road: two 3.5 m lanes and 0.25 m kerb shyness each
side), ${T45.lengthM} m, mixed traffic, the Bengaluru vehicle mix at ${num(T45.demandPerHour, 0)} veh/h (more than either engine lets in). Vehicles
past ${T45.countAtM} m in ${T45.measureS} s after a ${T45.warmUpS} s warm-up, ten seeds, converted with Indo-HCM's midblock PCU for 4-lane divided roads
(two-wheeler ${INDO_HCM_MIDBLOCK_PCU["two-wheeler"]}, auto-rickshaw ${INDO_HCM_MIDBLOCK_PCU["auto-rickshaw"]}, car 1, bus ${INDO_HCM_MIDBLOCK_PCU.bus}). With demand
beyond capacity both engines are limited where vehicles enter, so this is the most the road takes in from its start: neither
engine has a bottleneck downstream on this road.

Vehicles per hour by class: ours ${cls("ours")}; SUMO ${cls("sumo")}. In vehicles: ours ${mci(stat(t45.map((r) => r.ours.vehiclesPerHour)), 0)} veh/h, SUMO
${mci(stat(t45.filter((r) => r.sumo).map((r) => r.sumo!.vehiclesPerHour)), 0)} veh/h.

Indo-HCM values (all as read by the project's research agent from a third-party copy of the manual, whose table layout was partly
scrambled; **secondary**, not confirmed here from the primary text): base capacity 5,400 PCU/h for a 4-lane divided urban road,
2,700 per direction (Table 5.4); PCU medians as above (Table 5.3, column mapping marked uncertain by the agent).`);
  }
  if (t46.length > 0) {
    const ref = indoHcmSaturationFlow(T46.widthM);
    const o = stat(t46.map((r) => r.ours.pcuPerHour));
    const s = stat(t46.filter((r) => r.sumo).map((r) => r.sumo!.pcuPerHour));
    rows.push([
      "T4.6",
      `Signal approach ${T46.widthM} m wide, mixed traffic, **without two-wheeler filtering** (not built: ticket 06): saturation flow`,
      `Indo-HCM 2017: W (1140 - 60 W) = ${num(ref, 0)} PCU/h (secondary)`,
      "20%",
      `${mci(o, 0)} PCU/h (${pct(rel(o.mean, ref))})`,
      `${mci(s, 0)} PCU/h (${pct(rel(s.mean, ref))})`,
      verdict(Math.abs(rel(o.mean, ref)) <= TOLERANCE.t46),
      verdict(Math.abs(rel(s.mean, ref)) <= TOLERANCE.t46),
      closer(o.mean, s.mean, ref),
    ]);
    stuck("T4.6", t46.map((r) => r.ours), t46.filter((r) => r.sumo).map((r) => r.sumo!));
    details.push(`### T4.6 Saturation flow of a signal approach

The standard's T4.6 is with two-wheeler filtering. **Filtering is not built in our engine** (ticket 06 not started), so this is the
engine as it is: two-wheelers do not move up between queued vehicles during the red. SUMO's sublane model lets narrow vehicles
use any free sublanes, which includes moving up beside queued vehicles where there is room; nothing was added to SUMO for it.

Approach ${T46.widthM} m wide, ${T46.armLengthM} m long, through traffic only, Bengaluru mix at ${num(T46.demandPerHour, 0)} veh/h (more than the approach can take, so
the queue never clears). Green ${T46.plan.phases[0]!.greenS} s in a ${T46.plan.phases.reduce((a, p) => a + p.greenS + T46.plan.amberS + T46.plan.allRedS, 0)} s cycle. Saturation flow: vehicles crossing the stop line per hour of green, leaving out the
first ${T46.skipGreenStartS} s of each green, over ${T46.measureS} s after a ${T46.warmUpS} s warm-up; ten seeds. PCU at signals (Indo-HCM Table 6.3 as read by the research
agent, secondary, mapping uncertain): two-wheeler ${INDO_HCM_SIGNAL_PCU["two-wheeler"]}, auto-rickshaw ${INDO_HCM_SIGNAL_PCU["auto-rickshaw"]}, car 1, bus ${INDO_HCM_SIGNAL_PCU.bus}.
The width formula (unit base saturation flow 1140 - 60 W PCU/h per metre, 7 <= W <= 10.5 m) is also as read by the agent (secondary).
In vehicles: ours ${mci(stat(t46.map((r) => r.ours.vehiclesPerHour)), 0)}, SUMO ${mci(stat(t46.filter((r) => r.sumo).map((r) => r.sumo!.vehiclesPerHour)), 0)} veh/h of green.`);
  }

  // ------------------------------------------------------------------ Tier 5
  const t5Rows: string[][] = [];
  if (t5.length > 0) {
    for (const kind of ["cars", "mixed"] as const) {
      for (const vehicles of T5.sizes) {
        const o = t5.find((m) => m.kind === kind && m.vehicles === vehicles && m.engine === "ours");
        const s = t5.find((m) => m.kind === kind && m.vehicles === vehicles && m.engine === "sumo");
        const cell = (m: T5Measure | undefined) => (m ? `${num(m.speedRatio, 1)}x` : "not run");
        const mem = (m: T5Measure | undefined) => (m?.peakMemoryBytes ? `${num(m.peakMemoryBytes / 2 ** 20, 0)} MB` : "-");
        const setup = (m: T5Measure | undefined) => (m ? num(m.setupS, 2) : "-");
        t5Rows.push([
          kind === "cars" ? "cars, lanes" : "Bengaluru mix, mixed traffic",
          num(vehicles, 0),
          cell(o),
          cell(s),
          mem(o),
          mem(s),
          `${setup(o)} / ${setup(s)}`,
          `${o ? num(o.loadAverage, 1) : "-"} / ${s ? num(s.loadAverage, 1) : "-"}`,
          `${o?.vehiclesAtEnd ?? "-"} / ${s?.vehiclesAtEnd ?? "-"}`,
        ]);
      }
    }
    for (const kind of ["cars", "mixed"] as const) {
      for (const engine of ["ours", "sumo"] as const) {
        const faster = t5.filter((m) => m.kind === kind && m.engine === engine && m.speedRatio > 1).map((m) => m.vehicles);
        const slower = t5.filter((m) => m.kind === kind && m.engine === engine && m.speedRatio <= 1).map((m) => m.vehicles);
        const best = faster.length ? Math.max(...faster) : null;
        rows.push([
          "T5.3",
          `Largest count measured that ran faster than real time, ${kind === "cars" ? "cars in lanes" : "mixed traffic"}, ${engine === "ours" ? "ours (Node)" : "SUMO"}`,
          "-",
          "report only",
          engine === "ours" ? (best ? num(best, 0) : "none of those measured") : "",
          engine === "sumo" ? (best ? num(best, 0) : "none of those measured") : "",
          "report",
          "report",
          slower.length ? `slower than real time at ${slower.map((v) => num(v, 0)).join(", ")}` : `faster at every size measured (up to ${num(Math.max(...T5.sizes), 0)})`,
        ]);
      }
    }
    rows.push(["T5.1, T5.2", "Speed and peak memory at 1,000, 5,000 and 20,000 vehicles", "-", "report only", "see Tier 5 table", "see Tier 5 table", "report", "report", ""]);
    rows.push(["T5.1 (browser)", "Speed in a browser worker", "-", "report only", "**not measured**", "-", "not run", "-", "no browser was driven in this run"]);
    rows.push(["T5.4", "Feature coverage", "-", "report only", "see checklist", "see checklist", "report", "report", ""]);
  }

  // ------------------------------------------------------------------ the document
  const runsTable = table(
    ["Part run", "Date", "Commit", "Engine commit", "SUMO", "Parallel processes", "Load average at start", "Jobs run", "Wall clock (min)"],
    meta.runs.map((r) => [
      String(r.only),
      String(r.date),
      `\`${String(r.gitCommit).slice(0, 10)}\`${r.gitDirty ? " (uncommitted changes)" : ""}`,
      `\`${String(r.engineCommit).slice(0, 10)}\``,
      String(r.sumoVersion ?? "not run"),
      String(r.parallelJobs),
      num(Number(r.loadAverageAtStart), 1),
      String(r.jobsRun),
      num(Number(r.wallClockMin), 1),
    ]),
  );
  const machine = meta.runs.length ? String(meta.runs[meta.runs.length - 1]!.machine) : "unknown";
  const nodeVersion = meta.runs.length ? String(meta.runs[meta.runs.length - 1]!.node) : "unknown";

  const doc = `# Benchmark results: Tiers 2 to 5 (2026-11-12)

Results of Tiers 2 to 5 of [the benchmark standard](benchmark-standard.md) for our engine and for SUMO, against the references
the standard names. This document is written by \`packages/benchmark\` (\`pnpm --filter @traffic-simulator/benchmark bench:tiers\`)
from the raw results in \`packages/benchmark/results/raw/tiers-2-to-5\`; every number in its tables was measured in the runs
listed here. Failures are in the same table as passes. There is no overall score. Tiers 0 and 1 are in
[benchmark-results-2026-11-12-after-ticket-23.md](benchmark-results-2026-11-12-after-ticket-23.md).

SUMO is not ground truth. Agreement with SUMO in Tiers 2 and 3 shows the implementation is sane, not realistic. In Tier 4 both
engines are scored against field data and Indian standards and the closer one is named per row. Nothing here tests behaviour at
an Indian junction against field data: there is none.

## The runs

${table(
  ["", ""],
  [
    ["Machine", machine],
    ["Runtime", `Node ${nodeVersion}; SUMO 1.28.0 headless (\`eclipse-sumo\` wheel in \`~/.cache/traffic-simulator/sumo-1.28.0\`)`],
    ["Step", "0.2 s in both engines"],
    ["Seeds", "10 per stochastic test per engine (seeds 1 to 10), mean ± 95% confidence interval (Student's t), none dropped; T2.1 is not stochastic (one run per engine)"],
    ["Machine load", "Shared with other work: the load average at the start of each part is in the table below. Tier 5 was run one process at a time; its load average is in its table."],
  ],
)}

${runsTable}

## Results table

The two columns after the values are pass or fail of each engine against the reference and tolerance. Percentages in brackets are
differences from the reference. In Tier 3 SUMO is the reference, so only our engine has a verdict.

${table(header, rows)}

### Stuck vehicles, teleports and collisions, per test (fairness rule 7)

Our engine now releases stuck vehicles itself and counts them (\`Results.stuckVehicles\`); that count is what is reported. "Conservation" counts
steps at which vehicles entered differed from those through plus on the network plus released (none expected). SUMO ran with
\`--time-to-teleport 300\` and \`--collision.action warn\`; its statistics give the counts.

${table(["Test", "Our runs", "Our stuck vehicles", "Our runs with any", "Conservation violations", "SUMO runs", "SUMO teleports", "SUMO runs with any", "SUMO collisions", "SUMO emergency braking"], stuckRows)}

## Findings

${FINDINGS_TIERS.trim()}

## Details

## Tier 2 details

${details.filter((d) => d.startsWith("### T2")).join("\n\n")}

${details.filter((d) => d.startsWith("## Tier 3")).join("\n\n")}

${details.filter((d) => d.startsWith("## Tier 4") || d.startsWith("### T4")).join("\n\n")}

## Tier 5 details

Report only. Vehicles on the network from the start, 25 per km per lane on parallel 10 km roads of four lanes (1,000 vehicles a
road, with 1 km of clear road ahead so none leaves), at the speed of uniform traffic at that density; 60 simulated seconds. The
speed is simulated seconds per wall-clock second over the stepping alone (ours: around the steps, snapshots not read; SUMO: the
"Duration" it prints, loading left out); set-up and loading are given apart. Peak memory is the maximum resident set size of
the process (\`/usr/bin/time -l\`); for ours that includes Node and tsx. One process at a time; one measurement each, not repeated.
SUMO's mixed traffic is its sublane model at 0.5 m on 14 m lanes (four lanes of 3.5 m are one lane here, as in Tier 4).

${table(["Traffic", "Vehicles", "Ours (Node), speed", "SUMO, speed", "Ours, peak memory", "SUMO, peak memory", "Set-up / loading (s), ours / SUMO", "Load average, ours / SUMO", "Vehicles at the end, ours / SUMO"], t5Rows)}

**T5.4 Feature coverage** (from each engine's documentation; for ours, its "not modelled" list):

${table(
  ["Feature", "Ours", "SUMO 1.28"],
  [
    ["Rerouting", "No; one choice between a flyover and the junction beneath, made once at entry", "Yes (rerouting device, routing algorithms, dynamic user assignment)"],
    ["Actuated signals", "No; fixed-time plans only", "Yes (actuated, delay-based, NEMA, others)"],
    ["Public transport", "No; buses drive through without stopping", "Yes (stops, schedules, lines)"],
    ["Pedestrians", "No", "Yes"],
    ["Emissions", "No", "Yes (HBEFA, PHEMlight and others)"],
    ["Map import", "No (networks are drawn in the app or written as JSON)", "Yes (OpenStreetMap and other formats, by netconvert)"],
    ["Output formats", "Results as JSON (delay per class, vehicles through, longest queues, stuck vehicles); snapshots", "Many (trip info, edge and lane data, FCD, detectors, queues, emissions, summaries)"],
    ["Priority junctions", "Yes (ticket 08)", "Yes"],
    ["Mixed traffic without lanes", "Yes (strips)", "Yes (sublane model)"],
    ["Runs in a browser with nothing to install", "Yes", "No"],
  ],
)}

## How SUMO was set up, and where it could not be made identical

Every network is written once in our engine's format and translated by \`src/sumo-network.ts\`: each road an edge with its own
centreline (\`spreadType="center"\`) and its plan length, lanes and width; each junction a node at the middle of its roads' ends, SUMO
building the junction area from where the edges stop; signal programmes written from the engine's plans; only the engine's
connections (any other netconvert adds is deleted); \`--lefthand\` networks. Vehicle types from the engine's assumptions table
(IDM, delta 4, same a, b, T, s0, length, width, desired speed, \`speedFactor="1" speedDev="0"\`, \`stepping="0.2"\`). Departures are the
engine's own (\`src/demand-replay.ts\` repeats the engine's demand streams and every job checks the count per class against the
engine's results). Options: \`--step-length 0.2 --step-method.ballistic true --time-to-teleport 300 --collision.action warn\`.

Not identical:

${NOT_IDENTICAL.trim()}

## Tests that could not be run as written

${table(
  ["Test", "Engine", "What was done instead", "Why"],
  [
    ["T4.1 to T4.4", "both", "Demand at each 15-minute period's observed rate and class mix (Poisson), identical in both engines; the road starts empty.", "The engine's interface cannot take an arrival schedule; arrivals are drawn from a rate."],
    ["T4.1", "both", "Scored against speeds from the positions; the data's speed column shown beside it.", "The data's speed column and its positions disagree by a factor of about two (see Tier 4 details)."],
    ["T4.6", "ours", "Run as the engine is, without filtering.", "Two-wheeler filtering at signals is not built (ticket 06 not started)."],
    ["T2.3", "both", "Formula drawn with tf = 0.6 tc.", "The standard gives no critical gap or follow-up time for the formula; the engine gives a critical gap only."],
    ["T5.1", "ours", "Node only.", "No browser was driven in this run."],
    ["T5.3", "both", "The largest of the measured sizes (1,000, 5,000, 20,000) that ran faster than real time.", "Not searched for between the sizes."],
  ],
)}

## Proposed amendments to the standard

None has been applied; section 7 of the standard is unchanged. Proposals, dated 2026-11-12, for whoever owns the standard. No
tolerance change is proposed.

${PROPOSED_AMENDMENTS.trim()}

## How to run it again

\`\`\`sh
pnpm install
sh packages/benchmark/scripts/install-sumo.sh            # SUMO 1.28.0 into ~/.cache/traffic-simulator; needs uv
sh packages/benchmark/scripts/fetch-chennai.sh           # the Chennai data into data/external/chennai (ignored by git)
pnpm --filter @traffic-simulator/benchmark bench:tiers --jobs 6            # Tiers 2 to 4 (and 5); resumable
pnpm --filter @traffic-simulator/benchmark bench:tiers --only t5 --jobs 1  # Tier 5 alone, one process at a time
pnpm --filter @traffic-simulator/benchmark bench:tiers --report-only       # rebuild this document from the raw results
\`\`\`

Options: \`--only <kind or job id>\` (kinds: t2.1, t2.2, t2.3, t2.4, t3, t4-field, t4-chennai, t4.5, t4.6, t5), \`--jobs N\`,
\`--no-sumo\`, \`--fresh\` (ignore finished jobs kept in \`.work/tiers-cache\`), \`--keep-work\` (keep SUMO's files), \`--date\`.
A single job can be repeated by hand with \`tsx src/tiers-job-cli.ts <job.json> <result.json>\`.
`;
  writeFileSync(reportFile, doc);
}

export type { VehicleClass };
