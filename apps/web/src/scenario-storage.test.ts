import { describe, expect, it } from "vitest";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import { importArea, type AreaBounds, type OsmElement } from "@traffic-simulator/corridor";
import { areaBaseline, createBaseline, withAreaRoad, withRoadLanes, withRoadWidth, type Scenario } from "@traffic-simulator/scenario";
import { createLinkAndFileStorage } from "./scenario-storage";

const today = createBaseline({
  name: "One road: today / tomorrow?",
  network: mixedTraffic.network as Scenario["network"],
  demand: mixedTraffic.demand,
  seed: 1,
});
const proposal = withRoadLanes(withRoadWidth(today, "main", 7), "main", 2);

/** The storage with a stand-in for the browser: a page address, and downloads kept in a list. */
function storageInAPage(pageAddress = "https://traffic-simulator.example/", osm: OsmElement[] | "busy" = []) {
  const downloads: { fileName: string; text: string }[] = [];
  const imports: AreaBounds[] = [];
  const storage = createLinkAndFileStorage({
    pageAddress: () => pageAddress,
    download: (fileName, text) => downloads.push({ fileName, text }),
    importArea: async (bounds) => {
      imports.push(bounds);
      return osm === "busy" ? { ok: false, message: "The server is busy." } : importArea({ bounds, elements: osm });
    },
  });
  return { storage, downloads, imports };
}

describe("the storage module: an imported area", () => {
  const bounds = { south: -0.003, west: -0.003, north: 0.003, east: 0.003 };
  const osm: OsmElement[] = [
    { type: "node", id: 1, lat: -0.004, lon: 0 },
    { type: "node", id: 2, lat: 0, lon: 0 },
    { type: "node", id: 3, lat: 0.004, lon: 0 },
    { type: "node", id: 5, lat: 0, lon: 0.004 },
    { type: "way", id: 100, nodes: [1, 2, 3], tags: { highway: "secondary" } },
    { type: "way", id: 200, nodes: [2, 5], tags: { highway: "tertiary" } },
  ];
  const imported = importArea({ bounds, elements: osm });
  if (!imported.ok) throw new Error(imported.message);
  const onArea = withAreaRoad(areaBaseline(imported.value), imported.value.network.roads[0]!.id, { lanes: 3 });

  it("opens a link by importing the area again, once, with the corrections as they were", async () => {
    const { storage, imports } = storageInAPage("https://traffic-simulator.example/", osm);
    const shared = await storage.shareLink(onArea);
    if (!shared.ok) throw new Error(shared.message);

    expect(await storage.openLink(shared.value)).toEqual({ ok: true, value: onArea });
    expect(imports).toEqual([bounds]);
  });

  it("says why a link cannot be opened when the area cannot be imported again", async () => {
    const { storage } = storageInAPage("https://traffic-simulator.example/", "busy");
    const shared = await storage.shareLink(onArea);
    if (!shared.ok) throw new Error(shared.message);

    expect(await storage.openLink(shared.value)).toEqual({
      ok: false,
      message: "This link cannot be opened: its area must be imported again from OpenStreetMap. The server is busy.",
    });
  });
});

describe("the storage module: sharing a scenario as a link", () => {
  it("gives a link to the page the planner is on, and opening that link gives the same scenario", async () => {
    const { storage } = storageInAPage("https://traffic-simulator.example/#scenario=an-older-one");

    const shared = await storage.shareLink(proposal);

    expect(shared.ok && shared.value.startsWith("https://traffic-simulator.example/#scenario=d.")).toBe(true);
    expect(await storage.openLink(shared.ok ? shared.value : "")).toEqual({ ok: true, value: proposal });
  });

  it("an address with no scenario in it opens nothing", async () => {
    expect(await storageInAPage().storage.openLink("https://traffic-simulator.example/")).toBeUndefined();
  });

  it("a damaged link gives a message", async () => {
    const opened = await storageInAPage().storage.openLink("https://traffic-simulator.example/#scenario=d.AAAA");

    expect(opened).toEqual({ ok: false, message: "This link cannot be opened. It is damaged or cut short." });
  });

  it("a scenario the engine would refuse is not shared, and the planner is told why", async () => {
    expect(await storageInAPage().storage.shareLink(withRoadWidth(today, "main", 2))).toEqual({
      ok: false,
      message: 'This scenario cannot be shared. The proposal cannot be run: Road "main" is too narrow for a car.',
    });
  });
});

describe("the storage module: saving a scenario to a file", () => {
  it("downloads one file named after the scenario, and opening that file gives the same scenario", async () => {
    const { storage, downloads } = storageInAPage();

    const saved = await storage.saveFile(proposal);

    expect(saved).toEqual({ ok: true, value: "one-road-today-tomorrow.scenario.json" });
    expect(downloads.map((download) => download.fileName)).toEqual(["one-road-today-tomorrow.scenario.json"]);
    expect(await storage.openFile(new Blob([downloads[0]!.text]))).toEqual({ ok: true, value: proposal });
  });

  it("a scenario with a name that leaves nothing for a file name still gets one", async () => {
    const { storage } = storageInAPage();

    expect(await storage.saveFile({ ...proposal, name: "ಹೆಬ್ಬಾಳ" })).toEqual({ ok: true, value: "scenario.scenario.json" });
  });

  it("a scenario the engine would refuse is not saved, and the planner is told why", async () => {
    const { storage, downloads } = storageInAPage();

    expect(await storage.saveFile(withRoadWidth(today, "main", 2))).toEqual({
      ok: false,
      message: 'This scenario cannot be saved. The proposal cannot be run: Road "main" is too narrow for a car.',
    });
    expect(downloads).toEqual([]);
  });

  it("a file that is not a scenario gives a message", async () => {
    expect(await storageInAPage().storage.openFile(new Blob(["%PDF-1.7 not a scenario"]))).toEqual({
      ok: false,
      message: "This file cannot be opened. It is not a scenario file, or it is damaged.",
    });
  });

  it("a file that cannot be read at all gives a message", async () => {
    const unreadable = { size: 10, text: () => Promise.reject(new Error("NotReadableError")) } as unknown as Blob;

    expect(await storageInAPage().storage.openFile(unreadable)).toEqual({
      ok: false,
      message: "This file cannot be opened. The browser could not read it.",
    });
  });

  it("a very large file is refused without being read", async () => {
    let wasRead = false;
    const huge = {
      size: 50_000_000,
      text: () => {
        wasRead = true;
        return Promise.resolve("");
      },
    } as unknown as Blob;

    expect(await storageInAPage().storage.openFile(huge)).toEqual({
      ok: false,
      message: "This file cannot be opened. It is too large to be a scenario file.",
    });
    expect(wasRead).toBe(false);
  });
});
