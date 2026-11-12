import { describe, expect, it } from "vitest";
import { checkArea } from "@traffic-simulator/corridor";
import { AREA_PRESETS, osmViewUrl, parseCentre } from "./area-picking";

describe("picking an area to import", () => {
  it("reads a centre as a planner copies it from a map", () => {
    expect(parseCentre("12.9352, 77.6245")).toEqual({ ok: true, value: { lat: 12.9352, lon: 77.6245 } });
    expect(parseCentre(" 12.9352 77.6245 ")).toEqual({ ok: true, value: { lat: 12.9352, lon: 77.6245 } });
    expect(parseCentre("12.9352° N, 77.6245° E")).toEqual({ ok: true, value: { lat: 12.9352, lon: 77.6245 } });
  });

  it("says what is wrong with a centre it cannot read", () => {
    expect(parseCentre("Koramangala")).toEqual({ ok: false, message: expect.stringMatching(/latitude and longitude/) });
    expect(parseCentre("120, 77")).toEqual({ ok: false, message: expect.stringMatching(/latitude/) });
  });

  it("offers presets of Indian areas, each small enough to import", () => {
    expect(AREA_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const preset of AREA_PRESETS) expect(checkArea(preset.bounds).ok).toBe(true);
  });

  it("links to the area on openstreetmap.org, to see what will be imported", () => {
    expect(osmViewUrl({ south: 12.93, west: 77.62, north: 12.94, east: 77.63 })).toBe(
      "https://www.openstreetmap.org/?minlon=77.62&minlat=12.93&maxlon=77.63&maxlat=12.94&box=yes",
    );
  });
});
