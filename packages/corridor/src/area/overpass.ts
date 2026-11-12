/**
 * Asking OpenStreetMap for the roads of an area, through the public Overpass
 * API, from the browser (ADR 0001: no backend). Pure apart from the one fetch,
 * which is handed in, so the same code runs in a browser and from the command
 * line.
 *
 * The Overpass API's usage policy asks for modest use: one request per
 * import, a small area, a timeout, and backing off when the server says it is
 * busy. The request carries the query only; a browser adds its own client
 * identification, and nothing about the planner or the product is sent.
 */
import type { OsmExtract } from "../types";

/** The outcome of something that can fail with a message meant for the planner. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

/** An area: a box between two latitudes and two longitudes, in degrees. */
export interface AreaBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const AREA_LIMITS = {
  /** Longest side of the box, in metres. About 2 km of roads is what the browser runs for an hour in reasonable time. */
  largestSideM: 2500,
  /** Shortest side, in metres: less than this holds no junction with room for its approaches. */
  smallestSideM: 150,
  /** How long the server is asked to spend on the query, in seconds. */
  timeoutS: 25,
  /** How long the browser waits for the answer, in seconds: the query's time and the server's queue. */
  waitS: 60,
} as const;

export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
/** The road classes imported: the main roads. Residential streets and service roads are left out. */
export const IMPORTED_HIGHWAYS = "^(motorway|trunk|primary|secondary|tertiary)(_link)?$";

const METRES_PER_DEGREE = 111_320;
const km = (metres: number): string => `${Math.round(metres / 100) / 10} km`;

/** Metres north to south and east to west across the box. */
export function areaSizeM(bounds: AreaBounds): { northSouthM: number; eastWestM: number } {
  const midLat = (bounds.north + bounds.south) / 2;
  return {
    northSouthM: (bounds.north - bounds.south) * METRES_PER_DEGREE,
    eastWestM: (bounds.east - bounds.west) * METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180),
  };
}

/** The box of this size (metres on each side) around a point. */
export function areaAround(centre: { lat: number; lon: number }, sizeM: number): AreaBounds {
  const halfLat = sizeM / 2 / METRES_PER_DEGREE;
  const halfLon = sizeM / 2 / (METRES_PER_DEGREE * Math.cos((centre.lat * Math.PI) / 180));
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return { south: round(centre.lat - halfLat), west: round(centre.lon - halfLon), north: round(centre.lat + halfLat), east: round(centre.lon + halfLon) };
}

/** The area, if it can be imported; otherwise why not. */
export function checkArea(bounds: AreaBounds): Outcome<AreaBounds> {
  const { south, west, north, east } = bounds;
  const cannot = "This area cannot be imported:";
  if (![south, west, north, east].every((value) => typeof value === "number" && Number.isFinite(value))) {
    return { ok: false, message: `${cannot} its corners are not all numbers.` };
  }
  if (south < -85 || north > 85 || west < -180 || east > 180) {
    return { ok: false, message: `${cannot} latitudes must be between -85 and 85, and longitudes between -180 and 180.` };
  }
  if (north <= south || east <= west) {
    return { ok: false, message: `${cannot} its north edge must be north of its south edge, and its east edge east of its west edge.` };
  }
  const { northSouthM, eastWestM } = areaSizeM(bounds);
  const largest = AREA_LIMITS.largestSideM;
  if (northSouthM > largest || eastWestM > largest) {
    return {
      ok: false,
      message:
        `${cannot} it is ${km(northSouthM)} north to south and ${km(eastWestM)} east to west; the most is ${km(largest)} each way. ` +
        "A larger area would ask too much of the public OpenStreetMap server and of this browser. Pick a smaller area.",
    };
  }
  const smallest = AREA_LIMITS.smallestSideM;
  if (northSouthM < smallest || eastWestM < smallest) {
    return { ok: false, message: `${cannot} it is less than ${smallest} m across, too small to hold a junction and its approaches.` };
  }
  return { ok: true, value: bounds };
}

/** The Overpass query for an area: the main roads in the box, the signal nodes, and the nodes of those roads. */
export function overpassQuery(bounds: AreaBounds): string {
  const box = `(${bounds.south},${bounds.west},${bounds.north},${bounds.east})`;
  return (
    `[out:json][timeout:${AREA_LIMITS.timeoutS}];` +
    `(way["highway"~"${IMPORTED_HIGHWAYS}"]${box};node["highway"="traffic_signals"]${box};);` +
    "out body;>;out skel qt;"
  );
}

export interface OverpassRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export function overpassRequest(bounds: AreaBounds): OverpassRequest {
  return {
    url: OVERPASS_ENDPOINT,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(overpassQuery(bounds))}`,
  };
}

/** The OpenStreetMap data for an area, with where and when it came from. */
export interface AreaExtract extends OsmExtract {
  source: string;
  attribution: string;
  licence: string;
  bounds: AreaBounds;
  fetchedAt: string;
  osmDataTimestamp: string | null;
}

/** The part of fetch() used: the browser's and Node's both fit. */
export type Fetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: unknown },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const OSM_LICENCE = "Open Database Licence (ODbL) 1.0, https://www.openstreetmap.org/copyright";

/**
 * Fetch an area's OpenStreetMap data: one request, never repeated by itself.
 * An area that is refused is never asked for.
 */
export async function fetchArea(bounds: AreaBounds, fetch: Fetch, now: () => Date = () => new Date()): Promise<Outcome<AreaExtract>> {
  const checked = checkArea(bounds);
  if (!checked.ok) return checked;
  const request = overpassRequest(bounds);
  const cannot = "OpenStreetMap could not be asked for this area:";
  let response: Awaited<ReturnType<Fetch>>;
  let text: string;
  try {
    response = await fetch(request.url, { method: "POST", headers: request.headers, body: request.body, ...timeoutSignal() });
    text = await response.text();
  } catch {
    return {
      ok: false,
      message: `${cannot} the server (${request.url}) could not be reached, or did not answer within ${AREA_LIMITS.waitS} s. Check the connection and try again.`,
    };
  }
  if ([429, 502, 503, 504].includes(response.status)) {
    return {
      ok: false,
      message:
        `${cannot} the public Overpass server is busy (it answered ${response.status}). It shares its time among everyone who uses it; ` +
        "try again in a minute or two.",
    };
  }
  if (!response.ok) return { ok: false, message: `${cannot} the server refused the request (it answered ${response.status}).` };
  let body: { elements?: unknown; osm3s?: { timestamp_osm_base?: unknown }; remark?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, message: `${cannot} its answer was not understood (it was not OpenStreetMap data).` };
  }
  if (!Array.isArray(body.elements)) return { ok: false, message: `${cannot} its answer was not understood (it held no elements).` };
  // The server says in a remark when it ran out of time or memory part-way: the data would be incomplete.
  if (typeof body.remark === "string" && /runtime error|timed out|out of memory/i.test(body.remark)) {
    return { ok: false, message: `${cannot} the server stopped part-way (${body.remark.slice(0, 120)}). Try a smaller area, or again later.` };
  }
  const timestamp = body.osm3s?.timestamp_osm_base;
  return {
    ok: true,
    value: {
      source: "OpenStreetMap via the Overpass API",
      attribution: OSM_ATTRIBUTION,
      licence: OSM_LICENCE,
      bounds,
      fetchedAt: now().toISOString(),
      osmDataTimestamp: typeof timestamp === "string" ? timestamp : null,
      elements: body.elements as OsmExtract["elements"],
    },
  };
}

/** A signal that gives up after the wait, where the runtime has one. */
function timeoutSignal(): { signal?: unknown } {
  const abort = (globalThis as { AbortSignal?: { timeout?: (ms: number) => unknown } }).AbortSignal;
  return typeof abort?.timeout === "function" ? { signal: abort.timeout(AREA_LIMITS.waitS * 1000) } : {};
}
