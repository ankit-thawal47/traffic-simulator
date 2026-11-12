import { describe, expect, it } from "vitest";
import flyover from "@traffic-simulator/engine/examples/flyover.json";
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
  name: "Flyover over a signal junction",
  network: flyover.network as Scenario["network"],
  demand: flyover.demand,
  seed: 1,
});
const proposal = withRoadWidth(today, "west-in", 10.5);

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

describe("a scenario whose network has a flyover (network format version 4)", () => {
  it("survives being saved as text and as a link and read back, heights and all", () => {
    const text = scenarioToText(proposal);
    expect(text.ok).toBe(true);
    if (text.ok) expect(scenarioFromText(text.value)).toEqual({ ok: true, value: proposal });
    const link = scenarioToLink(proposal, "https://example.test/");
    expect(link.ok).toBe(true);
    if (link.ok) expect(scenarioFromLink(link.value)).toEqual({ ok: true, value: proposal });
    const road = proposal.network.roads.find((each) => each.id === "flyover-north")!;
    expect(road.points.map((point) => point.z)).toEqual([undefined, 6, 6, undefined]);
  });

  it("is rebuilt from the checked parts alone: a junction with no signal keeps no signal plan or other extras", () => {
    const read = readScenario(
      saved((scenario) => {
        scenario.network.junctions[0].signalPlan = { phases: "anything" };
        scenario.network.junctions[0].extra = 1;
        scenario.network.roads[2].points[1].extra = 1;
      }),
    );
    expect(read).toEqual({ ok: true, value: proposal });
  });

  it("refuses a height that is not a number, or is out of range", () => {
    expect(messageFor((scenario) => (scenario.network.roads[2].points[1].z = "6"))).toMatch(/height of point 2 of road "flyover-north"/i);
    expect(messageFor((scenario) => (scenario.network.roads[2].points[1].z = 5000))).toMatch(/height of point 2 of road "flyover-north"/i);
    expect(messageFor((scenario) => (scenario.network.roads[2].points[1].z = null))).toMatch(/height/i);
  });

  it("refuses heights, and junctions with no signal, in a network that says it is an older version", () => {
    expect(messageFor((scenario) => (scenario.network.formatVersion = 3))).toMatch(/version 4/);
    expect(
      messageFor((scenario) => {
        scenario.network.formatVersion = 3;
        for (const road of scenario.network.roads) for (const point of road.points) delete point.z;
      }),
    ).toMatch(/no signal.*version 4|version 4.*no signal/i);
  });

  it("refuses a junction of a kind it does not know, and a signal junction without a plan", () => {
    expect(messageFor((scenario) => (scenario.network.junctions[0].control = "roundabout"))).toMatch(/kind this version of the product does not know/);
    expect(messageFor((scenario) => delete scenario.network.junctions[4].signalPlan)).toMatch(/signal plan/i);
  });

  it("refuses a junction with no signal whose roads do not run straight on, in words for the planner", () => {
    const message = messageFor((scenario) => (scenario.network.junctions[0].connections[1].toRoadId = "west-out"));
    expect(message).toMatch(/cannot be run/);
  });

  it("refuses a network version it does not know", () => {
    expect(messageFor((scenario) => (scenario.network.formatVersion = 5))).toMatch(/network format version/);
  });
});
