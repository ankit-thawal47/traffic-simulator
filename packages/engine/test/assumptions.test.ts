import { describe, expect, it } from "vitest";
import {
  BENGALURU_VEHICLE_MIX,
  JUNCTION_ASSUMPTIONS,
  listAssumptions,
  NOT_MODELLED,
  SIDEWAYS_ASSUMPTIONS,
  STEP_SECONDS,
  VEHICLE_CLASSES,
  VEHICLE_CLASS_ASSUMPTIONS,
  type ListedAssumption,
} from "../src/index";

const STATES = ["confirmed", "secondary-source", "our-choice", "unconfirmed"];

function everyListed(): ListedAssumption[] {
  return listAssumptions().flatMap((group) => group.assumptions);
}

function listed(id: string): ListedAssumption {
  const found = everyListed().filter((assumption) => assumption.id === id);
  expect(found, `assumption "${id}" is listed once`).toHaveLength(1);
  return found[0]!;
}

describe("the list of assumptions shown to the planner", () => {
  it("has every value the engine uses for every vehicle class, as the engine has it", () => {
    for (const vehicleClass of VEHICLE_CLASSES) {
      const used = VEHICLE_CLASS_ASSUMPTIONS[vehicleClass] as unknown as Record<string, unknown>;
      const names = Object.keys(used).filter((name) => typeof used[name] === "number");
      // Size, desired speed, the four following values, side clearance and the sideways speed cap.
      expect(names).toHaveLength(9);
      for (const name of names) {
        expect(listed(`${vehicleClass}.${name}`).value).toBe(used[name]);
      }
    }
  });

  it("has every assumption the vehicle classes share, as the engine has it", () => {
    for (const [name, assumption] of Object.entries(SIDEWAYS_ASSUMPTIONS)) {
      expect(listed(name).value).toBe(assumption.value);
    }
    expect(listed("stepS").value).toBe(STEP_SECONDS);
    for (const vehicleClass of VEHICLE_CLASSES) {
      expect(listed(`vehicleMix.${vehicleClass}`).value).toBe(BENGALURU_VEHICLE_MIX[vehicleClass]);
    }
  });

  it("gives every assumption a name, a unit, a state and a source", () => {
    const all = everyListed();
    expect(all.length).toBeGreaterThan(40);
    for (const assumption of all) {
      expect(assumption.name.length, assumption.id).toBeGreaterThan(3);
      expect(typeof assumption.unit, assumption.id).toBe("string");
      expect(STATES, assumption.id).toContain(assumption.state);
      expect(assumption.source.length, assumption.id).toBeGreaterThan(20);
    }
    expect(new Set(all.map((assumption) => assumption.id)).size).toBe(all.length);
  });

  it("says where in the source a confirmed value was read", () => {
    const confirmed = everyListed().filter((assumption) => assumption.state === "confirmed");
    expect(confirmed.length).toBeGreaterThan(0);
    for (const assumption of confirmed) {
      expect(assumption.source, assumption.id).toMatch(/Table \d|page \d|Section [IVX]/);
    }
  });

  it("groups them by vehicle class, then those shared, those for junctions, the vehicle mix, then the rules", () => {
    expect(listAssumptions().map((group) => group.id)).toEqual([
      ...VEHICLE_CLASSES,
      "shared",
      "junctions",
      "vehicle-mix",
      "rules",
    ]);
  });

  it("has every assumption the engine uses at junctions, as the engine has it, each marked as our choice", () => {
    const names = Object.keys(JUNCTION_ASSUMPTIONS) as (keyof typeof JUNCTION_ASSUMPTIONS)[];
    // Turn speed, crossing margin, what counts as queued (two values) and keep-clear room.
    expect(names).toHaveLength(5);
    for (const name of names) {
      expect(listed(`junction.${name}`).value).toBe(JUNCTION_ASSUMPTIONS[name].value);
      expect(listed(`junction.${name}`).state).toBe("our-choice");
    }
    for (const rule of ["rule.signal", "rule.let-in-order", "rule.crossing-paths", "rule.keep-clear"]) {
      expect(listed(rule).state).toBe("our-choice");
    }
  });

  it("marks as our choice what no source gives: side clearances, sideways speed caps, the same-space rule, the limit on advancing", () => {
    for (const vehicleClass of VEHICLE_CLASSES) {
      expect(listed(`${vehicleClass}.sideClearanceM`).state).toBe("our-choice");
      expect(listed(`${vehicleClass}.maxSidewaysSpeedMps`).state).toBe("our-choice");
    }
    expect(listed("rule.same-space").state).toBe("our-choice");
    expect(listed("rule.advance-limit").state).toBe("our-choice");
  });
});

describe("the list of what is not modelled", () => {
  it("names everything the spec lists as not modelled", () => {
    const text = NOT_MODELLED.map((item) => `${item.name} ${item.meaning}`.toLowerCase()).join("\n");
    for (const expected of [
      "forced entry",
      "adaptive signals",
      "roundabouts",
      "pedestrians",
      "wrong-side driving",
      "bus stops",
      "turn bans",
      "rerouting",
      "equilibrium routing",
      "induced demand",
      "emissions",
      "roadside activity",
    ]) {
      expect(text).toContain(expected);
    }
    for (const item of NOT_MODELLED) expect(item.meaning.length).toBeGreaterThan(20);
  });
});
