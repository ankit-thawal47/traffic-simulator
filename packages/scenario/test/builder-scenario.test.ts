import { describe, expect, it } from "vitest";
import {
  builtBaseline,
  defaultBlock,
  LINK_LENGTH_LIMIT,
  resolveScenario,
  scenarioFromLink,
  scenarioFromText,
  scenarioToLink,
  scenarioToText,
  SCENARIO_FORMAT_VERSION,
  whyRefused,
  withFlowRate,
  withSignalTiming,
  type Layout,
  type Scenario,
} from "../src/index";

const FOUR_BLOCKS: Layout = {
  blocks: [defaultBlock("straight"), defaultBlock("t-junction"), defaultBlock("four-way"), defaultBlock("flyover")],
};

function baseline(layout: Layout): Scenario {
  const outcome = builtBaseline(layout);
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

describe("a scenario on a built network", () => {
  const scenario = baseline(FOUR_BLOCKS);

  it("is a baseline that carries its layout and the network built from it, and that the engine runs", () => {
    expect(scenario.formatVersion).toBe(SCENARIO_FORMAT_VERSION);
    expect(scenario.layout).toEqual(FOUR_BLOCKS);
    expect(scenario.changes).toEqual([]);
    expect(scenario.network.roads.length).toBeGreaterThan(20);
    expect(whyRefused(scenario)).toBeUndefined();
  });

  it("takes changes as any network does: signal timing of a built junction and the rate of a built flow", () => {
    const proposal = withFlowRate(withSignalTiming(scenario, "b3-junction", [40, 40, 15, 15]), "b1-eastbound", "b4-eastbound-exit", 1000);
    const resolved = resolveScenario(proposal);

    const junction = resolved.network.junctions?.find((one) => one.id === "b3-junction");
    expect(junction?.control === "signal" && junction.signalPlan.phases.map((phase) => phase.greenS)).toEqual([40, 40, 15, 15]);
    expect(resolved.demand.flows.find((flow) => flow.entryRoadId === "b1-eastbound" && flow.exitRoadId === "b4-eastbound-exit")?.vehiclesPerHour).toBe(1000);
  });

  it("is saved by its layout, not its network, and read back the same", () => {
    const text = scenarioToText(scenario);
    if (!text.ok) throw new Error(text.message);

    expect(JSON.parse(text.value).network).toBeUndefined();
    expect(JSON.parse(text.value).layout).toEqual(FOUR_BLOCKS);
    expect(scenarioFromText(text.value)).toEqual({ ok: true, value: scenario });
  });

  it("fits a link for four blocks", () => {
    const link = scenarioToLink(scenario, "https://example.org/");
    if (!link.ok) throw new Error(link.message);

    console.log(`Link for four blocks: ${link.value.length} characters`);
    expect(link.value.length).toBeLessThanOrEqual(LINK_LENGTH_LIMIT);
    expect(scenarioFromLink(link.value)).toEqual({ ok: true, value: scenario });
  });

  it("refuses to open a saved layout that cannot run, saying which block and why", () => {
    const text = scenarioToText(scenario);
    if (!text.ok) throw new Error(text.message);
    const saved = JSON.parse(text.value);
    saved.layout.blocks[3].lanes = 1;
    saved.layout.blocks[3].widthM = 3.5;

    expect(scenarioFromText(JSON.stringify(saved))).toEqual({
      ok: false,
      message:
        "This file cannot be opened. Block 4 (flyover over a junction): its road has 1 lane; a flyover needs at least 2, " +
        "one to rise onto the flyover and one to go beneath.",
    });
  });

  it("refuses a saved layout that is not a layout, saying what is wrong", () => {
    const text = scenarioToText(scenario);
    if (!text.ok) throw new Error(text.message);
    const saved = JSON.parse(text.value);
    saved.layout.blocks[1].kind = "roundabout";

    const read = scenarioFromText(JSON.stringify(saved));
    expect(read.ok).toBe(false);
    expect(!read.ok && read.message).toContain("Block 2 of the layout is of a kind this version of the product does not know");
  });

  it("refuses a description that has a layout and also carries a network", () => {
    const text = scenarioToText(scenario);
    if (!text.ok) throw new Error(text.message);
    const saved = { ...JSON.parse(text.value), network: scenario.network };

    expect(scenarioFromText(JSON.stringify(saved))).toEqual({
      ok: false,
      message: "This file cannot be opened. It has a layout and also carries a network; a scenario has one or the other.",
    });
  });
});
