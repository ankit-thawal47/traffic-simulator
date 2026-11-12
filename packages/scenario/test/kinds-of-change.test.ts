/**
 * Every kind of change alters the run in the expected direction. Each test
 * goes the way the product does: resolve the baseline and the proposal, run
 * both, compare. The figures in the comments are what was seen when the test
 * was written.
 */
import { describe, expect, it } from "vitest";
import { createRun, type Demand, type Network, type Results } from "@traffic-simulator/engine";
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";
import flyover from "@traffic-simulator/engine/examples/flyover.json";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import signalJunction from "@traffic-simulator/engine/examples/signal-junction.json";
import {
  baselineOf,
  createBaseline,
  resolveScenario,
  whyRefused,
  withDemandScale,
  withFlowRate,
  withFlyover,
  withLaneClosure,
  withLaneDiscipline,
  withLostWidth,
  withRoadClosure,
  withRoadWidth,
  withSignalTiming,
  withVehicleMix,
  type Scenario,
} from "../src/index";

const TEN_MINUTES_S = 600;

function resultsAfter(scenario: Scenario, seconds: number): Results {
  const run = createRun(resolveScenario(scenario));
  while (run.timeS < seconds - 1e-9) run.step();
  return run.results();
}

/** Baseline and proposal of one scenario description, each run for the same time. */
function ran(proposal: Scenario, seconds = TEN_MINUTES_S): { baseline: Results; proposal: Results } {
  return { baseline: resultsAfter(baselineOf(proposal), seconds), proposal: resultsAfter(proposal, seconds) };
}

/** The mixed-traffic example: one 10.5 m road of three lanes, four vehicle classes. */
function oneRoad(vehiclesPerHour: number, seed = 1): Scenario {
  return createBaseline({
    name: "One road",
    network: mixedTraffic.network as Network,
    demand: { ...mixedTraffic.demand, flows: [{ entryRoadId: "main", exitRoadId: "main", vehiclesPerHour }] },
    seed,
  });
}

function signalJunctionExample(seed = 1): Scenario {
  return createBaseline({
    name: "Four-way signal junction",
    network: signalJunction.network as Network,
    demand: signalJunction.demand as Demand,
    seed,
  });
}

function flyoverExample(seed = 1): Scenario {
  return createBaseline({
    name: "Flyover over a signal junction",
    network: flyover.network as Network,
    demand: flyover.demand as Demand,
    seed,
  });
}

describe("closing a lane", () => {
  it("leaves the road its other lanes, at the width they have", () => {
    const road = resolveScenario(withLaneClosure(oneRoad(6000), "main", 1)).network.roads[0]!;

    expect(road).toMatchObject({ id: "main", lanes: 2, widthM: 7 });
  });

  it("lowers the throughput past it when the demand is more than the open lanes carry", () => {
    const { baseline, proposal } = ran(withLaneClosure(oneRoad(6000), "main", 2));

    expect(proposal.vehiclesThrough).toBeLessThan(baseline.vehiclesThrough * 0.85);
  });

  it("is refused when it would close every lane of the road", () => {
    expect(whyRefused(withLaneClosure(oneRoad(6000), "main", 3))).toBe(
      'The proposal cannot be run: Change 1 closes 3 of the 3 lanes of road "main"; at least one lane must stay open (to close them all, close the road)',
    );
  });
});

describe("width lost to roadside activity", () => {
  it("comes off the road's width and leaves its lanes as many as they were", () => {
    const road = resolveScenario(withLostWidth(oneRoad(6000), "main", 2.5, "parking")).network.roads[0]!;

    expect(road).toMatchObject({ id: "main", lanes: 3, widthM: 8 });
  });

  it("comes off whatever a width change and a lane closure leave, in whatever order the changes were made", () => {
    const lostFirst = withLaneClosure(withLostWidth(oneRoad(6000), "main", 1, "hawkers"), "main", 1);

    expect(resolveScenario(lostFirst).network.roads[0]).toMatchObject({ lanes: 2, widthM: 6 });
  });

  it("lowers the throughput when the demand is high enough", () => {
    const { baseline, proposal } = ran(withLostWidth(oneRoad(6000), "main", 7, "parking"));

    expect(proposal.vehiclesThrough).toBeLessThan(baseline.vehiclesThrough * 0.85);
  });

  it("changes almost nothing when the demand is well within what the narrower road carries", () => {
    const { baseline, proposal } = ran(withLostWidth(oneRoad(1500), "main", 7, "parking"));

    expect(Math.abs(proposal.vehiclesThrough - baseline.vehiclesThrough)).toBeLessThan(baseline.vehiclesThrough * 0.02);
  });

  it("is refused when it takes the whole width of the road", () => {
    expect(whyRefused(withLostWidth(oneRoad(6000), "main", 10.5, "parking"))).toBe(
      'The proposal cannot be run: Change 1 takes 10.5 m from road "main", which has 10.5 m; some width must be left',
    );
  });
});

describe("scaling all demand", () => {
  it("changes every entry-to-exit rate together", () => {
    const today = signalJunctionExample();
    const scaled = resolveScenario(withDemandScale(today, 1.5)).demand;

    expect(scaled.flows.map((flow) => flow.vehiclesPerHour)).toEqual(
      today.demand.flows.map((flow) => flow.vehiclesPerHour * 1.5),
    );
    expect(scaled.flows.map((flow) => [flow.entryRoadId, flow.exitRoadId])).toEqual(
      today.demand.flows.map((flow) => [flow.entryRoadId, flow.exitRoadId]),
    );
    expect(scaled.vehicleMix).toEqual(today.demand.vehicleMix);
  });

  it("scales a flow whose rate the proposal also sets, whichever change was made first", () => {
    const scaledFirst = withFlowRate(withDemandScale(oneRoad(3000), 2), "main", "main", 1000);

    expect(resolveScenario(scaledFirst).demand.flows[0]!.vehiclesPerHour).toBe(2000);
  });

  it("scaling up raises the vehicles entered while the road has room for them", () => {
    const { baseline, proposal } = ran(withDemandScale(oneRoad(2000), 1.5));

    expect(proposal.vehiclesEntered).toBeGreaterThan(baseline.vehiclesEntered * 1.4);
    expect(proposal.vehiclesWaitingToEnter).toBe(0);
  });

  it("and no further once the road is at capacity: the extra vehicles wait to enter", () => {
    const { baseline, proposal } = ran(withDemandScale(oneRoad(12000), 1.5));

    expect(proposal.vehiclesEntered).toBeLessThan(baseline.vehiclesEntered * 1.05);
    expect(proposal.vehiclesWaitingToEnter).toBeGreaterThan(baseline.vehiclesWaitingToEnter + 500);
  });
});

describe("changing the demand of the proposal", () => {
  it("a flow rate change sets the rate of that flow and no other", () => {
    const today = signalJunctionExample();
    const flows = resolveScenario(withFlowRate(today, "south-in", "north-out", 900)).demand.flows;

    expect(flows.find((flow) => flow.entryRoadId === "south-in" && flow.exitRoadId === "north-out")!.vehiclesPerHour).toBe(900);
    expect(flows.filter((flow) => flow.exitRoadId !== "north-out" || flow.entryRoadId !== "south-in")).toEqual(
      today.demand.flows.filter((flow) => flow.exitRoadId !== "north-out" || flow.entryRoadId !== "south-in"),
    );
  });

  it("a flow rate change is refused for a flow the demand does not have", () => {
    expect(whyRefused(withFlowRate(oneRoad(3000), "main", "elsewhere", 10))).toBe(
      'The proposal cannot be run: Change 1 names a flow that is not in the demand: from road "main" to road "elsewhere"',
    );
  });

  it("a vehicle mix with more two-wheelers passes more vehicles along a road at capacity", () => {
    const moreTwoWheelers = { "two-wheeler": 0.9, car: 0.06, "auto-rickshaw": 0.02, bus: 0.02 };
    // 20,000 vehicles an hour is more than the road passes with either vehicle mix, so both runs are at capacity.
    // (At 12,000 the baseline passes 1794 of the 2000 that arrive in ten minutes, so there is little left to gain.)
    const proposal = withVehicleMix(oneRoad(20000), moreTwoWheelers);

    expect(resolveScenario(proposal).demand.vehicleMix).toEqual(moreTwoWheelers);
    expect(resolveScenario(baselineOf(proposal)).demand.vehicleMix).toEqual(mixedTraffic.demand.vehicleMix);
    const { baseline, proposal: after } = ran(proposal);
    // Seen: 1881 through with 65% two-wheelers, 2758 with 90%.
    expect(after.vehiclesThrough).toBeGreaterThan(baseline.vehiclesThrough * 1.3);
  });
});

describe("switching lane discipline", () => {
  it("sets it for the proposal and leaves the baseline as it was", () => {
    const proposal = withLaneDiscipline(oneRoad(12000), true);

    expect(resolveScenario(proposal).laneDiscipline).toBe(true);
    expect(resolveScenario(baselineOf(proposal)).laneDiscipline).toBe(false);
  });

  it("on, the same road at capacity passes fewer vehicles than it does as mixed traffic", () => {
    const { baseline, proposal } = ran(withLaneDiscipline(oneRoad(12000), true));

    // Seen: 1794 through as mixed traffic, 1015 keeping to three 3.5 m lanes.
    expect(proposal.vehiclesThrough).toBeLessThan(baseline.vehiclesThrough * 0.9);
  });
});

describe("changing signal timing", () => {
  it("sets the green time of each phase of that junction's signal plan, and nothing else", () => {
    const today = signalJunctionExample();
    const proposed = resolveScenario(withSignalTiming(today, "cross", [25, 25, 50, 25])).network;
    const plan = (network: Network) => {
      const junction = network.junctions!.find((one) => one.id === "cross")!;
      return junction.control === "signal" ? junction.signalPlan : undefined;
    };

    expect(plan(proposed)!.phases.map((phase) => phase.greenS)).toEqual([25, 25, 50, 25]);
    expect(plan(proposed)!.phases.map((phase) => phase.greenRoadIds)).toEqual(
      plan(today.network)!.phases.map((phase) => phase.greenRoadIds),
    );
    expect({ ...plan(proposed), phases: [] }).toEqual({ ...plan(today.network), phases: [] });
    expect(proposed.roads).toEqual(today.network.roads);
  });

  it("more green for an approach shortens its queue", () => {
    // The third phase is the green of south-in: 25 s in the baseline, 50 s in the proposal.
    const busier = withDemandScale(signalJunctionExample(), 1.6);
    const before = resultsAfter(busier, TEN_MINUTES_S);
    const after = resultsAfter(withSignalTiming(busier, "cross", [25, 25, 50, 25]), TEN_MINUTES_S);

    // Seen: 78 m before, 45 m after. The other approaches wait longer for their green: north-in 69 m to 94 m.
    expect(after.longestQueueByApproach["south-in"]!.lengthM).toBeLessThan(
      before.longestQueueByApproach["south-in"]!.lengthM * 0.8,
    );
  });

  it.each([
    ["a junction the network does not have", "nowhere", [25, 25, 25, 25], 'Change 1 names a junction that is not in the network: "nowhere"'],
    ["a different number of green times", "cross", [25, 25], 'Change 1 gives junction "cross" 2 green times; its signal plan has 4 phases'],
    ["a green time of zero", "cross", [25, 0, 25, 25], 'Change 1 gives junction "cross" a green time that is not a number above zero'],
  ])("is refused for %s", (_, junctionId, greenS, message) => {
    expect(whyRefused(withSignalTiming(signalJunctionExample(), junctionId, greenS))).toBe(
      `The proposal cannot be run: ${message}`,
    );
  });
});

const connectionsOf = (network: Network, junctionId: string) =>
  network.junctions!.find((junction) => junction.id === junctionId)?.connections;
const bothFlyoverRoads = ["flyover-north", "flyover-south"];
const withoutTheFlyover = (scenario: Scenario) =>
  bothFlyoverRoads.reduce((proposal, roadId) => withFlyover(proposal, roadId, false), scenario);

describe("removing a flyover", () => {
  it("takes the flyover road out of the network, with the connections that served only it", () => {
    const network = resolveScenario(withFlyover(flyoverExample(), "flyover-north", false)).network;

    expect(network.roads.map((road) => road.id)).not.toContain("flyover-north");
    expect(network.roads).toHaveLength(flyover.network.roads.length - 1);
    expect(connectionsOf(network, "diverge-northbound")).toEqual([{ fromRoadId: "south-entry", toRoadId: "south-in" }]);
    expect(connectionsOf(network, "merge-northbound")).toEqual([{ fromRoadId: "north-out", toRoadId: "north-exit" }]);
    // The other direction keeps its flyover.
    expect(connectionsOf(network, "diverge-southbound")).toEqual(connectionsOf(flyover.network as Network, "diverge-southbound"));
  });

  it("sends the through traffic to the junction beneath and lengthens its queues", () => {
    const { baseline, proposal } = ran(withoutTheFlyover(flyoverExample()));

    for (const approach of ["south-in", "north-in"]) {
      expect(proposal.longestQueueByApproach[approach]!.lengthM).toBeGreaterThan(
        baseline.longestQueueByApproach[approach]!.lengthM * 1.5,
      );
    }
    expect(proposal.vehiclesThrough).toBeLessThan(baseline.vehiclesThrough);
  });

  it("is refused for a road that is not a flyover road", () => {
    expect(whyRefused(withFlyover(flyoverExample(), "south-in", false))).toBe(
      'The proposal cannot be run: Change 1 names a road that is not a flyover road (it is not raised): "south-in"',
    );
  });
});

describe("adding a flyover", () => {
  /** The same network, with the flyover drawn but not built today. */
  const notBuiltToday = (): Scenario => ({ ...flyoverExample(), unbuiltRoadIds: bothFlyoverRoads });
  const withTheFlyover = (scenario: Scenario) =>
    bothFlyoverRoads.reduce((proposal, roadId) => withFlyover(proposal, roadId, true), scenario);

  it("the baseline runs without the roads that are not built today", () => {
    expect(resolveScenario(notBuiltToday())).toEqual(resolveScenario(withoutTheFlyover(flyoverExample())));
  });

  it("the proposal runs with the flyover the network has drawn", () => {
    expect(resolveScenario(withTheFlyover(notBuiltToday())).network).toEqual(flyover.network);
  });

  it("takes the through traffic off the junction beneath and shortens its queues", () => {
    const { baseline, proposal } = ran(withTheFlyover(notBuiltToday()));

    for (const approach of ["south-in", "north-in"]) {
      expect(proposal.longestQueueByApproach[approach]!.lengthM).toBeLessThan(
        baseline.longestQueueByApproach[approach]!.lengthM * 0.7,
      );
    }
    expect(proposal.vehiclesThrough).toBeGreaterThan(baseline.vehiclesThrough);
  });
});

describe("closing a road", () => {
  it("takes the road out of the network; traffic that used it goes another way when there is one", () => {
    const closed = withRoadClosure(flyoverExample(), "flyover-north", true);

    expect(whyRefused(closed)).toBeUndefined();
    expect(resolveScenario(closed).network).toEqual(
      resolveScenario(withFlyover(flyoverExample(), "flyover-north", false)).network,
    );
    const { baseline, proposal } = ran(closed);
    expect(proposal.longestQueueByApproach["south-in"]!.lengthM).toBeGreaterThan(
      baseline.longestQueueByApproach["south-in"]!.lengthM * 1.5,
    );
  });

  it("takes an approach's green out of the signal plan with it", () => {
    // Nobody enters by west-in in this proposal, so the road can be closed.
    const noTrafficFromTheWest = flyoverExample();
    noTrafficFromTheWest.demand = {
      ...noTrafficFromTheWest.demand,
      flows: noTrafficFromTheWest.demand.flows.filter((flow) => flow.entryRoadId !== "west-in"),
    };
    const closed = withRoadClosure(noTrafficFromTheWest, "west-in", true);

    expect(whyRefused(closed)).toBeUndefined();
    const cross = resolveScenario(closed).network.junctions!.find((junction) => junction.id === "cross")!;
    expect(cross.control === "signal" && cross.signalPlan.phases.map((phase) => phase.greenRoadIds)).toEqual([
      ["south-in"],
      ["north-in"],
      ["east-in"],
    ]);
    expect(cross.connections.some((connection) => connection.fromRoadId === "west-in")).toBe(false);
  });

  it("is refused, saying which traffic, when the demand enters by the closed road", () => {
    expect(whyRefused(withRoadClosure(oneRoad(3000), "main", true))).toBe(
      'The proposal cannot be run: Road "main" is closed (change 1), and the demand has traffic that enters by it ' +
        '(from road "main" to road "main"). Traffic is not sent another way or taken off the network',
    );
  });

  it("is refused, saying which traffic, when it leaves a flow of the demand with no route", () => {
    expect(whyRefused(withRoadClosure(flyoverExample(), "south-in", true))).toBe(
      // Through traffic still has the flyover; the traffic that turns at the junction has no other way.
      'The proposal cannot be run: There is no route from road "south-entry" to road "west-out"',
    );
  });
});

/**
 * Where a flyover leaves the main road, the roads lie side by side across the
 * width of the road before them. A road's width changes about its centreline,
 * so a change there can leave the roads no longer side by side.
 */
describe("changing the width of a road where the road divides for a flyover", () => {
  it("a road made narrower still lies within the road it divides from, and runs", () => {
    const narrowed = withLaneClosure(flyoverExample(), "south-in", 1);

    expect(whyRefused(narrowed)).toBeUndefined();
    expect(checkRunConsistency(resolveScenario(narrowed), { durationS: 300 }).violations).toEqual([]);
  });

  it("a road made wider is refused when it would lie over the road beside it", () => {
    expect(whyRefused(withRoadWidth(flyoverExample(), "south-in", 10))).toBe(
      'The proposal cannot be run: At junction "diverge-northbound", where roads lie side by side, road "south-in" would lie ' +
        '1.5 m over road "flyover-north". A road that begins or ends there can be made narrower, but not wider',
    );
  });

  it("the road before the divide is refused a width that leaves a road it leads to outside it", () => {
    expect(whyRefused(withLaneClosure(flyoverExample(), "south-entry", 1))).toBe(
      'The proposal cannot be run: At junction "diverge-northbound", where roads lie side by side, road "south-in" would lie ' +
        '1.75 m outside road "south-entry". Change the width of both, or of neither',
    );
  });

  it("the example as it is, and a change elsewhere in it, are not refused", () => {
    expect(whyRefused(flyoverExample())).toBeUndefined();
    expect(whyRefused(withRoadWidth(flyoverExample(), "west-in", 10.5))).toBeUndefined();
  });
});
