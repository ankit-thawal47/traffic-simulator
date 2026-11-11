/** One thing the engine leaves out, in plain words. */
export interface NotModelled {
  name: string;
  /** What it is, and what the engine does instead. */
  meaning: string;
}

/**
 * What is not modelled (spec: Out of Scope; ADR 0006), shown to the planner so
 * that the limits of an estimate are in plain sight.
 */
export const NOT_MODELLED: readonly NotModelled[] = [
  {
    name: "Forced entry at priority junctions",
    meaning: "Side-road traffic never pushes into main-road traffic; it waits for a gap that is large enough.",
  },
  {
    name: "Adaptive signals",
    meaning: "Signals do not change their timing with the traffic; every signal follows a fixed, repeating plan.",
  },
  { name: "Roundabouts", meaning: "A network cannot contain a roundabout." },
  { name: "Pedestrians", meaning: "Nobody walks along or across a road, so vehicles never slow or stop for them." },
  { name: "Wrong-side driving", meaning: "Every vehicle keeps to its own direction of the road." },
  { name: "Bus stops", meaning: "Buses do not stop to pick up or set down passengers; they drive through like other vehicles." },
  { name: "Turn bans", meaning: "A turn cannot be banned at a junction." },
  {
    name: "Rerouting",
    meaning:
      "A vehicle chooses its route once, when it enters, and never changes it. The one choice it has is between a " +
      "flyover and the junction beneath it; everywhere else it takes the route that is fastest on empty roads.",
  },
  {
    name: "Equilibrium routing",
    meaning: "The run is not repeated until no driver could do better by another route; drivers do not learn from earlier days.",
  },
  {
    name: "Induced demand",
    meaning: "A faster road does not attract new trips. The traffic that enters is what the scenario's demand says, whatever the change.",
  },
  { name: "Emissions", meaning: "No fuel use, exhaust or noise is estimated." },
  {
    name: "Roadside activity",
    meaning: "Parking, stalls and stopped vehicles at the roadside appear only as a narrower road, not as activity that comes and goes.",
  },
];
