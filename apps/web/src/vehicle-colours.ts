/**
 * What colour each vehicle is drawn in. A planner colours vehicles either by
 * vehicle class or by speed. Colours are "#rrggbb" text, usable both by the
 * 3D view and by the legend on the page.
 */
export type ColourBy = "vehicle-class" | "speed";

export interface LegendEntry {
  label: string;
  colour: string;
}

/**
 * One colour for each vehicle class of v1, chosen to stay apart for people
 * with colour-blindness (the Okabe-Ito set) and to show against a dark road.
 * Keyed by the vehicle class's name with only its letters kept, so that
 * "two-wheeler", "twoWheeler" and "two_wheeler" are all the same vehicle class.
 */
const VEHICLE_CLASS_COLOURS: Record<string, string> = {
  twowheeler: "#f0e442",
  car: "#d55e00",
  autorickshaw: "#009e73",
  bus: "#56b4e9",
};

/** For a vehicle class this file has no colour for, so that it is still drawn. */
export const UNKNOWN_VEHICLE_CLASS_COLOUR = "#cc79a7";

function lettersOnly(vehicleClass: string): string {
  return vehicleClass.toLowerCase().replace(/[^a-z]/g, "");
}

export function vehicleClassColour(vehicleClass: string): string {
  return VEHICLE_CLASS_COLOURS[lettersOnly(vehicleClass)] ?? UNKNOWN_VEHICLE_CLASS_COLOUR;
}

/** A vehicle class's name as shown to the planner: "two-wheeler" becomes "Two-wheeler". */
export function vehicleClassLabel(vehicleClass: string): string {
  const words = vehicleClass.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Speed is shown in a few separate bands, not a smooth blend, so that a queue
 * reads as one block of one colour. The slowest band is a strong red against
 * the road; free-flowing traffic is a blue that recedes into it. The colours
 * run red, yellow, blue (ColorBrewer RdYlBu), which stays readable with
 * red-green colour-blindness.
 */
export const SPEED_BANDS: readonly { fromKmh: number; colour: string }[] = [
  { fromKmh: 0, colour: "#d7191c" },
  { fromKmh: 5, colour: "#fdae61" },
  { fromKmh: 15, colour: "#ffffbf" },
  { fromKmh: 30, colour: "#abd9e9" },
  { fromKmh: 45, colour: "#2c7bb6" },
];

export function speedColour(speedMps: number): string {
  const kmh = speedMps > 0 ? speedMps * 3.6 : 0;
  let colour = SPEED_BANDS[0]!.colour;
  for (const band of SPEED_BANDS) {
    if (kmh >= band.fromKmh) colour = band.colour;
  }
  return colour;
}

export function vehicleColour(colourBy: ColourBy, vehicle: { vehicleClass: string; speedMps: number }): string {
  return colourBy === "speed" ? speedColour(vehicle.speedMps) : vehicleClassColour(vehicle.vehicleClass);
}

/** What the colours on screen mean, for the vehicle classes the engine has. */
export function legendFor(colourBy: ColourBy, vehicleClasses: readonly string[]): LegendEntry[] {
  if (colourBy === "vehicle-class") {
    return vehicleClasses.map((vehicleClass) => ({
      label: vehicleClassLabel(vehicleClass),
      colour: vehicleClassColour(vehicleClass),
    }));
  }
  return SPEED_BANDS.map((band, index) => {
    const next = SPEED_BANDS[index + 1];
    if (index === 0) return { label: `Queued, under ${next?.fromKmh ?? 0} km/h`, colour: band.colour };
    if (!next) return { label: `${band.fromKmh} km/h and over`, colour: band.colour };
    return { label: `${band.fromKmh} to ${next.fromKmh} km/h`, colour: band.colour };
  });
}
