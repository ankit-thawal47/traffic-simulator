import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Demand, Network } from "@traffic-simulator/engine";
import flyover from "@traffic-simulator/engine/examples/flyover.json";
import {
  createBaseline,
  describeChange,
  readScenario,
  scenarioFromLink,
  scenarioFromText,
  scenarioToLink,
  scenarioToText,
  withDemandScale,
  withFlowRate,
  withFlyover,
  withLaneClosure,
  withLaneDiscipline,
  withLostWidth,
  withoutChange,
  withRoadClosure,
  withRoadLanes,
  withRoadWidth,
  withSignalTiming,
  withVehicleMix,
  resolveScenario,
  baselineOf,
  type Change,
  type Scenario,
} from "../src/index";

const today = createBaseline({
  name: "Flyover over a signal junction",
  network: flyover.network as Network,
  demand: flyover.demand as Demand,
  seed: 3,
});

/** A proposal with one change of every kind, each to a different thing. */
function everyKind(): Scenario {
  let proposal = withRoadWidth(today, "west-in", 10.5);
  proposal = withRoadLanes(proposal, "west-in", 3);
  proposal = withLaneClosure(proposal, "east-in", 1);
  proposal = withLostWidth(proposal, "east-out", 1.5, "hawkers");
  proposal = withRoadClosure(proposal, "flyover-south", true);
  proposal = withFlyover(proposal, "flyover-north", false);
  proposal = withSignalTiming(proposal, "cross", [30, 30, 15, 15]);
  proposal = withFlowRate(proposal, "west-in", "east-out", 600);
  proposal = withVehicleMix(proposal, { "two-wheeler": 0.5, car: 0.4, bus: 0.1 });
  proposal = withDemandScale(proposal, 1.2);
  proposal = withLaneDiscipline(proposal, true);
  return proposal;
}

/** The scenario as a link or a file would hold it, with one thing altered. */
function saved(scenario: Scenario, alter: (saved: { changes: Record<string, unknown>[]; [key: string]: unknown }) => void): unknown {
  const copy = JSON.parse(JSON.stringify(scenario));
  alter(copy);
  return copy;
}

function messageFor(value: unknown): string {
  const read = readScenario(value);
  if (read.ok) throw new Error("Expected the scenario to be refused, and it was read");
  return read.message;
}

describe("a proposal with every kind of change", () => {
  it("holds eleven changes, each stored against the identifier of its road, junction or flow", () => {
    expect(everyKind().changes).toEqual([
      { kind: "road-width", roadId: "west-in", widthM: 10.5 },
      { kind: "road-lanes", roadId: "west-in", lanes: 3 },
      { kind: "lane-closure", roadId: "east-in", lanesClosed: 1 },
      { kind: "lost-width", roadId: "east-out", widthM: 1.5, reason: "hawkers" },
      { kind: "road-closure", roadId: "flyover-south" },
      { kind: "flyover", roadId: "flyover-north", built: false },
      { kind: "signal-timing", junctionId: "cross", greenS: [30, 30, 15, 15] },
      { kind: "flow-rate", entryRoadId: "west-in", exitRoadId: "east-out", vehiclesPerHour: 600 },
      { kind: "vehicle-mix", vehicleMix: { "two-wheeler": 0.5, car: 0.4, bus: 0.1 } },
      { kind: "demand-scale", factor: 1.2 },
      { kind: "lane-discipline", on: true },
    ]);
  });

  it("is read back from an untrusted value as exactly what it was", () => {
    const read = readScenario(JSON.parse(JSON.stringify(everyKind())));

    expect(read).toEqual({ ok: true, value: everyKind() });
  });

  it("survives a file and a link", () => {
    const text = scenarioToText(everyKind());
    expect(text.ok && scenarioFromText(text.value)).toEqual({ ok: true, value: everyKind() });
    const link = scenarioToLink(everyKind(), "https://example.org/");
    expect(link.ok && scenarioFromLink(link.value)).toEqual({ ok: true, value: everyKind() });
  });

  it("the saved example of version 3 (a file and a link) opens as this proposal", () => {
    const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

    expect(scenarioFromText(fixture("v3-flyover-every-kind-of-change.json"))).toEqual({ ok: true, value: everyKind() });
    expect(
      scenarioFromLink(`https://example.org/#scenario=${fixture("v3-flyover-every-kind-of-change.link.txt").trim()}`),
    ).toEqual({ ok: true, value: everyKind() });
  });

  it("undoing one change restores that part of the baseline and leaves the others", () => {
    const proposal = everyKind();
    const baseline = resolveScenario(baselineOf(proposal));
    const full = resolveScenario(proposal);
    const greens = (network: Network) => {
      const cross = network.junctions!.find((junction) => junction.id === "cross")!;
      return cross.control === "signal" ? cross.signalPlan.phases.map((phase) => phase.greenS) : [];
    };
    const widthOf = (network: Network, roadId: string) => network.roads.find((road) => road.id === roadId)?.widthM;
    expect(greens(full.network)).toEqual([30, 30, 15, 15]);

    // The signal timing change is the seventh in the list.
    const undone = withoutChange(proposal, 6);
    const after = resolveScenario(undone);

    expect(undone.changes).toEqual(proposal.changes.filter((change) => change.kind !== "signal-timing"));
    expect(greens(after.network)).toEqual(greens(baseline.network));
    // Everything else is as the full proposal had it.
    expect(after.network.roads).toEqual(full.network.roads);
    expect(after.demand).toEqual(full.demand);
    expect(after.laneDiscipline).toBe(true);
    expect(widthOf(after.network, "west-in")).toBe(10.5);
    expect(widthOf(after.network, "flyover-north")).toBeUndefined();
  });

  it.each(everyKind().changes.map((change, index) => [change.kind, index] as const))(
    "undoing the %s change leaves a proposal that differs from the full one, and undoing all of them gives the baseline",
    (_, index) => {
      const proposal = everyKind();

      expect(resolveScenario(withoutChange(proposal, index))).not.toEqual(resolveScenario(proposal));
      let none = proposal;
      while (none.changes.length > 0) none = withoutChange(none, 0);
      expect(resolveScenario(none)).toEqual(resolveScenario(baselineOf(proposal)));
    },
  );
});

describe("a change read from a link or a file", () => {
  const withChanges = (...changes: unknown[]) => saved(today, (scenario) => (scenario.changes = changes as never));

  it.each<[string, unknown, string]>([
    ["a lane closure of no lanes", { kind: "lane-closure", roadId: "west-in", lanesClosed: 0 }, "The number of lanes closed in change 1 must be a whole number from 1 to 11 (found 0)."],
    ["a lane closure of a road that is not there", { kind: "lane-closure", roadId: "nowhere", lanesClosed: 1 }, 'Change 1 names a road that is not in the network: "nowhere".'],
    ["lost width with no reason this version knows", { kind: "lost-width", roadId: "west-in", widthM: 1, reason: "a parade" }, 'The reason for the lost width in change 1 is not one this version of the product knows: "a parade".'],
    ["lost width that is not a width", { kind: "lost-width", roadId: "west-in", widthM: -1, reason: "parking" }, "The lost width in change 1 must be a number above 0 and up to 60 (found -1)."],
    ["a road closure with no road", { kind: "road-closure" }, "Change 1 is missing or is not text (found nothing)."],
    ["a flyover change to a road on the ground", { kind: "flyover", roadId: "west-in", built: false }, 'Change 1 names a road that is not a flyover road (it is not raised): "west-in".'],
    ["a flyover change that does not say built or not", { kind: "flyover", roadId: "flyover-north", built: "no" }, 'Change 1 must say whether the flyover road is built (true) or not (false) (found "no").'],
    ["signal timing for a junction that is not there", { kind: "signal-timing", junctionId: "nowhere", greenS: [10] }, 'Change 1 names a junction that is not in the network: "nowhere".'],
    ["signal timing for a junction with no signal", { kind: "signal-timing", junctionId: "diverge-northbound", greenS: [10] }, 'Change 1 gives green times to junction "diverge-northbound", which has no signal.'],
    ["signal timing with too few green times", { kind: "signal-timing", junctionId: "cross", greenS: [10, 10] }, 'Change 1 gives junction "cross" 2 green times; its signal plan has 4 phases.'],
    ["signal timing with a green time of zero", { kind: "signal-timing", junctionId: "cross", greenS: [10, 10, 0, 10] }, "Green time 3 in change 1 must be a number above 0 and up to 3600 (found 0)."],
    ["a flow rate for a flow the demand does not have", { kind: "flow-rate", entryRoadId: "west-in", exitRoadId: "west-out", vehiclesPerHour: 5 }, 'Change 1 names a flow that is not in the demand: from road "west-in" to road "west-out".'],
    ["a flow rate that is not a rate", { kind: "flow-rate", entryRoadId: "west-in", exitRoadId: "east-out", vehiclesPerHour: "many" }, 'The vehicles per hour in change 1 must be a number from 0 and up to 100000 (found "many").'],
    ["a vehicle mix with a vehicle class this version does not know", { kind: "vehicle-mix", vehicleMix: { tractor: 1 } }, 'The vehicle mix in change 1 names a vehicle class this version of the product does not know: "tractor".'],
    ["a vehicle mix with no share above zero", { kind: "vehicle-mix", vehicleMix: { car: 0 } }, "The vehicle mix in change 1 needs a share above zero for at least one vehicle class."],
    ["a demand scale that is not a number", { kind: "demand-scale", factor: null }, "The factor all demand is scaled by in change 1 must be a number from 0 and up to 10 (found null)."],
    ["a demand scale beyond the limit", { kind: "demand-scale", factor: 500 }, "The factor all demand is scaled by in change 1 must be a number from 0 and up to 10 (found 500)."],
    ["a lane discipline change that is neither on nor off", { kind: "lane-discipline", on: 1 }, "Change 1 must switch lane discipline on (true) or off (false) (found 1)."],
    ["a kind of change this version does not know", { kind: "roundabout", roadId: "west-in" }, 'Change 1 is of a kind this version of the product does not know: "roundabout".'],
  ])("%s is refused", (_, change, message) => {
    expect(messageFor(withChanges(change))).toBe(message);
  });

  it("is rebuilt from its checked parts alone: anything else it carried is dropped", () => {
    const read = readScenario(withChanges({ kind: "demand-scale", factor: 2, extra: "<script>" }));

    expect(read.ok && read.value.changes).toEqual([{ kind: "demand-scale", factor: 2 }]);
  });

  it("a proposal the engine would refuse is not opened, and the planner is told why", () => {
    expect(messageFor(withChanges({ kind: "road-closure", roadId: "south-in" }))).toBe(
      'The proposal cannot be run: There is no route from road "south-entry" to road "west-out".',
    );
  });
});

describe("the roads not built today, read from a link or a file", () => {
  const withUnbuilt = (value: unknown) => saved(today, (scenario) => (scenario.unbuiltRoadIds = value));

  it("are read back", () => {
    const read = readScenario(withUnbuilt(["flyover-north", "flyover-south"]));

    expect(read.ok && read.value.unbuiltRoadIds).toEqual(["flyover-north", "flyover-south"]);
  });

  it.each<[string, unknown, string]>([
    ["missing", undefined, "The list of roads not built today is missing or is not a list (found nothing)."],
    ["a road that is not in the network", ["nowhere"], 'Entry 1 of the list of roads not built today names a road that is not in the network: "nowhere".'],
    ["a road on the ground", ["west-in"], 'Entry 1 of the list of roads not built today names a road that is not a flyover road (it is not raised): "west-in".'],
  ])("%s: refused", (_, value, message) => {
    expect(messageFor(withUnbuilt(value))).toBe(message);
  });
});

describe("a change described in plain words", () => {
  it.each<[Change, string]>([
    [{ kind: "road-width", roadId: "west-in", widthM: 10.5 }, 'Road "west-in": width 7 m → 10.5 m'],
    [{ kind: "road-lanes", roadId: "west-in", lanes: 3 }, 'Road "west-in": lanes 2 → 3'],
    [{ kind: "lane-closure", roadId: "east-in", lanesClosed: 1 }, 'Road "east-in": 1 of 2 lanes closed'],
    [{ kind: "lost-width", roadId: "east-out", widthM: 1.5, reason: "hawkers" }, 'Road "east-out": 1.5 m of width lost to hawkers'],
    [{ kind: "lost-width", roadId: "east-out", widthM: 2, reason: "stopped-vehicles" }, 'Road "east-out": 2 m of width lost to stopped vehicles'],
    [{ kind: "lost-width", roadId: "east-out", widthM: 2, reason: "other" }, 'Road "east-out": 2 m of width lost to roadside activity'],
    [{ kind: "road-closure", roadId: "flyover-south" }, 'Road "flyover-south": closed'],
    [{ kind: "flyover", roadId: "flyover-north", built: false }, 'Flyover road "flyover-north": removed'],
    [{ kind: "flyover", roadId: "flyover-north", built: true }, 'Flyover road "flyover-north": built'],
    [{ kind: "signal-timing", junctionId: "cross", greenS: [30, 30, 15, 15] }, 'Signal junction "cross": green times 20, 20, 20, 20 s → 30, 30, 15, 15 s'],
    [{ kind: "flow-rate", entryRoadId: "west-in", exitRoadId: "east-out", vehiclesPerHour: 600 }, 'Demand from "west-in" to "east-out": 400 → 600 vehicles per hour'],
    [{ kind: "vehicle-mix", vehicleMix: { "two-wheeler": 0.5, car: 0.4, bus: 0.1 } }, "Vehicle mix: two-wheelers 67%, cars 23%, auto-rickshaws 6%, buses 4% → two-wheelers 50%, cars 40%, auto-rickshaws 0%, buses 10%"],
    [{ kind: "demand-scale", factor: 1.2 }, "All demand: scaled by 1.2 (+20%)"],
    [{ kind: "demand-scale", factor: 0.5 }, "All demand: scaled by 0.5 (−50%)"],
    [{ kind: "lane-discipline", on: true }, "Lane discipline: off (mixed traffic) → on"],
  ])("%j", (change, words) => {
    expect(describeChange(change, today)).toBe(words);
  });

  it("lane discipline switched off reads the other way", () => {
    expect(describeChange({ kind: "lane-discipline", on: false }, { ...today, laneDiscipline: true })).toBe(
      "Lane discipline: on → off (mixed traffic)",
    );
  });
});
