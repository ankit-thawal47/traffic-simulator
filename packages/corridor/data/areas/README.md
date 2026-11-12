# Imported areas: committed extracts and their hour-long runs

Each folder holds `osm-extract.json`: the OpenStreetMap data of one box, fetched with the same request the web app makes (`pnpm --filter @traffic-simulator/corridor fetch-area <name> <south> <west> <north> <east>`, one request to the public Overpass API, a generic client name and nothing else). The file carries its bounds, fetch date and the OpenStreetMap data date.

**Data © OpenStreetMap contributors, under the Open Database Licence (ODbL) 1.0, https://www.openstreetmap.org/copyright.** Every extract carries the same attribution and licence in its `attribution` and `licence` fields.

Nothing here is checked by hand: the importer (`src/area/import-area.ts`) makes the network by the rules in `src/area/guess-rules.ts`, the same way the web app does, and the network is not committed (it is made again from the extract).

## The areas

| Area | Kind | Bounds (S, W, N, E) |
|---|---|---|
| `koramangala` | Bengaluru, Koramangala: signal junctions in a city grid (Sony World junction, 80 Feet Road) | 12.9335, 77.6225, 12.94, 77.6305 |
| `kolkata-ajc-bose` | Kolkata, the AJC Bose Road flyover, raised over the streets with signal junctions beneath | 22.54, 88.35, 22.547, 88.358 |
| `mumbai-eeh-vikhroli` | Mumbai, the Eastern Express Highway at Vikhroli, with its slip roads and the road beside it | 19.104, 72.923, 19.111, 72.931 |
| `gemini` | Chennai, Anna Salai at Nungambakkam High Road: a dual carriageway arterial | 13.056, 80.2475, 13.063, 80.2555 |
| `gurugram-nh48` | Gurugram, NH 48: **refused**, a road passes under another in an underpass, which the importer cannot express | 28.495, 77.087, 28.502, 77.095 |

A part of the Hebbal corridor's extract (13.03 to 13.045 N, 77.585 to 77.595 E), a flyover interchange, is imported as well in `test/areas.test.ts`.

## A simulated hour at the guessed demand

`pnpm --filter @traffic-simulator/corridor run-area <name>`: mixed traffic, seed 1, 3,600 s, the guessed demand (150 vehicles per hour per lane of each road entering), then the same run again with the engine's consistency checks. Run on 2026-11-12.

| Area | Roads | Junctions (signal, priority) | Raised roads | Demand (veh/h) | Entered | Through | Stuck vehicles | Standing 300 s or more | Longest stand | Consistency violations |
|---|---|---|---|---|---|---|---|---|---|---|
| koramangala | 21 | 3, 2 | 0 | 2,100 | 2,048 | 1,984 | 0 | 0 | 62 s | 0 |
| kolkata-ajc-bose | 26 | 3, 2 | 2 | 2,850 | 2,797 | 2,720 | 0 | 0 | 89 s | 0 |
| mumbai-eeh-vikhroli | 14 | 2, 1 | 0 | 2,550 | 2,499 | 2,490 | 0 | 0 | 41 s | 0 |
| gemini | 7 | 1, 0 | 0 | 1,500 | 1,457 | 1,444 | 0 | 0 | 0 s | 0 |

The guessed demand is light: no approach fills and nothing waits to enter at the end. These are runs of guessed networks, not estimates of the places.

## What the importer leaves out, and why

Every area loses some roads, each listed with its reason in the import's adjustments (and on screen): short pieces of road between nodes OpenStreetMap draws a few metres apart (too short to drive between two junctions), slip roads too short to lie beside the road they leave, places where one road divides into several across more than one node, a turn the engine finds too tight for a bus, and roads that would overlap another on the same level as OpenStreetMap draws them. Their traffic uses the other roads. In Koramangala 4 roads are left out, in Kolkata 2, on the Eastern Express Highway 7, on Anna Salai 5.

## What real data needed, beyond the Hebbal corridor's rules

Found by importing these areas, each now a rule of the importer:

- Overpass lists a signal node twice, the second time without its tags: the tags are kept.
- A bridge drawn as several ways is raised as a whole, not only the way that passes over the road.
- A flyover cut by the edge of the area is at its deck height there (`raisedWhereCut` in the corrections), not on the ground.
- Roads drawn alongside closer than their widths are moved apart with a metre between their edges, on any level (ramps rise beside roads), unless they cross.
- Roads that would still overlap on the same level are found from the network, and the lesser one-way road is left out.
- Where roads divide or join too sharply to lie side by side, the place is made a junction.
- A slip road that leaves a junction and comes back to it is part of the junction.
- A turn whose road beyond starts beside or behind the road arriving (a junction drawn as several nodes) is not made.
- A junction where two approaches come from the same direction is signalled, one direction at a time: the engine's give-way judges crossings at an angle, not merging at a shallow one.
