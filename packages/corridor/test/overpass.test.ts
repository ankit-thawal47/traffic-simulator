import { describe, expect, it } from "vitest";
import { AREA_LIMITS, areaAround, checkArea, fetchArea, overpassRequest } from "../src/index";

const jayanagar = { south: 12.925, west: 77.58, north: 12.931, east: 77.587 };

describe("the area a planner picks", () => {
  it("is taken when it is between a few hundred metres and about 2 km across", () => {
    expect(checkArea(jayanagar)).toEqual({ ok: true, value: jayanagar });
  });

  it("is refused, with the reason, when it is larger than the limit", () => {
    const outcome = checkArea({ south: 12.9, west: 77.55, north: 12.95, east: 77.6 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toMatch(/5\.6 km north to south.*the most is 2\.5 km/);
  });

  it("is refused when its corners are the wrong way round or not on the earth", () => {
    expect(checkArea({ ...jayanagar, north: 12.92 }).ok).toBe(false);
    expect(checkArea({ south: 95, west: 0, north: 96, east: 0.01 }).ok).toBe(false);
    expect(checkArea({ south: Number.NaN, west: 0, north: 0.001, east: 0.01 }).ok).toBe(false);
  });

  it("can be given as a centre and a size, as a planner copies a point from a map", () => {
    const area = areaAround({ lat: 12.928, lon: 77.5835 }, 1000);
    expect(area.north - area.south).toBeCloseTo(1000 / 111_320, 5);
    expect(checkArea(area).ok).toBe(true);
    expect(AREA_LIMITS.largestSideM).toBe(2500);
  });
});

describe("the request to the Overpass API", () => {
  it("asks once for the major roads and signal nodes in the box, with a timeout, and nothing about who asks", () => {
    const request = overpassRequest(jayanagar);
    expect(request.url).toBe("https://overpass-api.de/api/interpreter");
    expect(request.body).toContain(encodeURIComponent("[timeout:25]"));
    expect(decodeURIComponent(request.body)).toContain("(12.925,77.58,12.931,77.587)");
    expect(decodeURIComponent(request.body)).toContain('node["highway"="traffic_signals"]');
    expect(JSON.stringify(request.headers)).not.toMatch(/traffic-simulator|ankit|vercel/i);
  });

  it("gives the extract, with the attribution, when the server answers", async () => {
    const answered = await fetchArea(jayanagar, async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ osm3s: { timestamp_osm_base: "2026-11-12T00:00:00Z" }, elements: [] }),
    }));
    expect(answered).toMatchObject({
      ok: true,
      value: { elements: [], attribution: "© OpenStreetMap contributors", osmDataTimestamp: "2026-11-12T00:00:00Z" },
    });
  });

  it("says plainly when the server is busy or refuses, and when it cannot be reached", async () => {
    const busy = await fetchArea(jayanagar, async () => ({ ok: false, status: 429, text: async () => "" }));
    expect(busy).toMatchObject({ ok: false });
    if (!busy.ok) expect(busy.message).toMatch(/busy.*try again in a minute/i);
    const timedOut = await fetchArea(jayanagar, async () => ({ ok: false, status: 504, text: async () => "" }));
    const gateway = await fetchArea(jayanagar, async () => ({ ok: false, status: 502, text: async () => "" }));
    if (!gateway.ok) expect(gateway.message).toMatch(/busy/i);
    if (!timedOut.ok) expect(timedOut.message).toMatch(/busy/i);
    const unreachable = await fetchArea(jayanagar, async () => {
      throw new Error("offline");
    });
    if (!unreachable.ok) expect(unreachable.message).toMatch(/could not be reached/i);
    const damaged = await fetchArea(jayanagar, async () => ({ ok: true, status: 200, text: async () => "<html>" }));
    if (!damaged.ok) expect(damaged.message).toMatch(/not understood/i);
  });

  it("does not ask at all for an area that is refused", async () => {
    let asked = 0;
    const outcome = await fetchArea({ south: 12, west: 77, north: 13, east: 78 }, async () => {
      asked++;
      throw new Error("should not be asked");
    });
    expect(outcome.ok).toBe(false);
    expect(asked).toBe(0);
  });
});
