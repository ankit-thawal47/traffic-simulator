/**
 * What the planner reads about an imported area: every value of every road
 * and junction, marked as from OpenStreetMap, guessed by a rule, or corrected
 * by the planner; and each rule, stated once.
 */
import type { Guess } from "@traffic-simulator/corridor";
import type { ScenarioArea } from "@traffic-simulator/scenario";

export interface GuessCell {
  value: string;
  guessed: boolean;
  corrected: boolean;
  /** The rule, or the OpenStreetMap tag, the imported value came from. */
  source: string;
}

export interface RoadRow {
  roadId: string;
  name: string;
  lanes: GuessCell;
  width: GuessCell;
  speed: GuessCell;
  level: GuessCell;
  /** The figures now, with corrections, for the correction fields. */
  lanesNow: number;
  widthNow: number;
}

export interface JunctionRow {
  junctionId: string;
  name: string;
  control: GuessCell;
  /** Green times now, one for each phase; undefined for a junction with no signal. */
  greenS?: number[];
  plan?: GuessCell;
  planCorrected: boolean;
  /** The approaches with green in each phase, by name. */
  phaseNames?: string[];
}

export interface GuessTable {
  roads: RoadRow[];
  junctions: JunctionRow[];
  /** One row for each road with guessed demand, and one for the vehicle mix. */
  demand: { name: string; cell: GuessCell }[];
  rules: { kind: Guess["kind"]; text: string }[];
}

const KIND_NAMES: Record<Guess["kind"], string> = {
  lanes: "Lanes",
  width: "Width",
  "speed-limit": "Speed limit",
  level: "Level",
  control: "Junction control",
  "signal-plan": "Signal plan",
  demand: "Demand",
  "vehicle-mix": "Vehicle mix",
};
export const guessKindName = (kind: Guess["kind"]): string => KIND_NAMES[kind];

export function guessTable(area: ScenarioArea): GuessTable {
  const { imported, corrections } = area;
  const guesses = imported.guesses;
  const find = (kind: Guess["kind"], key: { roadId?: string; junctionId?: string }) =>
    guesses.find((guess) => guess.kind === kind && guess.roadId === key.roadId && guess.junctionId === key.junctionId);
  const cell = (guess: Guess | undefined, fallback: string, corrected?: string): GuessCell => ({
    value: corrected ?? guess?.value ?? fallback,
    guessed: guess?.guessed ?? false,
    corrected: corrected !== undefined,
    source: guess?.rule ?? "",
  });
  const nameOf = (id: string) => imported.roadNames[id] ?? id;

  const roads = imported.network.roads.map((road): RoadRow => {
    const correction = corrections.roads[road.id] ?? {};
    return {
      roadId: road.id,
      name: nameOf(road.id),
      lanes: cell(find("lanes", { roadId: road.id }), String(road.lanes), correction.lanes === undefined ? undefined : String(correction.lanes)),
      width: cell(find("width", { roadId: road.id }), `${road.widthM} m`, correction.widthM === undefined ? undefined : `${correction.widthM} m`),
      speed: cell(find("speed-limit", { roadId: road.id }), `${Math.round(road.speedLimitMps * 3.6)} km/h`),
      level: cell(find("level", { roadId: road.id }), "ground"),
      lanesNow: correction.lanes ?? road.lanes ?? 1,
      widthNow: correction.widthM ?? road.widthM,
    };
  });
  const junctions = (imported.network.junctions ?? [])
    .filter((junction) => junction.control !== "none")
    .map((junction): JunctionRow => {
      const row: JunctionRow = {
        junctionId: junction.id,
        name: imported.roadNames[junction.id] ?? junction.id,
        control: cell(find("control", { junctionId: junction.id }), junction.control),
        planCorrected: corrections.greenS[junction.id] !== undefined,
      };
      if (junction.control === "signal") {
        row.greenS = corrections.greenS[junction.id] ?? junction.signalPlan.phases.map((phase) => phase.greenS);
        row.plan = cell(find("signal-plan", { junctionId: junction.id }), "", row.planCorrected ? `green ${row.greenS.join(", ")} s` : undefined);
        row.phaseNames = junction.signalPlan.phases.map((phase) => phase.greenRoadIds.map(nameOf).join("; "));
      }
      return row;
    });
  const demand = guesses
    .filter((guess) => guess.kind === "demand" || guess.kind === "vehicle-mix")
    .map((guess) => ({ name: guess.roadId ? `From ${nameOf(guess.roadId)}` : "Vehicle mix", cell: cell(guess, "") }));
  const rules: GuessTable["rules"] = [];
  for (const guess of guesses) {
    if (guess.guessed && !rules.some((rule) => rule.text === guess.rule)) rules.push({ kind: guess.kind, text: guess.rule });
  }
  return { roads, junctions, demand, rules };
}
