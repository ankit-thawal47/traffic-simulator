import { describe, expect, it } from "vitest";
import priorityJunction from "@traffic-simulator/engine/examples/priority-junction.json";
import signalJunction from "@traffic-simulator/engine/examples/signal-junction.json";
import { createBaseline, readScenario, scenarioFromLink, scenarioToLink, type Scenario } from "../src/index";

const today = createBaseline({
  name: "Priority junction",
  network: priorityJunction.network as Scenario["network"],
  demand: priorityJunction.demand,
  seed: 1,
});

/** The scenario as a link or a file would hand it over: plain parsed JSON, with one part replaced. */
function saved(replace: (scenario: any) => void = () => {}): unknown {
  const copy = JSON.parse(JSON.stringify(today));
  replace(copy);
  return copy;
}

function messageFor(replace: (scenario: any) => void): string {
  const read = readScenario(saved(replace));
  if (read.ok) throw new Error("Expected the scenario to be refused, and it was read");
  return read.message;
}

describe("a scenario whose network has a priority junction (network format version 5)", () => {
  it("survives being saved as a link and read back, main roads and all", () => {
    const link = scenarioToLink(today, "https://example.test/");
    expect(link.ok).toBe(true);
    if (link.ok) expect(scenarioFromLink(link.value)).toEqual({ ok: true, value: today });
    expect(today.network.junctions![0]).toMatchObject({ control: "priority", mainRoadIds: ["west-in", "east-in"] });
  });

  it("is rebuilt from the checked parts alone: a priority junction keeps no signal plan or other extras", () => {
    const read = readScenario(
      saved((scenario) => {
        scenario.network.junctions[0].signalPlan = { phases: "anything" };
        scenario.network.junctions[0].extra = 1;
      }),
    );
    expect(read).toEqual({ ok: true, value: today });
  });

  it("refuses a priority junction in an older network format", () => {
    expect(messageFor((scenario) => (scenario.network.formatVersion = 4))).toMatch(/junction "tee" is a priority junction, which needs network format version 5/i);
  });

  it("refuses main roads that are missing, not a list, not roads, or not approaches of the junction", () => {
    expect(messageFor((scenario) => delete scenario.network.junctions[0].mainRoadIds)).toMatch(/main roads of junction "tee"/i);
    expect(messageFor((scenario) => (scenario.network.junctions[0].mainRoadIds = "west-in"))).toMatch(/main roads of junction "tee"/i);
    expect(messageFor((scenario) => (scenario.network.junctions[0].mainRoadIds = ["nowhere"]))).toMatch(/nowhere/);
    expect(messageFor((scenario) => (scenario.network.junctions[0].mainRoadIds = ["east-out"]))).toMatch(/"east-out".*not an approach/i);
  });

  it("refuses a priority junction with no main road, or with no side road", () => {
    expect(messageFor((scenario) => (scenario.network.junctions[0].mainRoadIds = []))).toMatch(/needs a main road/i);
    expect(messageFor((scenario) => (scenario.network.junctions[0].mainRoadIds = ["west-in", "east-in", "south-in"]))).toMatch(
      /needs a side road/i,
    );
  });

  it("still reads networks of older format versions as they were", () => {
    const signal = createBaseline({
      name: "Signal junction",
      network: signalJunction.network as Scenario["network"],
      demand: signalJunction.demand,
      seed: 1,
    });
    expect(readScenario(JSON.parse(JSON.stringify(signal)))).toEqual({ ok: true, value: signal });
  });
});
