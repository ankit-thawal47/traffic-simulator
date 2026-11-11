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

/** Where the watched run is: in its warm-up, or how far into the hour the results cover. */
export function formatClock(watched: WatchedRun, plan: RunPlan): string {
  if (watched.warmingUp) {
    return `Warm-up ${formatTime(watched.timeS)} of ${formatTime(plan.warmUpS)}, left out of the results`;
  }
  const clock = `Run time ${formatTime(watched.timeS - plan.warmUpS)} of ${formatTime(plan.measuredS)}`;
  return watched.finished ? `${clock}, finished` : clock;
}

/**
 * One plain sentence or two on how complete the figures are: how many seeds
 * they are over, and what is still to come.
 */
export function completenessNote(
  seeds: { seedsFinished: number; seeds: number; firstSeedFinished: boolean },
  watched: WatchedRun | undefined,
  plan: RunPlan,
): string {
  if (seeds.seedsFinished >= seeds.seeds) return `Complete: the figures are over all ${seeds.seeds} seeds.`;
  if (seeds.seedsFinished === 0) return `No figures yet: none of the ${seeds.seeds} seeds has finished.`;
  const partial = `Partial: the figures are over the ${seeds.seedsFinished} seeds of ${seeds.seeds} that have finished.`;
  const onlyTheWatchedRunIsMissing = !seeds.firstSeedFinished && seeds.seedsFinished === seeds.seeds - 1;
  if (!onlyTheWatchedRunIsMissing) return `${partial} The other seeds are still running.`;
  if (!watched || watched.warmingUp) {
    return `${partial} The run you are watching is the one still to come: it is still in its warm-up and joins the figures when it reaches the end of its hour.`;
  }
  return `${partial} The run you are watching is the one still to come: it is at ${formatTime(watched.timeS - plan.warmUpS)} of its hour and joins the figures when it reaches the end.`;
}
