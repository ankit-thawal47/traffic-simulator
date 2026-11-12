/**
 * A change in plain words, for the list of changes that make up a proposal:
 * what it changes, from what the baseline has to what the proposal has.
 * Vocabulary follows GLOSSARY.md.
 */
import { VEHICLE_CLASSES, type VehicleClass, type VehicleMix } from "@traffic-simulator/engine";
import { greenTimesOf, lanesOf, type Change, type LostWidthReason, type Scenario } from "./scenario";

const VEHICLE_CLASS_PLURALS: Record<VehicleClass, string> = {
  "two-wheeler": "two-wheelers",
  car: "cars",
  "auto-rickshaw": "auto-rickshaws",
  bus: "buses",
};

const LOST_TO: Record<LostWidthReason, string> = {
  parking: "parking",
  hawkers: "hawkers",
  "stopped-vehicles": "stopped vehicles",
  other: "roadside activity",
};

/** At most two decimal places, and no trailing zeros: 1.2, 10.5, 7. */
function figure(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** A vehicle mix as whole percentages of its total, every vehicle class named. */
export function describeVehicleMix(vehicleMix: VehicleMix): string {
  const total = VEHICLE_CLASSES.reduce((sum, vehicleClass) => sum + (vehicleMix[vehicleClass] ?? 0), 0);
  return VEHICLE_CLASSES.map(
    (vehicleClass) =>
      `${VEHICLE_CLASS_PLURALS[vehicleClass]} ${total > 0 ? Math.round((100 * (vehicleMix[vehicleClass] ?? 0)) / total) : 0}%`,
  ).join(", ");
}

/** One change of a scenario, in plain words. `scenario` gives what the baseline has. */
export function describeChange(change: Change, scenario: Scenario): string {
  const road = (roadId: string) => scenario.network.roads.find((one) => one.id === roadId);
  switch (change.kind) {
    case "road-width":
      return `Road "${change.roadId}": width ${road(change.roadId)?.widthM ?? "?"} m → ${change.widthM} m`;
    case "road-lanes": {
      const today = road(change.roadId);
      return `Road "${change.roadId}": lanes ${today ? lanesOf(today) : "?"} → ${change.lanes}`;
    }
    case "lane-closure": {
      // The lanes the road has in the proposal before the closure: a lanes change comes first.
      const lanesChange = scenario.changes.find((other) => other.kind === "road-lanes" && other.roadId === change.roadId);
      const today = road(change.roadId);
      const lanes = lanesChange?.kind === "road-lanes" ? lanesChange.lanes : today ? lanesOf(today) : "?";
      return `Road "${change.roadId}": ${change.lanesClosed} of ${lanes} lanes closed`;
    }
    case "lost-width":
      return `Road "${change.roadId}": ${figure(change.widthM)} m of width lost to ${LOST_TO[change.reason] ?? "roadside activity"}`;
    case "road-closure":
      return `Road "${change.roadId}": closed`;
    case "flyover":
      return `Flyover road "${change.roadId}": ${change.built ? "built" : "removed"}`;
    case "signal-timing": {
      const today = greenTimesOf(scenario.network, change.junctionId);
      return `Signal junction "${change.junctionId}": green times ${today?.map(figure).join(", ") ?? "?"} s → ${change.greenS.map(figure).join(", ")} s`;
    }
    case "flow-rate": {
      const today = scenario.demand.flows.find(
        (flow) => flow.entryRoadId === change.entryRoadId && flow.exitRoadId === change.exitRoadId,
      );
      return `Demand from "${change.entryRoadId}" to "${change.exitRoadId}": ${today ? figure(today.vehiclesPerHour) : "?"} → ${figure(change.vehiclesPerHour)} vehicles per hour`;
    }
    case "vehicle-mix":
      return `Vehicle mix: ${describeVehicleMix(scenario.demand.vehicleMix ?? { car: 1 })} → ${describeVehicleMix(change.vehicleMix)}`;
    case "demand-scale": {
      const percent = Math.round((change.factor - 1) * 100);
      return `All demand: scaled by ${figure(change.factor)} (${percent < 0 ? "−" : "+"}${Math.abs(percent)}%)`;
    }
    case "lane-discipline": {
      const words = (on: boolean) => (on ? "on" : "off (mixed traffic)");
      return `Lane discipline: ${words(scenario.laneDiscipline)} → ${words(change.on)}`;
    }
  }
}
