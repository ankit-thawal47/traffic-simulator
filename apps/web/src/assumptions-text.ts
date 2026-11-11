import type { AssumptionState, ListedAssumption } from "@traffic-simulator/engine";

/** The words shown for each state of an assumption, and what each means. */
export const STATE_TEXT: Record<AssumptionState, { label: string; meaning: string }> = {
  confirmed: {
    label: "Confirmed in the source",
    meaning: "We read this figure in the paper or standard named, at the place given.",
  },
  "secondary-source": {
    label: "From a secondary source",
    meaning: "We found this only where someone else reports it; the original was not read.",
  },
  "our-choice": {
    label: "Our choice",
    meaning: "No source gives this; we chose it, for the reason given.",
  },
  unconfirmed: {
    label: "Not confirmed",
    meaning: "A source is named, but we could not open it to check the figure.",
  },
};

/** The states in the order the panel explains them. */
export const STATES: readonly AssumptionState[] = ["confirmed", "secondary-source", "our-choice", "unconfirmed"];

function plain(value: number): string {
  return String(Number(value.toFixed(3)));
}

/**
 * An assumption's value with its unit, as the planner reads it: a speed also in
 * km/h, a share of vehicles as a percentage. A rule has no value.
 */
export function formatAssumptionValue({ value, unit }: Pick<ListedAssumption, "value" | "unit">): string {
  if (value === null) return "Rule";
  if (unit === "m/s") {
    const kmh = value * 3.6;
    return `${plain(value)} m/s (${kmh < 10 ? plain(Number(kmh.toFixed(1))) : plain(Math.round(kmh))} km/h)`;
  }
  if (unit === "m/s2") return `${plain(value)} m/s²`;
  if (unit === "of all vehicles") return `${plain(value * 100)}% of all vehicles`;
  return unit === "" ? plain(value) : `${plain(value)} ${unit}`;
}
