import type { AcrossSeeds, RunPlan } from "@traffic-simulator/scenario";
import type { WatchedRun } from "./five-seeds";

/** Minutes and seconds: 200 is "3:20". */
export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** A figure to at most one decimal place; a dash for nothing to measure. */
export function formatNumber(value: number | null): string {
  if (value === null) return "–";
  return String(Math.round(value * 10) / 10);
}

/** The average, then the range across seeds: "210 (180 to 250)". */
export function formatAcrossSeeds(figure: AcrossSeeds): string {
  if (figure.average === null) return "–";
  return `${formatNumber(figure.average)} (${formatNumber(figure.lowest)} to ${formatNumber(figure.highest)})`;
}

/**
 * A note for the results when any seed of either scenario had a stuck vehicle
 * (ADR 0005: a headline result, not a hidden repair); null when none did.
 */
export function stuckVehiclesNote(baseline: AcrossSeeds, proposal: AcrossSeeds): string | null {
  const locked = [baseline.highest !== null && baseline.highest > 0 && "the baseline", proposal.highest !== null && proposal.highest > 0 && "the proposal"].filter(
    (name): name is string => typeof name === "string",
  );
  if (locked.length === 0) return null;
  const which = locked.join(" and ");
  return (
    `${which[0]!.toUpperCase()}${which.slice(1)} locked up: in at least one seed vehicles could not move and were released by force ` +
    `(stuck vehicles). ${locked.length > 1 ? "Their" : "Its"} figures are less reliable.`
  );
}

/** Where the watched run is: in its warm-up, or how far into the hour the results cover. */
export function formatClock(watched: WatchedRun, plan: RunPlan): string {
  if (watched.warmingUp) {
    return `Warm-up ${formatTime(watched.timeS)} of ${formatTime(plan.warmUpS)}, left out of the results`;
  }
  const clock = `Run time ${formatTime(watched.timeS - plan.warmUpS)} of ${formatTime(plan.measuredS)}`;
  return watched.finished ? `${clock}, finished` : clock;
}
