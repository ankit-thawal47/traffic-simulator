import { VEHICLE_CLASS_ASSUMPTIONS } from "@traffic-simulator/engine";
import { describe, expect, it } from "vitest";
import {
  SPEED_BANDS,
  UNKNOWN_VEHICLE_CLASS_COLOUR,
  legendFor,
  speedColour,
  vehicleClassColour,
  vehicleColour,
} from "./vehicle-colours";

/** The four vehicle classes of v1, as GLOSSARY.md names them. */
const V1_VEHICLE_CLASSES = ["two-wheeler", "car", "auto-rickshaw", "bus"];
const KMH = 1 / 3.6;

describe("colour by vehicle class", () => {
  it("gives each of the four v1 vehicle classes its own colour", () => {
    const colours = V1_VEHICLE_CLASSES.map(vehicleClassColour);

    expect(new Set(colours).size).toBe(4);
    expect(colours).not.toContain(UNKNOWN_VEHICLE_CLASS_COLOUR);
    for (const colour of colours) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("gives every vehicle class the engine has its own colour", () => {
    const colours = Object.keys(VEHICLE_CLASS_ASSUMPTIONS).map(vehicleClassColour);

    expect(new Set(colours).size).toBe(colours.length);
    expect(colours).not.toContain(UNKNOWN_VEHICLE_CLASS_COLOUR);
  });

  it("recognises a vehicle class however its name is spelled in code", () => {
    expect(vehicleClassColour("twoWheeler")).toBe(vehicleClassColour("two-wheeler"));
    expect(vehicleClassColour("two_wheeler")).toBe(vehicleClassColour("two-wheeler"));
    expect(vehicleClassColour("autoRickshaw")).toBe(vehicleClassColour("auto-rickshaw"));
  });

  it("still draws a vehicle class it has never heard of", () => {
    expect(vehicleClassColour("tractor")).toBe(UNKNOWN_VEHICLE_CLASS_COLOUR);
  });
});

describe("colour by speed", () => {
  it("gives a stopped or crawling vehicle the queue colour, and a moving one another", () => {
    const queued = speedColour(0);

    expect(speedColour(4 * KMH)).toBe(queued);
    expect(speedColour(10 * KMH)).not.toBe(queued);
    expect(speedColour(50 * KMH)).not.toBe(queued);
  });

  it("uses a few clearly separate colours, in bands of rising speed", () => {
    expect(SPEED_BANDS.length).toBeGreaterThanOrEqual(3);
    expect(SPEED_BANDS.length).toBeLessThanOrEqual(6);
    expect(SPEED_BANDS[0]!.fromKmh).toBe(0);
    for (let i = 1; i < SPEED_BANDS.length; i++) {
      expect(SPEED_BANDS[i]!.fromKmh).toBeGreaterThan(SPEED_BANDS[i - 1]!.fromKmh);
    }
    expect(new Set(SPEED_BANDS.map((band) => band.colour)).size).toBe(SPEED_BANDS.length);
  });

  it("puts each speed in the band it falls in", () => {
    for (const [index, band] of SPEED_BANDS.entries()) {
      const next = SPEED_BANDS[index + 1];
      expect(speedColour(band.fromKmh * KMH + 0.01)).toBe(band.colour);
      if (next) expect(speedColour(next.fromKmh * KMH - 0.01)).toBe(band.colour);
    }
    expect(speedColour(200 * KMH)).toBe(SPEED_BANDS.at(-1)!.colour);
  });

  it("treats a speed that is not a sensible number as stopped", () => {
    expect(speedColour(-1)).toBe(speedColour(0));
    expect(speedColour(Number.NaN)).toBe(speedColour(0));
  });
});

describe("the colour of a vehicle, by whichever the planner chose", () => {
  const stoppedCar = { vehicleClass: "car", speedMps: 0 };
  const movingCar = { vehicleClass: "car", speedMps: 14 };
  const stoppedBus = { vehicleClass: "bus", speedMps: 0 };

  it("by vehicle class, speed makes no difference", () => {
    expect(vehicleColour("vehicle-class", stoppedCar)).toBe(vehicleColour("vehicle-class", movingCar));
    expect(vehicleColour("vehicle-class", stoppedCar)).not.toBe(vehicleColour("vehicle-class", stoppedBus));
  });

  it("by speed, vehicle class makes no difference", () => {
    expect(vehicleColour("speed", stoppedCar)).toBe(vehicleColour("speed", stoppedBus));
    expect(vehicleColour("speed", stoppedCar)).not.toBe(vehicleColour("speed", movingCar));
  });
});

describe("the legend", () => {
  it("by vehicle class, names each vehicle class beside its colour", () => {
    expect(legendFor("vehicle-class", V1_VEHICLE_CLASSES)).toEqual([
      { label: "Two-wheeler", colour: vehicleClassColour("two-wheeler") },
      { label: "Car", colour: vehicleClassColour("car") },
      { label: "Auto-rickshaw", colour: vehicleClassColour("auto-rickshaw") },
      { label: "Bus", colour: vehicleClassColour("bus") },
    ]);
  });

  it("by speed, lists the bands from slowest to fastest in km/h, the slowest named as a queue", () => {
    const legend = legendFor("speed", V1_VEHICLE_CLASSES);

    expect(legend.map((entry) => entry.colour)).toEqual(SPEED_BANDS.map((band) => band.colour));
    expect(legend[0]!.label).toMatch(/queue/i);
    for (const entry of legend) expect(entry.label).toMatch(/km\/h/);
  });
});
