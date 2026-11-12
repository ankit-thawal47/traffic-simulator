import { describe, expect, it } from "vitest";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import {
  createBaseline,
  readScenario,
  whyRefused,
  withRoadLanes,
  withRoadWidth,
  type Scenario,
} from "../src/index";

const today = createBaseline({
  name: "One road",
  network: mixedTraffic.network as Scenario["network"],
  demand: mixedTraffic.demand,
  seed: 1,
});
const proposal = withRoadLanes(withRoadWidth(today, "main", 7), "main", 2);

/** The proposal as a link or a file would hand it over: plain parsed JSON, with one part replaced. */
function saved(replace: (scenario: any) => void = () => {}): unknown {
  const copy = JSON.parse(JSON.stringify(proposal));
  replace(copy);
  return copy;
}

function messageFor(value: unknown): string {
  const read = readScenario(value);
  if (read.ok) throw new Error("Expected the scenario to be refused, and it was read");
  return read.message;
}

describe("reading a scenario from a link or a file", () => {
  it("gives back the same scenario", () => {
    expect(readScenario(saved())).toEqual({ ok: true, value: proposal });
  });

  it("keeps only what the scenario description holds, dropping anything else that came with it", () => {
    const read = readScenario(
      saved((scenario) => {
        scenario.extra = "x";
        scenario.network.roads[0].colour = "red";
        scenario.changes[0].note = "y";
      }),
    );

    expect(read).toEqual({ ok: true, value: proposal });
  });
});

describe("a value that is not a scenario at all", () => {
  it.each([
    [null, "It does not hold a scenario (found null)."],
    [[1, 2], "It does not hold a scenario (found a list)."],
    ["hello", 'It does not hold a scenario (found "hello").'],
    [42, "It does not hold a scenario (found 42)."],
    [{}, "It does not say which version of the scenario description it uses."],
  ])("%j is refused with a message", (value, message) => {
    expect(messageFor(value)).toBe(message);
  });
});

describe("a scenario of a version this product does not know", () => {
  it("made by a newer version of the product: says so and what to do", () => {
    expect(messageFor(saved((scenario) => (scenario.formatVersion = 5)))).toBe(
      "It was made with a newer version of the product (scenario description version 5; this page reads up to version 4). " +
        "Reload the page to get the latest version and open it again.",
    );
  });

  it.each([0, -1, 1.5, "2", null])("version %j is not a version number", (version) => {
    expect(messageFor(saved((scenario) => (scenario.formatVersion = version)))).toMatch(
      /^It gives a version of the scenario description that is not a version number: /,
    );
  });

  it("a network of a format version it does not know", () => {
    expect(messageFor(saved((scenario) => (scenario.network.formatVersion = 9)))).toBe(
      "The network uses a network format version this version of the product does not know (9).",
    );
  });
});

describe("a damaged scenario: wrong types, values out of range, missing parts", () => {
  it.each<[string, (scenario: any) => void, string]>([
    ["no name", (s) => delete s.name, "The scenario's name is missing or is not text (found nothing)."],
    ["a name that is a number", (s) => (s.name = 5), "The scenario's name is missing or is not text (found 5)."],
    ["a very long name", (s) => (s.name = "x".repeat(201)), "The scenario's name is longer than 200 characters."],
    ["no network", (s) => delete s.network, "The network is missing or is not an object (found nothing)."],
    ["roads that are not a list", (s) => (s.network.roads = {}), "The network's list of roads is missing or is not a list (found an object)."],
    ["no roads", (s) => (s.network.roads = []), "The network has no roads."],
    ["a road with no identifier", (s) => delete s.network.roads[0].id, "The identifier of road 1 is missing or is not text (found nothing)."],
    [
      "two roads with one identifier",
      (s) => s.network.roads.push(s.network.roads[0]),
      'The network has two roads with the identifier "main".',
    ],
    ["a road with one point", (s) => s.network.roads[0].points.pop(), 'Road "main" needs at least two points.'],
    [
      "a point that is not a number",
      (s) => (s.network.roads[0].points[1].x = "200"),
      'Point 2 of road "main", x must be a number from -1000000 and up to 1000000 (found "200").',
    ],
    [
      "a road with no length",
      (s) => (s.network.roads[0].points[1] = s.network.roads[0].points[0]),
      'Road "main" has no length: all its points are in one place.',
    ],
    ["a width of text", (s) => (s.network.roads[0].widthM = "wide"), 'The width of road "main" must be a number above 0 and up to 60 (found "wide").'],
    ["a negative width", (s) => (s.network.roads[0].widthM = -3), 'The width of road "main" must be a number above 0 and up to 60 (found -3).'],
    ["an absurd width", (s) => (s.network.roads[0].widthM = 1e9), 'The width of road "main" must be a number above 0 and up to 60 (found 1000000000).'],
    ["half a lane", (s) => (s.network.roads[0].lanes = 2.5), 'The number of lanes of road "main" must be a whole number from 1 to 12 (found 2.5).'],
    [
      "no lane count in a network of format version 2",
      (s) => delete s.network.roads[0].lanes,
      'The number of lanes of road "main" must be a whole number from 1 to 12 (found nothing).',
    ],
    ["a speed limit of zero", (s) => (s.network.roads[0].speedLimitMps = 0), 'The speed limit of road "main" must be a number above 0 and up to 60 (found 0).'],
    ["no demand", (s) => delete s.demand, "The demand is missing or is not an object (found nothing)."],
    ["flows that are not a list", (s) => (s.demand.flows = 6000), "The demand's list of flows is missing or is not a list (found 6000)."],
    [
      "a flow from a road that does not exist",
      (s) => (s.demand.flows[0].entryRoadId = "bypass"),
      'The entry road of flow 1 names a road that is not in the network: "bypass".',
    ],
    [
      "a flow to a road that does not exist",
      (s) => (s.demand.flows[0].exitRoadId = "bypass"),
      'The exit road of flow 1 names a road that is not in the network: "bypass".',
    ],
    [
      "a negative demand",
      (s) => (s.demand.flows[0].vehiclesPerHour = -1),
      "The vehicles per hour of flow 1 must be a number from 0 and up to 100000 (found -1).",
    ],
    [
      "a demand large enough to hang the page",
      (s) => (s.demand.flows[0].vehiclesPerHour = 1e12),
      "The vehicles per hour of flow 1 must be a number from 0 and up to 100000 (found 1000000000000).",
    ],
    [
      "a vehicle class that does not exist",
      (s) => (s.demand.vehicleMix.tractor = 0.1),
      'The vehicle mix names a vehicle class this version of the product does not know: "tractor".',
    ],
    ["a share that is text", (s) => (s.demand.vehicleMix.car = "most"), 'The share of vehicle class "car" must be a number from 0 and up to 1000000 (found "most").'],
    [
      "a vehicle mix of nothing",
      (s) => (s.demand.vehicleMix = { car: 0 }),
      "The vehicle mix needs a share above zero for at least one vehicle class.",
    ],
    ["changes that are not a list", (s) => (s.changes = "none"), 'The list of changes is missing or is not a list (found "none").'],
    ["a change that is not an object", (s) => (s.changes[0] = 7), "Change 1 is missing or is not an object (found 7)."],
    [
      "a kind of change it does not know",
      (s) => (s.changes[1] = { kind: "paint-it-blue", roadId: "main" }),
      'Change 2 is of a kind this version of the product does not know: "paint-it-blue".',
    ],
    [
      "a change to a road that does not exist",
      (s) => (s.changes[0].roadId = "bypass"),
      'Change 1 names a road that is not in the network: "bypass".',
    ],
    ["a width change with no width", (s) => delete s.changes[0].widthM, "The width in change 1 must be a number above 0 and up to 60 (found nothing)."],
    ["a lanes change to no lanes", (s) => (s.changes[1].lanes = 0), "The number of lanes in change 2 must be a whole number from 1 to 12 (found 0)."],
    ["lane discipline that is text", (s) => (s.laneDiscipline = "on"), 'Lane discipline must be on (true) or off (false) (found "on").'],
    ["no lane discipline", (s) => delete s.laneDiscipline, "Lane discipline must be on (true) or off (false) (found nothing)."],
    ["a seed that is not a whole number", (s) => (s.seed = 1.5), /^The seed must be a whole number from .* \(found 1\.5\)\.$/ as unknown as string],
    ["no seed", (s) => delete s.seed, /^The seed must be a whole number from .* \(found nothing\)\.$/ as unknown as string],
  ])("%s", (_name, damage, message) => {
    const found = messageFor(saved(damage));

    if (typeof message === "string") expect(found).toBe(message);
    else expect(found).toMatch(message);
  });

  it("a hostile key does not reach any object's prototype", () => {
    const hostile = JSON.parse(
      JSON.stringify(proposal).replace('"car":0.22', '"car":0.22,"__proto__":{"polluted":true}'),
    );

    expect(messageFor(hostile)).toBe(
      'The vehicle mix names a vehicle class this version of the product does not know: "__proto__".',
    );
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe("a scenario the engine would refuse to run", () => {
  it("a road too narrow for a vehicle class in the vehicle mix: says which run, which road and which vehicle class", () => {
    const tooNarrow = withRoadWidth(today, "main", 2);

    expect(whyRefused(tooNarrow)).toBe('The proposal cannot be run: Road "main" is too narrow for a car');
    expect(messageFor(JSON.parse(JSON.stringify(tooNarrow)))).toBe(
      'The proposal cannot be run: Road "main" is too narrow for a car.',
    );
  });

  it("with lane discipline on, lanes too narrow for a vehicle class: more lanes on the same width is refused", () => {
    const kept = { ...today, laneDiscipline: true };

    // 10.5 m in 4 lanes is 2.625 m a lane, wide enough for a 2.43 m bus; in 5 lanes, 2.1 m, is not.
    expect(whyRefused(withRoadLanes(kept, "main", 4))).toBeUndefined();
    expect(whyRefused(withRoadLanes(kept, "main", 5))).toBe(
      'The proposal cannot be run: The lanes of road "main" are too narrow for a bus',
    );
  });

  it("with lane discipline off the same lanes are accepted: mixed traffic takes no notice of lanes", () => {
    expect(whyRefused(withRoadLanes(today, "main", 5))).toBeUndefined();
  });

  it("a baseline the engine refuses is named as the baseline", () => {
    const narrowToday = saved((scenario) => {
      scenario.network.roads[0].widthM = 2;
      scenario.changes = [];
    });

    expect(messageFor(narrowToday)).toBe('The baseline cannot be run: Road "main" is too narrow for a car.');
  });

  it("a scenario the engine accepts is not refused", () => {
    expect(whyRefused(proposal)).toBeUndefined();
  });
});
