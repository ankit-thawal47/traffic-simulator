import {
  withDemandScale,
  withFlowRate,
  withFlyover,
  withLaneClosure,
  withLaneDiscipline,
  withLostWidth,
  withRoadClosure,
  withRoadLanes,
  withRoadWidth,
  withSignalTiming,
  withVehicleMix,
} from "@traffic-simulator/scenario";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";
import {
  demandScaleIn,
  flowRateIn,
  flyoverBuiltIn,
  greenTimesIn,
  laneDisciplineIn,
  roadValues,
  vehicleMixIn,
} from "./proposal-values";

const flyover = EXAMPLES.find((example) => example.id === "flyover")!.scenario;
const notYetBuilt = EXAMPLES.find((example) => example.id === "flyover-proposed")!.scenario;

describe("what the change controls show for a proposal", () => {
  it("is what the baseline has while the proposal has no changes", () => {
    expect(roadValues(flyover, "west-in")).toEqual({
      widthM: 7,
      lanes: 2,
      lanesClosed: 0,
      lostWidthM: 0,
      lostWidthReason: "parking",
      closed: false,
      today: { widthM: 7, lanes: 2 },
    });
    expect(laneDisciplineIn(flyover)).toBe(false);
    expect(demandScaleIn(flyover)).toBe(1);
    expect(vehicleMixIn(flyover)).toEqual(flyover.demand.vehicleMix);
    expect(flowRateIn(flyover, "west-in", "east-out")).toBe(400);
    expect(greenTimesIn(flyover, "cross")).toEqual([20, 20, 20, 20]);
    expect(flyoverBuiltIn(flyover, "flyover-north")).toBe(true);
    expect(flyoverBuiltIn(notYetBuilt, "flyover-north")).toBe(false);
  });

  it("is what each change says once the proposal has it, even for a road that is closed", () => {
    let proposal = withRoadWidth(flyover, "west-in", 10.5);
    proposal = withRoadLanes(proposal, "west-in", 3);
    proposal = withLaneClosure(proposal, "west-in", 1);
    proposal = withLostWidth(proposal, "west-in", 1.5, "hawkers");
    proposal = withRoadClosure(proposal, "west-in", true);
    proposal = withLaneDiscipline(proposal, true);
    proposal = withDemandScale(proposal, 1.5);
    proposal = withVehicleMix(proposal, { car: 1 });
    proposal = withFlowRate(proposal, "west-in", "east-out", 900);
    proposal = withSignalTiming(proposal, "cross", [10, 20, 30, 40]);
    proposal = withFlyover(proposal, "flyover-north", false);

    expect(roadValues(proposal, "west-in")).toEqual({
      widthM: 10.5,
      lanes: 3,
      lanesClosed: 1,
      lostWidthM: 1.5,
      lostWidthReason: "hawkers",
      closed: true,
      today: { widthM: 7, lanes: 2 },
    });
    expect(roadValues(proposal, "east-in")?.widthM).toBe(7);
    expect(laneDisciplineIn(proposal)).toBe(true);
    expect(demandScaleIn(proposal)).toBe(1.5);
    expect(vehicleMixIn(proposal)).toEqual({ car: 1 });
    expect(flowRateIn(proposal, "west-in", "east-out")).toBe(900);
    expect(flowRateIn(proposal, "east-in", "west-out")).toBe(400);
    expect(greenTimesIn(proposal, "cross")).toEqual([10, 20, 30, 40]);
    expect(flyoverBuiltIn(proposal, "flyover-north")).toBe(false);
    expect(flyoverBuiltIn(withFlyover(notYetBuilt, "flyover-north", true), "flyover-north")).toBe(true);
  });

  it("gives nothing for a road the network does not have", () => {
    expect(roadValues(flyover, "nowhere")).toBeUndefined();
  });
});
