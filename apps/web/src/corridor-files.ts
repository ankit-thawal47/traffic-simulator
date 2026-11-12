/**
 * The Hebbal corridor's data files and the import script that makes the
 * corridor file from them, as text, for the page to offer (ODbL share-alike
 * and keep open: see corridor-notice.ts). Loaded on its own, only when the
 * corridor is shown.
 */
import buildScript from "../../../packages/corridor/scripts/build-corridor.ts?raw";
import corridorJson from "../../../packages/corridor/data/hebbal/corridor.json?raw";
import correctionsJson from "../../../packages/corridor/data/hebbal/corrections.json?raw";
import demandJson from "../../../packages/corridor/data/hebbal/demand.json?raw";
import osmExtractJson from "../../../packages/corridor/data/hebbal/osm-extract.json?raw";
import sourcesMd from "../../../packages/corridor/data/hebbal/SOURCES.md?raw";
import importCorridor from "../../../packages/corridor/src/import-corridor.ts?raw";
import preparedCorridor from "../../../packages/corridor/src/prepared-corridor.ts?raw";
import types from "../../../packages/corridor/src/types.ts?raw";
import wholeNetwork from "../../../packages/corridor/src/whole-network.ts?raw";
import type { CorridorFile } from "./corridor-notice";

export const HEBBAL_FILES: CorridorFile[] = [
  { name: "corridor.json", about: "the prepared corridor: the network and its default demand (ODbL 1.0)", text: corridorJson },
  { name: "osm-extract.json", about: "the OpenStreetMap data it is made from (ODbL 1.0)", text: osmExtractJson },
  { name: "corrections.json", about: "lanes, widths, levels, junctions and every adjustment, checked by hand, with sources", text: correctionsJson },
  { name: "demand.json", about: "the published volumes, the vehicle mix and the assumptions, with sources", text: demandJson },
  { name: "SOURCES.md", about: "what is confirmed, assumed or not reached", text: sourcesMd },
  { name: "import-corridor.ts", about: "the importer", text: importCorridor },
  { name: "whole-network.ts", about: "the importer: the whole network and its adjustments", text: wholeNetwork },
  { name: "prepared-corridor.ts", about: "the importer: the corridor file and its demand", text: preparedCorridor },
  { name: "types.ts", about: "the importer's inputs and outputs", text: types },
  { name: "build-corridor.ts", about: "the script that writes corridor.json", text: buildScript },
];
