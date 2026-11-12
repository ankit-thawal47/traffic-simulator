# Hebbal corridor, city-bound: extent, sources and what is confirmed

Corridor id: `hebbal-city-bound`. Checked on 2026-11-12.

A value is **confirmed** only where we opened the primary document or the OpenStreetMap data and found it there. **Assumed** values carry their reason. The per-road evidence is in `corrections.json`; the demand evidence is in `demand.json`. This file is the summary.

## Files

| File | What it is | How it is made |
|---|---|---|
| `osm-extract.json` | OpenStreetMap ways (motorway to tertiary, with links) and signal nodes in the box 13.0245 to 13.0482 N, 77.585 to 77.595 E. Fetched 2026-11-12T04:13Z; OpenStreetMap data as of 2026-11-12T04:12:30Z. | `node packages/corridor/scripts/fetch-osm.mjs hebbal` |
| `corrections.json` | Which ways make up each road, and lanes, usable width, level, direction, speed limit and a short name for each, with the source of every value; the junctions, their connections and signal plans; and (`network`) how the roads are put together into one network, with the reason for every adjustment. | By hand |
| `demand.json` | Published volumes, the vehicle mix, how they are put on the corridor's roads, the split at the Ganga Nagar fork and the default scale, with sources or marked assumed. | By hand |
| `corridor.json` | The prepared corridor: every road as checked, the whole corridor as one network in the engine's format (version 4), a short name for each road, every adjustment in words, and the default demand. | `pnpm --filter @traffic-simulator/corridor build-corridor` |

`pnpm --filter @traffic-simulator/corridor run-corridor` runs the whole corridor for a simulated hour (`--scale 1` for the published volumes) and reports vehicles through, queues, vehicles standing 300 s or more and engine speed, then runs the consistency checks.

A test fails if `corridor.json` is not what the importer makes of the other three, or if a tag in the extract differs from what was recorded when a road was checked.

## The extent

City-bound means southbound on Bellary Road (NH 44), from the airport side towards the city. About 2.4 km north to south, 23 roads, 7.0 km of carriageway (4.7 km on the ground, 2.4 km raised).

**Starts** at OpenStreetMap node 332955193 (13.0473 N, 77.5919 E), where the ground-level road to the junction leaves Bellary Road and the flyover approach begins.

**The flyover.** The city-bound deck: ways 377832186, 377832182, 842592053 (738 m), with its approach (377832181) and its landing on Bellary Road (1278555480).

**The junction beneath it.** Outer Ring Road x Bellary Road, the Bengaluru Traffic Police's "Hebbal Fly Over Junction". It has three approaches, each ending at a `highway=traffic_signals` node: from the airport side (road A in the police plan, node 2408586316), from Tumkur Road (B, node 430127696) and from K.R. Puram (C, node 335663834). There is no approach from the city side. No city-bound traffic from the airport passes through it: that traffic is on the flyover. City-bound traffic from Tumkur Road goes straight through the junction and then up a loop (ways 36987760, 377832176, 1460084785); city-bound traffic from K.R. Puram leaves the Outer Ring Road before the junction on a ramp (ways 1422977939, 1446941081, 1420425473). Both join the three-lane ramp (way 1422993566) that lands on Bellary Road about 350 m south of where the flyover lands.

**The next junction downstream.** Bellary Road's ground-level road x CBI Road, beneath the Ganga Nagar flyover (node 582566933, 13.0270 N, 77.5858 E), 1.4 km south of the flyover landing. It is the first place south of Hebbal where city-bound traffic meets crossing traffic. At the fork ahead of it (node 582566943) city-bound traffic either goes over on the Ganga Nagar flyover or down to this junction. Its control is **not confirmed**: OpenStreetMap has no signal node there, the police signal sheets on OpenCity do not include it, and the flyover deck hides it in the imagery. A further search on 2026-11-12 found only city-wide news of adaptive signals, none naming it. It is in the corridor on an **assumed** plan, so that a planner can see whether a queue moves there: a fixed-time signal of two phases, the service road (city-bound) 40 s green and CBI Road from RT Nagar 20 s, 3 s amber and 2 s all-red after each (70 s cycle). Assumed because the engine has no give-way control for crossing movements and this is the kind of junction that is signalled in Bengaluru; if it is uncontrolled or police-controlled, this plan is wrong. Its roads are all drawn to one node with no stop line, so the importer sets each back 10 m.

## The whole network, and how the importer departs from OpenStreetMap

The importer (`src/whole-network.ts`) makes one network in the engine's format version 4: 24 roads, 10 junctions (2 signal junctions, 8 with no signal). Nothing in its output is edited by hand; every departure from what OpenStreetMap draws is written out in `corridor.json` (`adjustments`) and comes from a rule with its reason in `corrections.json` (`network`):

- **Heights** (assumed): OpenStreetMap has none. A raised road rises 4 m in 100 m from where it leaves the ground until it is 6 m up.
- **Roads end to end** with the same lanes, width and speed limit are one road: the Hebbal flyover (approach, deck and landing), the ramp from K.R. Puram, the ramp towards the city.
- **Where a road divides** (the start of the flyover, the ramp leaving the Outer Ring Road from K.R. Puram, the Ganga Nagar fork) the engine needs the roads side by side; OpenStreetMap draws them to one node. They are one road as wide as both for as long as their drawn widths would overlap, and at least 50 m: Bellary Road from the airport (50 m, 5 lanes), Outer Ring Road from K.R. Puram (52 m, 5 lanes), Bellary Road before the Ganga Nagar flyover (50 m, 5 lanes). The side road then starts exactly beside the main road (up to 2.9 m off its drawn line) and curves back to its line. Where corridor traffic enters there, the 5 lanes are the 3 + 2 after the node, not the 3 OpenStreetMap has before it.
- **Where roads join onto a narrower road** (the loop from Tumkur Road onto the ramp from K.R. Puram, 2 + 2 lanes onto 2; the ramp towards the city onto Bellary Road, 3 + 3 onto 3) the two end side by side and the road beyond starts across the line between them, so each leads onto part of it and the engine lets vehicles in first come, first served. The ramp from K.R. Puram ends 9.8 m off its drawn line, because it curves in hard just before the node. A first version made a short road as wide as both, then a lane drop; the engine cannot yet discharge a lane drop (ticket 23), and vehicles stood there for up to 2,468 s at every demand tried, so that form was dropped.
- **Roads drawn closer than their widths allow** are moved apart, point by point, just enough: the ground road from the airport up to 1.8 m from the flyover approach; the ramp towards the city up to 5.2 m from the Hebbal flyover deck (drawn 5.4 m apart, less than one carriageway); the Outer Ring Road towards K.R. Puram up to 5.3 m from the ramp from K.R. Puram (an embankment, drawn 3.4 to 5 m from it); the loop from Tumkur Road up to 1.6 m from the deck; the service road beyond CBI Road up to 1.1 m from the Ganga Nagar flyover. The Outer Ring Road towards K.R. Puram is also cut to its first 130 m.
- **Joins with no signal** leave 12 m between roads for the path; the CBI Road junction's roads are set back 10 m.

**Turning a flyover off is refused on this corridor,** with the reason: each raised road is the only way for some traffic (the published plan gives road A no straight-on movement at the junction beneath), and the product never sends traffic another way or takes it off the network.

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
| CBI Road junction: control and plan | assumed (no source reached) | Two-phase fixed signal, 70 s; see above |
| Heights of raised roads; ramp gradient | assumed | 6 m deck, 4 m in 100 m; OpenStreetMap has no heights |
| Every adjustment of the drawn geometry | the importer's rule, with reason | `corrections.json` `network`; listed in `corridor.json` `adjustments` |
| Peak-hour turning volumes | confirmed | RITES extract, page 8 (2019, PCU) |
| PCU to vehicles | assumed | 0.969 PCU per vehicle, from the IIT Bombay report's junction total |
| Which road each movement uses | assumed | Our reading of the map; the counts predate the ramp from K.R. Puram |
| Vehicle mix | assumed | RITES extract, page 26: a 2051 forecast input, not an observed mix |
| Split at the fork ahead of the Ganga Nagar flyover | assumed (not published) | 80% over the flyover; 10% on along the service road, 5% left into CBI Road, 5% right beneath the flyover |
| Traffic on CBI Road from RT Nagar | assumed (no count) | 300 vehicles per hour: 200 towards the city, 100 beneath the flyover; not scaled |
| Default demand scale | our choice | 0.3 of the published volumes; see below |
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

### The model cannot carry the published volumes

Put on the corridor's roads, the published volumes are 18,080 vehicles per hour (17,780 from RITES, all city-bound flows including the two that need the flyover and ramps, plus the assumed 300 on CBI Road). Run for a simulated hour in mixed traffic (seed 1, 2026-11-12), the model puts **10,355 through, with 6,655 still waiting to enter** at the end, and the three Hebbal approaches fill (394 m, 300 m, 299 m). At half the volumes, 6,929 through, 1,643 waiting, and the ground road from the airport and the Outer Ring Road from Tumkur Road still fill.

So the **default demand is the published volumes times 0.3** (5,633 vehicles per hour): our choice, not a measurement. It is the largest scale tried (in steps of 0.05) at which only one signal approach fills. The published volumes stay in `demand.json` and in each flow's `publishedVehiclesPerHour` in `corridor.json`; the demand scale control takes a planner back to them (1 / 0.3 = 3.33). The Outer Ring Road from Tumkur Road fills its 300 m at every scale from 0.2 up (about 1,030 vehicles per hour from Tumkur Road), and not at 0.15.

Candidate reasons, none established: the signal plan is from 2010 and the junction may now run other timings or adaptive control; the network format gives green to whole approaches, so A's left turn loses phase 3 and B's left turn phase 1, and C's right turn was added to phase 2 where it crosses B's straight traffic; in the engine vehicles do not sort by turn before the stop line and a later vehicle never goes before an earlier one; widths are lanes x 3.5 m, assumed; the volumes are 2019 counts in PCU turned into vehicles with an assumed 0.969, and which road each movement uses today is our reading of the map; and the engine's junction discharge has not been calibrated against a measured saturation flow.

### A simulated hour at the default demand

Seed 1, mixed traffic, `run-corridor`: 4,899 through, 333 still waiting to enter; longest queues: ground road from the airport 95 m, Outer Ring Road from Tumkur Road 300 m (full), from K.R. Puram 62 m, service road to CBI Road 18 m, CBI Road from RT Nagar 43 m; 115 vehicles stood still 300 s or more (longest 473 s), all in the queue on the Outer Ring Road from Tumkur Road; consistency checks: no violation. The engine alone ran at 662 times real time.

## OpenStreetMap licence

OpenStreetMap data is © OpenStreetMap contributors, under the Open Database Licence (ODbL) 1.0: https://www.openstreetmap.org/copyright

`osm-extract.json` is OpenStreetMap data; `corridor.json` is a database derived from it. The licence summary at https://opendatacommons.org/licenses/odbl/summary/ was re-read on 2026-11-12. It says: you must attribute any public use of the database, or works produced from it, in the manner specified in the ODbL, and for any use or redistribution make clear to others the licence of the database and keep intact any notices on the original; if you publicly use an adapted version of the database, or works produced from an adapted database, you must also offer that adapted database under the ODbL; and if you redistribute the database or an adapted version with technological measures that restrict it, you must also redistribute a version without them. (The summary is not the licence; this is not legal advice, and the full text was not read.) What the product does:

1. **Attribution.** While the corridor is shown, the web app shows "Map data © OpenStreetMap contributors" under the views, linked to https://www.openstreetmap.org/copyright. `corridor.json` carries the wording in its `attribution` and `licence` fields.
2. **Share alike.** The same line says the corridor data is a database made from OpenStreetMap and is offered under the ODbL 1.0, with a link to the licence.
3. **Keep it open.** Under it, the app offers `corridor.json`, `osm-extract.json`, `corrections.json`, `demand.json`, this file and the importer's source (`import-corridor.ts`, `whole-network.ts`, `prepared-corridor.ts`, `types.ts`, `build-corridor.ts`) as plain files, with no restriction.
4. **What the licence does not reach.** Pictures and results produced from the data (the 3D view, the figures) need the attribution but need not be under the ODbL. The signal plan and the traffic volumes come from other sources and are kept in their own files and fields so that their terms are not mixed up with OpenStreetMap's.

The signal sheet is on OpenCity with no licence stated. The RITES extract and the tunnel documents are listed there as "Other (Public Domain)".
