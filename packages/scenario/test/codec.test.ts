import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import oneRoadExample from "@traffic-simulator/engine/examples/one-road.json";
import {
  LINK_LENGTH_LIMIT,
  createBaseline,
  scenarioFromLink,
  scenarioFromText,
  scenarioToLink,
  scenarioToText,
  withRoadLanes,
  withRoadWidth,
  type Outcome,
  type Scenario,
} from "../src/index";

const today = createBaseline({
  name: "One road",
  network: mixedTraffic.network as Scenario["network"],
  demand: mixedTraffic.demand,
  seed: 1,
});
const proposal = withRoadLanes(withRoadWidth(today, "main", 7), "main", 2);
const oneRoad = createBaseline({
  name: "One road today",
  network: oneRoadExample.network as Scenario["network"],
  demand: oneRoadExample.demand,
  seed: 1,
});
const examples: [string, Scenario][] = [
  ["the mixed-traffic example with no changes", today],
  ["the mixed-traffic example with a width change and a lanes change", proposal],
  ["the mixed-traffic example with lane discipline on", { ...today, laneDiscipline: true }],
  ["the one-road example (network format version 1)", oneRoad],
  ["a name in Kannada with an emoji", { ...today, name: "ಹೆಬ್ಬಾಳ ರಸ್ತೆ 🚌 – “today”" }],
];

const PAGE = "https://traffic-simulator.example/";

function valueOf<T>(outcome: Outcome<T>): T {
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

function messageOf(outcome: Outcome<unknown> | undefined): string {
  if (!outcome || outcome.ok) throw new Error("Expected a refusal with a message");
  return outcome.message;
}

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

describe("a scenario as a file", () => {
  it.each(examples)("round trip: %s saved as text and read back is the same scenario", (_name, scenario) => {
    expect(scenarioFromText(valueOf(scenarioToText(scenario)))).toEqual({ ok: true, value: scenario });
  });

  it("is JSON a person can read, holding the scenario description and its version", () => {
    const text = valueOf(scenarioToText(proposal));

    expect(text).toContain("\n");
    expect(JSON.parse(text)).toEqual(proposal);
    expect(JSON.parse(text).formatVersion).toBe(5);
  });

  it("is not written for a scenario the engine would refuse, and the planner is told why", () => {
    expect(messageOf(scenarioToText(withRoadWidth(today, "main", 2)))).toBe(
      'This scenario cannot be saved. The proposal cannot be run: Road "main" is too narrow for a car.',
    );
  });

  it.each([
    ["an empty file", "", "This file cannot be opened. It is empty."],
    ["a file of spaces", "  \n ", "This file cannot be opened. It is empty."],
    ["a file that is not JSON", "hello", "This file cannot be opened. It is not a scenario file, or it is damaged."],
    ["JSON that is not a scenario", "[1,2,3]", "This file cannot be opened. It does not hold a scenario (found a list)."],
    [
      "a scenario from a newer version of the product",
      JSON.stringify({ ...proposal, formatVersion: 12 }),
      "This file cannot be opened. It was made with a newer version of the product (scenario description version 12; " +
        "this page reads up to version 5). Reload the page to get the latest version and open it again.",
    ],
    [
      "a scenario with a damaged part",
      JSON.stringify({ ...proposal, seed: "one" }),
      /^This file cannot be opened\. The seed must be a whole number .* \(found "one"\)\.$/,
    ],
  ])("%s gives a message", (_name, text, message) => {
    const found = messageOf(scenarioFromText(text));

    if (typeof message === "string") expect(found).toBe(message);
    else expect(found).toMatch(message);
  });

  it("a file cut short at any point gives a message, never a scenario and never an exception", () => {
    const text = valueOf(scenarioToText(proposal));

    for (let length = 0; length < text.trimEnd().length; length++) {
      const read = scenarioFromText(text.slice(0, length));
      expect(read.ok, `cut to ${length} characters`).toBe(false);
    }
  });

  it("a file far larger than any scenario is refused without being parsed", () => {
    expect(messageOf(scenarioFromText(" ".repeat(6_000_000)))).toBe(
      "This file cannot be opened. It is too large to be a scenario file.",
    );
  });

  it.each(["v1-mixed-traffic-narrowed.json", "v1-one-road-baseline.json", "v2-mixed-traffic-lanes-and-width.json"])(
    "the saved example %s still opens",
    (name) => {
      expect(scenarioFromText(fixture(name)).ok).toBe(true);
    },
  );

  it("the saved example of version 2 opens as what was saved, brought up to the current version", () => {
    expect(valueOf(scenarioFromText(fixture("v2-mixed-traffic-lanes-and-width.json")))).toEqual({
      formatVersion: 5,
      unbuiltRoadIds: [],
      name: "One road, widened to four lanes",
      network: mixedTraffic.network,
      changes: [
        { kind: "road-width", roadId: "main", widthM: 14 },
        { kind: "road-lanes", roadId: "main", lanes: 4 },
      ],
      demand: mixedTraffic.demand,
      laneDiscipline: true,
      seed: 5,
    });
  });
});

describe("a scenario as a link", () => {
  it.each(examples)("round trip: %s encoded into a link and opened is the same scenario", (_name, scenario) => {
    const link = valueOf(scenarioToLink(scenario, PAGE));

    expect(scenarioFromLink(link)).toEqual({ ok: true, value: scenario });
  });

  it.each(examples)("the same scenario always gives the same link: %s opened and shared again", (_name, scenario) => {
    const link = valueOf(scenarioToLink(scenario, PAGE));

    expect(valueOf(scenarioToLink(valueOf(scenarioFromLink(link)!), PAGE))).toBe(link);
  });

  it("puts the scenario in the fragment of the page's address, which is never sent to a server", () => {
    const link = valueOf(scenarioToLink(proposal, "https://traffic-simulator.example/app/?x=1#old-fragment"));

    expect(link).toMatch(/^https:\/\/traffic-simulator\.example\/app\/\?x=1#scenario=d\.[A-Za-z0-9_-]+$/);
    expect(new URL(link).search).toBe("?x=1");
  });

  it.each(examples)("is short enough to paste: %s", (name, scenario) => {
    const link = valueOf(scenarioToLink(scenario, PAGE));

    // Measured with this 34-character page address: 384 characters with no changes, 420 with two changes,
    // 320 for the one-road example, 469 with a name in Kannada. The limit is 2000.
    expect(link.length, name).toBeLessThan(500);
  });

  it("an address with no scenario in it is not a scenario link", () => {
    expect(scenarioFromLink(PAGE)).toBeUndefined();
    expect(scenarioFromLink(`${PAGE}#`)).toBeUndefined();
    expect(scenarioFromLink(`${PAGE}#results`)).toBeUndefined();
  });

  it("beyond the limit there is no link: the planner is told to save a file instead", () => {
    const points = Array.from({ length: 1500 }, (_, index) => ({ x: index * 10.37, y: Math.sin(index) * 51.3 }));
    const long: Scenario = {
      ...today,
      network: { formatVersion: 2, roads: [{ ...today.network.roads[0]!, points }] },
    };

    expect(LINK_LENGTH_LIMIT).toBe(2000);
    expect(messageOf(scenarioToLink(long, PAGE))).toMatch(
      /^This scenario is too large to share as a link \(the link would be \d+ characters; the limit is 2000\)\. Save it as a file instead\.$/,
    );
    // The file has no such limit.
    expect(scenarioFromText(valueOf(scenarioToText(long)))).toEqual({ ok: true, value: long });
  });

  it("is not made for a scenario the engine would refuse, and the planner is told why", () => {
    expect(messageOf(scenarioToLink(withRoadWidth(today, "main", 2), PAGE))).toBe(
      'This scenario cannot be shared. The proposal cannot be run: Road "main" is too narrow for a car.',
    );
  });

  const DAMAGED = "This link cannot be opened. It is damaged or cut short.";

  it("a link cut short at any point gives a message, never a scenario and never an exception", () => {
    const link = valueOf(scenarioToLink(proposal, PAGE));
    const start = link.indexOf("#scenario=") + "#scenario=".length;

    for (let length = start; length < link.length; length++) {
      const read = scenarioFromLink(link.slice(0, length));
      expect(read?.ok, `cut to ${length} characters`).toBe(false);
      expect(messageOf(read)).toMatch(/^This link cannot be opened\. /);
    }
  });

  it("a link with any one character changed gives a message or a complete scenario, never an exception", () => {
    const link = valueOf(scenarioToLink(proposal, PAGE));
    const start = link.indexOf("#scenario=d.") + "#scenario=d.".length;

    for (let at = start; at < link.length; at++) {
      const changed = `${link.slice(0, at)}${link[at] === "A" ? "B" : "A"}${link.slice(at + 1)}`;
      const read = scenarioFromLink(changed);
      if (read?.ok) expect(scenarioToText(read.value).ok).toBe(true);
      else expect(messageOf(read)).toMatch(/^This link cannot be opened\. /);
    }
  });

  it.each([
    ["nothing after the name", `${PAGE}#scenario=`, DAMAGED],
    ["characters that are not part of the encoding", `${PAGE}#scenario=d.!!!***`, DAMAGED],
    ["random letters", `${PAGE}#scenario=d.QUJDREVGR0hJSktMTU5PUA`, DAMAGED],
    [
      "an encoding it does not know",
      `${PAGE}#scenario=z.AAAA`,
      "This link cannot be opened. It was made with a newer version of the product. Reload the page to get the latest version and open it again.",
    ],
    ["a link longer than any the product makes", `${PAGE}#scenario=d.${"A".repeat(5000)}`, "This link cannot be opened. It is longer than any link this product makes."],
  ])("%s gives a message", (_name, link, message) => {
    expect(messageOf(scenarioFromLink(link))).toBe(message);
  });

  it("a link that decodes to something that is not a scenario says what is wrong with it", () => {
    const link = valueOf(scenarioToLink(proposal, PAGE));
    const notAScenario = link.replace(/#scenario=.*/, `#scenario=${fixture("link-payload-of-a-list.txt").trim()}`);

    expect(messageOf(scenarioFromLink(notAScenario))).toBe(
      "This link cannot be opened. It does not hold a scenario (found a list).",
    );
  });

  it("the saved link of version 1 still opens, as the scenario its file holds", () => {
    const fromLink = scenarioFromLink(`${PAGE}#scenario=${fixture("v1-mixed-traffic-narrowed.link.txt").trim()}`);

    expect(fromLink).toEqual(scenarioFromText(fixture("v1-mixed-traffic-narrowed.json")));
    expect(fromLink?.ok).toBe(true);
  });

  it("the saved link of version 2 still opens, as the scenario its file holds", () => {
    const fromLink = scenarioFromLink(`${PAGE}#scenario=${fixture("v2-mixed-traffic-lanes-and-width.link.txt").trim()}`);

    expect(fromLink).toEqual(scenarioFromText(fixture("v2-mixed-traffic-lanes-and-width.json")));
    expect(fromLink?.ok).toBe(true);
  });
});
