import { whyRefused } from "@traffic-simulator/scenario";
import { describe, expect, it } from "vitest";
import { corridorNotice, corridorFiles } from "./corridor-notice";
import { EXAMPLES } from "./examples";

describe("the Hebbal corridor in the app", () => {
  it("is offered beside the examples and opens ready to run", () => {
    const example = EXAMPLES.find((one) => one.id === "hebbal-city-bound");
    expect(example?.scenario.corridorId).toBe("hebbal-city-bound");
    expect(example!.scenario.name).toBe("Hebbal, city-bound (Bengaluru)");
    expect(whyRefused(example!.scenario)).toBeUndefined();
  });

  it("has a notice with the OpenStreetMap attribution and the licence of its data", () => {
    expect(corridorNotice(undefined)).toBeUndefined();
    expect(corridorNotice("hebbal-city-bound")).toEqual({
      attribution: "© OpenStreetMap contributors",
      copyrightUrl: "https://www.openstreetmap.org/copyright",
      licenceName: "Open Database Licence (ODbL) 1.0",
      licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
      roadNames: expect.objectContaining({ "airport-ground-in": "Ground road from the airport" }),
    });
  });

  it("offers the corridor data with the import script that makes it", async () => {
    const files = await corridorFiles("hebbal-city-bound");
    const names = files.map((file) => file.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "corridor.json",
        "corrections.json",
        "demand.json",
        "osm-extract.json",
        "SOURCES.md",
        "import-corridor.ts",
        "whole-network.ts",
        "prepared-corridor.ts",
        "types.ts",
        "build-corridor.ts",
      ]),
    );
    const corridor = files.find((file) => file.name === "corridor.json")!;
    expect(JSON.parse(corridor.text).id).toBe("hebbal-city-bound");
  });
});
