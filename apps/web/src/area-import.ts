/**
 * Importing an area in the browser: one request to the public Overpass
 * server, then the corridor package's importer, which is pure logic. The
 * browser's own fetch is used as it is; nothing about the planner or the
 * product is added to the request.
 */
import { fetchArea, importArea, type AreaBounds, type ImportedArea, type Outcome } from "@traffic-simulator/corridor";

export async function importAreaFromOsm(bounds: AreaBounds, name?: string): Promise<Outcome<ImportedArea>> {
  const fetched = await fetchArea(bounds, (url, init) => fetch(url, init as RequestInit));
  if (!fetched.ok) return fetched;
  // Give the page a moment to show that the data has arrived before the import's own work.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return importArea(fetched.value, name === undefined ? {} : { name });
}
