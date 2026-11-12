# Hebbal corridor, city-bound: extent, sources and what is confirmed

Corridor id: `hebbal-city-bound`. Checked on 2026-11-12.

A value is **confirmed** only where we opened the primary document or the OpenStreetMap data and found it there. **Assumed** values carry their reason. The per-road evidence is in `corrections.json`; the demand evidence is in `demand.json`. This file is the summary.

## Files

| File | What it is | How it is made |
|---|---|---|
| `osm-extract.json` | OpenStreetMap ways (motorway to tertiary, with links) and signal nodes in the box 13.0245 to 13.0482 N, 77.585 to 77.595 E. Fetched 2026-11-12T04:13Z; OpenStreetMap data as of 2026-11-12T04:12:30Z. | `node packages/corridor/scripts/fetch-osm.mjs hebbal` |
| `corrections.json` | Which ways make up each road, and lanes, usable width, level, direction and speed limit for each, with the source of every value; the junctions, their connections and the signal plan. | By hand |
| `demand.json` | Published volumes, the vehicle mix and how they are put on the corridor's roads, with sources. | By hand |
| `corridor.json` | The prepared corridor: every road (ground-level and raised), the junctions, the ground-level network in the engine's format and its demand. | `pnpm --filter @traffic-simulator/corridor build-corridor` |

A test fails if `corridor.json` is not what the importer makes of the other three, or if a tag in the extract differs from what was recorded when a road was checked.

## The extent

City-bound means southbound on Bellary Road (NH 44), from the airport side towards the city. About 2.4 km north to south, 23 roads, 7.0 km of carriageway (4.7 km on the ground, 2.4 km raised).

**Starts** at OpenStreetMap node 332955193 (13.0473 N, 77.5919 E), where the ground-level road to the junction leaves Bellary Road and the flyover approach begins.

**The flyover.** The city-bound deck: ways 377832186, 377832182, 842592053 (738 m), with its approach (377832181) and its landing on Bellary Road (1278555480).

**The junction beneath it.** Outer Ring Road x Bellary Road, the Bengaluru Traffic Police's "Hebbal Fly Over Junction". It has three approaches, each ending at a `highway=traffic_signals` node: from the airport side (road A in the police plan, node 2408586316), from Tumkur Road (B, node 430127696) and from K.R. Puram (C, node 335663834). There is no approach from the city side. No city-bound traffic from the airport passes through it: that traffic is on the flyover. City-bound traffic from Tumkur Road goes straight through the junction and then up a loop (ways 36987760, 377832176, 1460084785); city-bound traffic from K.R. Puram leaves the Outer Ring Road before the junction on a ramp (ways 1422977939, 1446941081, 1420425473). Both join the three-lane ramp (way 1422993566) that lands on Bellary Road about 350 m south of where the flyover lands.

**The next junction downstream.** Bellary Road's ground-level road x CBI Road, beneath the Ganga Nagar flyover (node 582566933, 13.0270 N, 77.5858 E), 1.4 km south of the flyover landing. It is the first place south of Hebbal where city-bound traffic meets crossing traffic. At the fork ahead of it (node 582566943) city-bound traffic either goes over on the Ganga Nagar flyover or down to this junction. Its control is **not confirmed**: OpenStreetMap has no signal node there, the police signal sheets on OpenCity do not include it, and the flyover deck hides it in the imagery.

**Ends** where the Ganga Nagar flyover lands (node 6856463623, 13.0255 N) and 200 m along each arm of the CBI Road junction.

**Left out, to keep it compact:** everything airport-bound; the loop from the airport side to the Outer Ring Road eastbound (way 30213110); the new ground-level slip from the airport side (way 1349699192) and the service-road slip from Tumkur Road towards the airport (way 30415179); the service road beside Bellary Road between the two junctions (way 238204954, 1.2 km); long approaches (the Outer Ring Road arms are cut to 300 m).

## What OpenStreetMap had

| Tag | All major roads in the first box fetched (13.024 to 13.048 N, 77.584 to 77.603 E; 43 km) | The 38 ways of the corridor (8.8 km) |
|---|---|---|
| `lanes` | 54% of length | 32 of 38 ways, 90% of length. Missing on the six ways at the CBI Road junction. |
| `width` | 1% of length | none |
| `layer` and `bridge` | 14% of length | 9 ways, all the raised ones, each with `bridge=yes` and `layer=1` |
| `maxspeed` | 40% of length | 29 of 38 ways, 82% of length |
| `oneway` | 77% of length | 37 ways `oneway=yes`; CBI Road (way 503306660) `oneway=no` |

So the research's "lanes on about half of road length, widths on about 1%" holds for the area, and the trunk roads of the corridor are much better tagged for lanes than the area as a whole. No way of the corridor has a width.

Level: the only way tagged `layer=2` near the junction (379862163) is on the airport-bound side and is outside the corridor. One 110 m way on Bellary Road south of the landing (377832185) is tagged as a bridge; it is taken as ground level (assumed; what it spans was not checked).

Imagery (Esri World Imagery, zoom 19, 0.29 m per pixel, viewed 2026-11-12; `scripts/view-imagery.py` fetches it for looking at, and it is not committed) shows the flyover, the loops and ramps where OpenStreetMap has them. It is good enough to see structures and to measure a carriageway to about 2 m. It is not good enough to count lane markings. Widths are therefore lanes x 3.5 m (assumed) except where the imagery gave a measurement (the approach from Tumkur Road, about 12 m; the ground-level road from the airport side, about 7 m; the flyover, both carriageways about 27 m together).

## State of every data item

| Item | State | Source |
|---|---|---|
| Road geometry | confirmed | OpenStreetMap extract |
| Lanes, 18 roads (all but the CBI Road junction) | confirmed (as tagged) | OpenStreetMap `lanes`; imagery agrees where it can be read |
| Lanes, 5 roads at the CBI Road junction | assumed | No tag; taken as 2 lanes (1 each way on CBI Road); not counted |
| Usable width, every road | assumed | No `width` tag anywhere. Lanes x 3.5 m; three roads compared with imagery |
| Level, every road | confirmed (as tagged), one assumed | OpenStreetMap `bridge` and `layer`; imagery shows the structures. Way 377832185 assumed ground |
| One-way direction | confirmed (as tagged) | OpenStreetMap `oneway` |
| Speed limit, 18 roads | confirmed (as tagged) | OpenStreetMap `maxspeed` (60 on trunk roads, 30 on ramps). No sign was checked |
| Speed limit, 5 roads | assumed | No tag; 40 or 60 km/h from neighbouring ways |
| Signal plan, Hebbal junction: phases and times | confirmed | Bengaluru Traffic Police sheet on OpenCity (below) |
| Signal plan: amber, all-red | assumed | Not on the sheet. 3 s amber inside each phase time, no all-red |
| Signal plan: green by approach | assumed | The format gives green to approaches, the sheet to movements (below) |
| Whether the plan still runs on site | not confirmed | The sheet dates from 2010 |
| CBI Road junction: control and plan | could not be reached | No source found |
| Peak-hour turning volumes | confirmed | RITES extract, page 8 (2019, PCU) |
| PCU to vehicles | assumed | 0.969 PCU per vehicle, from the IIT Bombay report's junction total |
| Which road each movement uses | assumed | Our reading of the map; the counts predate the ramp from K.R. Puram |
| Vehicle mix | assumed | RITES extract, page 26: a 2051 forecast input, not an observed mix |
| Split at the fork ahead of the Ganga Nagar flyover | could not be reached | Not published in anything read |
| Tunnel project report of September 2025 (38 MB) and its drawings | not opened | On OpenCity; the likeliest place for classified counts and lane widths |

## The signal plan

Bengaluru Traffic Police, "Signal Timings Data - Hebbal Fly Over and Kodigehalli Gate Junctions", one page (page 60 of the source book; the PDF was created in March 2010), OpenCity dataset "Bengaluru City Traffic Signal Data" (no licence stated on the dataset):
https://data.opencity.in/dataset/f1146fbc-5208-4991-ac0b-8c1371fc567c/resource/176f9707-2ff1-4de8-8b51-676a535be214/download/743ca31f-fa3f-4ed8-a8a3-9467154c38e0.pdf

"Hebbal Fly Over Junction, Hebbal Police Station - Fixed. Ring Road x Bellary Road." Roads: A from Devanahalli, B from BEL Circle, C from Nagavara.

| Phase | Movements with green |
|---|---|
| 1 | A right, A left, B left |
| 2 | B left, B straight, C straight |
| 3 | A left, C right, C straight |
| 4 | Exclusive pedestrian |

| Period | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Cycle |
|---|---|---|---|---|---|
| 07:00 to 08:00 | 30 | 50 | 40 | 10 | 130 |
| 08:00 to 11:00 | 40 | 60 | 50 | 10 | 160 |
| 11:00 to 16:30 | 30 | 50 | 40 | 10 | 130 |
| 16:30 to 21:30 | 40 | 60 | 50 | 10 | 160 |
| 21:30 to 23:00 | 30 | 50 | 40 | 5 | 125 |
| Sunday, 07:30 to 23:00 | 30 | 50 | 40 | 10 | 130 |

The research summary (4 phases, 130 s off-peak, 160 s at peak) is right.

**As used in the network** (the peak plan): green 37 s for A; 57 s for B and C; 47 s for C; 7 s with no approach on green; 3 s amber after each; cycle 160 s. Two things differ from the sheet, because a phase in the network format gives green to whole approaches: A's left turn does not run in phase 3 and B's left turn does not run in phase 1; and C's right turn also runs in phase 2, giving way to B's straight traffic.

## Demand and vehicle mix

See `demand.json` for the citations and every figure. In short:

- **RITES, 2019 peak hour, PCU per hour** (confirmed, page 8): from the airport 8,867 (to Tumkur 2,890; to the city 3,642; to K.R. Puram 2,336); from Tumkur 5,003 (to the airport 1,277; to K.R. Puram 2,670; to the city 1,056); from K.R. Puram 5,691 (to the airport 1,018; to Tumkur 2,800; to the city 1,874); from the city 7,335. Total 26,896. City-bound: 6,572.
- **IIT Bombay report, 2026** (confirmed, section 5.2): 32,770 vehicles = 31,758 PCU per hour at Hebbal, 09:00 to 10:00. No turning movements, no vehicle classes, no signal timings. The IISc review disputes the report's model, not these counts.
- **Vehicle mix** (assumed): two-wheeler 39.5%, car 48.8%, auto-rickshaw 8.1%, bus 3.5%, from the RITES 2051 forecast input with goods vehicles left out.

## OpenStreetMap licence

OpenStreetMap data is © OpenStreetMap contributors, under the Open Database Licence (ODbL) 1.0: https://www.openstreetmap.org/copyright

`osm-extract.json` is OpenStreetMap data; `corridor.json` is a database derived from it. As we read the licence (sections 4.2 to 4.6; this is not legal advice, and the licence text was not re-read for this note):

1. **Attribution.** Wherever the corridor is shown or used in the web app, show "© OpenStreetMap contributors" with a link to https://www.openstreetmap.org/copyright. `corridor.json` carries the wording in its `attribution` and `licence` fields.
2. **Share alike.** A derived database that is used publicly stays under the ODbL. `corridor.json`, shipped with the web app, must be offered under the ODbL and say so.
3. **Keep it open.** Offer the derived database itself, or the changes made to OpenStreetMap, in a usable form: `corridor.json` together with `corrections.json` and the importer do this, provided the app links to where they can be had.
4. **What the licence does not reach.** Pictures and results produced from the data (the 3D view, the figures) need the attribution but need not be under the ODbL. The signal plan and the traffic volumes come from other sources and are kept in their own files and fields so that their terms are not mixed up with OpenStreetMap's.

The signal sheet is on OpenCity with no licence stated. The RITES extract and the tunnel documents are listed there as "Other (Public Domain)".
