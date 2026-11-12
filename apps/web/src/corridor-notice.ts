/**
 * What the page must say and offer wherever a prepared corridor is shown.
 *
 * A corridor's network is a database derived from OpenStreetMap, which is
 * under the Open Database Licence (ODbL) 1.0. As the licence summary at
 * opendatacommons.org puts it (read 2026-11-12): attribute any public use of
 * the database or works produced from it, and make clear to others the
 * licence of the database; offer an adapted database that is used publicly
 * under the ODbL (share-alike); and if it is redistributed with technical
 * restrictions, also redistribute it without them (keep open). So the page
 * shows "© OpenStreetMap contributors" with a link to OpenStreetMap's
 * copyright page while the corridor is on screen, names the licence, and
 * offers the corridor data file with the corrections and the import script
 * that make it, as plain files with no restriction.
 */
import { corridorById } from "@traffic-simulator/scenario";

export interface CorridorNotice {
  attribution: string;
  copyrightUrl: string;
  licenceName: string;
  licenceUrl: string;
  /** A short name for each road of the corridor's network, for results. */
  roadNames: Readonly<Record<string, string>>;
}

/** The notice for the corridor a scenario names; undefined for a scenario that names none. */
export function corridorNotice(corridorId: string | undefined): CorridorNotice | undefined {
  const corridor = corridorId === undefined ? undefined : corridorById(corridorId);
  if (!corridor) return undefined;
  return {
    attribution: corridor.attribution,
    copyrightUrl: "https://www.openstreetmap.org/copyright",
    licenceName: "Open Database Licence (ODbL) 1.0",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    roadNames: corridor.roadNames,
  };
}

export interface CorridorFile {
  name: string;
  /** What the file is, in a few words. */
  about: string;
  text: string;
}

/** The corridor's data files and the import script, loaded only when asked for (they are large). */
export async function corridorFiles(corridorId: string): Promise<CorridorFile[]> {
  if (corridorId !== "hebbal-city-bound") return [];
  const { HEBBAL_FILES } = await import("./corridor-files");
  return HEBBAL_FILES;
}
