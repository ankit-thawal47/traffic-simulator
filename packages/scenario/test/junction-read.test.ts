import { describe, expect, it } from "vitest";
import signalJunction from "@traffic-simulator/engine/examples/signal-junction.json";
import {
  createBaseline,
  readScenario,
  scenarioFromLink,
  scenarioFromText,
  scenarioToLink,
  scenarioToText,
  withRoadWidth,
  type Scenario,
} from "../src/index";

const today = createBaseline({
  name: "Four-way signal junction",
  network: signalJunction.network as Scenario["network"],
  demand: signalJunction.demand,
  seed: 1,
});
const proposal = withRoadWidth(today, "north-in", 10.5);

/** The proposal as a link or a file would hand it over: plain parsed JSON, with one part replaced. */
function saved(replace: (scenario: any) => void = () => {}): unknown {
  const copy = JSON.parse(JSON.stringify(proposal));
  replace(copy);
  return copy;
}

function messageFor(replace: (scenario: any) => void): string {
  const read = readScenario(saved(replace));
  if (read.ok) throw new Error("Expected the scenario to be refused, and it was read");
  return read.message;
}

describe("a scenario whose network has a signal junction (network format version 3)", () => {
  it("survives being saved as text and read back", () => {
    const text = scenarioToText(proposal);
    expect(text.ok).toBe(true);
    if (text.ok) expect(scenarioFromText(text.value)).toEqual({ ok: true, value: proposal });
  });

  it("survives being shared as a link and opened", () => {
    const link = scenarioToLink(proposal, "https://traffic-simulator.example/");
    expect(link.ok).toBe(true);
    if (link.ok) expect(scenarioFromLink(link.value)).toEqual({ ok: true, value: proposal });
  });

  it("keeps the junction, its connections and its signal plan, and drops anything else that came with them", () => {
    const read = readScenario(
      saved((scenario) => {
        const junction = scenario.network.junctions[0];
        junction.colour = "red";
        junction.connections[0].note = "x";
        junction.signalPlan.phases[0].name = "first";
        junction.signalPlan.extra = 1;
      }),
    );
    expect(read).toEqual({ ok: true, value: proposal });
  });

  it("keeps a signal plan's offset when it has one", () => {
    const withOffset = saved((scenario) => (scenario.network.junctions[0].signalPlan.offsetS = 30));
    const read = readScenario(withOffset);
    expect(read.ok && read.value.network.junctions![0]!.signalPlan.offsetS).toBe(30);
  });

  it("reads a version 3 network with no junctions", () => {
    const read = readScenario({
      ...(saved() as object),
      network: { formatVersion: 3, roads: [proposal.network.roads[0]] },
      changes: [],
      demand: { flows: [] },
    });
    expect(read.ok && read.value.network).toEqual({ formatVersion: 3, roads: [proposal.network.roads[0]] });
  });
});

describe("a damaged junction is refused with a message", () => {
  const junction = (scenario: any) => scenario.network.junctions[0];

  it("junctions in a network of an older format version", () => {
    expect(messageFor((scenario) => (scenario.network.formatVersion = 2))).toBe(
      "The network has junctions, which need network format version 3 (it says 2).",
    );
  });

  it("a list of junctions that is not a list", () => {
    expect(messageFor((scenario) => (scenario.network.junctions = "cross"))).toBe(
      'The network\'s list of junctions is missing or is not a list (found "cross").',
    );
  });

  it("two junctions with one identifier", () => {
    expect(messageFor((scenario) => scenario.network.junctions.push({ ...junction(scenario), connections: [] }))).toBe(
      'The network has two junctions with the identifier "cross".',
    );
  });

  it("a kind of junction this version does not know", () => {
    expect(messageFor((scenario) => (junction(scenario).control = "roundabout"))).toBe(
      'Junction "cross" is of a kind this version of the product does not know: "roundabout".',
    );
  });

  it("a connection to a road that is not in the network", () => {
    expect(messageFor((scenario) => (junction(scenario).connections[0].toRoadId = "nowhere"))).toBe(
      'Connection 1 of junction "cross" names a road that is not in the network: "nowhere".',
    );
  });

  it("a signal plan with a green time that is not a positive number", () => {
    expect(messageFor((scenario) => (junction(scenario).signalPlan.phases[1].greenS = "long"))).toBe(
      'The green time of phase 2 of junction "cross" must be a number above 0 and up to 3600 (found "long").',
    );
    expect(messageFor((scenario) => (junction(scenario).signalPlan.amberS = -1))).toBe(
      'The amber time of junction "cross" must be a number from 0 and up to 3600 (found -1).',
    );
  });

  it("a signal plan that gives green to a road that is not in the network", () => {
    expect(messageFor((scenario) => (junction(scenario).signalPlan.phases[0].greenRoadIds = ["nowhere"]))).toBe(
      'Phase 1 of junction "cross" names a road that is not in the network: "nowhere".',
    );
  });

  it("a junction the engine refuses, such as an approach that never has green, is refused in the engine's words", () => {
    expect(messageFor((scenario) => junction(scenario).signalPlan.phases.pop())).toBe(
      'The baseline cannot be run: Approach "west-in" of junction "cross" never has green.',
    );
  });

  it("more connections than a junction may have", () => {
    expect(
      messageFor((scenario) => {
        junction(scenario).connections = Array.from({ length: 501 }, () => junction(scenario).connections[0]);
      }),
    ).toBe('The connections of junction "cross" has 501 entries; the most allowed is 500.');
  });
});
