# Architect brief: Indian traffic simulator

Synthesis of the 23 deep-research results in `results/` (full detail in `report.md`).
Written 2026-11-11.

**Status of the evidence.** Everything here was gathered by web-research agents and
carries source links in the result files. The main session re-ran the field validator
(23 of 23 pass) but has not re-read the sources. Items marked *(weak)* rest on a
secondary source, a single site, or an agent's own synthesis.

## 1. Can we reuse an existing open-source application?

Not as a whole. No open project is at once a web app, network-capable, and built for
Indian mixed traffic.

| Project | Licence | Verdict | What to take |
|---|---|---|---|
| SUMO | EPL-2.0 | Usable only on a server (no browser build); one process per user | Sublane idea; junction right-of-way design; import flags; use as an **offline cross-check** |
| traffic-simulation.de | GPL-3.0 | Hand-written networks, no map import, no sideways model | **Structure to copy** (not code): links, connectors, per-vehicle routes, merge zones |
| MTGermany/mixedTraffic | GPL-3.0 | One straight road, no junctions | Chennai-calibrated parameter values (from the paper, not the code) |
| A/B Street | Apache-2.0 | Lane-only, no acceleration model, vehicles stick permanently on large maps | Scenario = base map + edit list; lessons on gridlock |
| osm2streets | Apache-2.0 | npm package stale (June 2023), ignores bridges in geometry | Optional; a custom import is safer |
| SiMTraM (IIT Bombay) | GPLv3 label | Abandoned: 2013 Windows binary, no source found | The strip concept and its sanity check |
| DhakaSim / RoadBird | no public code | Paper only | Lesson: support lane-based and lane-free in one engine |
| SUMO-Web3D, traffic-visualizer, FOSS4G platform | archived / no licence / no code | Not reusable | Architecture patterns only |

**Recommendation:** write a small engine of our own that runs in the browser, and keep
SUMO unmodified as an offline cross-check on one junction. Reasons: static hosting is
free while free server hosting has narrowed; GPL code cannot be copied into our
codebase without adopting GPL; both earlier forks of SUMO for Indian or lane-free
traffic went stale. Cost of this choice: the correctness of the model is ours to prove.

## 2. What "adapted for India" must mean

1. **Left-hand traffic.**
2. **Vehicle classes with their own size and behaviour.** Starting values:

   | Class | Length × width (m) | Time gap T (s) | Standstill gap (m) | Source |
   |---|---|---|---|---|
   | Two-wheeler | 2.01 × 0.73 | 0.3 to 0.49 | 0.5 | Chennai 2023 sizes; Kanagaraj and Treiber 2018; Chennai 2026 UAV study |
   | Car | 4.42 × 1.85 | 0.8 to 1.21 | 1.3 to 2.0 | same |
   | Auto-rickshaw | 2.92 × 1.35 | about 0.81 | about 0.83 | 2026 UAV study (2018 paper's auto values look misprinted) |
   | Bus / heavy | 10.3 × 2.1 to 11.97 × 2.92 | 1.0 | 2.0 | same |

3. **Vehicle mix.** Chennai Saidapet: 56% two-wheelers, 27% cars, 12% autos, 5% heavy.
   Bengaluru Silk Board peak count: 65 / 22 / 5.4 / 4.1 *(weak: one junction, trade media)*.
4. **Weak lane discipline.** Divide each road into 0.5 m strips; a vehicle's leader is
   whoever overlaps it sideways, not whoever shares its lane. Lane discipline is a
   per-link setting so the same engine runs lane-based roads. *(weak: the rule set is
   an agent synthesis of several papers)*
5. **Two-wheelers filter to the front of queues.** Simple published queue rule
   (Agarwal and Laemmel 2016), with a cap so the queue head still discharges.
6. **Junction behaviour.** Accepted gaps of about 3.5 s (two-wheelers) to 4.6 s (cars)
   at unsignalised junctions, plus impatience (long waiters accept smaller gaps).
   Signal cycles of 120 to 180 s with four phases.
7. **Indian capacity yardsticks.** Indo-HCM 2017 urban base capacities: 2-lane undivided
   2,400, 4-lane divided 5,400, 6-lane divided 8,400 PCU/h. Report dynamic PCU and
   area occupancy, not only vehicle counts.

## 3. What an architect has to design

| Component | Decision from the research |
|---|---|
| Network model | Directed links + connectors + junctions; grade separation is a **connection rule** (roads join only at shared junctions), height is for drawing |
| Neighbour search | Per-link arrays sorted by position; never a world-space grid (flyover traffic would react to the road below) |
| Following model | IDM only |
| Sideways model | Strips of 0.5 m, MOBIL-style gain test, capped sideways speed |
| Junction model | Conflict points computed once per junction; vehicles book time windows; keep-clear rule |
| Merges (ramps) | Merge zone with a virtual stopped vehicle at its end |
| Time stepping | Fixed 0.2 s step, simulation decoupled from rendering |
| Determinism | Seeded random generator, one stream per subsystem; compute all moves, then apply |
| Runtime | Engine in a background worker; vehicle positions sent as typed arrays |
| Map import | Offline: Overpass extract, osmnx simplify, custom code for connectors, levels and lane widths; hand-checked patch file for lanes and widths |
| Scenario model | Fixed base network + small list of edits keyed to stable link IDs; shareable by URL or JSON, no backend |
| Results | One fixed metric set for every scenario; absolute and percentage change together |
| Gridlock | Detect, release, and **report** every intervention as a run-health figure |
| Licence | Shipped network file is an OpenStreetMap derivative: ODbL, attribution, publish the import script |

## 4. Mistakes in prior work, and the rule each gives us

| Mistake | Where | Our rule |
|---|---|---|
| Lane-free only; could not do ordinary lanes | DhakaSim, rebuilt as RoadBird | One engine, lane discipline per link |
| Deep fork of a big engine went stale | TrafficFluid-Sim, SiMTraM | Do not fork; own a small engine or use SUMO unmodified |
| Stuck vehicles removed silently | SUMO teleporting (300 s default) | Count and show every forced release |
| Vehicles stuck permanently on large maps | A/B Street | Small, hand-checked corridor; explicit gridlock breaker |
| Never calibrated, so results dismissed | A/B Street | State plainly what is verified and what is not |
| Only one link analysed; "no spillover" without data | Hebbal report, per IISc review | Always include the next junction downstream |
| Different metrics per scenario; percentages hiding small gains | Hebbal report, per IISc review | Fixed metric set; absolute + percentage |
| Induced demand and pier capacity loss ignored | Hebbal report, per IISc review | Demand-sensitivity control; model lost width under a flyover |
| Flyover moved the queue downstream | Silk Board double-decker *(weak: press reports)* | Same as above: boundary beyond the ramp exit |
| Static PCU factors | Indian capacity practice | Report dynamic PCU |
| Calibrated parameters did not transfer between sites | Indian Vissim/SUMO studies | Do not claim "calibrated" |

## 5. Demo corridor and data

- **Corridor:** city-bound Hebbal: the NH-44 flyover, the signalised junction beneath it,
  and the landing downstream. It is the only Bengaluru site with open numbers: a real
  fixed-time signal plan (4 phases, 130 s off-peak, 160 s peak) and a 2019 RITES model
  with directional volumes and vehicle mix. The exact downstream junction still needs
  confirming on the map.
- **OpenStreetMap quality in Bengaluru** (measured by an agent on 2026-11-11): lanes
  tagged on 48% of road length, width on 1%; bridge layers present on 880 of 925
  bridge ways. Good for shape and grade separation, poor for capacity.
- **No open Bengaluru traffic counts or origin-destination data** in machine-readable form.
- **Validation dataset:** Chennai Saidapet, 3,005 vehicle tracks on a 245 m section,
  two spreadsheet files, no registration, no stated licence (cite Kanagaraj et al. 2015).

## 6. What we can and cannot claim

- **Can claim "verified":** vehicles conserved, no overlaps, fundamental-diagram shape,
  capacity rising with width, identical results for a fixed seed, confidence intervals
  over several seeds (8 runs is the FHWA table figure).
- **Can claim "plausible":** against Indo-HCM capacities and Chennai per-class speeds
  (cars 6.13 m/s, two-wheelers 6.01 m/s on the Saidapet section).
- **Cannot claim:** "calibrated", "validated", or "meets GEH".

## 7. Open risks

1. Browser performance is unmeasured; "about 5,000 vehicles at 10× real time" is an estimate.
2. The strip rule set is our own synthesis and has no published reference implementation.
3. No open Indian data exists for junction discharge; the Indo-HCM formula is the only target.
4. Some Indo-HCM table values came from a scrambled third-party copy and are marked uncertain.
5. The IISc review of the Hebbal report, our strongest source of design rules, has been
   read only by a research agent.
6. 16 medium-priority and 4 low-priority outline items were not researched.
