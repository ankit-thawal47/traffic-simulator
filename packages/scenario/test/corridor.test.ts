import { describe, expect, it } from "vitest";
import { createRun, type Results, type RunInput } from "@traffic-simulator/engine";
import {
  corridorBaseline,
  LINK_LENGTH_LIMIT,
  readScenario,
  resolveScenario,
  scenarioFromLink,
  scenarioFromText,
  scenarioToLink,
  scenarioToText,
  whyRefused,
  withDemandScale,
  withFlyover,
  withLaneClosure,
  withLostWidth,
  withRoadLanes,
  withRoadWidth,
  withSignalTiming,
  type Scenario,
} from "../src/index";

const PAGE = "https://example.org/traffic-simulator/";

function resultsAfter(input: RunInput, seconds: number): Results {
  const run = createRun(input);
  while (run.timeS < seconds - 1e-9) run.step();
  return run.results();
}

describe("a scenario on the Hebbal corridor", () => {
  const baseline = corridorBaseline("hebbal-city-bound");

  it("names the corridor and runs on its whole network", () => {
    expect(baseline.corridorId).toBe("hebbal-city-bound");
    expect(baseline.network.formatVersion).toBe(4);
    expect(baseline.network.roads.some((road) => road.id === "hebbal-flyover")).toBe(true);
    expect(whyRefused(baseline)).toBeUndefined();
  });

  it("is saved by the corridor's id, not its network, so its link is short", () => {
    const text = scenarioToText(baseline);
    if (!text.ok) throw new Error(text.message);
    const saved = JSON.parse(text.value);
    expect(saved.corridorId).toBe("hebbal-city-bound");
    expect(saved.network).toBeUndefined();

    const link = scenarioToLink(withSignalTiming(baseline, "hebbal", [30, 60, 50, 7]), PAGE);
    if (!link.ok) throw new Error(link.message);
    expect(link.value.length).toBeLessThan(LINK_LENGTH_LIMIT);
    const opened = scenarioFromLink(link.value);
    expect(opened).toEqual({ ok: true, value: withSignalTiming(baseline, "hebbal", [30, 60, 50, 7]) });
  });

  it("refuses a corridor id this version does not know, saying so", () => {
    const text = scenarioToText(baseline);
    if (!text.ok) throw new Error(text.message);
    const saved = JSON.parse(text.value);

    const unknown = scenarioFromText(JSON.stringify({ ...saved, corridorId: "hebbal-airport-bound" }));
    expect(unknown).toEqual({
      ok: false,
      message:
        'This file cannot be opened. It names a corridor this version of the product does not have: "hebbal-airport-bound". ' +
        "The corridors it has are: hebbal-city-bound.",
    });
  });

  it("refuses a description that names a corridor and also carries a network", () => {
    const both = { ...baseline };
    const read = readScenario(both);
    expect(read).toEqual({
      ok: false,
      message: "It names a corridor and also carries a network; a scenario has one or the other.",
    });
  });

  it("takes changes of width, lanes, closed lanes, lost width, signal timing and demand", () => {
    let proposal: Scenario = baseline;
    proposal = withRoadWidth(proposal, "tumkur-in", 10.5);
    proposal = withRoadLanes(proposal, "krpuram-in", 2);
    proposal = withLaneClosure(proposal, "tumkur-out", 1);
    proposal = withLostWidth(proposal, "airport-ground-in", 1, "parking");
    proposal = withSignalTiming(proposal, "cbi-road", [30, 30]);
    proposal = withDemandScale(proposal, 1.2);
    expect(whyRefused(proposal)).toBeUndefined();

    const input = resolveScenario(proposal);
    const road = (id: string) => input.network.roads.find((one) => one.id === id)!;
    expect(road("tumkur-in").widthM).toBe(10.5);
    expect(road("krpuram-in").lanes).toBe(2);
    expect(road("tumkur-out")).toMatchObject({ lanes: 2, widthM: 7 });
    expect(road("airport-ground-in").widthM).toBe(6);
    const flows = (scenario: RunInput) => scenario.demand.flows.reduce((sum, flow) => sum + flow.vehiclesPerHour, 0);
    expect(flows(input)).toBeCloseTo(flows(resolveScenario(baseline)) * 1.2, 6);
    expect(resultsAfter(input, 120).vehiclesThrough).toBeGreaterThan(0);
  });

  it("gives the planner the reason when the Hebbal flyover is turned off: the traffic over it has no other way", () => {
    const proposal = withFlyover(baseline, "hebbal-flyover", false);
    expect(proposal.changes).toEqual([{ kind: "flyover", roadId: "hebbal-flyover", built: false }]);
    expect(whyRefused(proposal)).toBe(
      'The proposal cannot be run: There is no route from road "airport-entry" to road "ganganagar-flyover"',
    );
  });
});
