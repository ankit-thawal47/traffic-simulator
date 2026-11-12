/**
 * How a planner picks an area to import: a preset Indian area, or a centre
 * (latitude and longitude, as copied from any map) and a size. No map is
 * drawn in the page: a map needs a mapping library and map tiles from a
 * server, and a planner can already find any place's coordinates in the map
 * they use every day. A link shows the box on openstreetmap.org before
 * importing.
 */
import type { AreaBounds, Outcome } from "@traffic-simulator/corridor";

export interface AreaPreset {
  id: string;
  name: string;
  bounds: AreaBounds;
}

/** Areas of different kinds that import; each has a committed extract and is run for an hour in the corridor package's tests. */
export const AREA_PRESETS: readonly AreaPreset[] = [
  {
    id: "koramangala",
    name: "Bengaluru, Koramangala: signal junctions in a city grid",
    bounds: { south: 12.9335, west: 77.6225, north: 12.94, east: 77.6305 },
  },
  {
    id: "kolkata-ajc-bose",
    name: "Kolkata, AJC Bose Road flyover over Camac Street",
    bounds: { south: 22.54, west: 88.35, north: 22.547, east: 88.358 },
  },
  {
    id: "mumbai-eeh-vikhroli",
    name: "Mumbai, Eastern Express Highway at Vikhroli",
    bounds: { south: 19.104, west: 72.923, north: 19.111, east: 72.931 },
  },
  {
    id: "gemini",
    name: "Chennai, Anna Salai at Nungambakkam High Road",
    bounds: { south: 13.056, west: 80.2475, north: 13.063, east: 80.2555 },
  },
];

/** The sizes offered for an area given by its centre, in metres on each side. */
export const AREA_SIZES_M = [500, 750, 1000, 1500, 2000] as const;

/** A latitude and longitude as typed: "12.9352, 77.6245", "12.9352 77.6245" or "12.9352° N, 77.6245° E". */
export function parseCentre(text: string): Outcome<{ lat: number; lon: number }> {
  const numbers = text.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const usage = "Give the centre as a latitude and longitude in degrees, such as 12.9352, 77.6245.";
  if (numbers.length !== 2) return { ok: false, message: usage };
  const [lat, lon] = numbers.map(Number) as [number, number];
  if (Math.abs(lat) > 85) return { ok: false, message: `The latitude must be between -85 and 85 degrees. ${usage}` };
  if (Math.abs(lon) > 180) return { ok: false, message: `The longitude must be between -180 and 180 degrees. ${usage}` };
  return { ok: true, value: { lat, lon } };
}

/** The box on openstreetmap.org, to see what will be imported. */
export function osmViewUrl(bounds: AreaBounds): string {
  return `https://www.openstreetmap.org/?minlon=${bounds.west}&minlat=${bounds.south}&maxlon=${bounds.east}&maxlat=${bounds.north}&box=yes`;
}
