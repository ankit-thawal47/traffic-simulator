import { describe, expect, it } from "vitest";
import {
  BENGALURU_VEHICLE_MIX,
  JUNCTION_ASSUMPTIONS,
  listAssumptions,
  NOT_MODELLED,
  ROUTE_CHOICE_ASSUMPTIONS,
  SIDEWAYS_ASSUMPTIONS,
  STEP_SECONDS,
  STUCK_VEHICLE_ASSUMPTIONS,
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

  it("groups them by vehicle class, then those shared, those for junctions, those for route choice, those for stuck vehicles, the vehicle mix, then the rules", () => {
    expect(listAssumptions().map((group) => group.id)).toEqual([
      ...VEHICLE_CLASSES,
      "shared",
      "junctions",
      "priority-junctions",
      "route-choice",
      "stuck-vehicles",
      "vehicle-mix",
      "rules",
    ]);
  });

  it("has every assumption behind the choice between a flyover and the junction beneath, each marked as our choice with its reason", () => {
    const names = Object.keys(ROUTE_CHOICE_ASSUMPTIONS) as (keyof typeof ROUTE_CHOICE_ASSUMPTIONS)[];
    // How strongly the faster route is preferred, the smallest share, and how long a travel time is measured over.
    expect(names).toHaveLength(3);
    for (const name of names) {
      expect(listed(`routeChoice.${name}`).value).toBe(ROUTE_CHOICE_ASSUMPTIONS[name].value);
      expect(listed(`routeChoice.${name}`).state).toBe("our-choice");
      expect(listed(`routeChoice.${name}`).source.length).toBeGreaterThan(80);
    }
    for (const rule of ["rule.route-choice", "rule.diverge-and-merge", "rule.levels", "rule.sorting", "rule.blocked-strip"]) {
      expect(listed(rule).state).toBe("our-choice");
    }
  });

  it("has an accepted gap at a priority junction for every vehicle class, smallest for two-wheelers, with its source", () => {
    // Kota, Pallela and Lalam (2025), Table 6, mean of the five intersections: 3.46, 3.74 and 4.62 s.
    expect(listed("priority.two-wheeler.acceptedGapS").value).toBe(3.5);
    expect(listed("priority.auto-rickshaw.acceptedGapS").value).toBe(3.7);
    expect(listed("priority.car.acceptedGapS").value).toBe(4.6);
    for (const vehicleClass of ["two-wheeler", "auto-rickshaw", "car"]) {
      expect(listed(`priority.${vehicleClass}.acceptedGapS`).state).toBe("confirmed");
    }
    // The paper has no bus class.
    expect(listed("priority.bus.acceptedGapS").state).toBe("our-choice");
    expect(listed("priority.bus.acceptedGapS").value).toBeGreaterThan(4.6);
    expect(listed("rule.priority-junction").state).toBe("our-choice");
  });

  it("has how slow and for how long a vehicle stands before it is a stuck vehicle, each marked as our choice with its reason", () => {
    expect(listed("stuck.standingBelowMps").value).toBe(0.1);
    expect(listed("stuck.stuckAfterS").value).toBe(300);
    for (const name of Object.keys(STUCK_VEHICLE_ASSUMPTIONS)) {
      expect(listed(`stuck.${name}`).state).toBe("our-choice");
      expect(listed(`stuck.${name}`).source.length).toBeGreaterThan(80);
    }
    expect(listed("rule.stuck-vehicles").state).toBe("our-choice");
  });

  it("has every assumption the engine uses at junctions, as the engine has it, each marked as our choice", () => {
    const names = Object.keys(JUNCTION_ASSUMPTIONS) as (keyof typeof JUNCTION_ASSUMPTIONS)[];
    // Turn speed, crossing margin, what counts as queued (two values), keep-clear room,
    // and sorting for the way on (what a shift towards its strips is worth, and where a vehicle waits).
    expect(names).toHaveLength(7);
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

  it("names rerouting beyond the flyover choice, and says what a closed road does to traffic that used it", () => {
    const rerouting = NOT_MODELLED.find((item) => item.name === "Rerouting beyond the flyover choice");

    expect(rerouting?.meaning).toContain("flyover and the junction beneath it");
    expect(rerouting?.meaning).toContain("closed");
  });

  it("names induced demand, and points to scaling all demand as the way to ask the question (ADR 0006)", () => {
    const induced = NOT_MODELLED.find((item) => item.name === "Induced demand");

    expect(induced?.meaning).toContain("does not attract new trips");
    expect(induced?.meaning).toContain("scale all demand");
  });
});
