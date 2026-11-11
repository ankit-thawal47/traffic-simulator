# Indian traffic simulator research report

Generated from 23 deep-research result files by `generate_report.py`.
Outline has 43 items; only those researched so far appear here.

How to read this: every value was gathered by a web-research agent and carries its
source links in the item's `links` field. Values the agent marked `[uncertain]` are
left out of the body and listed by field name at the end of each item.

## Contents


**A. Open-source simulators**

1. [SUMO](#1-sumo) - Type: simulator | Last activity: v1.28.0 released 2026-10-08 (ChangeLog); GitHub main branch pushed 202…
2. [A/B Street and osm2streets](#2-ab-street-and-osm2streets) - Type: simulator (A/B Street: agent-based traffic simulator and street editor… | Licence: Apache-2.0 for abstreet, osm2streets, osm2streets-js (npm) and osm2lan… | Last activity: abstreet: last commit 2025-09-10 (README points to successor projects;…
3. [MTGermany/mixedTraffic (Mixed Traffic Model)](#3-mtgermanymixedtraffic-mixed-traffic-model) - Type: simulator (interactive in-browser demonstrator of a fully two-dimensio… | Licence: GPL-3.0 (LICENSE file in repository; GitHub reports GPL-3.0) | Last activity: 2026-04-30 (last commit on master, 'changed upload script')
4. [traffic-simulation.de / MovSim](#4-traffic-simulationde--movsim) - Type: simulator (lane-based microscopic browser simulator in JavaScript, plu… | Licence: GPL-3.0 for both (LICENSE file in traffic-simulation-de; MovSim README… | Last activity: traffic-simulation-de: last commit 2026-10-29. MovSim: last commit 202…
5. [SiMTraM](#5-simtram) - Type: simulator (strip-based mixed-traffic extension of SUMO) | Licence: GPLv3 (as declared on the SourceForge project page) | Last activity: Software: 2013-04-29 (SiMTraM-0.1.1-winbin.zip). Paper: Journal of Com…
6. [Web reference architectures](#6-web-reference-architectures) - Type: simulator (three reference web architectures: server-side engine strea… | Last activity: SUMO-Web3D: last code commit 2018-11-15, PyPI 1.0.1 on 2018-06-14, rep…

**B. Behaviour models**

7. [Car-following models](#7-car-following-models) - Type: model (family of longitudinal vehicle-following models) | Licence: Models are published equations (no licence). Reference implementations…
8. [Two-dimensional lane-free models](#8-two-dimensional-lane-free-models) - Type: model (family of microscopic car-following-based models for lane-free,…
9. [Strip-based, seepage and filtering models](#9-strip-based-seepage-and-filtering-models) - Type: model (family: strip/sublane lateral discretisation, queue-model seepa… | Last activity: 11 July 2026: Mendeley Data 'Dataset for Modeling and benchmarking two…
10. [Junction control and conflict models](#10-junction-control-and-conflict-models) - Type: model (junction right-of-way, conflict resolution and signal control m… | Licence: SUMO EPL-2.0; traffic-simulation.de GPL-3.0; Indo-HCM and IRC codes ar… | Last activity: Checked 2026-11-11: SUMO docs current (Intersections, Traffic Lights, …
11. [Flyovers and grade separation](#11-flyovers-and-grade-separation) - Type: model (network representation of grade separation plus merge/diverge b… | Last activity: Checked 2026-11-11: osm2streets last commit 2 Oct 2025 (shallow clone)…

**C. Indian context and data**

12. [Vehicle mix and per-class parameters](#12-vehicle-mix-and-per-class-parameters) - Type: dataset / standard values (vehicle dimensions, kinematics, gaps and tr… | Licence: Indo-HCM and IRC codes: copyrighted publications (IRC codes sold by IR… | Last activity: arXiv 2608.00602 submitted 1 August 2026 (Chennai Saidapet UAV dataset…
13. [Indian standards and capacity measures](#13-indian-standards-and-capacity-measures) - Type: standard
14. [Indian trajectory and calibration datasets](#14-indian-trajectory-and-calibration-datasets) - Type: dataset | Last activity: Seepage benchmark v1 published 11 July 2026. NCR UAV Zenodo record (sa…
15. [Bengaluru network and traffic data sources](#15-bengaluru-network-and-traffic-data-sources) - Type: dataset survey (network geometry, signal timings, counts, speeds, cong… | Last activity: OSM: live (Overpass snapshot used here 2026-11-11T09:56Z; Geofabrik In…
16. [Bengaluru flyover case studies](#16-bengaluru-flyover-case-studies) - Type: case studies and validation datasets (consultancy microsimulation repo… | Licence: OpenCity lists the Hebbal tunnel dataset and the RITES Hebbal dataset … | Last activity: IIT-B report and IISc review uploaded to OpenCity 2026-09-30; finance …

**D. Architecture decisions**

17. [Engine placement](#17-engine-placement) - Type: design decision | Licence: Depends on the engine: SUMO EPL-2.0; A/B Street / osm2streets Apache-2… | Last activity: Evidence checked 2026-11-11: SUMO 1.28.0 wheels on PyPI (eclipse-sumo,…
18. [Engine design](#18-engine-design) - Type: design decision | Last activity: Evidence checked 2026-11-11 (SUMO Basic Definition docs, MDN SharedArr…
19. [Network pipeline](#19-network-pipeline) - Type: design decision (OpenStreetMap to simulation-graph pipeline: tool comp… | Licence: osmnx MIT; SUMO/netconvert EPL-2.0 OR GPL-2.0-or-later; osm2streets an… | Last activity: Checked 2026-11-11: osmnx 2.1.1 on PyPI; eclipse-sumo and sumolib 1.28…
20. [Scenario model and editor](#20-scenario-model-and-editor) - Type: Design decision (architecture): scenario data model, editor scope, sto… | Last activity: 2026-09-01 (FOSS4G 2026 talk 'Web-Based High-Performance Traffic Simul…

**E. Lessons from prior work**

21. [Gridlock and deadlock handling](#21-gridlock-and-deadlock-handling) - Type: lesson | Last activity: SUMO 1.28.0 (2026-10-08) ChangeLog still lists deadlock fixes (sublane…
22. [Calibration and validation practice](#22-calibration-and-validation-practice) - Type: lesson | Last activity: TAG M3.1 PDF dated May 2026; TxDOT microsimulation chapter applying FH…
23. [Design mistakes in earlier simulators](#23-design-mistakes-in-earlier-simulators) - Type: Lesson (cross-project failure analysis) | Last activity: 2026 (IISc technical review of 'Integrated Traffic Microsimulation Stu…

---

# A. Open-source simulators

## 1 SUMO

*Outline id A01 · category simulator · priority high · source file `results/SUMO.json`*

### Basic info

- **Name:** SUMO (Simulation of Urban MObility)
- **Type:** simulator
- **Maintainer:**
  > German Aerospace Center (DLR) Institute of Transportation Systems, hosted as an Eclipse Foundation project (eclipse-sumo on GitHub), plus community contributors
- **First release:** 2001 (SUMO docs state the package has been used since 2001; copyright line 2001-2026)
- **Last activity:** v1.28.0 released 2026-10-08 (ChangeLog); GitHub main branch pushed 2026-11-11
- **Language:**
  > C++ core (sumo, netconvert, sumo-gui); Python tooling (osmWebWizard, randomTrips, traci client). GitHub reports Python as the top language by bytes
- **Code availability:**
  > Source with public repository: https://github.com/eclipse-sumo/sumo; binaries for Windows/macOS/Linux; pip packages (eclipse-sumo, libsumo, traci)
- **Maintenance health:**
  > Very healthy. Releases roughly every 1-4 months (1.27.0 on 2026-05-21, 1.27.1 on 2026-06-25, 1.28.0 on 2026-10-08), daily commits, about 4.3k GitHub stars, active sumo-user mailing list with maintainer replies. The ChangeLog still lists sublane deadlock fixes in 1.28.0 and Git main, so the sublane model is still being hardened

### Model

- **Scale:**
  > Microscopic by default; a mesoscopic mode (queue-based, up to 100 times faster per the docs) is available
- **Car following:**
  > Default Krauss (safe-speed model, parameters accel, decel, emergencyDecel, sigma for driver imperfection, tau for reaction headway, minGap). Alternatives include IDM, EIDM, ACC, CACC, Wiedemann (W99) and others selectable per vType through carFollowModel
- **Lane model:**
  > Lane-based by default: vehicles sit at the lane centre and change lanes instantly (LC2013 model). Option --lanechange.duration gives continuous, non-instant lane changes. Option --lateral-resolution switches on the sublane model with the SL2015 lane-change model
- **Lateral model type:**
  > Sublane. With --lateral-resolution <m> (default -1 = off) each lane is split into sublanes, and vehicles may hold any lateral offset. SL2015 parameters: lcSublane (default 1.0), lcPushy (0-1, default 0), lcAssertive (0-1, default 0), lcImpatience, lcTimeToImpatience, lcAccelLat, lcMaxSpeedLatStanding, lcMaxSpeedLatFactor. vType attributes minGapLat, latAlignment (right, center, left, arbitrary, compact, nice, or offset) and maxSpeedLat. The resolution should divide lane width evenly (0.8 m gives 4 sublanes on a 3.2 m lane) and be small enough for the narrowest vehicle
- **Junction model:**
  > Junctions have internal lanes. Right-of-way comes from the node type (priority, right_before_left, allway_stop, zipper, traffic_light, and others) and edge priority. Minor-road vehicles wait at the lane end and accept gaps using jmTimegapMinor (default 1 s). Other junction-model vType parameters: jmCrossingGap (10 m), jmIgnoreKeepClearTime (-1), jmDriveAfterYellowTime and jmDriveAfterRedTime (-1), jmIgnoreFoeProb and jmIgnoreFoeSpeed (0), jmIgnoreJunctionFoeProb (0), jmSigmaMinor, jmStoplineGap (1 m), and impatience (0, grows over --time-to-impatience, default 180 s). A keep-clear (no-block) heuristic is on by default (--default.junctions.keep-clear true) and can be turned off per node or connection. Roundabouts give circulating edges priority, detected by --roundabouts.guess (default true, max circumference 3500 m)
- **Signal control modes:**
  > Static fixed-time programs, actuated (gap-based), delay_based, NEMA dual-ring and others. netconvert can guess signals from OSM (--tls.guess-signals, --tls.default-type actuated). Programs can be changed at runtime through TraCI/libsumo, which is the standard hook for RL controllers (for example sumo-rl and Flow)
- **Flyover support:**
  > Yes. Edges that cross without sharing a node do not interact, so flyovers, bridges and underpasses work. netconvert --ramps.guess adds acceleration and deceleration lanes on motorway on- and off-ramps. Merges and diverges are ordinary junctions; zipper nodes are available for merges
- **Vehicle types:**
  > Built-in vClasses include passenger, bus, coach, truck, trailer, delivery, taxi, motorcycle, moped, bicycle, pedestrian, emergency, tram and rail. Each vType sets length, width, minGap, accel, decel, maxSpeed, speedFactor, speedDev, carFollowModel, laneChangeModel, emissionClass and lateral attributes. Custom types (for example auto-rickshaw or e-rickshaw) are defined by cloning a vClass and changing dimensions and dynamics. Lane permissions use allow/disallow per vClass
- **Gridlock policy:**
  > Teleporting: a vehicle that is first in line and slower than 0.1 m/s for --time-to-teleport (default 300 s; values of 0 or below disable it) leaves the network and reappears downstream. Extras: --time-to-teleport.highways (default 0 = off), .disconnected, .bidi, .remove (delete instead of teleport), --max-num-teleports (abort above the limit, default -1). --ignore-junction-blocker <s> (default -1) ignores vehicles stuck inside a junction. --collision.action defaults to teleport. Teleports are reported as warnings with a reason (wrong lane, yield, jam, blocked, disconnected), counted in summary output and meanData, and absent from FCD output

### India fit

- **Mixed traffic support:**
  > Partial. Vehicles of different widths can share a lane side by side under the sublane model, and per-type minGapLat and latAlignment shape lateral spacing. This is the closest any mainstream open-source simulator gets to Indian mixed traffic, but it is still anchored to lane geometry and was designed for bicycles and motorcycles in otherwise lane-disciplined traffic
- **Non lane behaviour:**
  > Approximated through the sublane model: vehicles drift continuously across sublanes, overtake within a lane, and set a preferred lateral alignment. Lane markings stay as the network topology (one wide lane per carriageway is a common workaround to mimic no-lane roads). Behaviour at junctions is still governed by connections from specific lanes, so free-form weaving through an intersection is not modelled. A truly continuous 2D model does not exist in SUMO

### Data

- **Network import:**
  > netconvert imports OpenStreetMap, OpenDRIVE, VISUM, Vissim, MATsim, shapefiles and plain XML. Recommended OSM options: --geometry.remove --ramps.guess --junctions.join --tls.guess-signals --tls.discard-simple --tls.join --tls.default-type actuated, plus --lefthand for India and typemaps for road classes. osmWebWizard.py gives a browser map picker that downloads OSM, runs netconvert, generates randomTrips demand per mode (passenger, bus, truck, motorcycle, bicycle, pedestrian and others), writes osm.net.xml and osm.sumocfg, and launches sumo-gui. Very large areas make it slow
- **Demand input formats:**
  > XML routes (vehicle, trip, flow, route, vType, routeDistribution), trips with origin/destination edges routed by duarouter, flows with vehsPerHour/period/probability, OD matrices through od2trips, detector counts through routeSampler or flowrouter, activity-based demand through activitygen, randomTrips.py for synthetic demand, and runtime insertion through TraCI

### Engineering

- **Runs in browser or server:**
  > Server or desktop native process. No browser build; web front-ends talk to a server-side SUMO through TraCI/libsumo (for example the archived sidewalklabs/sumo-web3d, which used TraCI plus three.js)
- **Api:**
  > TraCI: a TCP socket protocol with clients in Python, C++ (libtraci), Java, Matlab and others. It supports multiple clients and remote control of vehicles, signals, routes and edges, and subscriptions. libsumo: an in-process C++ library with Python (pip install libsumo), Java and C++ bindings and the same function signatures, but no socket overhead. libsumo cannot serve multiple clients, has experimental or no GUI support, and needs Python multiprocessing for parallel instances
- **Gpu requirement:** None; CPU only
- **Multi tenancy model:**
  > One SUMO process per scenario run (TraCI server or libsumo inside a worker process). Hosting cost scales with concurrent runs; batch runs with a step cap are cheap. Interactive sessions hold one process per user. Use a worker pool or queue with time and step limits
- **Build complexity:**
  > Low if using prebuilt packages: pip install eclipse-sumo libsumo traci, apt packages, or the official Docker images. Building from source needs CMake, Xerces-C, PROJ, GDAL, FOX (GUI) and Eigen, which takes moderate effort. Embedding through libsumo in Python is straightforward
- **Scenario editability:**
  > Through netedit or plain XML or the TraCI API: lanes (count, width, permissions per vClass), speeds, edge priority, junction type and keepClear, connections, traffic-light programs and phases, demand (routes, flows, vTypes), bus stops, parking areas, detectors, rerouters, calibrators, variable speed signs. netconvert can regenerate the net from edited plain-XML node/edge/connection files
- **Output metrics supported:**
  > Trip info (travel time, waiting time, time loss/delay, departDelay), summary (running, waiting, teleports, mean speed), edge and lane meanData (density, occupancy, speed, flow, timeLoss, waitingTime, teleports), queue output (queue length per lane), induction-loop and lane-area detectors, FCD trajectories, emissions output, SSM device for conflicts (TTC, DRAC, PET), and TLS state. Dynamic PCU and Indian LOS are not built in and must be derived
- **Emissions support:**
  > Yes: HBEFA v2.1, v3.1 and v4.2 based classes, plus PHEMlight and PHEMlight5, with an emissions device and outputs

### Reuse verdict

- **Reuse mode:**
  > Use as engine. SUMO runs server-side as the simulation core; we build the web UI, scenario editor and metrics layer around netconvert, sumo/libsumo and its XML outputs
- **Effort within 72 hours:**
  > Realistic and recommended. About 4-6 hours for a Docker image with SUMO plus a Python (FastAPI) worker using libsumo/TraCI, about 6-10 hours for the OSM-to-net pipeline (netconvert with the recommended options and --lefthand, bounded bbox), and about 10-16 hours for a web map UI that streams vehicle positions and edits lanes, widths, signals and demand by regenerating plain XML. Indian vTypes (2W, 3W, car, bus, truck) with sublane at 0.8-1.0 m resolution take about 2-4 hours. Cut: in-browser simulation, a full netedit-equivalent editor, rigorous calibration, mesoscopic mode, and emission dashboards beyond the default HBEFA output
- **Licence constraint:**
  > EPL-2.0 is weak file-level copyleft. Modifications to SUMO source files must be published under EPL when distributed, but our own separate web app and orchestration code can use any licence. Running SUMO unmodified on a server (SaaS) triggers no source obligation. Keep any SUMO patches upstream or in a public fork

### Lessons

- **Known limitations:**
  > The sublane model is still lane-anchored, not true 2D, and costs more CPU at fine resolution. Sublane deadlocks and unsafe driving were still being fixed in 1.28.0 and Git main. OSM networks need cleanup: junction clusters on divided roads, missing turn lanes, wrong lane counts, layer heuristics for flyovers. libsumo has no multi-client or stable GUI support. No WebAssembly build. No built-in Indian vehicle classes or dynamic PCU
- **Documented failures:**
  > OSM imports without --junctions.join produce short intermediate edges that cause throughput loss, jams and deadlocks (OSM import docs). A bicycle path crossing a roundabout stopped netconvert from detecting it, so entering vehicles got priority and the roundabout deadlocked (sumo-user list). Many connections with keepClear=false caused deadlocks (sumo-user list). Vehicles inserted on the wrong lane near turn bays get stuck; the docs recommend departLane=best. The ChangeLog records fixed deadlocks with parallel internal lanes (1.27.1) and in sublane simulation (1.28.0)
- **Validation approach:**
  > Extensive nightly regression test suite (TextTest) with published daily test and coverage reports, plus a body of peer-reviewed calibration studies by users, including Indian ones
- **Takeaway for our build:**
  > Adopt SUMO as the engine, run it server-side through libsumo or TraCI in one worker process per scenario, and stream positions to the browser. Always run OSM through netconvert with --junctions.join --ramps.guess --tls.guess-signals --tls.join --lefthand and a bounded bbox. Enable the sublane model (--lateral-resolution about 0.8 m) with explicit Indian vTypes. Never hide teleports: surface teleport counts and reasons as a first-class 'model health' metric next to delay and queue results

### Sources

- **Links:**
  - https://github.com/eclipse-sumo/sumo
  - https://sumo.dlr.de/docs/SUMO_at_a_Glance.html
  - https://sumo.dlr.de/docs/ChangeLog.html
  - https://sumo.dlr.de/docs/sumo.html
  - https://sumo.dlr.de/docs/Simulation/SublaneModel.html
  - https://sumo.dlr.de/docs/Simulation/Why_Vehicles_are_teleporting.html
  - https://sumo.dlr.de/docs/Simulation/Intersections.html
  - https://sumo.dlr.de/docs/Definition_of_Vehicles%2C_Vehicle_Types%2C_and_Routes.html
  - https://sumo.dlr.de/docs/Networks/Import/OpenStreetMap.html
  - https://sumo.dlr.de/docs/netconvert.html
  - https://sumo.dlr.de/docs/Networks/PlainXML.html
  - https://sumo.dlr.de/docs/Tutorials/OSMWebWizard.html
  - https://sumo.dlr.de/docs/Libsumo.html
  - https://sumo.dlr.de/docs/Models/Emissions.html
  - https://sumo.dlr.de/docs/Simulation/Meso.html
  - https://sumo.dlr.de/docs/Simulation/Output/Summary.html
  - https://github.com/sidewalklabs/sumo-web3d
  - https://www.eclipse.org/lists/sumo-user/msg10135.html
  - https://www.eclipse.org/lists/sumo-user/msg15106.html
  - https://publications.iitm.ac.in/publication/calibration-of-sumo-for-indian-heterogeneous-traffic-conditions
  - https://iccesd.kuet.ac.bd/Papers/1355.pdf
  - https://sourceforge.net/projects/simtram/

### Uncertain fields (left out above)

- calibration_dataset_used
- calibration_method
- grade_separation_handling
- indian_calibration_evidence
- licence
- max_density_tested
- per_class_parameters
- performance
- seepage_filtering_support
- validation_against_field_case
- wasm_or_streaming_feasibility


## 2 A/B Street and osm2streets

*Outline id A02 · category simulator · priority high · source file `results/AB_Street_and_osm2streets.json`*

### Basic info

- **Name:** A/B Street (abstreet) and osm2streets
- **Type:**
  > simulator (A/B Street: agent-based traffic simulator and street editor) plus library (osm2streets: OSM-to-lane-level street geometry)
- **Maintainer:**
  > Dustin Carlino and contributors, now A/B Street Ltd (abstreet.uk); repositories under github.com/a-b-street
- **First release:**
  > A/B Street repository created June 2018; osm2streets repository created May 2022; osm2lanes created Nov 2021 and archived Mar 2023
- **Last activity:**
  > abstreet: last commit 2025-09-10 (README points to successor projects; last packaged release v0.3.49). osm2streets: last commit 2025-10-02 ('Update git dependencies'). osm2streets-js on npm: latest 0.1.4 published 2023-06-04. osm2lanes: archived, last commit 2023-03-09
- **Licence:** Apache-2.0 for abstreet, osm2streets, osm2streets-js (npm) and osm2lanes
- **Language:**
  > Rust core; compiled to WebAssembly for the browser via wasm-bindgen; osm2streets also has JavaScript (osm2streets-js), Python (osm2streets-py) and in-progress Java bindings; StreetExplorer web UI uses Svelte/TypeScript
- **Code availability:**
  > Source: https://github.com/a-b-street/abstreet and https://github.com/a-b-street/osm2streets ; browser build at https://play.abstreet.org/0.3.49/abstreet.html ; npm package osm2streets-js
- **Maintenance health:**
  > abstreet is not archived but is effectively in maintenance mode: the README '2025 Update' says the project 'has turned into several others' (Network Planning Workspace, LTN tool, 15-minute tool, od2net) and recent commits are dependency bumps and link fixes. The traffic simulation is not where effort goes any more; the retrospective says 'nobody's using it'. osm2streets still receives small commits (2025), has 160 stars and about 33 open issues, but the README warns the API is not stable, and the npm package has not been republished since June 2023, so the npm build drifts behind main. osm2lanes is archived.

### Model

- **Scale:**
  > Microscopic agent-based, but discrete-event rather than time-stepped (agents schedule their next state transition in a priority queue)
- **Car following:**
  > No continuous car-following model. Vehicles change speed instantly ('no smooth acceleration from rest, or modeling of safe stopping distance'); followers are bounded by the leader position plus vehicle length and a fixed FOLLOWING_DISTANCE of 1.0 m. Vehicle lengths in code: car 4.5-6.5 m, bus 12.5 m, bike 1.8 m.
- **Lane model:**
  > Strict lane-based. Lanes are inferred from OSM tags (lanes, turn:lanes, cycleway, parking etc.) and listed left-to-right with type, direction and width. Lane changes happen mainly at intersections via turns; there is a limited discretionary overtaking lane change with a 'ghost' left in the original lane. Mandatory mid-block lane changing was attempted and removed because 'many vehicles repeatedly attempted lane-changing maneuvers required by pathfinding'.
- **Lateral model type:** None (lane-based only; no sublane or continuous lateral position)
- **Junction model:**
  > Intersections are polygons built by thickening road centre-lines by inferred width, trimming roads back where thickened edges collide, and joining the points clockwise into a polygon. Turns between lanes are inferred, honouring OSM turn restrictions. Control types: uncontrolled, stop sign (signed), traffic signal, construction (osm2streets IntersectionControl). Conflicts are resolved per turn; vehicles cross one at a time; 'block-the-box' protection stops a vehicle entering a junction it cannot clear; 'uber-turns' lock a sequence of turns through a cluster of nearby intersections and synchronise signal groups. Short dual-carriageway segments are consolidated into one logical intersection (heuristic or manual junction=intersection tag). osm2streets reuses this geometry and adds transforms: collapsing degenerate two-road intersections, merging dog-leg intersections, merging 'sausage links' and dual carriageways. Turning movements and crosswalks are still listed as planned in osm2streets.
- **Signal control modes:**
  > Fixed-time stages (StageType::Fixed) and a simple demand-responsive/actuated stage (StageType::Variable with minimum, no-demand delay and extension). Signal timing and stages are editable in the UI and via the headless API (/traffic-signals/set). No adaptive or learned-control hooks beyond the HTTP API.
- **Flyover support:**
  > Partial and implicit. Grade separation works only because OSM bridges do not share nodes with the roads below, so no intersection is created where they cross. Motorway on/off-ramps are a documented problem case for intersection geometry. No explicit flyover, ramp-merge or weaving model.
- **Grade separation handling:**
  > osm2streets reads the OSM 'layer' tag into Road.layer (0 default, negative below), writes it to GeoJSON output for z-ordered rendering, and refuses to collapse an intersection between two roads on different layers (collapse_intersections.rs). There is no elevation model and no check or repair of broken bridge topology. The intersection-geometry docs say outright 'Let's ignore bridges and tunnels', a code comment in block.rs says 'Incorrect near bridges/tunnels', and the retrospective shows gridlock spreading 'from one broken Fremont bridge'.
- **Vehicle types:**
  > Car, Bus, Train, Bike (sim VehicleType enum) plus pedestrians. There are no two-wheelers, auto-rickshaws or trucks as separate motorised classes; bikes are the only small vehicle.
- **Gridlock policy:**
  > Prevention, not resolution: block-the-box protection with a manual override list, uber-turns, a cycle detector, and debugging flags (--disable_turn_conflicts, --disable_block_the_box, --infinite_parking). Scenario modifiers can cancel a share of trips. No teleporting, no dynamic rerouting, and the 'last resort' of releasing a vehicle after a long wait is not implemented. Stuck agents are visible and the 'blocked-by' graph can be queried via the API. The authors admit that 'in most simulations on larger maps, vehicles get stuck. Like, permanently.'

### India fit

- **Mixed traffic support:**
  > No. Strict lane discipline, one vehicle per lane slot, fixed 1 m gap; bikes use bike lanes or occupy a whole lane.
- **Non lane behaviour:**
  > Not supported. There is no lateral position, so vehicles cannot share a lane side by side, form ad hoc columns or ignore markings. Adding this would mean rewriting the core queue-based movement model.
- **Seepage filtering support:** No. Queues are FIFO per lane; small vehicles cannot move to the front of a queue.
- **Per class parameters:**
  > Only hard-coded lengths (car 4.5-6.5 m, bus 12.5 m, bike 1.8 m), a 1.0 m following distance and per-agent max speed. No published Indian per-class parameters.

### Data

- **Network import:**
  > OSM only, via the pipeline: clip the extract with osmium -> convert_osm builds a RawMap -> map_model builds the final Map (since 2022 the shared part lives in osm2streets: lanes from tags, intersection geometry, transforms). osm2streets-js takes OSM XML input plus an optional clip polygon and import options, including override_driving_side, so it works for left-hand-traffic India, and returns GeoJSON (plain network, lane polygons, lane markings, intersection markings) or JSON. Map JSON can be dumped and re-imported (cli dump-json / import-json-map).
- **Demand input formats:**
  > Scenario files (people and trips, each with start, end, departure time and mode: walk/bike/drive/transit; endpoints are buildings or border intersections). Generators: 'proletariat robot' (home-to-work from OSM building tags, no local data needed), census-based (global population_areas file), UK origin-destination desire lines, Grid2Demand input_agents.csv import, and the abstr R package. Scenario JSON can be dumped, edited and re-run.
- **Data access:**
  > OSM data (ODbL) via Geofabrik or Overpass; A/B Street hosts pre-imported city maps for its own app. No Indian demand data ships with it.

### Engineering

- **Runs in browser or server:**
  > Both: full simulator runs natively (Windows/Mac/Linux) and in the browser as WebAssembly (play.abstreet.org); a 'headless' server mode exposes JSON over HTTP. osm2streets runs in browser (WASM), native Rust or Python.
- **Wasm or streaming feasibility:**
  > Proven WASM: both the simulator and osm2streets compile to WebAssembly and run client-side with no server. Caveats from the retrospective: one large WASM bundle 'didn't scale' and had to be split into per-city downloads, and detangling native-only dependencies was 'quite tough'. osm2streets-js is the most reusable piece: an npm package (Apache-2.0) with a JsStreetNetwork constructor and toGeojsonPlain / toLanePolygonsGeojson / toLaneMarkingsGeojson / toIntersectionMarkingsGeojson / toJson methods.
- **Api:**
  > A/B Street headless JSON-over-HTTP API (marked 'under construction', no backwards-compatibility guarantees): /sim/load, /sim/goto-time, /sim/new-person, /traffic-signals/get|set|get-delays|get-cumulative-thruput, /data/get-finished-trips|get-agent-positions|get-road-thruput|get-blocked-by-graph, /map/get-all-geometry|get-edits. It holds one map and one sim per server process and serialises requests. osm2streets: Rust crate, JS/WASM (osm2streets-js) and Python bindings.
- **Gpu requirement:** None for simulation; the native and WASM UI need WebGL/OpenGL for rendering.
- **Multi tenancy model:**
  > Client-side in the browser (zero server cost per user, static hosting). The headless server is single-tenant: one map and sim per process, with requests serialised.
- **Build complexity:**
  > High for the full simulator: a large Rust workspace (8,400+ commits), a city import pipeline and per-city data files. Moderate-low for osm2streets-js: npm install osm2streets-js (0.1.4, 2023) or build from main with wasm-pack and release_npm.sh. The npm build is stale relative to main.
- **Output metrics supported:**
  > Trip durations and before/after-edit comparisons, finished trips per mode, intersection delays, cumulative signal throughput, road throughput, live agent positions, and the blocked-by graph. No level of service, PCU, conflict or emissions output.

### Reuse verdict

- **Reuse mode:**
  > osm2streets: use as a data/geometry library (OSM -> lane polygons and intersection polygons as GeoJSON) in the browser. A/B Street simulator: inspiration and model to learn from (discrete-event design, uber-turns, block-the-box, gridlock lessons), not as an engine for Indian mixed traffic.
- **Effort within 72 hours:**
  > osm2streets-js: about 2-4 hours to load an OSM extract (Overpass XML) of an Indian junction or corridor in the browser and render lane and intersection polygons on a map; budget extra time for wrong lane counts and widths where OSM lacks lanes/width tags (common in India) and for flyovers whose layer tags are missing. Forking the A/B Street simulator to add mixed, non-lane traffic is not realistic in 72 hours (it would need a new lateral movement model); cut it. Using A/B Street unmodified as the engine is possible but gives lane-disciplined Western behaviour and a large Rust codebase to embed.
- **Licence constraint:**
  > Apache-2.0: permissive. Commercial or closed use is allowed; keep the licence and NOTICE files, state changes, and note the patent-grant termination clause. No copyleft obligation on our code. OSM-derived data stays under ODbL (attribution, share-alike on derived databases).

### Lessons

- **Known limitations:**
  > No acceleration or kinematics; limited lane changing ('one of the main limitations'); gridlock on large maps; bridges and tunnels ignored in geometry; highway ramps produce bad geometry; short roads are 'a currently unsolved problem'; output depends on OSM tag quality (turn lanes often wrong, signal timing not public); headless API unstable; osm2streets API unstable, with turning movements and crosswalks not implemented; no non-lane or mixed traffic; the simulator is no longer the maintainers' focus.
- **Documented failures:**
  > (1) Permanent gridlock in most large-map runs, caused by broken intersection geometry, cautious vehicles, poor signal timing and bad demand data; fixes gave 'only very modest success'. (2) Mandatory lane-changing was removed because agents repeatedly attempted manoeuvres they could not complete. (3) One broken bridge (Fremont, Seattle) spread gridlock across the network. (4) A single WASM blob holding all maps did not scale. (5) Re-importing about 130 maps from about 80 cities was hard to keep up. (6) Self-funded with few users of the simulator; the author calls not forming a business 'likely a mistake'.
- **Validation approach:**
  > Regression tests and screenshot diffs on imported maps (the author calls formal invariants 'pretty impossible targets'); osm2streets has a test suite of tricky real-world junctions (e.g. i5_exit_ramp, montlake_roundabout, taipei, perth_peanut_roundabout, frederiksted) with expected GeoJSON output; the StreetExplorer web app is used for visual checking. No empirical traffic-flow validation was found.
- **Takeaway for our build:**
  > Use osm2streets-js (Apache-2.0, WASM) as the OSM-to-geometry front end and visual base layer, but treat its output as a draft that the user can correct, because Indian OSM data often lacks lanes, width and layer tags. Keep the network model separate from the movement model. Do not inherit A/B Street's lane-queue movement model, which cannot represent Indian non-lane traffic. Design gridlock handling up front: detect it, report it and offer a release valve (teleport or timeout), because A/B Street shows that prevention alone fails on real networks. Treat flyovers explicitly: use the OSM layer/bridge tags plus no-shared-node topology, and validate that a road with layer!=0 never forms an at-grade junction with a layer-0 road. Ship a small, curated set of pre-imported scenarios (one or two Indian junctions), not a global importer, to avoid A/B Street's per-city maintenance burden and bundle-size problems.

### Sources

- **Links:**
  - https://github.com/a-b-street/abstreet
  - https://raw.githubusercontent.com/a-b-street/abstreet/main/README.md
  - https://github.com/a-b-street/osm2streets
  - https://github.com/a-b-street/osm2lanes
  - https://www.npmjs.com/package/osm2streets-js
  - https://registry.npmjs.org/osm2streets-js
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets-js/src/lib.rs
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets/src/road.rs
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets/src/intersection.rs
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets/src/transform/collapse_intersections.rs
  - https://github.com/a-b-street/osm2streets/tree/main/tests/src
  - https://a-b-street.github.io/osm2streets/
  - https://github.com/a-b-street/abstreet/tree/main/importer/config/in/pune
  - https://github.com/a-b-street/abstreet/blob/main/sim/src/lib.rs
  - https://github.com/a-b-street/abstreet/blob/main/map_model/src/objects/traffic_signals.rs
  - https://a-b-street.github.io/docs/tech/trafficsim/discrete_event/index.html
  - https://a-b-street.github.io/docs/tech/trafficsim/gridlock.html
  - https://a-b-street.github.io/docs/tech/trafficsim/travel_demand.html
  - https://a-b-street.github.io/docs/tech/map/importing/index.html
  - https://a-b-street.github.io/docs/tech/map/geometry/index.html
  - https://a-b-street.github.io/docs/tech/map/platform.html
  - https://a-b-street.github.io/docs/tech/dev/api.html
  - https://a-b-street.github.io/docs/project/history/retrospective/index.html
  - https://play.abstreet.org/0.3.49/abstreet.html

### Uncertain fields (left out above)

- calibration_dataset_used
- calibration_method
- emissions_support
- indian_calibration_evidence
- max_density_tested
- performance
- scenario_editability
- validation_against_field_case


## 3 MTGermany/mixedTraffic (Mixed Traffic Model)

*Outline id A03 · category simulator · priority high · source file `results/MTGermany_mixedTraffic.json`*

### Basic info

- **Name:** MTGermany/mixedTraffic (Mixed Traffic Model in-browser simulation)
- **Type:**
  > simulator (interactive in-browser demonstrator of a fully two-dimensional, lane-free mixed-traffic model on a single road)
- **Maintainer:** Martin Treiber (GitHub user MTGermany; TU Dresden). Single author repository.
- **First release:**
  > 2019 (GitHub repository created 2019-05-22; the model paper is Kanagaraj and Treiber, Physica A 2018)
- **Last activity:** 2026-04-30 (last commit on master, 'changed upload script')
- **Licence:** GPL-3.0 (LICENSE file in repository; GitHub reports GPL-3.0)
- **Language:**
  > JavaScript (about 271 KB, 14 files, about 8,700 lines in js/), HTML5 canvas, CSS; plus C++ and gnuplot analysis scripts in analysis/
- **Code availability:**
  > Full source on GitHub: https://github.com/MTGermany/mixedTraffic ; live demo at https://www.mtreiber.de/mixedTraffic/
- **Maintenance health:**
  > One maintainer, low community activity (17 stars, 2 forks at time of check). Commits are sporadic (2021-11 and 2023-01 parameter changes visible in code comments; last commit 2026-04). README_TODO dates from 2019 and is partly in German; listed TODO 'road link network as directed graph as in traffic-simulation.de' is still open. Code is research/demo quality with global variables and console-logging hooks, no tests, no build system, no module system.

### Model

- **Scale:**
  > Microscopic (continuous 2D particle model, time-continuous, ballistic integration at 30 fps with timewarp)
- **Car following:**
  > Longitudinal interaction is a generalised car-following model; default is the ACC model (IDM variant with 'coolness' factor), IDM also available in js/models.js. Default code parameters (sim_main.js): car v0=25 m/s, T=1 s, s0=2 m, a=2 m/s2, b=2 m/s2; truck v0=12 m/s, T=1.5 s, s0=2 m, a=1, b=2; bike/motorbike v0=25 m/s, T=0.5 s, s0=1.5 m, a=3, b=2. The longitudinal force from a leader is the CF interaction term multiplied by alpha=min(exp(-sy/s0y),1) where sy is the lateral gap; s0y=0.20 m in code. Only the most strongly interacting leader is used (arg max).
- **Lane model:**
  > No lanes by default: the road is one continuous 2D surface with left and right boundary functions widthLeft(u), widthRight(u). An optional 'Floor Field' toggle adds lateral forces pulling cars and trucks to the centres of five lanes while bikes ride between lanes; with the floor field the model becomes an integrated car-following plus continuous lane-changing model. Lane changes are therefore continuous steering, not discrete MOBIL events.
- **Lateral model type:**
  > Continuous 2D, force-based (social-force-like). Lateral acceleration = OVM-like relaxation (w0 - w)/tauLatOVM, where the desired lateral speed w0 is the sum of contributions from all relevant neighbours (generalised MOBIL acceleration shear), plus boundary forces, optional floor field, right-drive bias (accBiasRightTruck=0.8) and noise. Heading limited to dv/du <= 0.3.
- **Junction model:**
  > None. The simulation is a single road link drawn as a U-bend (600 m in sim_main.js), explicitly 'not intended to be part (link) of a network, for reasons of simplicity' (README). There are no intersections, merges, conflicts or priority rules. Users can drag traffic objects (obstacles, traffic lights, speed limits) onto the road; a red light is a standing virtual vehicle spanning the full stop line, and the MTM paper states stop signs are modelled the same way. Bottlenecks are created by road-width functions or obstacle vehicles.
- **Signal control modes:**
  > Fixed-time only: TrafficLightControlEditor.js (shared with traffic-simulation.de) lets the user set relative green duration and phase for traffic lights dropped on the road. No actuated, adaptive or learned control hooks.
- **Flyover support:** No. No ramps, merges, diverges or grade separation; single road only.
- **Grade separation handling:**
  > Not applicable in practice: there is no network, no layers and no import, so nothing to check or repair.
- **Vehicle types:**
  > Car (5.0 x 2.0 m), truck (10 x 2.5 m), bike (2.0 x 0.7 m; 'bicycles or motorbikes, depending on parameterisation'), and obstacle (10 x 1.5 m, v0=0). Composition set by FracTruck and FracBike sliders. Classes differ by dimensions, ACC parameters, right-drive bias and image. The IAM pages (sim_lanes_IAM.html 'City Traffic', sim_bicycles_IAM.html 'Bicycle Flow') add lane-based city and bicycle-path scenarios. No auto-rickshaw or bus class in code by default (the paper's Chennai calibration used motorcycle, car, bus, auto-rickshaw).
- **Gridlock policy:**
  > None (no junctions, so no junction gridlock). A code fix lifts the heading restriction when stuck behind an obstacle (speedLatStuck=1.2) and forces lateral desire when a leader is too close to a boundary to pass on that side, to avoid vehicles being 'trapped'. No teleporting and no gridlock reporting.

### India fit

- **Mixed traffic support:**
  > Yes, this is the core purpose: vehicles of very different widths and lengths share a continuous road surface; a narrow vehicle can pass a wide one whenever the lateral gap allows, and the longitudinal interaction fades exponentially with lateral gap. Calibrated in the paper on Chennai mixed traffic (motorcycles, cars, buses, auto-rickshaws).
- **Non lane behaviour:**
  > Full lane-free movement. Each vehicle has continuous lateral position and speed. Lateral motion arises from (1) repulsion proportional to the lateral derivative of the longitudinal interaction force of each neighbour (a continuous generalisation of MOBIL's incentive), linear in offset when overlapping and exponentially decaying otherwise (s0yLat=0.40 m in code, 0.30 m in the paper); (2) optional pushing from followers (pushLat slider, actio=reactio when 1); (3) boundary repulsion with a forward-looking anticipation of narrowings (sum over 8 look-ahead points up to about 2 stopping distances); (4) optional floor field. Lanes self-organise when the floor field is on and dissolve when it is off; the info page notes lane-free flow can be more efficient in congestion at strong bottlenecks.
- **Per class parameters:**
  > Code defaults (sim_main.js): car 5.0x2.0 m, v0=25 m/s, T=1 s, s0=2 m, a=2, b=2; truck 10x2.5 m, v0=12, T=1.5, s0=2, a=1, b=2; bike 2.0x0.7 m, v0=25, T=0.5, s0=1.5, a=3, b=2. Shared MTM parameters: s0y=0.20 m, s0yLat=0.40 m, sensLat=1.0 s, s0yB=0.15 m, s0yLatB=0.20 m, accLatBRef=4 m/s2, accLongBRef=2 m/s2, longParReductFactor=0.1, max heading tan 0.3, tauLatOVM/pushLong/pushLat from sliders. The Chennai-calibrated values are in the paper, not the code defaults (see Two-dimensional_lane-free_models.json): motorcycle 1.8x0.6 m, T=0.3 s, s0=0.5 m, a=2, b=2; car 4.2x1.7 m, T=0.8 s, s0=2 m, a=1, b=1; bus 10.3x2.1 m, T=1.0 s; auto-rickshaw 2.6x0.9 m, T=1.0 s.
- **Indian calibration evidence:**
  > The underlying MTM paper (Kanagaraj and Treiber 2018) calibrated on medium traffic in Chennai and validated on congested traffic: all simulated characteristics within 20% except the number of lateral shifts in the congested case (observed 14 vs simulated 9). The repository code itself is not shipped with the Chennai parameter set; its current defaults and the IAM scenario were tuned on Athens pNEUMA drone data (code comments 'Athens d8* data').
- **Calibration method:**
  > Paper: MATLAB genetic algorithm minimising the root of summed squared relative errors over five macroscopic measures (mean travel time, its standard deviation, entry flow, exit flow, number of lateral shifts) in a 47 m test section. The repo contains analysis/ C++ and gnuplot scripts for comparing simulated trajectories, but no calibration pipeline.
- **Max density tested:**
  > Paper validation case: about 790 veh/km on a 12 m roadway (450 motorcycles, 225 cars, 35 buses, 80 auto-rickshaws per km, 1D partial densities).
- **Validation against field case:**
  > Chennai six-lane urban arterial midblock (paper). No named Indian junction case (Hebbal, Silk Board or similar).

### Data

- **Network import:**
  > None. Road geometry is hard-coded as parametric axis functions axis_x(u), axis_y(u) and width functions in the scenario JS file. No OpenStreetMap or other import.
- **Demand input formats:**
  > Inflow slider (veh/h), FracTruck and FracBike sliders, MaxOutflow slider (downstream bottleneck), and custom microscopic initial conditions loaded from text files (IC-configurations/*.txt, for example IC_2lanes_zipper.txt). No OD matrices or routes.
- **Data access:**
  > Not a dataset. The simulator can export simulated trajectories to a downloaded text file (download button in gui.js, dt_export=0.05 s).

### Engineering

- **Runs in browser or server:** Browser only (plain JavaScript and HTML5 canvas, no server component, can run from a local file).
- **Wasm or streaming feasibility:**
  > No WASM needed: it is already native JavaScript running client-side. Could be moved into a Web Worker, but simulation, GUI and drawing are interleaved through globals and setInterval main_loop, so separation needs refactoring.
- **Api:**
  > None formal. Pseudo-classes road, vehicle, MTM/ACC/IDM in models.js can be called from JavaScript, but there is no module export, no headless mode and heavy reliance on global variables (for example longParReductFactor, sensLat, glob_* constants).
- **Gpu requirement:** None.
- **Multi tenancy model:**
  > Client-side: each viewer runs their own simulation; hosting is a static file server with near-zero marginal cost.
- **Build complexity:**
  > Very low to run (open index.html). Moderate to embed: no bundler, no modules, globals shared across files, and GUI coupling; porting the MTM math alone (about 600 lines in models.js plus the per-vehicle neighbour loop in road.js) is the realistic route.
- **Scenario editability:**
  > Road width (slider), variable-width bottlenecks left/right (toggles), inflow, max outflow, truck and bike fractions, model parameters (tauLatOVM, sensdvy, pushLat, pushLong), floor field on/off, drag-and-drop obstacles, traffic lights and speed limits, custom initial vehicle configurations from file. No network editing, no bus stops, no parking.
- **Output metrics supported:**
  > On-screen speed-density box plot and flow-density scatter (approximate macroscopic fundamental diagram, 3 s aggregation), stationary detector (stationaryDetector.js), trajectory export. No delay, LOS, PCU, emissions or conflict metrics.
- **Emissions support:** None.

### Reuse verdict

- **Reuse mode:**
  > Port the model. Reuse the MTM/IAM force equations and parameter structure (and possibly models.js directly under GPL) inside our own network engine; do not use as engine since it has no network, junctions or routing.
- **Effort within 72 hours:**
  > Porting the 2D force model into our own link-based engine: about 8 to 14 hours for a working version (longitudinal attenuation, lateral OVM relaxation with neighbour sum, boundary forces, heading cap, ballistic update, spatial index), plus 4 to 8 hours tuning so vehicles do not leave the road or jitter. The hard part not covered by this repo is junctions: lane-free vehicles must be handed between links and resolve conflicts in 2D, which has no reference here; within 72 hours we should cut lane-free behaviour inside junction boxes (use simple reservation or gap-acceptance zones) and keep 2D only on links, cut floor fields, cut follower pushing (pushLat=pushLong=0 as in the paper), and cut user-editable model parameters.
- **Licence constraint:**
  > GPL-3.0. Copying code (for example models.js) into our app and distributing it, including serving the JavaScript to browsers, requires releasing the combined client code under GPL-3.0 with source. A clean-room reimplementation from the published equations (Physica A paper, arXiv 1805.05076) avoids this; equations themselves are not copyrighted.

### Lessons

- **Known limitations:**
  > (1) Single road link only, no network, junctions, ramps or routing (README; TODO still open). (2) README_TODO bug note (2019): vehicles sometimes drive over the 'grass' (leave the road) when lateral pushes are on, at high speed, or when an obstacle ends abruptly. (3) Info page: floor field (lanes) only sensible without significant narrowings, otherwise vehicles may leave the road; activating both bottlenecks 'takes the model to its limits'. (4) Only landscape viewports supported. (5) Boundary widths must not change faster than about one stopping distance or obstacles must be used instead (models.js comment). (6) pushLong=1 removes the fundamental diagram; the paper model requires pushLat=pushLong=sensdvy=0. (7) Default parameters are tuned to the demo and Athens data, not to Indian traffic.
- **Documented failures:**
  > Vehicles leaving the road surface under strong lateral pushes, high speeds or abrupt obstacle ends (README_TODO, 2019-08-30); vehicles getting trapped behind slow vehicles near boundaries, fixed by a special-case override of the lateral desire (models.js comment 'introduced to avoid trapped cars behind slow vehs at boundaries'); lateral crashes at larger tauLatOVM (> about 1 s), fixed by adding the experimental sensdvy relative-lateral-speed term (info.html). Author noted that deactivating most boundary 'complications' gave better results (models.js calcAccB comment).
- **Validation approach:**
  > Visual plausibility on standard situations (overtaking, zipper merge, narrowing, door-like passage) plus comparison against field data: Chennai macroscopic measures in the 2018 paper and Athens pNEUMA trajectories in the IAM paper; C++/gnuplot analysis scripts in the repo compare simulated and observed trajectories.
- **Takeaway for our build:**
  > Treat MTM/IAM as the lateral-dynamics formula, not as an engine. Design rule: keep a link-based network engine (from traffic-simulation.de style road/connect architecture) and give each link a continuous lateral coordinate with width functions; compute longitudinal force as CF interaction times exp(-lateral gap/s0y) from the single strongest leader, and lateral desire as a summed, capped OVM relaxation; model red lights and stop lines as full-width virtual standing vehicles. Always hard-clamp vehicles to the road boundary and cap heading, because the author's own soft boundary forces let vehicles leave the road. Reimplement from the paper to avoid GPL obligations unless we are happy to open-source the client.

### Sources

- **Links:**
  - https://github.com/MTGermany/mixedTraffic
  - https://github.com/MTGermany/mixedTraffic/blob/master/README.md
  - https://github.com/MTGermany/mixedTraffic/blob/master/README_TODO
  - https://github.com/MTGermany/mixedTraffic/blob/master/LICENSE
  - https://github.com/MTGermany/mixedTraffic/blob/master/js/models.js
  - https://github.com/MTGermany/mixedTraffic/blob/master/js/sim_main.js
  - https://github.com/MTGermany/mixedTraffic/blob/master/js/TrafficObjects.js
  - https://github.com/MTGermany/mixedTraffic/blob/master/js/gui.js
  - https://github.com/MTGermany/mixedTraffic/blob/master/info.html
  - https://www.mtreiber.de/mixedTraffic/
  - https://arxiv.org/abs/1805.05076
  - https://doi.org/10.1016/j.physa.2018.05.086
  - https://arxiv.org/abs/2310.16816
  - https://toledo.net.technion.ac.il/?p=387

### Uncertain fields (left out above)

- calibration_dataset_used
- performance
- seepage_filtering_support


## 4 traffic-simulation.de / MovSim

*Outline id A04 · category simulator · priority high · source file `results/traffic-simulation-de_MovSim.json`*

### Basic info

- **Name:** traffic-simulation.de (movsim/traffic-simulation-de) and MovSim (movsim/movsim)
- **Type:**
  > simulator (lane-based microscopic browser simulator in JavaScript, plus the related Java desktop/CLI simulator MovSim)
- **Maintainer:**
  > Martin Treiber (TU Dresden) for traffic-simulation.de; MovSim copyright Arne Kesting, Martin Treiber, Ralph Germ and Martin Budden, under the movsim GitHub organisation.
- **First release:**
  > traffic-simulation-de GitHub repository created 2016-09-27 (JavaScript version); MovSim repository created 2011-07-01, described in Treiber and Kesting, IEEE ITS Magazine 2010.
- **Last activity:**
  > traffic-simulation-de: last commit 2026-10-29. MovSim: last commit 2026-09-02 ('upgraded dependencies, cleanups'), with dependabot merges in 2025-12.
- **Licence:**
  > GPL-3.0 for both (LICENSE file in traffic-simulation-de; MovSim README: 'licensed under GPL version 3', with commercial use by contacting the copyright holders).
- **Language:**
  > traffic-simulation-de: JavaScript (about 2.4 MB of JS including English, German and Spanish copies of each scenario; road.js alone 5,242 lines), HTML5 canvas, CSS. MovSim: Java 8+ with Maven (about 1.16 MB of Java), JAXB XML configuration.
- **Code availability:**
  > Full source on GitHub: https://github.com/movsim/traffic-simulation-de (live at https://traffic-simulation.de) and https://github.com/movsim/movsim .
- **Maintenance health:**
  > traffic-simulation-de: single active developer (Treiber), frequent commits, about 1,058 stars and 157 forks; many forks are student copies and drift. Code is per-scenario copy-and-modify (each scenario has .js, _gui.js, and _ger/_es copies), so fixes do not propagate automatically and many README_* files are working notes, some in German or personal email. MovSim (Java): about 340 stars, 94 forks, mainly maintenance updates (dependency bumps) in recent years; its README still references Travis CI.

### Model

- **Scale:**
  > Microscopic (time-continuous car-following with ballistic update; MovSim Java also includes cellular automata and coupled-map models).
- **Car following:**
  > JS: ACC model (IDM extension with 'coolness' factor, Treiber and Kesting book ch. 12.5) by default, original IDM selectable by replacing 'new ACC' with 'new IDM'; parameters deliberately set to produce very string-unstable traffic for visual effect (README_tips4scientificUse). Acceleration noise QnoiseAccel (default 0.05 to 0.1 m2/s3) and inter-driver variation driver_varcoeff=0.15 on v0 and T. MovSim Java: IDM, ACC/Enhanced IDM, OVM/Bando, Velocity Difference Model, Gipps, Krauss, Nagel-Schreckenberg CA, Kerner-Klenov-Wolf CA, plus memory and noise driver models.
- **Lane model:**
  > Discrete lanes per road link (fixed lane count per link, numbered from the left, lateral coordinate v positive to the right). Lane changes by MOBIL with speed-dependent bSafe to make changes more aggressive in congestion; mandatory lane changes before lane closures and offramps via setLCMandatory and route-driven bias; lane-changing bans by range; minimum waiting times after active and passive changes. Lane changes are instantaneous in logic with smooth drawing.
- **Lateral model type:**
  > None (discrete lanes). Lateral position within a lane is not modelled; the separate mixedTraffic project is the 2D variant.
- **Junction model:**
  > Network of directed logical road links connected by road.connect(target, uSource, uTarget, offsetLane, conflicts, maxspeed, targetPrio). Vehicles carry a route (sequence of roadIDs). Without conflicts, a connection acts like a pointwise merge (only target-road vehicles are checked). With conflicts, road.determineConflicts checks vehicles on crossing links that are approaching conflict points; the intersection scenario defines per-OD conflict lists for three rule sets (trafficRuleIndex 0 = priority road, 1 = right-before-left, 2 = traffic lights; left turners keep some conflicts under signals). Gap acceptance design notes (README_intersections) use an obstruction criterion plus a time-to-collision threshold of about 3 s. Ramps use road.mergeDiverge over a parallel section, with a standing virtual obstacle at the merge end. Roundabouts are modelled as a ring link with on-ramps and off-ramps for each arm (4-arm design with OD presets and a toggle between ring priority and right priority; a multi-lane roundabout page exists). Red lights are rows of standing virtual obstacle vehicles, one per lane.
- **Signal control modes:**
  > Fixed-time: TrafficLightControlEditor.js lets users set relative green duration and phase per light; lights can also be toggled by click and dragged from a depot. No actuated or adaptive control, no learned-control hooks. Ramp-metering game lets a human act as controller. MovSim Java supports traffic lights configured in XML.
- **Flyover support:**
  > Partial. On-ramps, off-ramps, merges, diverges, weaving and lane drops are fully supported. Grade separation is implicit: links only interact where explicitly connected, so two links whose drawings cross do not conflict; overpasses are purely a drawing-order trick ('offramp bridge => draw last' in offramp.js, routing.js), and road.js drawing accepts umin/umax 'useful for bridges'.
- **Grade separation handling:**
  > No layer or elevation model, no import, no checks or repair. Geometry is hand-coded per scenario as trajectory functions x(u), y(u); conflicts and connections are hand-specified. A bridge is just a link drawn last.
- **Vehicle types:**
  > Car and truck (default), obstacles (user-movable and fixed), virtual traffic-light vehicles, ego vehicle id; ids encode type ranges (1 ego, 10-49 clicked, 50-99 obstacles, 100-149 traffic lights, >=200 normal). onramp_scooters.js adds a scooter class (2.5 x 1.5 m, described as 'kind of tricycles' for a 2023 user request); README_carsAndScooters explains rescaling cars and trucks to emulate scooters. Classes differ by length, width, ACC parameters and truck right-lane preference. No motorcycle, auto-rickshaw or bus class by default.
- **Gridlock policy:**
  > Two ad-hoc hacks, reported only to the browser console: (1) road.connect force-hack: if a vehicle on a closing lane stays below 0.2 m/s for 0.8 s it is moved by force onto the target link ('moved by force to new link'); (2) intersection.js with right-before-left rules periodically calls resolveGridlock() for 1.5 s every 10 s, temporarily giving the main road priority. The source notes that keeping all conflicts under signal control 'will lead to gridlocks', so some conflicts are deliberately dropped. No teleport statistics are exposed to users.

### India fit

- **Mixed traffic support:**
  > Weak. Two vehicle classes in lanes; heterogeneity only through length, width and parameters. Smaller vehicles cannot share a lane side by side or filter between lanes.
- **Non lane behaviour:**
  > None in traffic-simulation.de or MovSim; vehicles always occupy exactly one lane. The author's lane-free work is in the separate MTGermany/mixedTraffic project, which is not integrated into this network code.
- **Seepage filtering support:** No.
- **Per class parameters:**
  > No published Indian per-class values. Defaults are demo values chosen to produce visible stop-and-go waves; the author recommends using the book's standard parameters for scientific use (README_tips4scientificUse). Scooter scenario dimensions: car 5.0 x 2.2 m, truck 12.5 x 3.0 m, scooter 2.5 x 1.5 m (onramp_scooters.js).
- **Calibration dataset used:**
  > None for Indian traffic. The simulator can generate trajectories and leader-follower pairs for external calibration studies (README_trajData4ExternalUse, README_createLFpairs).
- **Max density tested:** Not reported.
- **Validation against field case:**
  > None for India. Scenarios are stylised (ring, on-ramp, roadworks, uphill, roundabout, intersection) with some German road names (BaWue, S71) rather than validated field cases.

### Data

- **Demand input formats:**
  > JS: inflow sliders (veh/h) at upstream boundaries with a fractional inflow buffer, truck fraction slider, route fractions (for example offramp or roundabout OD presets), density slider on the ring road, and micro initialisation via road.initializeMicro. MovSim Java: XML (.xprj) configuration of sources, routes, vehicle types and traffic composition, with CSV output.
- **Data access:**
  > Not a dataset. JS simulator exports trajectory files (road<n>_time<t>.txt, dt_export default 0.5 s) and virtual detector files via a download button.

### Engineering

- **Runs in browser or server:**
  > traffic-simulation.de runs entirely in the browser (static files, setInterval main loop at 30 fps). MovSim runs as a Java desktop viewer or command-line batch simulator on a server or workstation.
- **Api:**
  > JS: no formal API; pseudo-classes road, vehicle, models (IDM, ACC, MOBIL), TrafficObjects and stationaryDetector, with heavy use of globals and per-scenario setup code. README explains how to add a new model (CACC skeleton via testNewModel flag). MovSim Java: XML config plus command-line; Java library classes in core.
- **Gpu requirement:** None.
- **Multi tenancy model:**
  > JS: client-side, one simulation per browser tab, static hosting with near-zero server cost. MovSim Java: process per scenario on a server if offered as a service.
- **Build complexity:**
  > JS: zero build (open the HTML file), but embedding is hard: each scenario is a monolithic script with its own globals and GUI; road.js is a 5,000-line class mixing simulation, network connection and drawing. Lifting road.js, models.js, vehicle.js and TrafficObjects.js into a module is a few hours of refactoring. MovSim Java: Maven build, Java 8+.
- **Scenario editability:**
  > Users can change inflow, truck fraction, speed limits, model parameters (v0, T, s0, a, b, politeness), drag obstacles, traffic lights and speed limits onto roads, edit fixed-time signal plans, choose roundabout OD presets and priority rules, and choose intersection rule type. Road geometry, lane counts and widths are fixed per scenario (some scenarios add or remove a lane). No bus stops, parking or network editing UI.
- **Output metrics supported:**
  > Virtual stationary detectors (flow, speed), trajectory export, travel-time displays in routing games, speed colour maps; coffeemeter game shows ride comfort. No LOS, PCU, queue-length or conflict metrics. MovSim Java: detectors, spatiotemporal fields, floating-car data, travel times, and fuel consumption.
- **Emissions support:**
  > traffic-simulation.de: none found in the JS sources. MovSim Java: physics-based fuel-consumption and emissions model (not HBEFA).

### Reuse verdict

- **Reuse mode:**
  > Inspiration and architecture reference, and optionally port selected code. The road-link plus connect/conflicts/mergeDiverge design, parallel update order, virtual-vehicle traffic lights and inflow-buffer boundary conditions are directly reusable patterns for a lane-based or hybrid browser engine. Not usable as-is for Indian mixed traffic.
- **Effort within 72 hours:**
  > Forking a scenario and re-skinning it (rename trucks/cars, add a motorbike class with small width) could produce a lane-based demo in about 4 to 6 hours, but it would not show lane-free behaviour. Extracting road.js/models.js into a reusable engine with a user-editable network: about 12 to 20 hours, because every network is hand-coded and conflicts are specified manually per OD. Replacing lanes with a continuous lateral model (MTM) inside road.js is a deep rewrite of neighbour search, lane changing, mergeDiverge and connect, likely beyond 72 hours together with UI and OSM import. Cut: roundabouts, right-before-left rules, routing games, multilingual pages, MovSim Java entirely.
- **Licence constraint:**
  > GPL-3.0 for both. Copying JS code into our web app and distributing it to browsers obliges us to release the client code under GPL-3.0 with source. MovSim commercial use requires contacting the copyright holders. Reimplementing the published IDM/ACC/MOBIL equations ourselves avoids the obligation.

### Lessons

- **Known limitations:**
  > (1) Author: intersection and connection logic 'not yet perfect' (README) and right turns need much anticipation heuristics. (2) Parameters chosen for visible instability, not realism (README_tips4scientificUse). (3) Inter-link update is not fully sequential across dependent links (README: 'presently, is not done'). (4) No network import; all geometry and conflicts hand-coded. (5) Lane-based only; no mixed-traffic or lateral model. (6) README_intersections: a full 12-OD X intersection was judged too complex for the original project's intent. (7) Code duplication across scenario and language copies. (8) MovSim Java is mainly in maintenance mode.
- **Documented failures:**
  > Gridlocks at right-before-left intersections when all four arms have waiting vehicles (solved by periodically forcing main-road priority, resolveGridlock); gridlocks when all conflicts are kept under signal control because secondary-road vehicles always 'fear' waiting main-road vehicles (some conflicts dropped); vehicles stuck on closing lanes (force-moved after 0.8 s); README_speedlimit_bug_2019_12 records a speed-limit bug; README_Gridlock email notes that early lane changes in dense traffic cause self-blocking at roadworks.
- **Validation approach:**
  > Model-level validation in the authors' publications and textbook (IDM, ACC, MOBIL, numerical integration comparison in Treiber and Kanagaraj 2015); simulator correctness shown by reproducing qualitative phenomena (stop-and-go waves, capacity drop, bottleneck effects) and by detector and trajectory exports; no published validation of the browser network logic against field junction data.
- **Takeaway for our build:**
  > Copy the architecture, not the code: model the network as directed road links with arc-length coordinate u and lateral coordinate v, link-to-link connect(source, uSource, target, uTarget, laneOffset, conflicts) with routes per vehicle, ramps as parallel merge/diverge zones, signals as full-width standing virtual vehicles, and a strict parallel update order (accelerations, then lateral moves, then merges, then positions, then boundary conditions, then connections). From day one build an explicit, counted and user-visible gridlock breaker (timeout plus forced release), because even Treiber needed hidden console-only hacks; and generate conflict lists automatically from geometry rather than hand-coding them per OD.

### Sources

- **Links:**
  - https://github.com/movsim/traffic-simulation-de
  - https://github.com/movsim/traffic-simulation-de/blob/master/README.md
  - https://github.com/movsim/traffic-simulation-de/blob/master/LICENSE
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_intersections
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_roundabouts
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_IntersectionsVarNetworks.txt
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_tips4scientificUse
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_carsAndScooters.txt
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_3d
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_Gridlock
  - https://github.com/movsim/traffic-simulation-de/blob/master/js/road.js
  - https://github.com/movsim/traffic-simulation-de/blob/master/js/intersection.js
  - https://github.com/movsim/traffic-simulation-de/blob/master/js/onramp_scooters.js
  - https://github.com/movsim/traffic-simulation-de/blob/master/js/TrafficLightControlEditor.js
  - https://traffic-simulation.de
  - https://github.com/movsim/movsim
  - https://github.com/movsim/movsim/blob/develop/README.md
  - https://arxiv.org/abs/1012.4913
  - https://arxiv.org/abs/1403.4881

### Uncertain fields (left out above)

- calibration_method
- indian_calibration_evidence
- network_import
- performance
- wasm_or_streaming_feasibility


## 5 SiMTraM

*Outline id A08 · category simulator · priority high · source file `results/SiMTraM.json`*

### Basic info

- **Name:** SiMTraM (Simulation of Mixed Traffic Mobility)
- **Type:** simulator (strip-based mixed-traffic extension of SUMO)
- **Maintainer:**
  > Transportation Systems Engineering lab, IIT Bombay (Tom V. Mathew, Caleb Ronald Munigety, Ashutosh Bajpai); SourceForge user 'simtram'
- **First release:** 2013 (SourceForge project registered 2013-02-05; versions 0.1.0 and 0.1.1)
- **Last activity:**
  > Software: 2013-04-29 (SiMTraM-0.1.1-winbin.zip). Paper: Journal of Computing in Civil Engineering, 2015 (DOI 10.1061/(ASCE)CP.1943-5487.0000378)
- **Licence:** GPLv3 (as declared on the SourceForge project page)
- **Maintenance health:**
  > Abandoned. No release since April 2013 (13+ years). Zero recent downloads (about 1,899 all-time), no reviews, no issue tracker activity. The SUMO fork base is many major versions behind the current 1.28.0, so forward-porting would mean re-implementation, not merging

### Model

- **Scale:** Microscopic
- **Lane model:**
  > Each lane is divided into strips of configurable width. A vehicle occupies as many contiguous strips as its width requires and moves along them. Lateral movement is 'discrete gradual lane changing': strip-by-strip shifts, with a strip-change parameter (lambda) calibrated on the observed number of strip changes. When strip width equals lane width, the model reduces to ordinary lane-based SUMO
- **Lateral model type:** Strip-based (discretised lateral positions, conceptually close to SUMO's later sublane model)

### India fit

- **Mixed traffic support:**
  > Yes, the central purpose: homogeneous and heterogeneous traffic, a mix of vehicle types, vehicles not restricted to lanes (SourceForge feature list)
- **Non lane behaviour:**
  > Supported through strips: vehicles position laterally at strip granularity, and narrower strips give near-continuous lateral movement. Tests showed throughput rises as strip width falls, and strip width equal to lane width matched the lane-based model, a useful sanity check. Lane markings remain the outer frame of the road, so this is lane-free within a carriageway rather than free 2D

### Engineering

- **Runs in browser or server:** Desktop native (Windows binary; Linux claimed)
- **Wasm or streaming feasibility:**
  > Not practical: binary-only, outdated build chain, no maintained API surface. It would have to run as a server binary under Wine or Windows
- **Gpu requirement:** None
- **Multi tenancy model:** Process per scenario, as with SUMO; would need Windows workers. Not viable for hosting
- **Build complexity:** High: no source found to build, and a 2013 Windows binary is hard to containerise on Linux servers

### Reuse verdict

- **Reuse mode:**
  > Inspiration only: reuse the modelling idea and its published validation, not the code. The idea maps directly onto modern SUMO's sublane model (--lateral-resolution ≈ strip width, vType width ≈ strip occupancy)
- **Effort within 72 hours:**
  > Adopting the binary: not feasible (Windows-only 2013 build, no source, obsolete TraCI). Adopting the idea: about 1-2 hours. Set SUMO --lateral-resolution to a strip width of about 0.5-0.8 m, define Indian vTypes with realistic widths, and run a sanity test that throughput rises as resolution narrows and that resolution = lane width matches lane-based results. Cut: porting SiMTraM's custom leader logic and its calibrated parameters unless the paper full text is obtained
- **Licence constraint:**
  > GPLv3: linking or redistributing its code would force GPLv3 on derived distributed code. Moot in practice because no source was found and we will not reuse its code. Reimplementing the published idea carries no licence obligation

### Lessons

- **Known limitations:**
  > Strip discretisation restricts lateral positions to strip multiples. Remains bounded by lane geometry. Abstracts state no quantitative error. Only midblock validation is clear. Single site (Mumbai). Software frozen at a 2013 SUMO base and binary-only, so results are not reproducible today
- **Validation approach:**
  > Calibration of the strip-change parameter on observed strip changes, validation against Mumbai Eastern Express Highway video data, plus a consistency check that strip width equal to lane width reproduces lane-based throughput
- **Takeaway for our build:**
  > Lateral discretisation (strips or sublanes) is the proven, cheap way to get Indian mixed traffic in a lane-based engine. Use SUMO's maintained sublane model instead of a fork. Keep the SiMTraM sanity test (resolution = lane width must reproduce lane-based output; finer resolution should raise throughput) as an automated regression check. Never fork the engine core inside a 72-hour build: forks rot, as SiMTraM did

### Sources

- **Links:**
  - https://sourceforge.net/projects/simtram/
  - https://sourceforge.net/projects/simtram/files/
  - https://sourceforge.net/p/simtram/
  - https://doi.org/10.1061/(ASCE)CP.1943-5487.0000378
  - https://krishi.icar.gov.in/ohs-2.3.1/index.php/record/view/138368
  - https://www.bohrium.com/paper-details/strip-based-approach-for-the-simulation-of-mixed-traffic-conditions/813170996822409217-3945
  - https://sumo.dlr.de/docs/Simulation/SublaneModel.html
  - https://sumo.dlr.de/docs/ChangeLog.html

### Uncertain fields (left out above)

- api
- calibration_dataset_used
- calibration_method
- car_following
- code_availability
- demand_input_formats
- documented_failures
- emissions_support
- flyover_support
- grade_separation_handling
- gridlock_policy
- indian_calibration_evidence
- junction_model
- language
- max_density_tested
- network_import
- output_metrics_supported
- per_class_parameters
- performance
- scenario_editability
- seepage_filtering_support
- signal_control_modes
- validation_against_field_case
- vehicle_types


## 6 Web reference architectures

*Outline id A15 · category simulator · priority high · source file `results/Web_reference_architectures.json`*

### Basic info

- **Name:**
  > Web reference architectures: SUMO-Web3D, alexose/traffic-visualizer, FOSS4G 2025/2026 Korean web traffic simulation platform
- **Type:**
  > simulator (three reference web architectures: server-side engine streaming to browser; engine in browser as Rust/WASM; microservice platform with scenario editor)
- **Maintainer:**
  > SUMO-Web3D: Sidewalk Labs (github.com/sidewalklabs/sumo-web3d; not eclipse-sumo/sumo-web3d, which does not exist). traffic-visualizer: individual developer Alex Ose (github.com/alexose). FOSS4G platform: Hansang Kim and Sungjo Min (FOSS4G 2025 talk); Cheun-gill Park (Gaia3D, Head of DT Department) and Kim Deokhyeon (FOSS4G 2026 talk); funded by Korean IITP grant RS-2024-00459703
- **First release:**
  > SUMO-Web3D: repository created 2017-12-21, PyPI 1.0.0 on 2018-02-22. traffic-visualizer: commits from January 2026, repository created 2026-02-08. FOSS4G platform: presented 2025-11-20 (FOSS4G 2025) and 2026-09-01 (FOSS4G 2026, described as the project's third year)
- **Last activity:**
  > SUMO-Web3D: last code commit 2018-11-15, PyPI 1.0.1 on 2018-06-14, repository archived (read-only). traffic-visualizer: last commit 2026-02-08 ('Adding stuff'), 12 commits total, 3 stars. FOSS4G platform: FOSS4G 2026 talk 2026-09-01; no public repository found
- **Language:**
  > SUMO-Web3D: Python 3 server (aiohttp, websockets, lxml, xmltodict) + TypeScript/React/three.js client. traffic-visualizer: Python data pipeline, Rust simulation compiled to WASM with wasm-bindgen, TypeScript WebGL2 renderer. FOSS4G platform: CesiumJS (3D), OpenLayers (2D WebGL), PostGIS/PostgreSQL; engine language not disclosed
- **Code availability:**
  > SUMO-Web3D: source at https://github.com/sidewalklabs/sumo-web3d and pip package sumo-web3d. traffic-visualizer: source at https://github.com/alexose/traffic-visualizer (no licence). FOSS4G platform: talk abstracts and a workflow PDF only; no repository found under the Gaia3D GitHub organisation (checked: no traffic-related repository) - code availability unconfirmed
- **Maintenance health:**
  > SUMO-Web3D: dead since 2018 and archived; pinned to SUMO 0.31-era tooling, and the README warns Mac users must build SUMO themselves. traffic-visualizer: a one-month personal prototype, single author, no releases, no licence. FOSS4G platform: an active government-funded R&D project (2025 to 2026) but closed or unpublished code.

### Model

- **Car following:**
  > SUMO-Web3D: whatever SUMO is configured with (default Krauss); it is only a visualiser. traffic-visualizer: Intelligent Driver Model (simulation/src/idm.rs). FOSS4G platform: not disclosed
- **Signal control modes:** SUMO-Web3D: SUMO signals, read-only in the viewer. Others: not documented
- **Grade separation handling:**
  > SUMO-Web3D draws SUMO's z coordinates; it does no import checking. FOSS4G 2026 lists overpass/underpass editing as a new UX feature but gives no algorithm. traffic-visualizer: not documented
- **Vehicle types:**
  > SUMO-Web3D: SUMO vehicle and person types (cars, buses, pedestrians shown). traffic-visualizer: trip types coloured by purpose ('Trip types + color' commit). FOSS4G: not disclosed
- **Gridlock policy:** SUMO-Web3D: SUMO's (teleport by default). Others: not documented

### India fit

- **Mixed traffic support:** None of the three addresses Indian mixed traffic; SUMO-Web3D could show SUMO sublane runs.
- **Non lane behaviour:** Not addressed by any of the three (SUMO-Web3D only passes through whatever SUMO computes).
- **Seepage filtering support:** Not addressed by any of the three.
- **Per class parameters:** None published by any of the three.
- **Indian calibration evidence:**
  > None; the targets are Bologna/Toronto demo scenarios (SUMO-Web3D), Portland, Oregon (traffic-visualizer) and Seoul/Daejeon (FOSS4G).
- **Calibration dataset used:**
  > traffic-visualizer: OSM, Oregon Metro RLIS parcels, US Census ACS, LEHD LODES commute flows (synthetic population). FOSS4G: Seoul and Daejeon transport network and station data (GeoJSON/PostGIS). SUMO-Web3D: SUMO example scenarios.
- **Validation against field case:** None reported.

### Data

- **Network import:**
  > SUMO-Web3D: reads SUMO .net.xml and poly files (built beforehand with netconvert/osmWebWizard), and the server reformats them for three.js. traffic-visualizer: an offline Python pipeline fetches OSM plus local datasets and emits binary files the WASM engine loads (load_network, load_routes, load_agents, load_parking, load_corridors). FOSS4G platform: GeoJSON and PostGIS network and station data, with 2026 adding import/export for external simulation engines and GIS formats.
- **Demand input formats:**
  > SUMO-Web3D: SUMO route files via .sumocfg (with --sumo-args such as --scale 10). traffic-visualizer: synthetic agents from census and LEHD flows, precomputed by the pipeline. FOSS4G: 'demand conditions' configured in the scenario editor (format not disclosed).
- **Data access:** traffic-visualizer data are US public datasets fetched by 'make data'. Others: N/A.

### Engineering

- **Runs in browser or server:**
  > SUMO-Web3D: engine on the server (SUMO subprocess + Python TraCI bridge), rendering in the browser. traffic-visualizer: engine and rendering both in the browser (Rust->WASM + WebGL2), with only static files served. FOSS4G platform: server-side microservices with a browser client (OpenLayers 2D editing, CesiumJS 3D playback).
- **Wasm or streaming feasibility:**
  > SUMO-Web3D demonstrates streaming: the server keeps a list of vehicles and people and sends 'frame-by-frame diffs' over a WebSocket to a three.js client. traffic-visualizer demonstrates WASM: a Simulation object exposing tick(dt), get_visible_agents(bbox) -> Vec<f32> (flat float buffer for the GPU), get_stats and get_congestion_stats. FOSS4G: microservices so each function scales independently, with a shared state-management layer between Cesium and OpenLayers.
- **Api:**
  > SUMO-Web3D: TraCI between server and SUMO; WebSocket JSON diffs to the client; scenarios registered in scenarios.json. traffic-visualizer: wasm-bindgen JS class (new, load_*, tick, get_visible_agents, get_stats). FOSS4G: not published.
- **Gpu requirement:** No CUDA. All three need WebGL (WebGL2 for traffic-visualizer) in the client browser.
- **Multi tenancy model:**
  > SUMO-Web3D: one SUMO subprocess per server process and a single shared simulation, so every viewer sees the same run; per-user scenarios would need one process per session. traffic-visualizer: fully client-side, so each user runs their own simulation at zero server cost. FOSS4G: microservices (details not disclosed).
- **Build complexity:**
  > SUMO-Web3D: 'pip install sumo-web3d' plus a system SUMO install and SUMO_HOME; stale (2018) dependencies, so expect breakage with current SUMO and Python. traffic-visualizer: Python 3.10+, Rust + wasm-pack, Node 18+, with 'make data', 'make wasm' and 'make dev'. FOSS4G: not available.
- **Scenario editability:**
  > SUMO-Web3D: none (view only; scenario chosen from a dropdown). traffic-visualizer: playback speed and agent inspection; no network editing. FOSS4G platform: the only one with a scenario editor (modify road network and route structure, configure demand, Edit -> Simulate -> Visualize -> Analyze workflow, side-by-side scenario comparison, time filter, route-change analyser; 2026 adds overpass/underpass control and dashboard reports).
- **Output metrics supported:**
  > SUMO-Web3D: visual only. traffic-visualizer: aggregate stats and per-zone congestion. FOSS4G: route-change analysis, scenario comparison, trip lines and OD matrices (companion 2025 visualisation talk), and policy dashboards (2026).
- **Emissions support:**
  > None in the three web layers themselves (SUMO's own emission models would be available behind SUMO-Web3D).

### Reuse verdict

- **Reuse mode:**
  > Inspiration only for all three. SUMO-Web3D: copy the pattern (TraCI subscription -> diff -> WebSocket -> three.js), not the archived code. traffic-visualizer: copy the pattern (WASM tick + flat Float32 buffer for the visible bounding box -> WebGL2 instanced draw); the code cannot be legally reused without a licence. FOSS4G: copy the product workflow (Edit -> Simulate -> Visualize -> Compare); there is no code to reuse.
- **Licence constraint:**
  > SUMO-Web3D EPL-2.0: weak copyleft at file level; modified EPL files must be released as source, but separate files of our own can use any licence. traffic-visualizer: no licence, so the code cannot legally be copied; only ideas can be reused. FOSS4G: no code; talk materials CC BY 4.0 (attribution).

### Lessons

- **Known limitations:**
  > SUMO-Web3D: archived, no editing, a single shared simulation, needs a native SUMO install, dependencies frozen at 2018 versions. traffic-visualizer: 12-commit prototype, US-specific data pipeline, no licence, no documentation of the model, no editing. FOSS4G platform: code not public, no performance numbers, engine unnamed; the Korean context (lane-based) does not transfer to Indian mixed traffic.
- **Validation approach:**
  > Visual demonstration only (screenshots, demo scenarios; conference talks). No quantitative validation in any of the three.
- **Takeaway for our build:**
  > Pick one of two proven shapes and do not mix them: (a) server engine -> WebSocket diffs (SUMO-Web3D shape), or (b) WASM engine in the browser -> flat Float32 buffers -> WebGL instanced rendering (traffic-visualizer shape). In both, send only positions of agents inside the current viewport, as compact typed arrays rather than per-vehicle JSON, because TraCI per-vehicle polling alone is about 11x slower than plain SUMO. Borrow the FOSS4G product loop (Edit -> Simulate -> Visualize -> Compare two scenarios side by side), since comparing scenarios is what planners value. Make overpass/underpass editing an explicit editor feature, as the Korean team had to add in year three. Do not depend on any of these codebases: one is archived, one is unlicensed and one is unpublished.

### Sources

- **Links:**
  - https://github.com/sidewalklabs/sumo-web3d
  - https://raw.githubusercontent.com/sidewalklabs/sumo-web3d/master/README.md
  - https://raw.githubusercontent.com/sidewalklabs/sumo-web3d/master/setup.py
  - https://pypi.org/project/sumo-web3d/
  - https://api.github.com/repos/sidewalklabs/sumo-web3d
  - https://github.com/alexose/traffic-visualizer
  - https://raw.githubusercontent.com/alexose/traffic-visualizer/HEAD/README.md
  - https://github.com/alexose/traffic-visualizer/blob/HEAD/simulation/src/lib.rs
  - https://github.com/alexose/traffic-visualizer/blob/HEAD/simulation/Cargo.toml
  - https://api.github.com/repos/alexose/traffic-visualizer
  - https://talks.osgeo.org/foss4g-2025/talk/GSE9DT/
  - https://talks.osgeo.org/foss4g-2025/talk/Q8C3FK/
  - https://talks.osgeo.org/foss4g-2026/talk/QY3TUS/
  - https://github.com/Gaia3D
  - https://sumo.dlr.de/docs/TraCI/index.html

### Uncertain fields (left out above)

- calibration_method
- documented_failures
- effort_within_72_hours
- flyover_support
- junction_model
- lane_model
- lateral_model_type
- licence
- max_density_tested
- performance
- scale


---

# B. Behaviour models

## 7 Car-following models

*Outline id B01 · category model · priority high · source file `results/Car-following_models.json`*

### Basic info

- **Name:**
  > Car-following models (IDM, Krauss, Gipps, Wiedemann-74/99, Nagel-Schreckenberg) and their Indian calibrations
- **Type:** model (family of longitudinal vehicle-following models)
- **Maintainer:**
  > Academic models: IDM by Treiber, Hennecke and Helbing (2000); Krauss by S. Krauss (1998, SUMO default); Gipps by P.G. Gipps (1981); Wiedemann-74/99 by R. Wiedemann (PTV Vissim); Nagel-Schreckenberg cellular automaton by K. Nagel and M. Schreckenberg (1992). Indian calibrations by IIT Madras / TU Dresden (Kanagaraj, Treiber, Chaudhari, Kulkarni, Asaithambi), IIT Bombay (Mathew, Ravishankar) and NIT Karnataka.
- **First release:**
  > 1981 (Gipps); 1992 (Nagel-Schreckenberg); 1998 (Krauss); 2000 (IDM). Wiedemann psycho-physical model 1974, W99 variant 1999.
- **Licence:**
  > Models are published equations (no licence). Reference implementations: SUMO (EPL-2.0) implements Krauss, IDM, EIDM, W99, Wiedemann; Treiber's mixedTraffic JavaScript (GPL-3.0) implements IDM/ACC-based 2D model.
- **Language:**
  > Language-independent equations; reference implementations in C++ (SUMO) and JavaScript (Treiber's traffic-simulation.de / mixedTraffic).
- **Code availability:**
  > Source available: SUMO car-following models (https://sumo.dlr.de/docs/Car-Following-Models.html, https://github.com/eclipse-sumo/sumo) and Treiber's JS implementation (https://github.com/MTGermany/mixedTraffic). Indian calibration studies are paper-only; no calibration code released.
- **Maintenance health:**
  > IDM and Krauss are actively maintained inside SUMO. Indian IDM calibration research is active (IIT Madras + TU Dresden group published 2018, 2024, 2026). Per-class Indian parameter sets are scattered across papers and not packaged in any simulator.

### Model

- **Scale:**
  > Microscopic (IDM, Krauss, Gipps, Wiedemann are time-continuous or time-step car-following; Nagel-Schreckenberg is a microscopic cellular automaton with 7.5 m cells and 1 s steps).
- **Lane model:**
  > All five models are single-file (one leader). They need an external lane-change model (MOBIL for IDM, SUMO LC2013/SL2015 for Krauss) or an extension that picks the leader by lateral overlap in non-lane traffic. Indian studies identify the leader as the nearest vehicle ahead with lateral overlap (follower and candidate widths overlapping), optionally with a lateral-clearance tolerance (arXiv 2405.10665 'lateral clear gap' method M8 performed best).
- **Lateral model type:**
  > None in the base models. Extensions: Kanagaraj and Treiber (2018) generalise IDM/ACC to a 2D force field (continuous 2D lateral model); SUMO sublane model adds sublane lateral positioning for any car-following model; Gunay (2007) staggered following with lateral discomfort.
- **Junction model:**
  > Not part of car-following models. In SUMO, junction right-of-way and signals are handled by the junction model, with the car-following model used to compute stopping at the stop line (leader = virtual stopped vehicle). Same approach applies to any IDM implementation: treat red signal / yield point as a standing obstacle at s = distance to stop line.
- **Signal control modes:** Not applicable to the model itself; signals act as virtual obstacles to the car-following model.
- **Flyover support:**
  > Not applicable (car-following is network-agnostic; works on any link including ramps). Merges need a gap-acceptance or lane-change model on top.
- **Grade separation handling:** Not applicable to car-following models.
- **Vehicle types:**
  > Parameterised per class by changing v0, T, s0, a, b and vehicle length/width. Published Indian per-class IDM sets exist for motorcycle, car, bus and auto-rickshaw (Kanagaraj and Treiber 2018). Gipps variant of Ravishankar and Mathew uses leader-follower type pairs.

### India fit

- **Mixed traffic support:**
  > Partial. Base models assume homogeneous lane-based following. Indian studies show parameters differ strongly by follower class and by leader-follower pair, and IDM, Gipps and Wiedemann can reproduce Indian following behaviour reasonably well once calibrated per class (JITS 2019 calibration of Wiedemann-74/99, Gipps, Bando OVM and IDM per follower category, DOI 10.1080/15472450.2019.1675522).
- **Seepage filtering support:**
  > Not by itself. Filtering emerges only when combined with a lateral model (2D MTM, SUMO sublane, strip-based) plus small two-wheeler width and small s0 / T (Indian two-wheeler s0 ~ 0.5 m, T ~ 0.3-0.5 s).
- **Indian calibration evidence:**
  > Kanagaraj and Treiber 2018: MTM with IDM base calibrated on medium traffic, validated on congested traffic in Chennai; travel time, entry/exit flow within 20% of observation (calibration avg travel time 7.24 s observed vs 6.16 s simulated; validation 12.82 s vs 13.41 s); lateral-shift count off in congested case (14 observed vs 9 simulated). Kulkarni et al. (arXiv 2405.10665): W99 calibrated for 623 car-follower pairs (70/30 split for validation); leader identification method changes calibrated parameters significantly (CC1 0.30 s vs 0.56 s depending on method). JITS 2019 study calibrated Wiedemann-74/99, Gipps, Bando and IDM per follower class and found IDM, Gipps and Wiedemann resemble Indian behaviour reasonably well. Ravishankar and Mathew 2011 vehicle-type dependent Gipps assessed micro and macro on homogeneous and heterogeneous data. NITK thesis compared Gipps, IDM, Krauss and Das-Asundi across car-2W, 2W-auto, HV-2W pairs.
- **Max density tested:**
  > Kanagaraj and Treiber 2018 congested validation: 450 motorcycles/km + 225 cars/km + 35 buses/km + 80 autos/km (1D partial densities on ~12 m roadway). Agrawal et al. 2026 observed area densities up to ~0.33 veh/m2 in two-wheeler/auto dominated states.
- **Validation against field case:**
  > Chennai six-lane urban arterial (Kanagaraj et al. 2015 site) and Saidapet, Chennai (13.0209 N, 80.2254 E) UAV section. No Bengaluru (Hebbal/Silk Board) car-following calibration found.

### Reuse verdict

- **Reuse mode:**
  > Port the model: implement IDM (about 15 lines) as the longitudinal core, parameterised per vehicle class with Indian values; use Krauss only if adopting SUMO as engine (it is SUMO's default and SUMO also ships IDM via carFollowModel="IDM").
- **Effort within 72 hours:**
  > IDM per-class implementation plus leader selection by lateral overlap: 2-4 hours including unit tests (free-road acceleration to v0, stopping behind standing obstacle at s0, no negative gaps). Cut: Wiedemann (10 parameters, regime logic, poorly documented defaults), Gipps (reaction-time delay buffers), formal calibration (use published Chennai values instead), stochastic noise beyond a simple speedFactor distribution. Nagel-Schreckenberg is fastest to code but its 7.5 m cell cannot represent 2 m two-wheelers, so skip it.
- **Licence constraint:**
  > None for equations. Copying SUMO code imposes EPL-2.0 (file-level copyleft); copying Treiber's mixedTraffic JS imposes GPL-3.0 on the combined work - reimplement from the paper instead to keep licensing free.

### Lessons

- **Known limitations:**
  > IDM: deterministic, no reaction time, gives unrealistic hard braking when a vehicle cuts in at a very small gap (Treiber's IIDM/ACC variants address this); delta and b interplay causes overshoot in very dense stop-and-go. Krauss: stochastic dawdling sigma = 0.5 makes it noisy and lowers capacity; parameters are not behaviourally interpretable for Indian classes. Gipps: requires reaction-time delay, conservative capacity. Wiedemann-99: many parameters, regime thresholds sensitive, calibration ill-posed; Indian calibrations depend strongly on how the leader is identified (CC1 changes from 0.56 s to 0.30 s by changing the identification method). Nagel-Schreckenberg: 7.5 m cells, single class, no lateral movement. All: designed for single-file following; in Indian traffic followers often have multiple partial leaders and intermittent following, so the same parameters behave differently depending on leader-selection logic. Calibrated Indian values come from a few Chennai mid-block sections, not from intersections or Bengaluru.
- **Documented failures:**
  > Kanagaraj and Treiber 2018: number of lateral shifts underpredicted in congested validation (9 vs 14 observed), attributed to more aggressive or cooperative behaviour not in the model. Kulkarni et al.: headway-threshold-based leader identification gave significantly different (biased) parameters; a 0.5 s change in the headway threshold notably changed the identified pairs. Agrawal et al. 2026: one-dimensional models cannot adequately describe the observed disordered traffic states.
- **Validation approach:**
  > Trajectory-level RMSE of position for leader-follower pairs (hold-out 30%); macroscopic validation by travel time, flows and lateral shifts on a different traffic state (calibrate on medium, validate on congested); fundamental-diagram comparison.
- **Takeaway for our build:**
  > Use IDM as the single longitudinal model for all classes, with per-class parameters taken from Indian data: two-wheeler T 0.5 s, s0 0.5 m, a 2.0 m/s2, b 2.0 m/s2; car T 1.2 s, s0 1.3-2.0 m, a 1.0-1.5 m/s2, b 1.5 m/s2; auto-rickshaw T 0.8 s, s0 0.8 m, a 1.0 m/s2; bus/HCV T 1.5 s, s0 1.0-2.0 m, a 1.0 m/s2; delta = 4, bmax 9 m/s2 clamp. Pick the leader as the nearest vehicle ahead whose lateral extent overlaps the follower's (plus a small clearance), not the vehicle in the same lane. Integrate with dt = 0.1-0.2 s using ballistic update and clamp v >= 0 and gap >= 0. Keep the parameter table as editable data in scenario JSON so users can tweak classes. Do not spend time on Wiedemann or calibration inside 72 hours; cite the Chennai sources in the UI as parameter provenance.

### Sources

- **Links:**
  - https://en.wikipedia.org/wiki/Intelligent_driver_model
  - https://arxiv.org/abs/cond-mat/0002177
  - https://sumo.dlr.de/docs/Car-Following-Models.html
  - https://sumo.dlr.de/docs/Definition_of_Vehicles%2C_Vehicle_Types%2C_and_Routes.html
  - https://sumo.dlr.de/docs/Vehicle_Type_Parameter_Defaults.html
  - https://en.wikipedia.org/wiki/Nagel%E2%80%93Schreckenberg_model
  - https://arxiv.org/pdf/1805.05076
  - https://econpapers.repec.org/RePEc:eee:phsmap:v:509:y:2018:i:c:p:1-11
  - https://arxiv.org/pdf/2405.10665
  - https://arxiv.org/abs/2608.00602
  - https://www.sciencedirect.com/science/article/abs/pii/S0968090X26002366
  - https://informahealthcare.com/doi/abs/10.1080/15472450.2019.1675522
  - https://ascelibrary.com/doi/10.1061/%28ASCE%29TE.1943-5436.0000273
  - https://idr.nitk.ac.in/handle/123456789/13132
  - https://ideas.repec.org/a/eee/transb/v41y2007i7p722-735.html
  - https://github.com/MTGermany/mixedTraffic
  - https://github.com/eclipse-sumo/sumo

### Uncertain fields (left out above)

- calibration_dataset_used
- calibration_method
- car_following
- gridlock_policy
- last_activity
- non_lane_behaviour
- per_class_parameters


## 8 Two-dimensional lane-free models

*Outline id B03 · category model · priority high · source file `results/Two-dimensional_lane-free_models.json`*

### Basic info

- **Name:**
  > Two-dimensional lane-free models: Mixed Traffic Model (MTM, Kanagaraj and Treiber 2018), Intelligent-Agent Model (IAM, Treiber and Chaudhari 2023), Non-Lane-Based IDM (NLBIDM, Chennai)
- **Type:** model (family of microscopic car-following-based models for lane-free, heterogeneous traffic)
- **Maintenance health:**
  > MTM/IAM: research line still active (IAM 2023, Kulkarni, Chaudhari, Treiber et al. leader-follower calibration on Chennai data published in Transportation Research Part C 2024/2025, DOI 10.1016/j.trc.2024.104940); single-author JS code. NLBIDM: new single paper.

### Model

- **Scale:**
  > Microscopic, time-continuous, two-dimensional (longitudinal x along road axis, lateral y), ballistic update.
- **Junction model:**
  > None of the three models defines junction conflict resolution. MTM and IAM represent red traffic lights and stop signs as very short, very wide standing virtual vehicles covering the stop line, considered separately from the real leader. The tactical lateral component (entering or leaving a road) is a placeholder of order 1 m/s2 not modelled in the MTM paper; IAM uses a desired lateral speed w0 = v0 * e_dest,y toward a destination.
- **Signal control modes:** Not part of the models; signals enter only as virtual standing obstacles.
- **Flyover support:** Not addressed (models are per-link physics).
- **Grade separation handling:** Not applicable (no network representation).
- **Vehicle types:**
  > MTM calibration: motorcycle, car, bus, auto-rickshaw (no trucks present in the recorded video). MTM/IAM code: car, truck, bike (bicycle or motorbike), obstacle. IAM paper: cars, motorcycles (Athens), bicycles. Classes differ by length, width and CF parameters; lateral parameters are shared across classes in MTM.
- **Gridlock policy:**
  > Not applicable at model level. MTM includes a fix so vehicles overlapping a leader that is too close to a boundary steer to the passable side; in code an angle-restriction lift (speedLatStuck) avoids getting stuck behind obstacles.

### India fit

- **Non lane behaviour:**
  > MTM lateral dynamics: g_i = g_self + g_boundary + g_int. g_int = (w0_i - w_i)/tau (OVM-like relaxation), with desired lateral speed w0_i = sum over neighbours j of w0_ij = lambda * alpha_tilde(dy_ij) * a_CF,int_ij * [1 - lambda_dw * (w_j - w_i) * sign(dy_ij)], where alpha_tilde = sign(dy)*(1 + s_y/W) for overlap (s_y<0) and sign(dy)*exp(-s_y/s_tilde_y0) otherwise. This is MOBIL's acceleration-difference incentive turned into a derivative of the longitudinal force with respect to y. Followers are included with weight p (politeness); p>0 gives an automatic MOBIL-like safety criterion because overlapping neighbours return -b_max. Heading is limited to a cone of half-angle theta. Boundaries: longitudinal f_b = -b_b (v/v0) exp(-s_yb/s0b) and lateral g_b = +/- b_tilde_b (v/v0) exp(-s_yb/s_tilde_0b); the v/v0 factor lets slow vehicles squeeze through narrow gaps. IAM simplifies: g_int_ij = (w0_ij - w_i)/tau_y with w0_ij = sigma * f_CF,int * (dy/W if overlapping, else sign(dy) exp(-s_y/s0y)), summed over all agents without shielding, followers weighted by anisotropy lambda; boundary force vector alpha_B(s_y)*(-f_B*v/v0, +/- g_B), alpha_B = min(1, exp(-s/s_B0)). IAM paper criticises MTM for reacting only to front vehicles and for lateral forces that are hard to calibrate.
- **Max density tested:**
  > MTM validation: about 790 veh/km on one 12 m roadway (450 motorcycles, 225 cars, 35 buses, 80 auto-rickshaws per km, 1D partial densities).

### Reuse verdict

- **Reuse mode:**
  > Port the model. Implement a simplified IAM/MTM (IDM or ACC longitudinal core, exponential lateral attenuation, summed lateral OVM relaxation, boundary forces, heading cap) inside our own link-based engine, and seed per-class longitudinal parameters from MTM Table 1. NLBIDM is inspiration only until its equations and parameters are available.
- **Effort within 72 hours:**
  > MTM/IAM core equations: about 200 to 400 lines; 6 to 10 hours to implement and unit-test (single-file reversion to IDM, no-collision at overlap, boundary containment), plus 4 to 8 hours of tuning. Use IAM's simpler lateral formula and MTM's Chennai longitudinal parameters, set follower pushing to 0 (or lambda about 0.1), fix lambda_dw to 0 initially. Cut: floor fields, calibration pipeline, NLBIDM, per-pair parameters, lateral tactical routing through junctions (use straight-line junction paths with gap acceptance instead). A spatial grid for neighbour search is needed for more than a few hundred vehicles.
- **Licence constraint:**
  > Equations from published papers can be reimplemented freely. Copying the JavaScript reference implementation (MTGermany/mixedTraffic) imposes GPL-3.0 on distributed client code.

### Lessons

- **Documented failures:**
  > MTM: number of lateral shifts in the congested validation off by about 36% (14 observed vs 9 simulated). Reference code: lateral crashes for tau > about 1 s without the relative-lateral-speed term (sensdvy), vehicles leaving the road at high speed or abrupt obstacle ends, vehicles trapped behind slow leaders near boundaries (needed a special-case override). Leader identification in non-lane traffic is itself error-prone: hEART 2025 work on the Saidapet data shows heuristic leader-follower pairing gives R-squared 0.268 vs 0.349 with an improved method.
- **Takeaway for our build:**
  > Adopt the IAM form as our link-level physics: acceleration vector = CF free term + strongest-leader CF interaction times exp(-lateral gap/s0y) + boundary force; lateral = summed OVM relaxation toward a desired lateral speed from neighbours, capped, with heading limit about 0.2 rad. Use MTM's published Chennai values (motorcycle T=0.3 s, s0=0.5 m; car T=0.8 s; bus and auto-rickshaw T=1.0 s; s0y=0.15 m; s_tilde_y0=0.30 m; lambda=0.4 s; tau=1 s; p=0.2) as defaults, labelled 'calibrated on one Chennai midblock, not junctions'. Add hard boundary clamping and a regression test that single-file traffic reproduces plain IDM. Do not promise junction realism: no published lane-free model covers Indian junction conflicts, so present junction results as indicative.

### Sources

- **Links:**
  - https://arxiv.org/abs/1805.05076
  - https://doi.org/10.1016/j.physa.2018.05.086
  - https://arxiv.org/abs/2310.16816
  - https://github.com/MTGermany/mixedTraffic
  - https://github.com/MTGermany/mixedTraffic/blob/master/js/models.js
  - https://www.mtreiber.de/mixedTraffic/
  - https://www.sciencedirect.com/science/article/abs/pii/S0968090X26002366
  - https://trid.trb.org/View/2709594
  - https://arxiv.org/abs/2405.10665v1
  - https://www.sciencedirect.com/science/article/pii/S0968090X24004613
  - https://toledo.net.technion.ac.il/?p=387
  - https://doi.org/10.3141/2491-01
  - https://transp-or.epfl.ch/heart/2025/abstracts/hEART_2025_shortpaper_289.pdf
  - https://link.springer.com/content/pdf/10.1007/s40890-016-0025-6.pdf

### Uncertain fields (left out above)

- calibration_dataset_used
- calibration_method
- car_following
- code_availability
- first_release
- indian_calibration_evidence
- known_limitations
- lane_model
- language
- last_activity
- lateral_model_type
- licence
- maintainer
- mixed_traffic_support
- per_class_parameters
- seepage_filtering_support
- validation_against_field_case
- validation_approach


## 9 Strip-based, seepage and filtering models

*Outline id B04 · category model · priority high · source file `results/Strip-based_seepage_and_filtering_models.json`*

### Basic info

- **Name:** Strip-based, seepage and filtering models for two-wheelers in mixed traffic
- **Type:**
  > model (family: strip/sublane lateral discretisation, queue-model seepage, 2D force-based filtering) plus one benchmark dataset
- **Maintainer:**
  > Strip-based: Mathew, Munigety and Bajpai, IIT Bombay (SiMTraM on SUMO); Gunay (2007) lateral-discomfort staggered following. Seepage in MATSim: Amit Agarwal and Gregor Laemmel (TU Berlin VSP / Forschungszentrum Juelich), 2015-2016. 2D filtering: Kanagaraj and Treiber (IIT Madras / TU Dresden) 2018; Ni, Li, Yuan, Sun (Tongji University / TU Delft) 2023 multi-interaction framework. Benchmark: Guin, Bazan-Guillen, Kannan, Lu, Postigo-Boix (Universitat Politecnica de Catalunya), Mendeley Data 2026. SUMO sublane model: Eclipse SUMO / DLR.
- **First release:**
  > 2007 (Gunay lateral discomfort); 2015 (Agarwal and Laemmel, Procedia Computer Science 52, 890-895); 2015 (Mathew et al. strip-based, J. Comput. Civ. Eng.; some references list 2013) ; 2016 (Agarwal and Laemmel journal version, Transportation in Developing Economies 2); 2023 (Ni et al., Physica A 611, 128441).
- **Last activity:**
  > 11 July 2026: Mendeley Data 'Dataset for Modeling and benchmarking two-wheeler seepage behavior in dense mixed traffic simulations' v1, DOI 10.17632/hs6drgb2vx.1.

### Model

- **Scale:**
  > Microscopic (strip-based, sublane, 2D force models) and mesoscopic queue-based (MATSim seepage: link-level FIFO queue with earliest-exit times).
- **Lane model:**
  > Strip-based: road divided into narrow longitudinal strips; a vehicle occupies ceil(width / strip width) adjacent strips; lane change = shift by one or more strips. SUMO sublane: lane divided into sublanes of --lateral-resolution width (e.g. 0.8 m on a 3.2 m lane); lateral position continuous, occupancy computed at sublane granularity. MATSim: no lanes, link is a queue.
- **Lateral model type:**
  > Strip-based (Mathew et al.), sublane (SUMO SL2015), continuous 2D force-based (Kanagaraj-Treiber MTM; Ni et al. behaviour force model), none (MATSim seepage queue).
- **Signal control modes:**
  > Not specific to these models; signal acts as a queue stopper. Seepage matters most at signals (two-wheelers collect at the stop line and discharge first).
- **Flyover support:** Not applicable to the lateral/seepage logic (link-level behaviour).
- **Grade separation handling:** Not applicable.
- **Vehicle types:**
  > MATSim seepage: car (PCU 1, 16.67 m/s), motorbike (PCU 0.25, 16.67 m/s), bike/bicycle (PCU 0.25, 4.17 m/s); seep modes configurable (motorbike, bike). MTM: motorcycle, car, bus, auto-rickshaw. Ni et al.: bicycles, e-bicycles, e-mopeds. Mendeley benchmark: two-wheelers in Indian dense traffic (IDD/TIAND imagery).
- **Gridlock policy:**
  > MATSim backward-travelling holes create inflow capacity; seepage with unrestricted seep vehicles starved cars (car flow fluctuated, no steady state above 110 PCU/km), fixed by 'restricted seepage' (after 4 seeping bikes, the queue head must leave). Otherwise not specified.

### India fit

- **Mixed traffic support:**
  > Yes, this is the central purpose: lets small vehicles share road width and overtake/filter large ones.
- **Non lane behaviour:**
  > IMPLEMENTABLE RULE SET (synthesised from Mathew et al. strip-based approach, SUMO sublane semantics and Kanagaraj-Treiber MTM; numbers cited). (1) Discretise each road segment laterally into strips of width w_s, at most the narrowest vehicle width (SUMO guidance; e.g. 0.5 m for 0.6-0.73 m two-wheelers, or 0.8 m on a 3.2 m lane). Mathew et al. found strip width = lane width reproduces lane-based throughput; small strips approximate continuous lateral motion. (2) A vehicle occupies k = ceil((W + minGapLat) / w_s) contiguous strips; two vehicles may not occupy the same strip while longitudinally overlapping. (3) Leader for car-following = nearest vehicle ahead occupying any of the follower's strips (lateral overlap). Compute IDM acceleration a_0 for current strip set. (4) Each step (or every 0.5-1 s), for candidate offsets of -n..+n strips (n limited by max lateral speed * dt; observed two-wheeler lateral speed P90 ~0.3 m/s, max ~1.6-2.2 m/s; cars SD ~0.09 m/s), compute the IDM acceleration a_j against the leader in the candidate strip set and the induced deceleration on the new follower. (5) Move to the candidate maximising a_j - a_0 - p*(induced braking on new follower) if gain > threshold (MOBIL-style; MTM politeness p = 0.2) and lateral clearance >= minGapLat to neighbours (MTM soft lateral gap ~0.15-0.30 m). (6) Gap filling at standstill: when speed < ~1 m/s and the gap ahead in current strips is < s0, a two-wheeler searches strips within its reach for a longitudinal gap >= its length + s0 and creeps forward at low speed (seepage). (7) Larger vehicles (car, bus) are restricted to lateral moves of whole-vehicle size and prefer lane-centre alignment; two-wheelers use 'arbitrary/compact' alignment. (8) Road edges act as boundaries with clearance (MTM boundary scale 0.15-0.25 m).
- **Calibration dataset used:**
  > Mumbai (Mathew et al.; not open), Chennai arterial video (Kanagaraj et al. 2015), Patna Comprehensive Mobility Plan 2009 for demand (Agarwal-Laemmel; synthetic demonstration), Chinese trajectory data (Ni et al.), IDD and TIAND videos (UPC benchmark; raw data from idd.insaan.iiit.ac.in, processed data CC BY-NC 4.0 on Mendeley).
- **Max density tested:**
  > MATSim seepage FD: up to ~110 PCU/km for bikes before data points vanish (unrestricted), jam density 133.33 PCU/km. MTM congested: 450 motorcycles/km + 225 cars/km + 35 buses/km + 80 autos/km on ~12 m roadway.
- **Validation against field case:**
  > Patna evacuation (illustrative), Chennai six-lane arterial (MTM), Mumbai (strip-based). No Bengaluru case found.

### Reuse verdict

- **Reuse mode:**
  > Port the model. For a 72-hour web build implement a strip-based lateral model (rules above) on top of IDM; add the Agarwal-Laemmel queue-jump rule as a cheap 'seepage at stop line' behaviour (with a restricted-seepage counter) if a full lateral model is cut. Use the Mendeley UPC benchmark as validation data for seepage rates (non-commercial licence). Treat Ni et al. 2023 as inspiration only (paywalled, Chinese two-wheelers, too complex).
- **Effort within 72 hours:**
  > Option A, queue-jump seepage on a lane/link queue (Agarwal-Laemmel): 2-3 hours; very robust, gives the visible effect of two-wheelers at the front of the queue at signals. Option B, strip-based lateral model (strips 0.5 m, leader by strip overlap, MOBIL-style strip shift, standstill gap filling): 10-16 hours including debugging of overlap/collision checks and rendering; this is the realistic upper bound inside 72 hours. Option C, continuous 2D force model (MTM or Ni et al.): 20+ hours plus tuning instability risk - cut. Recommended: B with A's restricted-seepage counter as a safety valve at stop lines; cut Bayesian decision layers, comfort zones and calibration.

### Lessons

- **Known limitations:**
  > Agarwal-Laemmel: seep vehicles do not save storage space (they still consume link storage even though they fit between cars); unrestricted seepage starves large vehicles and produced no congested-branch data above ~110 PCU/km; restriction factor 4 is arbitrary; consistency with kinematic wave theory under seepage is unclear; queue model has no geometry so it cannot show where two-wheelers are laterally. Strip-based: results depend on strip width; coarse strips give lane-like behaviour, fine strips raise computation; lateral moves are discrete jumps. SUMO sublane: smaller resolution increases computation; lateral extents computed only at resolution granularity; lane changes take multiple steps. MTM: lateral shift count mismatched in congestion. Ni et al.: validated only by face validation on non-Indian two-wheelers (bicycles, e-bikes, e-mopeds).
- **Documented failures:**
  > Agarwal and Laemmel 2015 (Procedia CS) fundamental diagrams lacked a proper congested branch; fixed in 2016 by adding backward-travelling holes and restricted seepage. In the Patna run, seepage made bikes 17.6% faster but cars and motorbikes 38-41% slower, showing seepage redistributes rather than adds capacity in a queue model.
- **Validation approach:**
  > Fundamental diagrams on a 3 x 1000 m triangular race track with varying mode shares (MATSim); sensitivity analysis on bike share; travel-time and flow comparisons against video (MTM); strip-change counts (strip-based); face validation against trajectories (Ni et al.); seepage-event annotations (UPC benchmark).
- **Takeaway for our build:**
  > Model lateral space explicitly with strips of 0.5 m (no wider than a two-wheeler), letting each vehicle occupy ceil((width + lateral clearance)/0.5) strips, and pick the car-following leader by strip overlap. Allow two-wheelers (and optionally autos) to shift strips when it increases their IDM acceleration and leaves >= 0.2-0.3 m lateral clearance, capped at a lateral speed of ~1 m/s. At stop lines implement explicit seepage: when stopped, two-wheelers may advance into any strip gap ahead long enough for them, and as a fallback apply the Agarwal-Laemmel rule (seep modes jump to the queue front, with a counter forcing the queue head to discharge after N seeps, default N = 4 and user-editable). Expose 'seepage on/off' and N as scenario controls and report per-class delay so users can see the redistribution effect (two-wheelers gain, cars lose) documented in the Patna case.

### Sources

- **Links:**
  - https://link.springer.com/article/10.1007/s40890-016-0014-9
  - https://svn.vsp.tu-berlin.de/repos/public-svn/publications/vspwp/2015/15-09/zz_archive/2015-08-28_seepage_submitted_ctrg.pdf
  - https://elib.dlr.de/103606/
  - https://data.mendeley.com/datasets/hs6drgb2vx/1
  - https://doi.org/10.17632/hs6drgb2vx.1
  - https://ideas.repec.org/a/eee/phsmap/v611y2023ics0378437122009992.html
  - https://research.tudelft.nl/en/publications/an-operational-simulation-framework-for-modelling-the-multi-inter
  - https://www.bohrium.com/paper-details/strip-based-approach-for-the-simulation-of-mixed-traffic-conditions/813170996822409217-3945
  - https://krishi.icar.gov.in/ohs-2.3.1/index.php/record/view/138368
  - https://ideas.repec.org/a/eee/transb/v41y2007i7p722-735.html
  - https://sumo.dlr.de/docs/Simulation/SublaneModel.html
  - https://arxiv.org/pdf/1805.05076
  - https://arxiv.org/abs/2608.00602
  - https://github.com/eclipse-sumo/sumo

### Uncertain fields (left out above)

- calibration_method
- car_following
- code_availability
- indian_calibration_evidence
- junction_model
- language
- licence
- licence_constraint
- maintenance_health
- per_class_parameters
- seepage_filtering_support


## 10 Junction control and conflict models

*Outline id B06 · category model · priority high · source file `results/Junction_control_and_conflict_models.json`*

### Basic info

- **Name:**
  > Junction control and conflict models (fixed-time, actuated and adaptive signals incl. CoSiCoSt; gap acceptance at unsignalised junctions; roundabouts; conflict points)
- **Type:**
  > model (junction right-of-way, conflict resolution and signal control models, with Indian parameter values)
- **Maintainer:**
  > Reference implementations: Eclipse SUMO (DLR / Eclipse Foundation) and traffic-simulation.de / MovSim (Martin Treiber, Arne Kesting). Indian parameters: CSIR-CRRI Indo-HCM 2017 and academic groups (e.g. Kota, Pallela and Lalam, NIT Warangal 2025; Ashalatha and Chandra 2011). Signal guidance: Indian Roads Congress (IRC:93-1985). Indian adaptive control: CoSiCoSt by C-DAC Thiruvananthapuram with KELTRON
- **Last activity:**
  > Checked 2026-11-11: SUMO docs current (Intersections, Traffic Lights, vType junction-model parameters); traffic-simulation.de repo active (550 commits, no dated release); Kota et al. Warangal gap study published 2025; Bengaluru B-ATCS (adaptive signals) reported in an April 2026 case study
- **Licence:**
  > SUMO EPL-2.0; traffic-simulation.de GPL-3.0; Indo-HCM and IRC codes are copyrighted publications (numbers are facts and may be used); CoSiCoSt is proprietary (C-DAC, licensed to integrators such as DIMTS)
- **Code availability:**
  > SUMO source: github.com/eclipse-sumo/sumo (junction logic in src/microsim/MSLink.cpp). traffic-simulation.de source: github.com/movsim/traffic-simulation-de (road.connect / determineConflicts in js/road.js, README_intersections). Indian gap and saturation-flow values: papers and Indo-HCM manual only. CoSiCoSt: no public code or specification, only presentations and trade-press descriptions
- **Maintenance health:**
  > SUMO junction model is actively maintained and heavily parameterised. traffic-simulation.de intersection logic is maintained by one author and its README says turns are 'not yet perfect'. Indian critical gap literature is fragmented across many small single-city studies with differing methods (Raff, occupation time, clearing behaviour, MLE). CoSiCoSt is maintained commercially by C-DAC; algorithm internals are not published

### Model

- **Scale:**
  > Microscopic (vehicle-level conflict resolution); signal-timing formulas (Webster, Indo-HCM saturation flow) are macroscopic inputs
- **Car following:**
  > Junction logic sits on top of car-following: in SUMO a closed link is a standing obstacle at the stop line (vehicles at traffic lights wait 1 m before lane end, jmStoplineGap = 1 m; minor-road vehicles wait exactly at lane end, jmStoplineGapMinor = 0 m). In traffic-simulation.de a red light or a stop sign is a virtual zero-length standing vehicle per lane, so IDM produces the braking; a crossing vehicle is assumed to accelerate freely with the IDM acceleration a when computing its crossing time
- **Lane model:**
  > SUMO: each connection (link) from an incoming lane to an outgoing lane has its own internal lane(s) through the junction; left turners from the major road can be split by an internal junction so they wait inside the box (cont=1). traffic-simulation.de: connections are road.connect(target, uSource, uTarget, offsetLane, conflicts, options) between directed road objects; turns without conflicts behave like single-point merges/diverges
- **Lateral model type:**
  > None inside the junction in both reference implementations (vehicles follow the connector centreline). Indian practice of fanning out across the junction box is not modelled by either
- **Junction model:**
  > SUMO (implementable rules): (1) netconvert builds a right-of-way matrix per junction: each connection has request index, a 'response' bitstring (higher-priority connections it must yield to), a 'foes' bitstring (all conflicting connections, superset of response) and 'cont' (may enter and wait at an internal junction). Bitstrings are read right to left. (2) Connection states: M major, m minor, = equal, G/g green major/minor, r red, y/Y yellow, o flashing, O off, plus zipper (Z) at merge junctions and stop/all-way-stop types. (3) Each approaching vehicle registers its expected arrival and leave times on the link it will use; a minor vehicle may enter only if no foe in 'response' would arrive within its occupation window, keeping at least jmTimegapMinor = 1 s before/after a prioritised vehicle that has not yet entered; jmAdvance = 1 lets it creep to the conflict point when a foe is already inside. (4) Keep-clear: vehicles do not enter if they would be stuck inside (default.junctions.keep-clear = true); jmIgnoreKeepClearTime = -1 (never ignore) by default. (5) Driver imperfection: impatience (0 default) grows willingness to force priority; jmIgnoreFoeProb / jmIgnoreFoeSpeed allow ignoring slow priority foes; jmDriveAfterRedTime / jmDriveAfterYellowTime allow red/yellow running; jmExtraGap adds distance a foe must clear. (6) Turn speed limited by sqrt(radius * 5.5). (7) Minor vehicles decide brake-or-go at the connection's visibilityDistance. traffic-simulation.de (simpler, implementable in a day): connections carry explicit conflict lists derived from rule sets (priority road, right-before-left, signals). A secondary vehicle may go only if C1: the crossing area is not occupied by a main-road vehicle, AND C2: the lowest anticipated time-to-collision exceeds TTC_crit of about 3 s, with t_cross = sqrt(2 s_cross / a_IDM), s_min = s_main - v_main * t_cross, TTC = s_min / v_main. Without stop signs the test is applied at a decision point 20-50 m upstream; if it fails the vehicle stops at a virtual obstacle at the stop line. Right turns (for right-hand traffic) have no conflicts; straight across a main road conflicts with both main directions; left turn from priority road conflicts with opposite straight traffic. Roundabouts are modelled as a ring road with on-ramps (yield at entry) and off-ramps per arm. Recommended rule set for our engine: precompute conflict points as intersections of connector centrelines (widened by vehicle half-widths) at each node; each vehicle approaching reserves a time window [t_in, t_out] at each conflict point on its connector; a lower-priority vehicle enters only if no higher-priority reservation overlaps its window extended by the class-specific critical gap; apply keep-clear (exit link has room for the vehicle length) and an impatience term so long-waiting vehicles accept smaller gaps (forced entry, as observed in India)
- **Flyover support:**
  > N/A for this item (see B07). Relevant link: the at-grade junction under a flyover is a normal signalised junction with reduced approach width
- **Vehicle types:**
  > SUMO lets every junction-model parameter (jm*, impatience) be set per vType, so 2W/3W/car/bus can have different gap acceptance and red-running behaviour. Indian studies consistently find two- and three-wheelers accept the smallest gaps and heavy vehicles the largest, and that the share of large vehicles in the conflicting stream raises the critical gap

### India fit

- **Mixed traffic support:**
  > Partial in references: SUMO supports per-class parameters but its foe logic assumes vehicles follow connector centrelines. Indian evidence shows small vehicles fill gaps laterally inside the junction and force entry (Ashalatha and Chandra found forced entry has a substantial effect on minor-approach capacity), so a pure gap-acceptance model underestimates minor-street capacity in India
- **Non lane behaviour:**
  > Inside Indian junctions, vehicles do not follow lane-to-lane connectors; they spread across the box, creep into conflict areas and negotiate priority by forcing (priority reversal). Indian methodology responded with occupation-time and clearing-behaviour methods instead of classical lag/gap methods: Kota et al. (2025) measured conflict-area occupation times (2W shortest, heavy vehicles longest, e.g. minimum occupation 2.0-3.4 s for 2W and 6.6-12.6 s for HV across five Warangal intersections). Practical model: let a vehicle enter if its class-specific critical gap is met OR its waiting time exceeds a threshold and the foe is slow (SUMO-style impatience / jmIgnoreFoeProb), and give conflict points a lateral extent so 2W can pass beside a waiting car
- **Seepage filtering support:**
  > Junction models in SUMO and traffic-simulation.de have no seepage. SUMO offers stopOffset per vehicle class (e.g. bike boxes) which can emulate 2W stopping ahead of cars at the stop line. Seepage itself is covered by the strip-based seepage item; at the junction the effect is a larger first-discharge platoon of 2W and a higher saturation flow per metre
- **Indian calibration evidence:**
  > Kota, Pallela and Lalam (2025): five uncontrolled intersections in Warangal, video data, critical gaps by Raff's method per class, occupation time per class, capacity by Indo-HCM; found occupation time of minor approach increases 0.2 s per 5% increase in conflicting-flow occupation and 0.13 s per 5% pedestrian volume increase. Ashalatha and Chandra (2011, KSCE J. Civil Eng. 15:1427-1434): clearing-behaviour approach for critical gap, forced entry substantial. Saturation-flow calibrations at Indian signals show high errors when US HCM equations are applied to heterogeneous traffic and propose modified base saturation flow including 2W effect (WCTR 2019). Maji, Maurya, Nama and Sahu (Journal of Modern Transportation, 2015): microsimulation of intersection layouts under a flyover for heterogeneous traffic
- **Calibration method:**
  > Critical gap: Raff's method (cumulative accepted vs rejected gap curves), clearing-behaviour approach, occupation-time method, maximum likelihood and probability equilibrium methods; deterministic methods give lower values than probabilistic ones in a high-speed T-intersection study. Follow-up often assumed as 0.6 x critical gap instead of measured. Saturation flow: headway/discharge analysis per cycle with ANOVA to identify the saturated part of green, then multiple linear regression for base saturation flow and adjustment factors; error metric percent difference between observed and estimated saturation flow
- **Max density tested:** Not reported for junction models; studies report flows and capacities, not densities

### Reuse verdict

- **Reuse mode:**
  > Port the model, not the code: adopt SUMO's foe/response matrix plus time-window reservation and keep-clear concepts, traffic-simulation.de's TTC-based gap rule and virtual-obstacle stop lines, Indian per-class critical gaps from Kota et al. as defaults, and Indo-HCM saturation flow per metre as a calibration target for signalised approaches. CoSiCoSt cannot be reused (proprietary, undocumented); offer an 'adaptive (CoSiCoSt-like)' mode that re-splits green each cycle by measured degree of saturation and clearly label it as an approximation
- **Effort within 72 hours:**
  > About 10-14 hours total. 3-4 h: connector geometry and precomputed conflict points per node with priority (major/minor/equal, signal group). 3-4 h: reservation-window gap acceptance with per-class tc/tf, keep-clear check, impatience-based forced entry. 2-3 h: fixed-time signal programs (cycle, phases, amber 3 s, all-red) with split phasing presets and Webster auto-timing from demand using Indo-HCM saturation flow. 1-2 h: simple actuated mode (max-gap 3 s, minDur/maxDur). 1 h: roundabout as a ring of links with yield-at-entry using the same gap logic. Cut: NEMA, coordinated offsets, real CoSiCoSt logic, pedestrian crossings, internal waiting positions beyond one per left/right turn
- **Licence constraint:**
  > Reading SUMO (EPL-2.0) and traffic-simulation.de (GPL-3.0) to re-implement algorithms is fine; copying traffic-simulation.de code would force our engine to GPL-3.0 if distributed; copying SUMO code requires EPL-2.0 file-level terms. Published numeric parameters (Indo-HCM, papers) are facts and can be used with citation. CoSiCoSt branding should not be used to describe our approximation

### Lessons

- **Known limitations:**
  > SUMO junction logic assumes lane-following vehicles on connectors; with the sublane model foes are still link-based, so Indian box-filling and creeping are not captured. traffic-simulation.de's TTC rule is acknowledged as defensive (sometimes blocks a start even after the threat passed) and its left-turn handling is 'not yet perfect'; its intersection README covers straight-only X intersections and excludes signals. Indian critical gaps vary widely by site (car 3.9-5.3 s across five intersections in one city), follow-up is often assumed rather than measured, and methods disagree. Indo-HCM saturation flow uses width only and has limited ability to address heterogeneity; the per-metre formula appears discontinuous at 7.0 m. CoSiCoSt internals, parameters and evaluation methodology are not public; reported benefits are vendor or trade-press claims
- **Documented failures:**
  > SUMO networks imported from OSM commonly produce junction deadlocks and teleports when many minor links conflict and keep-clear or join settings are wrong (see the Gridlock item and SUMO Intersections docs on ignore-junction-blocker). Applying US HCM saturation flow or gap values in India gives large errors due to heterogeneous traffic (WCTR 2019). Most Indian fixed-time signals keep the same timings for years without revision, so static plans mismatch demand (arXiv 2205.01640). Traffic under flyovers is often left unmanaged, which erodes the flyover's benefit (Maji et al. 2015)
- **Validation approach:**
  > SUMO: extensive regression test suite and documented parameter semantics. traffic-simulation.de: visual plausibility in interactive scenarios. Indian studies: compare estimated capacity or saturation flow against field counts (percent error), cumulative accepted/rejected gap curves. For our build: unit tests per junction type (two-car T-junction, crossing, opposite left turn), check discharge rate of a saturated signal approach against Indo-HCM PCU/h/m for the drawn width, and check that minor-approach capacity falls with conflicting flow in the shape predicted by gap-acceptance theory

### Sources

- **Links:**
  - https://sumo.dlr.de/docs/Simulation/Intersections.html
  - https://sumo.dlr.de/docs/Networks/SUMO_Road_Networks.html
  - https://sumo.dlr.de/docs/Definition_of_Vehicles%2C_Vehicle_Types%2C_and_Routes.html
  - https://sumo.dlr.de/docs/Simulation/Traffic_Lights.html
  - https://github.com/eclipse-sumo/sumo/blob/main/src/microsim/MSLink.cpp
  - https://github.com/movsim/traffic-simulation-de
  - https://raw.githubusercontent.com/movsim/traffic-simulation-de/master/README_intersections
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_Gridlock
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_roundabouts
  - https://github.com/movsim/traffic-simulation-de/blob/master/js/road.js
  - https://a-b-street.github.io/docs/tech/trafficsim/gridlock.html
  - https://sjsutst.polsl.pl/archives/2025/vol126/097_SJSUTST126_2025_Kota_Pallela_Lalam.pdf
  - https://doi.org/10.20858/sjsutst.2025.126.6
  - https://journals.sagepub.com/doi/10.1177/03611981211035761
  - https://idr.nitk.ac.in/handle/123456789/22977
  - https://www.researchgate.net/publication/364593143_Critical_Gap_Estimation_and_Its_Implication_on_Capacity_and_Safety_of_High-Speed_Un-Signalised_T-Intersection_under_Heterogeneous_Traffic_Conditions
  - https://www.researchgate.net/publication/335184165_Calibrating_HCM_model_for_roundabout_entry_capacity_under_heterogeneous_traffic
  - https://pessoas.feb.unesp.br/barbara/files/2011/04/17-Unsignalized-Intersections.pdf
  - https://www.wctrs-society.com/wp-content/uploads/abstracts/mumbai/WCTR2019_Mumbai_263.pdf
  - https://www.wctrs-society.com/wp-content/uploads/abstracts/mumbai/WCTR2019_Mumbai_409.pdf
  - https://springerlink.bibliotecabuap.elogim.com/10.1007/978-981-32-9042-6_47
  - https://kscst.org.in/spp/49_series/49s_spp/Poster_Presentation_Synopsis/52_49S_BE_7079.pdf
  - https://pdf.arxiv.org/pdf/2205.01640
  - https://law.resource.org/pub/in/bis/irc/irc.gov.in.093.1985.pdf
  - https://infralens.in/code/IRC-93-1985
  - https://www.scribd.com/document/412451143/Indian-ATCS-System
  - https://dimts.in/adaptive-traffic-control-systems.aspx
  - https://www.academia.edu/68659615/Adaptive_Signal_Control_Technology_State_of_Practice
  - https://smartnet.niua.org/node/3005
  - https://www.smartcitybhubaneswar.gov.in/traffic-management-system
  - https://trafficinfratech.com/emag/2024/february/files/basic-html/page20.html
  - https://indianinfrastructure.com/2026/04/06/smart-mobility-a-case-study-of-the-bengaluru-adaptive-traffic-control-system/
  - https://link.springer.com/article/10.1007/s40534-015-0072-4

### Uncertain fields (left out above)

- calibration_dataset_used
- first_release
- gridlock_policy
- language
- per_class_parameters
- signal_control_modes
- takeaway_for_our_build
- validation_against_field_case


## 11 Flyovers and grade separation

*Outline id B07 · category model · priority high · source file `results/Flyovers_and_grade_separation.json`*

### Basic info

- **Name:**
  > Flyovers and grade separation (layers, ramps, merges and diverges in the network graph and in vehicle behaviour)
- **Type:**
  > model (network representation of grade separation plus merge/diverge behaviour model, with Indian geometric standards)
- **Maintainer:**
  > Network representation: Eclipse SUMO / netconvert (DLR), A/B Street and osm2streets (Dustin Carlino and contributors), ASAM OpenDRIVE (ASAM e.V.), OpenStreetMap community (layer/bridge/link tagging). Behaviour: MOBIL and traffic-simulation.de (Treiber, Kesting, Helbing). Indian geometry: Indian Roads Congress (IRC:92-2017 Guidelines for the Design of Interchanges in Urban Areas)
- **Last activity:**
  > Checked 2026-11-11: osm2streets last commit 2 Oct 2025 (shallow clone); SUMO netconvert docs current; ASAM OpenDRIVE 1.8.0 specification online; traffic-simulation.de repo active; IRC:92-2017 current edition
- **Language:**
  > SUMO/netconvert C++; osm2streets Rust (with osm2streets-js WASM bindings); traffic-simulation.de JavaScript; OpenDRIVE is an XML format
- **Code availability:**
  > Source: github.com/eclipse-sumo/sumo, github.com/a-b-street/osm2streets (layer field in osm2streets/src/road.rs), github.com/movsim/traffic-simulation-de (onramp.html, offramp.html, mergeDiverge in js/road.js). OpenDRIVE: specification only. IRC:92-2017: PDF on law.resource.org
- **Maintenance health:**
  > SUMO actively maintained; its z-coordinate/elevation support from OSM is labelled experimental. osm2streets maintained at lower cadence (last commit October 2025); a TODO in block.rs notes block tracing is 'Incorrect near bridges/tunnels'. traffic-simulation.de ramp scenarios are stable and long-lived

### Model

- **Scale:** Microscopic (merge/diverge lane-change behaviour); network representation is scale-independent
- **Car following:**
  > Merges reuse the car-following model: in traffic-simulation.de the on-ramp ends in a standing virtual obstacle so ramp vehicles brake with IDM if they find no gap; merging vehicles are inserted into the main road and the IDM handles the follower's response. In SUMO, lanes ending at a zipper junction produce slow-down only on demand based on neighbours
- **Lane model:**
  > MOBIL (traffic-simulation.de): safety criterion acc'(B') > -b_safe; incentive acc'(M') - acc(M) > p[acc(B') - acc'(B')] + a_thr (the acc(B) term is dropped in the implementation), defaults a_thr = 0.2 m/s2, a_bias = 0.2 m/s2, b_safe = 4 m/s2 (below the about 9 m/s2 physical maximum), politeness p 0 to 0.5. Mandatory lane change at on-ramps: a large bias toward the target lane plus the safety criterion only; setLCMandatory marks mandatory zones on on-ramps and before lane drops; b_safe grows aggressive in congestion because it is speed-dependent. Off-ramps: each road stores off-ramp position and side; vehicles whose route continues on the ramp get a strong lane-change bias toward the exit as they approach, and mergeDiverge moves them onto the ramp along the parallel section. Merges happen over a parallel section of length L with the upstream link as master. SUMO: lanes end at junctions; acceleration lanes can be added by --ramps.guess; strategic lane changes (LC2013 model) start early enough to reach the exit lane; lane drops can be junction type zipper
- **Lateral model type:**
  > None in the reference ramp models (lane-based MOBIL). For Indian traffic the merge zone should reuse our strip-based lateral model: a ramp is an extra set of strips that ends, so ramp vehicles must move laterally into main-road strips before the nose
- **Junction model:**
  > Grade separation means there is no junction where a flyover crosses the road below; interactions happen only at ramp merge/diverge nodes and at the at-grade junction under the flyover (handled by the B06 junction model). Merge nodes behave as priority junctions (main road major, ramp minor) or zipper merges
- **Signal control modes:**
  > N/A for the flyover itself (uninterrupted). The at-grade junction underneath is usually signalised; see B06
- **Flyover support:**
  > SUMO: yes. Crossings without shared nodes create no junction, so overpasses work topologically; z data only affects 3D/visualisation and slope; ramps are ordinary edges, with optional acceleration lanes from --ramps.guess (disabled by default; ramp-length 100 m; edges slower than ramps.min-highway-speed = 21.94 m/s, about 79 km/h, are not treated as highways). osm2streets/A/B Street: yes topologically (OSM shared nodes), with an integer layer per road for drawing order. traffic-simulation.de: on-ramp, off-ramp and lane-closing scenarios built from road objects with merge/diverge connections; no explicit layering, roads may overlap visually. OpenDRIVE: yes, roads without a junction element simply cross; each road carries an elevationProfile (cubic polynomials in s) and a lateralProfile (superelevation, shape)

### India fit

- **Non lane behaviour:**
  > Indian arterials are typically median-divided with three to four lanes per direction, connected to the junction by two- to four-lane ramps (Maji et al. 2015); traffic below the flyover is non-lane-based and often unmanaged. A strip-based model handles the merge as lateral movement into free strips with a minimum lateral clearance per class, with smaller acceptable longitudinal gaps for 2W
- **Seepage filtering support:**
  > Not applicable to ramps directly. At the at-grade junction beneath the flyover, seepage at the stop line applies as for any signal (see the seepage item)
- **Max density tested:** Not reported

### Reuse verdict

- **Reuse mode:**
  > Use as data and port the model: adopt OSM conventions (bridge + layer, *_link) and osm2streets' integer layer per road if importing; port the traffic-simulation.de mergeDiverge pattern (parallel merge section, virtual obstacle at the end, route-driven exit bias) and MOBIL mandatory lane change into our strip model; take ramp geometry defaults from IRC:92-2017. No code reuse needed
- **Licence constraint:**
  > No code is copied, so no constraint. If osm2streets (Apache-2.0) is used for OSM import, keep its notice; OSM-derived networks must carry ODbL attribution; do not copy traffic-simulation.de JS (GPL-3.0)

### Lessons

- **Documented failures:**
  > Joining nodes at a crossing (shared node between a bridge and the road below) creates a phantom at-grade junction; the OSM wiki explicitly warns this destroys vertical order. Renderers that sort by a single pass of layer draw overpasses under highways (OSM Community 2025 Shortbread vector-tile report). Indian flyovers often move the bottleneck to the unmanaged junction underneath and to the ramp landing points (Maji et al. 2015). IRC:92 identifies rear-end crashes at entrances as the most frequent interchange crash type, caused by short acceleration lanes
- **Validation approach:**
  > IRC:92 is a design standard (no simulation validation). Maji et al. compared layouts by microsimulated operational performance. traffic-simulation.de demonstrates on-ramp breakdown and capacity drop qualitatively. For our build: test that two crossing links on different levels never interact; that ramp merge capacity drops when main-road flow rises; that a blocked ramp spills back to the at-grade junction; and that a flyover diverts through traffic so the junction underneath shows lower delay
- **Takeaway for our build:**
  > 1) Grade separation is a topology rule, not geometry: vehicles interact only through shared nodes and conflict points computed per node; never infer junctions from plan-view crossings. Store level (int) per link for rendering and validation only. 2) Spatial queries must be link-local (or include level), because a world-space grid would make vehicles on a flyover see vehicles on the road beneath (link to D02). 3) Provide a one-click 'flyover over junction' template using IRC:92-2017 defaults: 2 lanes (7.0-7.5 m) per direction, ramp grade 4% (max 6%), urban design speed 80 km/h main / 40-50 km/h ramp, acceleration lane 180-250 m, deceleration lane 90-120 m, vertical clearance 5.5 m, ramp capacity per IRC Table 6.3 (two-lane 7.0 m: 2400 PCU/h; 4-lane divided 7.5 m: 2700 PCU/h/direction). 4) Merge = ramp strips end at a nose with a virtual obstacle; vehicles move laterally into free main-road strips if the new follower's required braking stays below b_safe (4 m/s2, lower for heavy vehicles) and after a waiting time accept smaller gaps (forced merge). 5) Diverge = route-aware bias starting about 300 m upstream so exiting vehicles move toward the exit side. 6) Keep service roads and the at-grade junction underneath as normal level-0 links so users see that the flyover shifts congestion to ramp landings and the junction below

### Sources

- **Links:**
  - https://sumo.dlr.de/docs/Networks/Import/OpenStreetMap.html
  - https://sumo.dlr.de/docs/netconvert.html
  - https://sumo.dlr.de/docs/Simulation/Intersections.html
  - https://sumo.dlr.de/docs/Definition_of_Vehicles%2C_Vehicle_Types%2C_and_Routes.html
  - https://wiki.openstreetmap.org/wiki/Key:layer
  - https://wiki.openstreetmap.org/wiki/Key:bridge
  - https://wiki.openstreetmap.org/wiki/Tag:highway%3Dprimary_link
  - https://community.openstreetmap.org/t/ordering-of-layers-is-wrong-in-the-new-vector-tiles/133081
  - https://github.com/a-b-street/osm2streets
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets/src/road.rs
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets/src/transform/collapse_intersections.rs
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets/src/block.rs
  - https://dabreegster.github.io/talks/sotm_2022/slides.html
  - https://publications.pages.asam.net/standards/ASAM_OpenDRIVE/ASAM_OpenDRIVE_Specification/1.8.0/specification/10_roads/10_05_elevation.html
  - https://github.com/movsim/traffic-simulation-de
  - https://github.com/movsim/traffic-simulation-de/blob/master/js/road.js
  - https://traffic-simulation.de/info/info_MOBIL.html
  - https://traffic-simulation.de/onramp.html
  - https://law.resource.org/pub/in/bis/irc/irc.gov.in.092.2017.pdf
  - https://archive.nptel.ac.in/content/storage2/courses/105101087/12-Ltexhtml/p6/p.html
  - https://link.springer.com/article/10.1007/s40534-015-0072-4
  - https://www.bohrium.com/paper-details/performance-based-intersection-layout-under-a-flyover-for-heterogeneous-traffic/814627996575989763-32017
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137/resource/1677ca40-d3cd-42b3-b9d0-78d339307019/download/integrated-traffic-microsimulation-report-bengaluru-projectv4.pdf
  - https://www.tce.co.in/project/flyover-at-karmaveer-vithalrao-yadav-chowk-maharashtra-state-road-development-corporation-limited/

### Uncertain fields (left out above)

- calibration_dataset_used
- calibration_method
- effort_within_72_hours
- first_release
- grade_separation_handling
- gridlock_policy
- indian_calibration_evidence
- known_limitations
- licence
- mixed_traffic_support
- per_class_parameters
- validation_against_field_case
- vehicle_types


---

# C. Indian context and data

## 12 Vehicle mix and per-class parameters

*Outline id C01 · category india_context · priority high · source file `results/Vehicle_mix_and_per-class_parameters.json`*

### Basic info

- **Name:** Vehicle mix and per-class parameters for Indian (Bengaluru) urban traffic
- **Type:** dataset / standard values (vehicle dimensions, kinematics, gaps and traffic composition)
- **Maintainer:**
  > CSIR-CRRI (Indo-HCM 2017); Indian Roads Congress (IRC:106-1990 urban PCU); Chandra and Kumar (IIT Roorkee, J. Transp. Eng. 2003) dimension table reproduced in NPTEL; IIT Madras / TU Dresden (Kanagaraj, Treiber, Asaithambi, Agrawal) Chennai trajectory studies; DataCorp Traffic (Silk Board counts, reported by Traffic Infratech); WRI India (Bengaluru fleet share).
- **First release:**
  > 1990 (IRC:106); 2003 (Chandra and Kumar dimension/PCU method); 2015 (Kanagaraj et al. Chennai trajectory data); 2017 (Indo-HCM); 2018 (Kanagaraj-Treiber calibrated per-class IDM); 2026 (Agrawal et al. Chennai UAV per-class statistics).
- **Last activity:** arXiv 2608.00602 submitted 1 August 2026 (Chennai Saidapet UAV dataset recorded 26 June 2023).
- **Licence:**
  > Indo-HCM and IRC codes: copyrighted publications (IRC codes sold by IRC; Indo-HCM distributed by CSIR-CRRI). Papers: publisher copyright; arXiv preprints non-exclusive distribution licence. Numbers themselves can be used as model parameters with citation.
- **Language:** Not software.
- **Code availability:**
  > No code. Values are tabulated in papers and manuals (links). Indo-HCM 2017 full text is circulated as PDF (searchable copy on Scribd; official CSIR-CRRI distribution) - the dimension table (Section 1.3 'Vehicle Types and Their Dimensions') was not directly retrieved in this research.
- **Maintenance health:**
  > Indo-HCM 2017 is the latest edition; no update found. Research values are refreshed by the IIT Madras / TU Dresden group (2015, 2018, 2024, 2026). Bengaluru-specific classified counts are scarce in open literature; the best open evidence is a junction count at Silk Board (2019/2020) and city fleet shares.

### India fit

- **Mixed traffic support:**
  > Indian urban arterials carry two-wheelers (57-71% of vehicles), cars (20-27%), auto-rickshaws (5-12%), buses (2-4%) and small shares of LCV/HCV and bicycles on the same carriageway with largely ignored lane markings; the simulator must support at least 5 classes: two-wheeler, car, auto-rickshaw, bus/HCV, LCV (bicycle optional).
- **Non lane behaviour:**
  > Observed on Chennai six-lane arterial: 'three nominal lanes, which are largely ignored' (Kulkarni et al.). Lateral speed in congestion: SD two-wheeler 0.25 m/s (P90 0.30 m/s, max 2.15 m/s), auto 0.15 m/s, car 0.09 m/s, LCV 0.12, HCV 0.10; lateral acceleration SD TW 0.18 m/s2, AR 0.11, car 0.08, HCV 0.10 m/s2 (Agrawal et al. 2026). At area density below ~0.05 veh/m2 lateral velocities span -0.3 to 0.6 m/s; above ~0.15 veh/m2 lateral motion is suppressed.
- **Seepage filtering support:**
  > Smaller vehicles filter through queues; two-wheeler standstill gap median 0.55 m vs car 1.32 m, enabling tighter packing (Agrawal et al. 2026). Two-wheeler share in high-density states reached 73.2-82.7%.
- **Indian calibration evidence:**
  > Dimensions, gaps and kinematics measured on Chennai urban arterials with validated trajectory extraction (Saidapet UAV: detection precision 97%, recall 93%, MOTA 94%; mean absolute positional errors 0.04-0.07 m). Per-class IDM values calibrated by genetic algorithm and validated to within 20% on travel time and flows (Kanagaraj-Treiber 2018). Silk Board counts are raw counts, not used in any calibration.
- **Calibration method:**
  > Trajectory-derived statistics with steady-state leader-follower filter (relative speed within deadband, |acc| < 0.2 m/s2, persistence) for time gaps; stopped state |v| <= 0.01 m/s for >= 3 s for standstill gaps; heading-corrected bounding boxes for dimensions. Genetic algorithm on macroscopic measures for IDM per class.
- **Max density tested:**
  > Chennai 2023: area density up to ~0.33 veh/m2 (two-wheeler share 82.7%); congested Chennai MTM validation: 450 motorcycles/km + 225 cars/km + 35 buses/km + 80 autos/km.
- **Validation against field case:**
  > Bengaluru Silk Board Junction peak-hour classified counts (composition only). Per-class kinematics only from Chennai.

### Data

- **Network import:**
  > Not applicable to this item beyond composition: vehicle mix should be specified per entry link as class shares, since mixes differ by corridor (Silk Board 65% TW vs Chennai 57-71%).
- **Demand input formats:**
  > Recommended: demand per origin link as total veh/h plus a class-share vector, e.g. Bengaluru default {two-wheeler 0.65, car 0.22, auto-rickshaw 0.055, bus 0.04, LCV/other 0.035} derived from Silk Board 2019 peak hour (15,507 veh: TW 10,113 = 65.2%, car 3,454 = 22.3%, auto 845 = 5.4%, bus 632 = 4.1%, other ~463 = 3.0%); 2020 count (20,074 veh): TW 67.1%, car 21.3%, auto 5.6%, bus 1.8%, other ~4.1%. Cars at Silk Board 2019 were 73% private / 27% taxi. Other Indian arterial mixes: Chennai six-lane arterial 2015: TW 57%, car 27%, three-wheeler 12%, bus 3%, light truck 1%, heavy truck 0.3%; Chennai Saidapet 2023: TW 70.84%, car 20.37%, auto 7.32%, LCV 0.54%, HCV 0.93%. Bengaluru registered fleet: two-wheelers ~69%, buses < 1% (WRI India) - fleet share, not road share.

### Reuse verdict

- **Reuse mode:**
  > Use as data: ship a default vehicle-class table (dimensions, IDM parameters, lateral clearance, colour) and a default Bengaluru class mix in the scenario schema, with source citations.
- **Effort within 72 hours:**
  > 1-2 hours to encode the table and default mix as JSON plus per-class sampling (draw length/width from normal distributions with the published mean/SD, e.g. TW length 2.02 +/- 0.11 m, car 4.46 +/- 0.42 m). Cut: per-corridor calibration, dynamic PCU computation (report PCU with fixed static factors instead), bicycles and cycle-rickshaws unless a scenario needs them.
- **Licence constraint:**
  > Numbers are facts and can be used with citation. Do not redistribute Indo-HCM or IRC PDF text or tables verbatim; arXiv preprints are non-exclusive licence (cite, do not republish).

### Lessons

- **Known limitations:**
  > No open Bengaluru per-class kinematic dataset was found; all trajectory-based kinematics come from Chennai mid-block sections, so intersection behaviour (start-up acceleration, discharge headways) is not covered. Chennai 2023 kinematics are from congested states (mean speeds 2-2.5 m/s), so they under-represent free-flow desired speeds and maximum accelerations. LCV/HCV samples are small (13-19 pairs). Silk Board figures are a single junction, single peak hour, from a commercial firm's internal study reported in trade media; class 'others' is unreported. Dimension sources disagree (car 3.72 x 1.44 m in the 2003 table vs 4.46 x 1.85 m measured in 2023), reflecting fleet growth toward SUVs - older tables understate car size. The Kanagaraj-Treiber auto-rickshaw width 0.9 m and v0 '5-6 m/s' look inconsistent with measured 1.35 m width and observed 12 m/s maxima. IRC/Indo-HCM primary tables were not directly accessed.
- **Documented failures:**
  > IHCM PCU values have been criticised as too optimistic and not reflecting actual service conditions (IAENG WCE 2017 paper). Using a single static PCU ignores that PCU depends on composition and speed (motivation for Chandra's dynamic PCU).
- **Validation approach:**
  > Field measurement: UAV trajectories with manual ground-truth validation of extraction accuracy; manual video classified counts; GA-calibrated simulation compared against observed travel times and flows.
- **Takeaway for our build:**
  > Define five default classes with these parameters (L x W m; IDM v0 km/h, T s, s0 m, a m/s2, b m/s2; min lateral clearance m): two-wheeler 2.0 x 0.75; 60; 0.5; 0.55; 2.0; 2.0; 0.2 | car 4.45 x 1.85; 50; 1.2; 1.3; 1.2; 1.5; 0.3 | auto-rickshaw 2.9 x 1.35; 40; 0.8; 0.8; 1.0; 1.5; 0.25 | bus 11.5 x 2.6; 40; 1.5; 1.5; 0.8; 1.2; 0.4 | LCV 5.9 x 2.25; 45; 1.2; 1.0; 1.0; 1.5; 0.3 (v0 and clearances are engineering choices interpolated from the cited ranges, not single published values). Default Bengaluru mix: TW 65%, car 22%, auto 6%, bus 4%, LCV 3% (Silk Board 2019). Make every value editable per scenario, sample dimensions from distributions rather than fixed means, display the source next to each default, and report outputs per class and in PCU using Chandra's area-speed method so users can compare to Indo-HCM practice.

### Sources

- **Links:**
  - https://arxiv.org/abs/2608.00602
  - https://arxiv.org/pdf/2608.00602
  - https://arxiv.org/pdf/1805.05076
  - https://arxiv.org/pdf/2405.10665
  - https://archive.nptel.ac.in/content/storage2/courses/105101008/521_TrVolume/point13/point.html
  - https://ascelibrary.com/doi/10.1061/(ASCE)0733-947X(2003)129:2(155)
  - https://trid.trb.org/View/1509422
  - https://www.scribd.com/document/522796944/IndoHCM-Searchable
  - https://www.iaeng.org/publication/WCE2017/WCE2017_pp564-567.pdf
  - https://newlayout.trafficinfratech.com/?p=23335
  - https://typeset.io/pdf/enhancing-bengaluru-s-public-transport-network-approaches-1xuiluym9b.pdf
  - https://data.opencity.in/dataset/a2f7a600-3965-44a2-8127-48996e5743f0/resource/76c7d21a-fddf-42a4-b16a-f9f8079dfd06/download/kuidfc-cttp-bengaluru-2011.pdf
  - https://www.rcet.org.in/uploads/academics/regulation2021/rohini_10540480012.pdf
  - https://sumo.dlr.de/docs/Vehicle_Type_Parameter_Defaults.html

### Uncertain fields (left out above)

- calibration_dataset_used
- data_access
- per_class_parameters


## 13 Indian standards and capacity measures

*Outline id C03 · category india_context · priority high · source file `results/Indian_standards_and_capacity_measures.json`*

### Basic info

- **Name:**
  > Indian standards and capacity measures (IRC:106-1990, IRC:64-1990, Indo-HCM 2017, dynamic PCU, area occupancy, LOS)
- **Type:** standard
- **Maintainer:**
  > Indian Roads Congress (IRC:106-1990 urban capacity guidelines and IRC:64-1990 rural capacity guidelines); CSIR-Central Road Research Institute (CSIR-CRRI), New Delhi, with IIT Roorkee, IIT Bombay, IIT Guwahati, SPA Delhi, SVNIT Surat, IIEST Shibpur and Anna University (Indo-HCM 2017). The area occupancy concept comes from academic work by Mallikarjuna and Ramachandra Rao (2006) and Arasan and Dhivya (2010).
- **First release:**
  > IRC:64 first published 1976, revised November 1990. IRC:106 first published November 1990 (reprinted 2007 and 2016). Indo-HCM project approved October 2012; manual published by CSIR-CRRI in 2017 (executive summary dated 15 April 2014 for the draft).
- **Code availability:**
  > Paper only. IRC:106-1990 scanned PDF: https://law.resource.org/pub/in/bis/irc/irc.gov.in.106.1990.pdf . IRC:64-1990 scanned PDF: https://law.resource.org/pub/in/bis/irc/irc.gov.in.064.1990.pdf . Indo-HCM 2017 full text: a third-party copy at pdfcoffee.com (secondary hosting of the primary document) and a CRRI executive summary on crridom.gov.in. No software or code exists.

### India fit

- **Mixed traffic support:**
  > Both standards handle mixed traffic only by converting it to passenger car units (PCU). IRC:106-1990 (primary, read from the scanned original, Table 1) gives static urban PCUs that change with the share of that vehicle class. At 5% share / at 10% share and above: two-wheeler (motorcycle or scooter) 0.5 / 0.75; passenger car or pick-up van 1.0 / 1.0; auto-rickshaw 1.2 / 2.0; light commercial vehicle 1.4 / 2.0; truck or bus 2.2 / 3.7; agricultural tractor-trailer 4.0 / 5.0; cycle 0.4 / 0.5; cycle-rickshaw 1.5 / 2.0; tonga (horse-drawn) 1.5 / 2.0; hand cart 2.0 / 3.0. IRC:64-1990 rural PCUs (primary, Table 1): motorcycle or scooter 0.50; car, pick-up van or auto-rickshaw 1.00; agricultural tractor or LCV 1.50; truck or bus 3.00; truck-trailer or tractor-trailer 4.50; cycle 0.50; cycle-rickshaw 2.00; hand cart 3.00; horse-drawn 4.00; bullock cart 8.00 (6 for small carts). Indo-HCM 2017 uses dynamic PCU: PCU_i = (Vc/Vi) / (Ac/Ai), where Vc and Vi are the speeds of the standard car and of vehicle type i, and Ac and Ai are their projected rectangular plan areas. On urban roads the standard car area is the weighted average of small and big cars, 6.19 m2. Indo-HCM also defines a Stream Equivalency Factor Se = (flow in PCU/h) / (flow in veh/h), with regressions for urban divided roads: Se = 1 - 0.77 PTW - 0.28 PAuto + 0.53 PLCV + 2.60 PBus + 1.83 PHV - 0.66 PNMT + 12.71 (1/N), and for undivided roads: Se = 1 - 0.85 PTW - 0.31 PAuto + 0.60 PLCV + 3.09 PBus + 1.06 PHV - 1.30 PNMT - 1.29 (1/N). P terms are class shares and N is total veh/h.
- **Seepage filtering support:**
  > The standards do not model seepage explicitly. Its effect is absorbed into the low dynamic PCUs of two-wheelers: Indo-HCM median about 0.20 to 0.24 on urban midblocks, and 0.4 at signalized intersections. IRC:106 uses a static 0.5 to 0.75. Indo-HCM's signal chapter adds an initial surge / anticipation adjustment factor (fis) to saturation flow, which captures early discharge by vehicles queued ahead of the stop line.
- **Indian calibration evidence:**
  > BASE CAPACITIES, URBAN (Indo-HCM 2017 Table 5.4, primary text; every row checks arithmetically as lane capacity x lanes, and DSV = 0.7 x capacity). Two-lane undivided: capacity 2400 PCU/h total, 1200 PCU/h/lane, design service volume (DSV) 1680. Four-lane divided: 5400 (2700 per direction), 1350 per lane, DSV 3780 (1890 per direction). Six-lane divided: 8400 (4200 per direction), 1400 per lane, DSV 5880 (2940). Eight-lane divided: 13600 (6800), 1700 per lane, DSV 9520 (4760). Ten-lane divided: 20000 (10000), 2000 per lane, DSV 14000 (7000). The 8- and 10-lane values come from sections with 1-3 km signal spacing. Lane capacity versus car operating speed (85th percentile free speed of cars, valid for 40-80 km/h): C_lane = 20.11 V + 210.8 (Table 5.5: 55 km/h 1317; 60 km/h 1417; 65 km/h 1518; 70 km/h 1619; 75 km/h 1719 PCU/h/lane). Side-friction capacity C = C0 x FOP x FBS x FAC. The on-street parking factor is 0.70 / 0.65 / 0.40 for under 25% / 25-50% / over 50% of segment length occupied. INTERURBAN MULTILANE (Indo-HCM Ch. 3): four-lane C = 30 V + 1540 and six-lane C = 43 V + 2490 PCU/h/direction (70 km/h: 3640 and 5500; 80: 3940 and 5930; 90: 4240 and 6360; 100: 4540 and 6790). Two-lane interurban example: 2946 PCU/h for a 7.0 m carriageway with 1.5 m earthen shoulders on plain terrain. IRC:106-1990 DESIGN SERVICE VOLUMES AT LOS C (primary, Table 2, PCU/h, arterial / sub-arterial / collector): 2-lane one-way 2400 / 1900 / 1400; 2-lane two-way 1500 / 1200 / 900; 3-lane one-way 3600 / 2900 / 2200; 4-lane undivided two-way 3000 / 2400 / 1800; 4-lane divided two-way 3600 / 2900 / -; 6-lane undivided two-way 4800 / 3800 / -; 6-lane divided two-way 5400 / 4300 / -; 8-lane divided two-way 7200 / - / -. IRC:106 sets DSV at about 0.70 x capacity, so implied capacity is DSV / 0.7; for example a 4-lane divided arterial is about 5140 PCU/h (our derivation). IRC:64-1990 rural two-lane DSV at LOS B (about 0.5 x capacity), PCU/day: plain terrain 15,000 (low curvature) / 12,500 (high); rolling 11,000 / 10,000; hilly 7,000 / 5,000. Paved shoulders of at least 1.5 m add about 15%. Single-lane plain: 2000 / 1900 PCU/day.
- **Calibration dataset used:**
  > Indo-HCM urban roads: base and non-base midblock sections in 10 metro cities (Delhi, Mumbai, Kolkata, Chennai, Jaipur, Chandigarh, Surat, Ahmedabad, Thiruvananthapuram, Guwahati), recorded on video over 50-75 m traps at least 500 m from the upstream junction. Signalized intersections: 18 intersections nationwide. The raw data are not public.
- **Calibration method:**
  > Dynamic PCU from speed and area ratios; capacity from fitted speed-flow curves per width class; LOS bands from clustering stream speeds; Stream Equivalency regression on composition. IRC:106 and IRC:64 used committee judgement on earlier CRRI studies.
- **Max density tested:**
  > Interurban 4-lane LOS F starts above 90 PCU/km/direction and 6-lane LOS F above 136 PCU/km/direction (Indo-HCM Tables 3.8 and 3.9). The urban chapter has no density threshold; urban LOS is based on speed and v/c.
- **Validation against field case:**
  > Indo-HCM worked examples, e.g. a four-lane interurban section with 1250 veh/h/direction gives 1978 PCU/h/direction, v/c = 0.56 and LOS D. No named urban junction case such as Silk Board appears in the manual.

### Data

- **Network import:**
  > N/A (standards define road typologies the simulator should expose: 2-lane undivided 7.5 m; 4/6/8/10-lane divided at 7.5/11/14.5/18 m per direction; signal approaches by effective width in metres).
- **Demand input formats:**
  > Classified volume counts in veh/h by class, converted to PCU/h with static (IRC) or dynamic (Indo-HCM) PCU or with Se. Peak hour is about 8-10% of daily traffic in urban areas (IRC:106 clause 6.1).

### Reuse verdict

- **Reuse mode:**
  > Use as data: (1) validation targets for the capacity-versus-width test (urban lane capacity 1200-2000 PCU/h/lane; saturation flow 1140 - 60 W PCU/h/m); (2) output metrics: report dynamic PCU per class with Indo-HCM's formula from simulated speeds and plan areas, LOS from v/c using the Indo-HCM urban bands, and area occupancy computed over a virtual detection zone; (3) static IRC:106 PCU as a fallback converter for user-entered demand.
- **Effort within 72 hours:**
  > Low, about 3-4 hours. Hard-code a JSON table of PCU sets (IRC:106 static, Indo-HCM median), capacity targets and LOS bands; add a detector that logs per-class speed, plan area and occupancy time; compute dynamic PCU, area occupancy, v/c and LOS per link per interval. Cut: side-friction adjustment factors, interurban chapters, pedestrian chapters, and the Se regression (optional).
- **Licence constraint:**
  > None on our code. Cite IRC:106-1990, IRC:64-1990 and Indo-HCM (CSIR-CRRI 2017) as sources. Do not redistribute the PDFs themselves inside the app.

### Lessons

- **Documented failures:**
  > Using one fixed PCU set across compositions gives large errors in mixed flow. Indo-HCM introduced Se precisely because a small change in volume or composition can change PCU substantially, especially for large vehicles. Many Indian simulation papers still benchmark against IRC:106 static PCUs (e.g. WCTR 2019 comparisons of IRC, Chandra dynamic PCU and Indo-HCM), so results that agree with one method can disagree with another.
- **Validation approach:**
  > Indo-HCM: field speed-flow data on base sections in 10 cities; capacity from fitted speed-flow curves; LOS bands from speed clustering; worked examples. IRC:106: committee review of CRRI urban capacity studies. Our extraction was checked by OCR of the IRC:106 scan, visual inspection of the page images for Tables 1 and 2, and arithmetic checks on Indo-HCM Table 5.4 (capacity = lane capacity x lanes; DSV = 0.7 x capacity).
- **Takeaway for our build:**
  > Adopt Indo-HCM 2017 as the reference for both validation targets and output metrics, and keep IRC:106 only as a static PCU fallback. Concrete rules: (a) the capacity-versus-width test should give about 1350 PCU/h/lane on a 7.5 m directional carriageway and about 1400 on 11 m, within an explicit tolerance band (say +-20%), using Indo-HCM median PCUs to convert simulated veh/h; (b) the signal-approach discharge test should give about 1140 - 60 W PCU/h per metre of green, e.g. 720 x 7 = 5040 PCU/h for a 7 m approach and 510 x 10.5 = 5355 PCU/h for 10.5 m; (c) compute dynamic PCU_i = (Vc/Vi)/(Ac/Ai) from simulation output with a 6.19 m2 standard car, and show it next to the static IRC value so users see the difference; (d) compute area occupancy over a virtual trap as sum((L_i + d) B_i / v_i) / (T W) and use it, not veh/km, as the congestion-state variable for lane-free traffic; (e) label LOS with the Indo-HCM urban v/c bands for divided versus undivided roads, and state which table was used.

### Sources

- **Links:**
  - https://law.resource.org/pub/in/bis/irc/irc.gov.in.106.1990.pdf
  - https://law.resource.org/pub/in/bis/irc/irc.gov.in.064.1990.pdf
  - https://pdfcoffee.com/indo-hcm-2017pdf-pdf-free.html
  - https://crridom.gov.in/sites/default/files/news/Development-of-Indian-Highway-Capacity-Manual-Executive-Summary-15-04-2014.pdf
  - https://www.wctrs-society.com/wp-content/uploads/abstracts/rio/general/3671.pdf
  - https://arxiv.org/pdf/2408.02353
  - https://informahealthcare.com/doi/abs/10.1080/18128600608685661
  - https://scipedia.com/public/Arasan_Dhivya_2010a
  - https://www.wctrs-society.com/wp-content/uploads/abstracts/mumbai/WCTR2019_Mumbai_622.pdf
  - https://www.rcet.org.in/uploads/academics/regulation2021/rohini_10540480012.pdf
  - https://www.slideshare.net/VijaiKrishnanV/capacity-level-of-service-highways-signalized-intersections-indohcm

### Uncertain fields (left out above)

- data_access
- known_limitations
- last_activity
- licence
- maintenance_health
- non_lane_behaviour
- per_class_parameters


## 14 Indian trajectory and calibration datasets

*Outline id C04 · category india_context · priority high · source file `results/Indian_trajectory_and_calibration_datasets.json`*

### Basic info

- **Name:**
  > Indian trajectory and calibration datasets (Chennai Saidapet / ETF2D, NCR UAV, SkyEye Ahmedabad, two-wheeler seepage benchmark, IDS-JODHA, IIT Guwahati highway data)
- **Type:** dataset
- **Maintainer:**
  > Chennai Saidapet: V. Kanagaraj, G. Asaithambi, T. Toledo, T.-C. Lee (Technion and partners), hosted by Tomer Toledo, Technion. ETF2D: A. A. Chaudhari, O. Okhrin, M. Treiber (TU Dresden, DFG project 456691906). NCR UAV: Yawar Ali, K. Ramachandra Rao, Ashish Bhaskar, Niladri Chatterjee (IIT Delhi / QUT). SkyEye: Debaditya Roy, Tetsuhiro Ishizaka, Krishna Mohan C., Atsushi Fukuda. Seepage benchmark: Agneev Guin, Alberto Bazan-Guillen, Prashanth Kannan, Junjun Lu, Marcos Postigo-Boix (Universitat Politecnica de Catalunya). IDS-JODHA: Sreejib Pal, Shashvat Tripathi, Ranju Mohan (IIT Jodhpur TSTM Lab). IIT Guwahati highway data: Akhilesh Kumar Maurya's group, IIT Guwahati.
- **First release:**
  > Chennai Saidapet 2014-2015 (recorded 13 Feb 2014; data legend dated 14 Oct 2014; TRR 2491, 2015). SkyEye 2019 (arXiv 1912.04801). ETF2D report 2025. IDS-JODHA October 2025. NCR UAV December 2025 (arXiv 2512.11898). Seepage benchmark 11 July 2026. IIT Guwahati UAV paper 2026.
- **Last activity:**
  > Seepage benchmark v1 published 11 July 2026. NCR UAV Zenodo record (sample clips) created 18 May 2026. IIT Guwahati paper 2026 (DOI 10.1007/s13177-026-00657-2). Chennai Technion files unchanged since 2014.
- **Language:** N/A (data files: XLSX, CSV, MP4, ZIP, rosbag)
- **Code availability:**
  > Chennai Saidapet: public XLSX files at toledo.net.technion.ac.il. NCR UAV: Zenodo DOI 10.5281/zenodo.17745347. Seepage: Mendeley Data DOI 10.17632/hs6drgb2vx.1. IDS-JODHA: Zenodo DOI 10.5281/zenodo.17258045, plus a project page with codes. SkyEye: the pointer at github.com/debadityaroy/SkyEye returned HTTP 404 on 2026-11-11. ETF2D: report PDF only (DOI 10.25368/2025.122). IIT Guwahati: paper only.

### India fit

- **Mixed traffic support:**
  > Chennai Saidapet: 6 classes (motorcycle, car, bus, truck, LCV, auto-rickshaw); composition 56.4% motorcycles, 26.6% cars, 12.2% autos, 4.8% heavy vehicles; each record carries vehicle length and width. NCR UAV: 6 classes (car, motorised two-wheeler, motorised three-wheeler, LCV, bus, HCV), with car:M2W:M3W:LCV:Bus:HCV shares of about 35-41 : 31-45 : 10-15 : 4-11 : 1-2 : 1-6 percent across sites. SkyEye: lane-less intersection traffic, all road users tracked. Seepage benchmark: two-wheeler seepage events from Indian videos (IDD/TIAND).
- **Non lane behaviour:**
  > Chennai Saidapet records continuous lateral position (centre of vehicle, measured from the left edge), lateral speed and lateral acceleration for every vehicle at 0.5 s, so lateral placement and lateral gaps can be measured directly. NCR UAV gives X,Y local coordinates at 30 fps; the paper reports lane-keeping preferences and wide lateral distributions for two-wheelers. ETF2D and Kulkarni et al. (2024) used the Chennai data to define leader-follower pairs through lateral overlap and influence zones.
- **Calibration method:**
  > N/A for datasets; see indian_calibration_evidence for the methods studies applied to them (RMSE of position for leader-follower calibration; speed-density model fitting).
- **Validation against field case:**
  > Maraimalai Adigalar Bridge, Saidapet, Chennai (6-lane divided arterial). NCR midblocks in Delhi and Noida. Four Ahmedabad intersections (SkyEye). No dataset covers a named junction such as Silk Board or Hebbal.

### Data

- **Demand input formats:**
  > Chennai: entry times and classes of the 3,005 vehicles can be replayed as an exact inflow schedule at the upstream end of the 245 m section. NCR: classified flows per site (composition given in Table 1 of the paper).

### Reuse verdict

- **Reuse mode:**
  > Use as data. MOST PRACTICAL IN 72 HOURS: the Chennai Saidapet set (Technion). It is the only one that is small (two XLSX files of about 7 MB each), directly downloadable without registration, already in physical units (metres, m/s, 0.5 s), includes lateral position and vehicle dimensions, and is the established benchmark. What each set can calibrate or validate: Chennai gives the speed-density/flow scatter from 1-min aggregates, per-class speed distributions, time and space headways, lateral position and lateral gap distributions, and IDM parameters per class; it has no junction discharge. NCR UAV gives the same quantities plus fundamental diagrams across 6 sites and two widths (10.5 m and 14 m), which is good for testing how capacity changes with width, if the trajectory files can be fetched. SkyEye would give intersection turning and conflict trajectories and junction discharge, but is not obtainable. The seepage benchmark gives the rate and conditions of two-wheeler seepage at queues, but needs the raw IDD/TIAND videos for full use and is non-commercial. IIT Guwahati gives a jam density reference (about 900 veh/km over 8 lanes) from the paper only. IDS-JODHA is a perception dataset (dashcam plus LiDAR, 176 GB) and is not useful for calibration within 72 hours.
- **Effort within 72 hours:**
  > Chennai validation, about 4-6 hours: (1) download the two XLSX files and convert them to CSV once offline; (2) build a 245 m x 11.2 m straight one-way link in the simulator; (3) inject the observed entry schedule (time, class, length, width, entry lateral position) at the upstream edge; (4) run, place virtual detectors every 50 m, and aggregate to 1-min flow, density and space-mean speed; (5) compare per-class mean speeds against the observed 6.13 / 6.01 / 5.64 / 5.06 m/s (cars / motorcycles / heavy / autos), the lateral-position histograms by class, and the speed-density cloud. Report the error per class (e.g. mean absolute percentage error) and note that this is one 30-min sample. Cut: trajectory-level calibration with an optimiser, leader-follower identification, and every other dataset. Junction discharge cannot be validated from Chennai, so use the Indo-HCM saturation-flow formula (1140 - 60 W PCU/h/m) as the junction target instead.

### Lessons

- **Known limitations:**
  > Chennai: one site, one 30-min afternoon period, medium flow, on a bridge with no side friction or junctions; trajectories were extracted semi-automatically at 0.5 s; 4,199 observations (3.73%) were manually corrected for overlaps and are flagged and should be excluded from microscopic analysis; the classes do not separate bicycles or pedestrians. NCR: midblock only; the DOI's current version shows only sample clips. SkyEye: unavailable. Seepage benchmark: derived from dashcam-style IDD/TIAND footage; raw video is not included; non-commercial. IDS-JODHA: no trajectory labels. IIT Guwahati: highway, not urban; data not released. None of the open sets covers a signalized junction with stop-line discharge measurements.
- **Documented failures:**
  > Several Indian trajectory sets announced as public later became unreachable (SkyEye GitHub 404; NCR concept DOI now pointing at sample clips). The ETF2D DOI given in the task is a project report, not a Chennai dataset, so it is easy to misidentify sources. Kanagaraj et al. note that most developing-world trajectory data are not public, which is why the 2014 Chennai set is still reused a decade later.
- **Validation approach:**
  > Chennai: locally weighted regression smoothing gives consistent position, speed and acceleration, with no trajectory overlaps after correction; ANOVA confirms class speed differences are significant (F(3,3001) = 114.93). NCR: compared against classified volume counts, class space-mean speeds and a probe-vehicle trajectory. Availability and sizes in this item were checked by HTTP download on 2026-11-11.
- **Takeaway for our build:**
  > Ship one honest empirical check: a Chennai Saidapet replay scenario (245 m x 11.2 m, observed entry schedule) that reports simulated against observed per-class mean speeds, lateral-position histograms and the 1-min speed-density cloud. Pair it with Indo-HCM saturation-flow and lane-capacity targets for junctions and width, because no open Indian dataset validates junction discharge. Label the result 'checked against one 30-min Chennai midblock sample', not 'calibrated for Indian traffic'. Store the converted CSV outside the app bundle and cite Kanagaraj et al. (2015).

### Sources

- **Links:**
  - https://toledo.net.technion.ac.il/?p=387
  - https://toledo.net.technion.ac.il/files/2014/10/TrajectoryDataDescription.pdf
  - https://toledo.net.technion.ac.il/files/2014/10/ChennaiTrajectoryData2.45-3.00PM.xlsx
  - https://toledo.net.technion.ac.il/files/2014/10/ChennaiTrajectoryData3.00-3.15PM.xlsx
  - https://toledo.net.technion.ac.il/files/2016/01/TRR_KanagarajEtAl_15.pdf
  - https://doi.org/10.25368/2025.122
  - https://tud.qucosa.de/id/qucosa%3A97638
  - https://arxiv.org/abs/2405.10665
  - https://arxiv.org/abs/2512.11898v1
  - https://doi.org/10.5281/zenodo.17745347
  - https://zenodo.org/records/17745347
  - https://arxiv.org/abs/1912.04801
  - https://sites.google.com/view/debadityaroy/datasets
  - https://data.mendeley.com/datasets/hs6drgb2vx/1
  - https://shaaashvat.github.io/ids-jodha/
  - https://zenodo.org/records/17258045
  - https://www.downtoearth.org.in/governance/why-traffic-on-indian-roads-defies-conventional-models-what-a-study-of-36000-vehicles-found
  - https://arxiv.org/pdf/2408.02353
  - https://arxiv.org/pdf/2608.00602

### Uncertain fields (left out above)

- calibration_dataset_used
- data_access
- indian_calibration_evidence
- licence
- licence_constraint
- maintenance_health
- max_density_tested
- per_class_parameters
- seepage_filtering_support


## 15 Bengaluru network and traffic data sources

*Outline id C05 · category india_context · priority high · source file `results/Bengaluru_network_and_traffic_data_sources.json`*

### Basic info

- **Name:** Bengaluru network and traffic data sources
- **Type:**
  > dataset survey (network geometry, signal timings, counts, speeds, congestion indices) for a Bengaluru traffic simulator
- **Maintainer:**
  > Several: OpenStreetMap contributors (OSM Foundation, ODbL); OpenCity.in (Oorvani Foundation civic data portal, hosting documents from Bengaluru Traffic Police (BTP), BBMP/GBA, BDA, BMRCL, DULT); Bengaluru Traffic Police and C-DAC (B-ATCS adaptive signals); TomTom (Traffic Index, Traffic Stats); IISc CDPG/CiSTUP and AIM@IISc (Bengaluru Mobility Challenge, UVH-26 image dataset)
- **Last activity:**
  > OSM: live (Overpass snapshot used here 2026-11-11T09:56Z; Geofabrik India extract contains data to 2026-11-09). OpenCity: Hebbal tunnel dataset updated 2026-10-11; GBA elevated-corridor datasets with KML updated 2026-10-14; BTP signal-timing set metadata touched 2025-11-27. TomTom Traffic Index 2025 released Jan 2026. Arcadis B-ATCS case study April 2026.
- **Code availability:**
  > Data, not code. Downloadable today: OSM via Overpass API or Geofabrik southern-zone-latest.osm.pbf (533 MB); OpenCity CKAN API (package_show/package_search) returns direct PDF/CSV/KML URLs. Not downloadable: B-ATCS live signal state, BTP junction counts, TomTom segment speeds (commercial), Bengaluru Mobility Challenge videos (participants only).

### India fit

- **Mixed traffic support:**
  > Data side only: classified counts by mode exist only inside PDF reports, e.g. RITES Hebbal 2051 input of 33,765 veh/h = car 8,354, taxi 6,266, two-wheeler 11,835, auto 2,437, bus 1,044, LCV 1,392, truck 1,741, multi-axle 696 (41,596 PCU). No open machine-readable classified count dataset was found for Bengaluru.
- **Seepage filtering support:**
  > N/A for data sources; none of the sources measures two-wheeler seepage. Must come from literature parameters.
- **Per class parameters:**
  > Implied PCU factors from the RITES Hebbal table (PCU/vehicle): car 1.0, taxi 1.0, auto 1.0, two-wheeler 0.75, bus 3.0, LCV 2.0, truck 4.0, multi-axle 4.0. IIT-B Hebbal report says it used IRC PCU factors; critics say these are 1990s factors that may overstate two-wheeler impact by about 30%.
- **Indian calibration evidence:**
  > Usable field numbers found: (1) RITES Hebbal VISSIM base 2019: 14 directional peak-hour volumes with GEH (e.g. City->Hebbal 7,946 observed vs 7,796 simulated, GEH 1.69; GEH < 10 for 85% of values) and 6 section speeds (16-29 km/h observed). (2) IIT-B Hebbal: junction peak-hour 32,770 veh (31,758 PCU) at Hebbal and 28,493 veh (27,863 PCU) at Mekhri Circle, 09:00-10:00; travel speeds 4.29, 3.57 and 8.3 km/h on surveyed routes. (3) TomTom 2025: 36 min 9 s per 10 km average, 74.4% congestion, morning peak 14.6 km/h, evening peak 13.2 km/h (BTP disputes, says about 34.5 min per 10 km at peak).
- **Calibration dataset used:**
  > Best available open targets: RITES Hebbal 2019 peak-hour turning-movement diagram (26,896 PCU total, by approach) plus directional volumes and section speeds (PDF, public domain on OpenCity); IIT-B / tunnel DPR junction totals and speed-delay runs (PDF); BTP fixed-time signal plans for roughly 240 junctions in 124 PDFs (most PDFs cover a pair of junctions). None is machine-readable; numbers must be transcribed.
- **Calibration method:** N/A for the data sources themselves (RITES used GEH on link volumes plus speed comparison; see C06).
- **Validation against field case:**
  > Hebbal is the only Bengaluru junction found with an open, numeric base-year calibration table (RITES 2019 VISSIM) plus a public BTP signal plan for the at-grade junction under the flyover. Silk Board has a BTP signal plan and only percentage before/after congestion figures.

### Data

- **Network import:**
  > OpenStreetMap is the only practical network source. Overpass check on 2026-11-11 of all motorway/trunk/primary/secondary/tertiary (+_link) ways in bbox 12.83,77.45,13.14,77.78 (15,288 ways, 3,996 km): length share with tag present - lanes 48% overall (motorway 97%, trunk 96%, primary 70%, secondary 47%, tertiary 28%, primary_link 33%); oneway tagged on 100% of trunk/motorway and 89% of primary (divided roads are drawn as two one-way carriageways); width only 1% (values mixed: '10', '12 m', "40'"); maxspeed 19% (trunk 70%); turn:lanes about 0%; lanes:forward about 0%. Bridges: 925 bridge ways (142.5 km), 880 carry layer (852 layer=1, 26 layer=2, 2 layer=3), 45 have no layer; 617 bridge ways on secondary-or-higher roads, 597 with layer but only 407 with lanes and 6 with width. 184 ways named '*Flyover*' (59 distinct names): all have layer, 133 have lanes. 55 major-road ways have layer>0 without a bridge tag and 39 have layer<0 without tunnel/covered. A node-sharing check found 0 bridge ways whose interior nodes are shared with a layer-0 ground road (no false at-grade connections). Corridor examples: Outer Ring Road (625 ways, 136 km): lanes 84%, oneway 99%, width 1%, layer 13%, maxspeed 77%. Hebbal (box 13.030-13.045 N, 77.585-77.600 E): 19 bridge ways all lanes+layer, e.g. way 377852248 'Hebbal Flyover' trunk lanes=3 layer=1 (468 m), way 379862163 'Flyover Ramp' lanes=2 layer=2, way 693773357 'Hebbal Flyover' lanes=1 width=3; but only 67% of all ways there have lanes. Silk Board: way 40696221/40696222 'Silk Board Flyover' trunk lanes=3 layer=1 (456 m each); way 886153772 'Ragigudda-Silk Board Integrated Flyover' primary lanes=2 bridge=viaduct layer=1 (2,079 m); way 1254771465 'Silk Board Interchange' lanes=2 layer=2; way 519734960 'Silkboard Double Decker Flyover' lanes=4 layer=1; the metro deck above is a separate railway layer. K R Puram/Tin Factory: way 172886625/172886626 'Tin Factory Flyover' trunk lanes=2 layer=1 (241 m each), way 380724513 'Benniganahalli Flyover' lanes=3 layer=1; only 62% of ways in the box have lanes and 69% oneway. Richmond Circle: 8 'Richmond Circle Flyover' ways all with layer=1 but 4 of 8 lack lanes (e.g. way 36852353, 346 m) and two say lanes=1. Goraguntepalya: way 380052398/380052400 'Goraguntepalya Flyover' motorway lanes=2 layer=1, about 4.4 km each.

### Reuse verdict

- **Reuse mode:**
  > Use as data. OSM -> network geometry, lanes, oneway, layer (pre-import offline). BTP signal PDFs -> hand-coded fixed-time plans for the demo junctions. RITES/IIT-B tables -> demand and validation targets. BBMP width KML -> optional carriageway-width hint. TomTom -> only a city-level sanity check, not an input.
- **Effort within 72 hours:**
  > Feasible in about 4-6 hours for one corridor: Overpass clip (minutes), manual lane/width patching of about 10-30 ways (1-2 h), transcribing one BTP signal sheet and one turning-movement diagram (1-2 h), checking layer/connectivity (1 h). Cut: citywide import, BBMP width conflation (spatial matching of a 25 MB KML is a day's work), any attempt to get B-ATCS or TomTom data, and classified demand beyond the RITES mix.

### Lessons

- **Known limitations:**
  > OSM: width almost never tagged (1%); lanes missing on about half of all major-road length and on a third of bridge ways; turn:lanes essentially absent, so lane-to-lane connectivity at junctions must be guessed; service roads beside flyovers are often unlaned; some bridges have no layer (45) and some layered ways have no bridge tag (55); a few ways under construction are already in the data. OpenCity: almost everything is PDF or scanned drawing, so numbers need manual transcription; signal plans are fixed-time and undated and likely superseded at B-ATCS junctions; one-way list has no geometry; the width KML field meanings are undocumented. Counts: no open, machine-readable traffic counts or OD for Bengaluru; DPR counts predate structural changes (Hebbal ramp opened Jan 2026). TomTom: city aggregates only; BTP publicly disputes its numbers by about 10%.
- **Documented failures:**
  > IIT-B Hebbal study built its base model on DPR counts without OD data or real signal timings ('junction control is represented on an assumed basis'), and the IISc review found its base speed (13.74 km/h) inconsistent with the 4.29 km/h observed in the DPR; experts also noted the data predates the January 2026 Hebbal ramp. The Bengaluru Mobility Challenge dataset was announced as open to participants but many could not download it. The BTP signal-timing PDFs embed timings in drawings, so automated extraction is unreliable (pdftotext output interleaves diagram labels).
- **Validation approach:**
  > Direct inspection: Overpass API queries on 2026-11-11 with length-weighted tag-completeness statistics computed per highway class and per corridor box, plus a node-sharing check between bridge ways and layer-0 roads; OpenCity CKAN API listing of datasets, licences and resource formats; download and text extraction of the BTP signal PDFs (Hebbal, Silk Board/Checkpost, Marathahalli), the one-way CSV and the road-width KML attribute schema.
- **Takeaway for our build:**
  > Treat OSM as the geometry and topology source but never as the source of truth for capacity: (1) pre-import the corridor offline from Overpass, keep the OSM way IDs, and ship a small hand-reviewed patch file that sets lanes and carriageway width for every link the demo uses (default lanes by class when absent: trunk 3, primary 2, link roads 1-2; default lane width 3.0-3.5 m, matching the 3.0 m at-grade / 3.5 m elevated values quoted in the Hebbal DPR). (2) Derive z-level from layer, falling back to layer=1 for bridge without layer and -1 for tunnel; flag layer-without-bridge for review. (3) Encode the BTP fixed-time plan for the junction under the flyover as the default signal program and let the user edit it. (4) Use RITES Hebbal 2019 turning PCUs and GEH table as the single validation target. (5) Put OSM attribution and the ODbL link in the UI and in the shipped network file.

### Sources

- **Links:**
  - https://overpass-api.de/api/interpreter
  - https://wiki.openstreetmap.org/wiki/Overpass_API
  - https://download.geofabrik.de/asia/india.html
  - https://www.openstreetmap.org/way/377852248
  - https://www.openstreetmap.org/way/379862163
  - https://www.openstreetmap.org/way/693773357
  - https://www.openstreetmap.org/way/40696221
  - https://www.openstreetmap.org/way/886153772
  - https://www.openstreetmap.org/way/1254771465
  - https://www.openstreetmap.org/way/519734960
  - https://www.openstreetmap.org/way/172886625
  - https://www.openstreetmap.org/way/380724513
  - https://www.openstreetmap.org/way/36852353
  - https://www.openstreetmap.org/way/380052398
  - https://www.openstreetmap.org/copyright
  - https://opendatacommons.org/licenses/odbl/1-0/
  - https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
  - https://data.opencity.in/api/3/action/package_search?q=traffic%20signal
  - https://data.opencity.in/dataset/bengaluru-city-traffic-signal-data
  - https://data.opencity.in/dataset/f1146fbc-5208-4991-ac0b-8c1371fc567c/resource/176f9707-2ff1-4de8-8b51-676a535be214/download/743ca31f-fa3f-4ed8-a8a3-9467154c38e0.pdf
  - https://data.opencity.in/dataset/f1146fbc-5208-4991-ac0b-8c1371fc567c/resource/cdeae23a-77c0-4795-9e6d-f0e73b3e2948/download/850106de-e89f-45cf-ad48-2ffab3d04943.pdf
  - https://data.opencity.in/dataset/f1146fbc-5208-4991-ac0b-8c1371fc567c/resource/b3622d4a-e765-4660-b438-c71d41b211dc/download/f5f7101b-a6a7-4460-8175-b6e1cf59c02c.pdf
  - https://data.opencity.in/dataset/bengaluru-one-way-roads
  - https://data.opencity.in/dataset/bengaluru-road-width-map
  - https://data.opencity.in/dataset/bengaluru-comprehensive-mobility-plan
  - https://data.opencity.in/dataset/capacity-augmentation-of-road-and-rail-infrastructure-at-hebbal-junction
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137/resource/1677ca40-d3cd-42b3-b9d0-78d339307019/download/integrated-traffic-microsimulation-report-bengaluru-projectv4.pdf
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137/resource/26640ad3-9a60-4329-aeef-8bc1a815bfe4/download/av_technical_review_iitb_report.pdf
  - https://data.opencity.in/dataset/elevated-corridor-from-old-madras-road-to-central-silk-board-documents
  - https://data.opencity.in/dataset/bengaluru-traffic-police-jurisdictions
  - https://www.oneindia.com/bengaluru/bengaluru-hebbal-tunnel-experts-raise-concerns-over-traffic-data-and-modelling-8220163.html
  - https://indianinfrastructure.com/2026/04/06/smart-mobility-a-case-study-of-the-bengaluru-adaptive-traffic-control-system/
  - https://www.theweek.in/wire-updates/national/2024/10/09/mes5-ka-traffic-system.html
  - https://www.deccanherald.com/india/karnataka/bengaluru/ai-powered-signals-in-bengaluru-reduce-travel-time-by-33-3226394
  - https://www.tomtom.com/traffic-index/bengaluru-traffic/
  - https://www.deccanherald.com/india/karnataka/bengaluru/bengaluru-worlds-2nd-most-congested-city-commuters-lose-seven-days-a-year-on-roads-traffic-tom-tom-traffic-index-2025-3870635
  - https://www.deccanherald.com/india/karnataka/bengaluru/slow-traffic-bengaluru-cops-counter-tomtom-traffic-index-survey-numbers-3902490
  - https://docs.tomtom.com/traffic-stats/documentation/product-information/introduction
  - https://download.tomtom.com/open/banners/TomTom-Traffic-Stats-Product-Sheet-2025.pdf
  - https://ieee-dataport.org/node/13083
  - https://www.iisc.ac.in/events/aim-iisc-announces-public-release-of-uvh-26-dataset-and-vision-models-for-indian-urban-traffic/

### Uncertain fields (left out above)

- data_access
- demand_input_formats
- first_release
- licence
- licence_constraint
- maintenance_health
- non_lane_behaviour


## 16 Bengaluru flyover case studies

*Outline id C06 · category india_context · priority high · source file `results/Bengaluru_flyover_case_studies.json`*

### Basic info

- **Name:** Bengaluru flyover case studies
- **Type:**
  > case studies and validation datasets (consultancy microsimulation reports, peer review, before/after evidence) for Bengaluru flyovers and junctions
- **Maintainer:**
  > IIT-B Hebbal report: Prof. Archak Mittal, IIT Bombay, consultancy for client Rithwik Projects Pvt Ltd (its role in the project is not stated in the report), dated 10 Aug 2026, published by OpenCity under the BBMP Hebbal tunnel dataset. Review: Prof. Ashish Verma, IST Lab, IISc Bengaluru (Sept 2026). RITES Ltd for BMRCL/GoK: Hebbal capacity augmentation and MMI hub study (15 Dec 2021). Silk Board double-decker: built by BMRCL; before/after figures from Bengaluru Traffic Police via press.
- **First release:**
  > RITES Hebbal study: LOA 8 Mar 2019, interim Aug 2019, final feasibility Apr 2020, revised Jan 2021, public extract 15 Dec 2021. Silk Board double-decker first opened 17-18 July 2024. IIT-B report 10 Aug 2026.
- **Last activity:**
  > IIT-B report and IISc review uploaded to OpenCity 2026-09-30; finance department comments 2026-10-11; press coverage of the Silk Board/Ragigudda downstream jam on 2026-05-04 after the full double-decker opening.
- **Licence:**
  > OpenCity lists the Hebbal tunnel dataset and the RITES Hebbal dataset as 'Other (Public Domain)' (Government of Karnataka / BMRCL documents). The IIT-B report carries a consultancy disclaimer (technical opinion of the faculty member, not IIT Bombay). Press articles are copyrighted.
- **Code availability:**
  > Reports only (PDF). No model files, network files or VISSIM .inpx are published for any Bengaluru case.
- **Maintenance health:**
  > N/A (static reports). The Hebbal debate is live: tunnel work underway since June 2026, expected completion end of Jan 2028, and the IIT-B study is publicly contested.

### India fit

- **Mixed traffic support:**
  > IIT-B Hebbal: says the model should distinguish at least two-wheelers, cars, auto-rickshaws, LCVs, buses and heavy vehicles, with IRC PCU factors; no composition table is reported. RITES Hebbal 2051 input (veh/h): car 8,354, taxi 6,266, two-wheeler 11,835 (35% of vehicles), auto 2,437, private/KSRTC bus 1,044, LCV 1,392, truck 1,741, multi-axle 696; total 33,765 veh = 41,596 PCU, plus 728-1,197 BMTC buses per hour depending on scenario.
- **Non lane behaviour:**
  > None of the Bengaluru studies reports modelling non-lane movement; both Hebbal studies used VISSIM-style lane-based links and connectors (the IIT-B report's calibration table names 'vehicle inputs', 'connectors', 'desired speed distributions'; the RITES slides are titled 'TRAFFIC SIMULATION (VISSIM)'). The IISc review notes flyover pier footprints reducing at-grade capacity were not modelled.
- **Seepage filtering support:** Not addressed in any of the studies found.
- **Per class parameters:**
  > Only PCU factors are recoverable. RITES implied PCU/veh: car, taxi, auto 1.0; two-wheeler 0.75; bus 3.0; LCV 2.0; truck 4.0; multi-axle 4.0. Hebbal DPR design values: elevated lane width 3.5 m, at-grade lane width 3.0 m, design speed 80/60 km/h, ramps 30 km/h, Mekhri rotary 30-40 km/h. Critics (S. Arikutharam, ex-DULT) say the 1990s PCU factors may overstate the two-wheeler contribution by about 30%.
- **Calibration dataset used:**
  > IIT-B: DPR data only - 24-hour classified videographic counts on a typical working day, peak-hour turning counts, Hebbal ramp observations, speed-delay runs; no OD survey; signal timings not recorded ('represented on an assumed basis'); no pedestrian/NMT counts. RITES: July 2019 daily and peak-hour turning counts at Hebbal (398,875 PCU/day; 26,896 PCU peak hour) and link volumes on the Nagavara, Bhadrappa and Mekhri flyovers. Neither dataset is released in machine-readable form; both are in public-domain PDFs on OpenCity.
- **Calibration method:**
  > IIT-B: manual calibration matrix - volumes (vehicle inputs, OD matrix, turning proportions) vs junction/link counts; travel time and speed vs speed-delay survey (desired speed, car-following, signal control, route choice); queue length vs videos (saturation, lane change, signal timing); ramp interaction vs Hebbal observations (merge priority, connector placement). No error metric (GEH/RMSE) is reported; same demand and random seeds across scenarios, 30+ replications recommended but count used not stated. RITES: GEH statistic on 14 link volumes (target GEH < 10 for 85% of links met) plus comparison of 6 section speeds.
- **Max density tested:** Not reported in any study; IIT-B lists density (veh/km/lane) as a metric but publishes no values.
- **Validation against field case:**
  > Hebbal is the strongest candidate validation case: an open RITES 2019 GEH table and section speeds, an open IIT-B base-case summary (13.74 km/h, 3,573.5 veh-h) and its documented conflict with observed DPR speeds (4.29 and 3.57 km/h), plus a BTP fixed-time plan for the at-grade Ring Road x Bellary Road junction under the flyover (4 phases incl. pedestrian, cycle 130 s off-peak / 160 s peak). Silk Board is a qualitative scenario template (flyover relieves the junction, queue moves to the Ragigudda exit) with only percentage figures.

### Data

- **Network import:**
  > Studies coded their networks by hand on aerial imagery; nothing reusable. For our build the same corridors are well represented in OSM: Hebbal flyover ways (e.g. way 377852248, trunk lanes=3 layer=1; ramp way 379862163 lanes=2 layer=2), Silk Board flyover and double-decker ways with layer 1/2, Tin Factory flyover (2 x 241 m, lanes=2, layer=1).
- **Demand input formats:**
  > Reports give PCU turning diagrams per approach (RITES), junction totals and classified mode volumes; IIT-B splits demand into strategic OD groups (Airport/Yelahanka<->City, Yeshwanthpur<->Hebbal, KR Puram/ORR<->Hebbal, local Sanjay Nagar/CBI) and imposes route diversion of 50-80% because no OD survey exists.
- **Data access:**
  > OpenCity CKAN dataset 6b11c60b-2d6d-4426-acfa-1e5464759137 (Hebbal tunnel: DPR Sept 2025, drawings, EPC agreement, RFP, IIT-B report, IISc review, finance department comments) - direct PDF downloads, no registration. RITES Hebbal report: OpenCity dataset 'capacity-augmentation-of-road-and-rail-infrastructure-at-hebbal-junction', 33-page PDF. BTP signal plans: OpenCity 'bengaluru-city-traffic-signal-data' (Hebbal Fly Over & Kodigehalli Gate; Sarjapur Road Checkpost & Silk Board; HSR 14th Main & Iblur; Bhashyam Circle & Mekhri Circle; Palmgrove & Richmond Circle; Mariappa Circle & Nagavara). Silk Board figures only in press articles.

### Reuse verdict

- **Effort within 72 hours:**
  > About 6-8 hours of data work: clip the Hebbal box from Overpass (about 13.025-13.045 N, 77.585-77.600 E), keep the NH-44 mainline, one ramp pair and the at-grade junction (drop the ORR loops and the service-road web), transcribe the BTP 4-phase plan and the RITES 2019 peak-hour turning PCUs for the four approaches, convert PCU to vehicles with the RITES mode split, and hard-code the 14 RITES directional volumes as validation checkpoints. Cut: the full four-loop cloverleaf, Mekhri Circle rotary, tunnel scenario, route choice (use fixed turning ratios), evening peak, 2047 forecasts.
- **Licence constraint:**
  > Government reports are public domain on OpenCity, so quoting their counts and timings in the app is fine; cite them. The IIT-B report's disclaimer means its numbers should be presented as one consultant's model output, not observed truth. Press numbers should be cited, not redistributed in bulk.

### Lessons

- **Known limitations:**
  > IIT-B report (per the report itself and the IISc review): only 2 of 4 promised scenarios reported (flyover-only and tunnel-only results not tabulated); diversion fixed at 50%/80% from the tunnel DPR and also applied to the 2+2-lane elevated corridor; no OD survey, no recorded signal timings, no pedestrian counts; software, parameters and replications not documented; queue length, density, V/C and LOS promised but not reported; incident scenarios listed but not simulated; induced demand, mode shift and pier footprint ignored; network-level analysis effectively limited to the Mekhri-Hebbal link; base speed 13.74 km/h vs observed 4.29 km/h; data predates the January 2026 Hebbal ramp opening; a figure appears to mislabel Hebbal as Mekhri Circle. RITES: GEH > 10 on 2 of 14 links (Nagavara EB 13.68, Mekhri SB 11.94); 2051 runs assume a large public-transport shift (PT scenario 2: 65:35). Silk Board: only press-reported percentages, no counts or travel times.
- **Documented failures:**
  > (1) Silk Board double-decker: junction congestion fell (BTP: -56%), but the queue moved to the Ragigudda exit - about 6 km/day in the first week after opening, and in May 2026 vehicles descending at Ragigudda met a signal and a queue backing onto the flyover; commuters and press describe the jam as shifted towards HSR Layout and JP Nagar/Kanakapura Road. Cause: high-capacity elevated road discharging into a narrow signalised junction with insufficient dispersal capacity. (2) Hebbal IIT-B study: a base model that does not reproduce observed speeds was used to recommend a large capital project; the IISc reviewer concluded the recommendations were 'not scientifically supported' and that the scheme pushes congestion from one point to another. (3) IIT-B itself warns the combined scheme 'can produce a new bottleneck if both grade-separated facilities discharge large flows onto the same downstream surface link' yet concludes there is no severe spillback without showing queue results.
- **Validation approach:**
  > Read primary PDFs in full (IIT-B report text and figures, IISc review, RITES extract); cross-checked numbers between tables; checked OpenCity metadata through the CKAN API; Silk Board evidence from multiple press reports (Deccan Herald, OneIndia, Swarajya), since BTP has not published the underlying data.
- **Takeaway for our build:**
  > Make the demo about the downstream junction, not the flyover: (1) always include at least one signalised junction downstream of the flyover landing in the network, and report queue length and spillback onto the flyover there as headline metrics, because both Bengaluru cases fail at the landing, not on the deck. (2) Report the same metric set for every scenario (delay/vehicle, completed trips, max queue per approach, stops), with throughput-normalised delay, so comparisons cannot be cherry-picked as in the IIT-B report. (3) Ship a 'calibration check' panel that compares base-run link volumes with the RITES 2019 values using GEH and shows the observed 3.57-4.29 km/h speeds, so users see whether the base reproduces reality before trusting a scenario. (4) Expose diversion share and PCU factors as visible, editable assumptions. (5) Seed the scenario list with: base; flyover lane addition; downstream signal retiming; flyover-merge lane blockage.

### Sources

- **Links:**
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137/resource/1677ca40-d3cd-42b3-b9d0-78d339307019/download/integrated-traffic-microsimulation-report-bengaluru-projectv4.pdf
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137/resource/26640ad3-9a60-4329-aeef-8bc1a815bfe4/download/av_technical_review_iitb_report.pdf
  - https://data.opencity.in/api/3/action/package_show?id=6b11c60b-2d6d-4426-acfa-1e5464759137
  - https://data.opencity.in/dataset/capacity-augmentation-of-road-and-rail-infrastructure-at-hebbal-junction
  - https://data.opencity.in/dataset/ea803af5-a9fd-439f-9365-0ec3ded0d455/resource/75cd4720-f36c-43bd-8e40-510447152891/download/a6b1f762-c310-4d03-aff8-77ca80a78d25.pdf
  - https://data.opencity.in/dataset/f1146fbc-5208-4991-ac0b-8c1371fc567c/resource/176f9707-2ff1-4de8-8b51-676a535be214/download/743ca31f-fa3f-4ed8-a8a3-9467154c38e0.pdf
  - https://data.opencity.in/dataset/f1146fbc-5208-4991-ac0b-8c1371fc567c/resource/cdeae23a-77c0-4795-9e6d-f0e73b3e2948/download/850106de-e89f-45cf-ad48-2ffab3d04943.pdf
  - https://data.opencity.in/dataset/f1146fbc-5208-4991-ac0b-8c1371fc567c/resource/efc6b288-72f7-4eda-9884-5bd19f561fdc/download/26822cb9-f77c-429c-8e17-74a7ad09a7f6.pdf
  - https://data.opencity.in/dataset/bengaluru-city-traffic-signal-data
  - https://www.oneindia.com/bengaluru/bengaluru-hebbal-tunnel-experts-raise-concerns-over-traffic-data-and-modelling-8220163.html
  - https://deccanherald.com/india/karnataka/bengaluru/silk-board-double-decker-flyover-cuts-congestion-by-half-reveals-police-data-3208886
  - https://www.deccanherald.com/india/karnataka/bengaluru/new-flyover-eases-silk-board-crawl-but-creates-fresh-jam-at-bengalurus-ragigudda-3989694
  - https://deccanherald.com/india/karnataka/bengaluru/double-decker-flyover-has-shifted-the-congestion-2-3133561
  - https://www.oneindia.com/bengaluru/bengaluru-s-double-decker-flyover-eases-silk-board-jam-but-gridlock-builds-at-ragigudda-8076847.html
  - https://swarajyamag.com/infrastructure/how-bengalurus-double-decker-flyover-makes-the-dreaded-silk-board-commute-shorter-and-smoother
  - https://www.deccanherald.com/india/karnataka/bengaluru/study-suggests-construction-of-flyovers-to-ease-congestion-in-bengaluru-1244133.html
  - https://www.imanagerpublications.com/article/20878
  - https://imanagerpublications.com/article/22139
  - https://www.openstreetmap.org/way/377852248
  - https://www.openstreetmap.org/way/379862163
  - https://www.openstreetmap.org/way/886153772
  - https://www.openstreetmap.org/way/172886625

### Uncertain fields (left out above)

- indian_calibration_evidence
- reuse_mode


---

# D. Architecture decisions

## 17 Engine placement

*Outline id D01 · category architecture · priority high · source file `results/Engine_placement.json`*

### Basic info

- **Name:**
  > Engine placement: SUMO on server streaming state vs engine in browser (JS or Rust/WASM) vs Python engine behind an API
- **Type:** design decision
- **Maintainer:**
  > N/A for the decision itself. Components it depends on: Eclipse SUMO (DLR / Eclipse Foundation), hosting providers (Render, Google Cloud Run, Fly.io, Hugging Face, Oracle Cloud), and reference projects (A/B Street, SUMO-Web3D, traffic-simulation.de, UXsim)
- **Last activity:**
  > Evidence checked 2026-11-11: SUMO 1.28.0 wheels on PyPI (eclipse-sumo, libsumo, traci); SUMO WebAssembly PR #18310 still a draft and unmerged (last updated 2026-10-12); Fly.io and Hugging Face free-tier terms as documented in November 2026
- **Licence:**
  > Depends on the engine: SUMO EPL-2.0; A/B Street / osm2streets Apache-2.0; UXsim MIT; traffic-simulation.de (movsim) GPL-3.0
- **Language:**
  > Server pattern: Python (FastAPI/aiohttp) + libsumo/TraCI (C++ engine). Browser pattern: TypeScript, or Rust compiled to WASM with wasm-pack. API pattern: Python (NumPy-based engine such as UXsim, or custom)
- **Code availability:**
  > All candidate building blocks are open source: SUMO (github.com/eclipse-sumo/sumo, pip install eclipse-sumo / libsumo), A/B Street and osm2streets (github.com/a-b-street), UXsim (github.com/toruseo/UXsim), traffic-simulation.de (github.com/movsim/traffic-simulation-de)
- **Maintenance health:**
  > SUMO is actively maintained with regular releases and binary wheels for Linux x86_64/aarch64, macOS arm64 and Windows, so a server deployment is just a pip install. No maintained SUMO WebAssembly build exists: the only attempt is an AI-generated draft PR (#18310, September 2026) whose author has not yet signed the Eclipse contributor agreement. In-browser engines are therefore custom code you maintain yourself.

### Data

- **Network import:**
  > Server/SUMO: OSM -> netconvert (or osmWebWizard) -> .net.xml on the server; edits mean regenerating the network server-side. Browser: OSM (Overpass XML) -> osm2streets-js (WASM) or a custom TS parser in the client, with no server round-trip. Python API: OSM -> osmnx/custom importer on the server, or a pre-baked JSON network shipped with the app.
- **Demand input formats:**
  > Server/SUMO: SUMO route/flow XML (generate from UI parameters with randomTrips or flow definitions). Browser and Python: our own JSON scenario (origin-destination flows per vehicle class per hour), which is simplest and keeps the UI schema identical across engine choices.
- **Data access:** N/A for the decision; OSM extracts via Overpass/Geofabrik (ODbL).

### Engineering

- **Runs in browser or server:**
  > Pattern A (SUMO on server, streaming): engine on server, browser renders. Pattern B (engine in browser): everything client-side, server only serves static files. Pattern C (Python engine behind API): engine on server, either batch (run, then return results/trajectories) or streaming.
- **Api:**
  > Pattern A: libsumo (in-process, fastest, single simulation per process; 'cannot be used to connect multiple clients') or TraCI over a socket (slower; multiple clients possible); the web server exposes REST to create/edit a scenario and a WebSocket for frames. Pattern B: a JS/WASM module interface (e.g. sim.tick(dt), sim.positions() -> Float32Array), so no network API is needed. Pattern C: REST POST /scenarios -> job id; GET /results; optional WebSocket for frames.
- **Gpu requirement:**
  > None for any pattern (CPU simulation). The browser renderer needs WebGL/WebGL2 for thousands of agents.
- **Build complexity:**
  > Pattern A: low engine effort (pip install eclipse-sumo libsumo; Docker image with SUMO), moderate glue (process pool, cleanup, WebSocket diffing, netconvert on edits); SUMO's lane-based model needs the sublane model configured for Indian traffic. Pattern B: highest engine effort (write or port the model in TS or Rust), lowest ops effort (static hosting on GitHub Pages / Cloudflare Pages / Netlify / Vercel); Rust/WASM adds a wasm-pack toolchain and JS<->WASM boundary design, while plain TypeScript is fastest to iterate in 72 hours. Pattern C: moderate (FastAPI + custom or UXsim engine; Docker; job runner); simplest to debug.
- **Scenario editability:**
  > Pattern A: edits (lane count, width, signals) need regenerating the SUMO network (netconvert / XML patch) and restarting the simulation, giving a slower edit loop. Pattern B: edit in-memory objects and restart instantly, the best fit for 'tweak and rerun'. Pattern C: same as B, plus an HTTP round-trip.
- **Output metrics supported:**
  > Pattern A: SUMO's built-in outputs (tripinfo, edgeData, queue output, emissions) for free. Patterns B and C: only what we implement (travel time, delay, queue length, throughput are cheap; emissions and conflicts are not).
- **Emissions support:**
  > Pattern A gets SUMO's HBEFA-based emission models for free; Patterns B and C must implement their own (e.g. a simple speed-based factor table) or skip.

### Lessons

- **Known limitations:**
  > Pattern A: process-per-simulation (libsumo), cold starts (Render free spins down after 15 min idle, about 1 min to wake), a 750 instance-hours/month cap, ephemeral filesystem, Cloud Run WebSocket max 60-minute timeout with best-effort session affinity, Hugging Face Docker Spaces now require a paid plan (only static Spaces are free), Fly.io has no free tier for new organisations (only $1 trial credit; bills under $5/month waived), and SUMO lane-based defaults need sublane configuration for Indian traffic. Pattern B: the engine must be written from scratch, performance depends on the user's device (low-end phones), there are no built-in validated models, and all scenario data is client-visible. Pattern C: the Python GIL, slower per-agent loops, and the same cold-start and free-tier caps as A.
- **Documented failures:**
  > A/B Street: a monolithic WASM bundle 'didn't scale' and detangling native-only dependencies for the web was 'quite tough'. SUMO-Web3D: the server-streaming viewer was archived after 2018 and never tracked SUMO releases. SUMO TraCI docs: naive per-vehicle polling is about 11x slower than plain SUMO in the Bologna benchmark. The SUMO WASM attempt (PR #18310) is stalled as a draft on contributor-agreement paperwork.
- **Validation approach:**
  > Evidence from primary documentation (SUMO Libsumo and TraCI docs with the Bologna timing table; Render, Cloud Run, Fly.io, Hugging Face and Oracle free-tier docs), working public deployments (play.abstreet.org WASM, traffic-simulation.de JS), and repository inspection (SUMO-Web3D architecture, traffic-visualizer WASM exports, SUMO PR #18310 status).

### Sources

- **Links:**
  - https://sumo.dlr.de/docs/Libsumo.html
  - https://sumo.dlr.de/docs/TraCI/index.html
  - https://pypi.org/project/eclipse-sumo/
  - https://pypi.org/project/libsumo/
  - https://github.com/eclipse-sumo/sumo/pull/18310
  - https://github.com/sidewalklabs/sumo-web3d
  - https://play.abstreet.org/0.3.49/abstreet.html
  - https://a-b-street.github.io/docs/project/history/retrospective/index.html
  - https://github.com/a-b-street/osm2streets
  - https://github.com/movsim/traffic-simulation-de
  - https://github.com/alexose/traffic-visualizer
  - https://github.com/toruseo/UXsim
  - https://render.com/docs/free
  - https://docs.cloud.google.com/run/docs/triggering/websockets
  - https://docs.cloud.google.com/free/docs/free-cloud-features
  - https://docs.fly.io/about/pricing
  - https://huggingface.co/docs/hub/spaces-overview
  - https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

### Uncertain fields (left out above)

- first_release
- multi_tenancy_model
- performance
- takeaway_for_our_build
- wasm_or_streaming_feasibility


## 18 Engine design

*Outline id D02 · category architecture · priority high · source file `results/Engine_design.json`*

### Basic info

- **Name:**
  > Engine design: time-stepped vs event-driven, integration scheme, neighbour search at Indian densities, seeded determinism, worker/typed-array architecture, one engine for lane-based and lane-free movement
- **Type:** design decision
- **Maintainer:**
  > N/A for the decision itself. Evidence from: Eclipse SUMO (DLR) step/integration docs, Treiber and Kanagaraj (integration schemes for car-following models), A/B Street (discrete-event simulator, Dustin Carlino), traffic-simulation.de (Treiber/Kesting), MDN (Web Workers, SharedArrayBuffer), Glenn Fiedler (Fix Your Timestep), PRNG references (bryc/code, Vigna and Blackman xoshiro)
- **Last activity:**
  > Evidence checked 2026-11-11 (SUMO Basic Definition docs, MDN SharedArrayBuffer page, A/B Street discrete-event doc, 2025 IDM review arXiv 2506.05909)
- **Language:**
  > TypeScript in a Web Worker (same module runnable in Node for headless tests); optional Rust/AssemblyScript to WASM for the hot loop only if profiling demands
- **Code availability:**
  > N/A (design). References: SUMO docs; A/B Street sim crate (github.com/a-b-street/abstreet); traffic-simulation.de JS (github.com/movsim/traffic-simulation-de); PRNG reference code at github.com/bryc/code/blob/master/jshash/PRNGs.md
- **Maintenance health:**
  > N/A (design decision). The pieces relied on (Web Workers, transferable ArrayBuffers, typed arrays) are stable web platform features; SharedArrayBuffer additionally requires cross-origin isolation headers

### Data

- **Network import:**
  > Engine consumes a pre-built link-and-connector JSON (links with polyline, width, level, speed limit, strip count = floor(width / 0.5 m); nodes with connectors, conflict points, signal programs). OSM import (osm2streets-js or a custom Overpass parser) is a separate preprocessing module so the engine never touches OSM; this keeps the engine deterministic and testable
- **Demand input formats:**
  > OD flows per vehicle class and time slice (veh/h), converted to departures by a seeded Poisson/exponential headway generator from a dedicated PRNG stream; optional explicit trip list for replay. Routes resolved once at insertion (shortest path on the link graph) so routing does not perturb the random stream

### Engineering

- **Runs in browser or server:**
  > Browser: simulation in a dedicated Web Worker, rendering on the main thread (Canvas2D or WebGL). The same TypeScript engine runs in Node for unit tests, golden-run regression tests and any batch runs
- **Api:**
  > Engine as a pure module: createSim(network, scenario, seed) -> sim; sim.step(dt) advances one fixed step; sim.snapshot() fills typed arrays (id, x, y, heading, class, level) for rendering; sim.metrics() returns aggregates; sim.apply(edit) for scenario edits between runs. Worker protocol: main thread sends {cmd: start/pause/speed/edit}; worker posts frames as transferable ArrayBuffers (ping-pong two buffers to avoid allocation) at render rate, and metrics at 1 Hz
- **Gpu requirement:** None for simulation; WebGL optional for rendering
- **Multi tenancy model:**
  > Fully client-side: each user's browser runs its own scenario, so hosting is static files (zero marginal compute cost per user). Scenario sharing via URL-encoded or stored JSON plus seed reproduces identical results
- **Build complexity:**
  > Low: Vite + TypeScript with module workers (new Worker(new URL('./sim.worker.ts', import.meta.url), {type: 'module'})). SharedArrayBuffer would require COOP: same-origin and COEP: require-corp headers on the host, which also restrict loading third-party resources; transferable ArrayBuffers avoid that requirement and are recommended for a 72-hour build
- **Scenario editability:**
  > Edits (lanes/widths, signals, demand, vehicle mix, flyover templates) are applied while paused and trigger a rebuild of derived structures (strips, conflict points, signal tables); then the run restarts from t = 0 with the same seed, so before/after comparisons differ only by the edit
- **Output metrics supported:**
  > Determinism enables paired comparisons: travel time and delay per OD and per link, queue length per approach (max and mean), throughput per node, stops, density and speed per link, level of service from delay; dynamic PCU possible from headway or area occupancy. Collected in the worker into fixed-size typed-array accumulators
- **Emissions support:** Not part of the core design; could add per-class speed-acceleration emission factors later

### Lessons

- **Documented failures:**
  > A/B Street: time-step version abandoned because of floating-point edge cases in computing per-step accelerations; discrete-event version has laggy-head checks retried every 0.1 s and turn-start retries as hot spots. SUMO: users get collisions or unrealistic behaviour when action step exceeds the reaction time tau; ballistic plus sublane combination problematic (SUMO issue 2581). Renderer-coupled loops (variable dt from requestAnimationFrame) change simulation results with frame rate and cause a 'spiral of death' under load, which the fixed-timestep accumulator with a clamp (e.g. 0.25 s max frame time) avoids
- **Validation approach:**
  > Golden-run tests: run fixed scenarios headlessly in Node with a fixed seed and compare a hash of the final state and metrics against stored values on every change. Convergence test: halve dt (0.2 -> 0.1 s) and check that link travel times change by less than a few percent. Invariant checks each step in debug builds: no negative speeds, no overlap of vehicle footprints within a link, vehicles conserved (inserted = exited + present). Performance test: steps per second at 1k/5k/10k vehicles in a worker
- **Takeaway for our build:**
  > 1) Fixed time step dt = 0.2 s (0.1 s if strip lateral moves look jumpy), ballistic position update with an explicit stop clamp (if v + a*dt < 0, stop at the point where v = 0), same dt for longitudinal and strip-lateral moves; this keeps IDM below the 0.5 s accuracy threshold and avoids SUMO's sublane-ballistic issue by owning the lateral logic. 2) Neighbour search: per-link arrays of vehicle indices sorted by longitudinal position s (re-sorted by insertion sort each step, near O(n) because order barely changes), with each vehicle also storing its strip span [lo, hi]; leader/follower search scans forward/backward in the sorted array until the lookahead distance and keeps only vehicles whose strip spans overlap the candidate strips. At 900 veh/km and 50 m lookahead this is about 45 candidates per scan, so add per-strip-group buckets if profiling shows it hot. Connectors through junctions use the same structure plus conflict-point reservations. Never use a world-space grid: flyovers overlap the road beneath (B07). 3) Lane-based and lane-free in one engine: a lane is just a fixed strip span of width 3.5 m / 0.5 m = 7 strips with lateral moves only allowed as whole-lane changes; lane-free classes may occupy any contiguous strip span; the same sorted-array index serves both. 4) Determinism: seeded sfc32 or xoshiro128** PRNG, separate streams for demand, driver-parameter sampling and behaviour noise (so changing signal timing does not reshuffle arrivals); fixed update order (by link id then position); no Math.random, Date.now, or iteration over Maps/Sets keyed by objects in the update; avoid transcendental functions in the update loop or confine them to precomputed geometry. 5) Two-phase update: compute all accelerations and lateral decisions from the state at t, then apply, so results do not depend on iteration order. 6) Worker architecture: structure-of-arrays Float32Array/Float64Array state in the worker, transferable ArrayBuffer frames to the main thread (ping-pong), renderer interpolates between the last two frames with alpha from the accumulator; skip SharedArrayBuffer to avoid COOP/COEP hosting constraints. 7) Main loop: accumulator with clamp; speed multiplier = number of fixed steps per render frame

### Sources

- **Links:**
  - https://sumo.dlr.de/docs/Simulation/Basic_Definition.html
  - https://sumo.dlr.de/docs/TraCI/index.html
  - https://sumo.dlr.de/docs/Simulation/SublaneModel.html
  - https://sumo.dlr.de/docs/Car-Following-Models/EIDM.html
  - https://arxiv.org/abs/1403.4881
  - https://arxiv.org/pdf/2506.05909
  - https://traffic-simulation.de/info/info_IDM.html
  - https://arxiv.org/pdf/cond-mat/0404736
  - https://a-b-street.github.io/docs/tech/trafficsim/discrete_event/index.html
  - https://github.com/a-b-street/abstreet
  - https://github.com/movsim/traffic-simulation-de
  - https://github.com/movsim/traffic-simulation-de/blob/master/README_3d
  - https://gafferongames.com/post/fix_your_timestep/
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
  - https://tc39.es/ecma262/#sec-function-properties-of-the-math-object
  - https://github.com/bryc/code/blob/master/jshash/PRNGs.md
  - https://prng.di.unimi.it/
  - https://simblob.blogspot.com/2022/05/upgrading-prng.html
  - https://8bitworkshop.com/docs/posts/2021/webassembly-vs-javascript-emulator-performance.html
  - https://reddit.birdcat.cafe/r/bevy/comments/1k26hgp/not_great_bevy_benchmark_results_on_web_compared

### Uncertain fields (left out above)

- first_release
- known_limitations
- licence
- performance
- wasm_or_streaming_feasibility


## 19 Network pipeline

*Outline id D03 · category architecture · priority high · source file `results/Network_pipeline.json`*

### Basic info

- **Name:** Network pipeline
- **Type:**
  > design decision (OpenStreetMap to simulation-graph pipeline: tool comparison and minimal custom pipeline)
- **Maintainer:**
  > Tools compared: osmnx (Geoff Boeing, MIT); SUMO netconvert (Eclipse Foundation / DLR, EPL-2.0 OR GPL-2.0-or-later); osm2streets (A/B Street, Dustin Carlino and contributors, Apache-2.0). Pipeline itself: our team.
- **Last activity:**
  > Checked 2026-11-11: osmnx 2.1.1 on PyPI; eclipse-sumo and sumolib 1.28.0 on PyPI; osm2streets main branch active in 2025 (last commit 2025-10-02), npm osm2streets-js 0.1.4 (June 2023).
- **Licence:**
  > osmnx MIT; SUMO/netconvert EPL-2.0 OR GPL-2.0-or-later; osm2streets and osm2streets-js Apache-2.0. Output data from all three remains under OSM's ODbL 1.0.
- **Language:**
  > osmnx: Python >= 3.11 (geopandas >= 1.0.1, networkx, shapely 2, numpy, pandas, requests). netconvert: C++ binary (pip package eclipse-sumo ships it). osm2streets: Rust, with JS/WASM, Python and Java bindings. Proposed custom pipeline: Python offline (osmnx + custom code) emitting JSON consumed by a TypeScript engine.
- **Code availability:**
  > Source: https://github.com/gboeing/osmnx ; https://github.com/eclipse-sumo/sumo ; https://github.com/a-b-street/osm2streets

### Data

- **Demand input formats:**
  > The pipeline outputs only the supply side. Demand is a separate JSON keyed to the pipeline's stable IDs: per entry link, flow by vehicle class per 15 min, and per junction approach, turning ratios (from RITES-style turning counts). Keeping OSM way IDs on every link lets a re-import re-attach demand and signal plans.

### Engineering

- **Runs in browser or server:**
  > Offline, at build time, on a developer machine or CI. Only the resulting JSON ships to the browser. osm2streets-js could run in the browser via WASM, but runtime import is not needed for a fixed demo corridor.
- **Wasm or streaming feasibility:**
  > Not required. Pre-import offline and serve static JSON. (osm2streets is the only one of the three with a WASM build; netconvert has no WASM build; osmnx is Python.)
- **Api:**
  > osmnx: Python functions (graph_from_bbox/graph_from_polygon with custom_filter, simplify_graph, consolidate_intersections, graph_to_gdfs, save_graph_geopackage). netconvert: CLI options plus sumolib Python reader for .net.xml. osm2streets: Rust API and JS binding (StreetNetwork from OSM XML + clip polygon + options -> GeoJSON/JSON). Our output contract: network.json with nodes {id, x, y, z, osm_node_ids}, links {id, from, to, polyline, lanes, width_m, carriageway_width_m, speed_kmh, z_start, z_end, osm_way_ids, class, is_ramp, is_bridge}, connectors {id, from_link, from_lanes, to_link, to_lanes, movement: L/S/R/U, conflicts[]}, junctions {id, node_ids, type: signal|priority|merge|diverge, z, signal_plan_ref}, meta {source, osm_timestamp, licence: ODbL-1.0, attribution}.
- **Gpu requirement:** None.
- **Multi tenancy model:**
  > N/A at runtime: a static network file shared by all users, served from a CDN; per-user scenario edits are stored as diffs (lane counts, signal plans, closures) against the stable link IDs, not as new networks.
- **Build complexity:**
  > Lowest: osmnx (pip install, about 30 lines to fetch, simplify, consolidate and export) but it yields only centre-line topology, so lanes, connectors and z-levels are custom code (est. 4-8 h). Medium: netconvert (one command with recommended options gives lanes and lane-to-lane connections; parsing .net.xml into our JSON is 2-4 h, but it brings SUMO's lane-level geometry and internal junction lanes we may not want). Highest risk: osm2streets (best lane geometry, but unstable API, stale npm package, dual-carriageway merge experimental, would add Rust/WASM toolchain). Recommended hybrid within 72 hours: Overpass -> osmnx (with layer added to useful tags) -> custom lane/connector/z builder -> JSON, and run netconvert once on the same clip as a cross-check of lane connections and joined junctions.
- **Scenario editability:**
  > Pipeline should make these editable downstream by keeping stable IDs: lane count and width per link, ramp open/closed, connector permissions (turn bans), signal plan per junction, link closure/lane blockage. Geometry edits (new flyover) are out of scope in 72 h; pre-build alternative networks offline instead.
- **Output metrics supported:**
  > N/A for the pipeline; it must emit detector locations (link id + offset) at junction stop lines and flyover landings so the engine can report queues and GEH against counts.

### Lessons

- **Known limitations:**
  > OSM input quality dominates: in Bengaluru, width is tagged on about 1% of major-road length and lanes on about 48% (and on 407 of 617 major bridge ways), turn:lanes is effectively absent, so every tool falls back to defaults or guesses lane connections. netconvert typemaps are self-described as unverified; netconvert lane defaults (1 lane) are wrong for Indian arterials without a typemap tuned for India. osmnx consolidation is purely geometric within tolerance even with rebuild_graph topology checks; it does not use layer, and simplified edges can carry list-valued lanes/width that need a reduction rule. osm2streets geometry is explicitly weak near bridges/tunnels and on-off ramps ('Incorrect near bridges/tunnels'), and its dual-carriageway merge is experimental. None of the tools validates bridge topology: a bridge that wrongly shares a node with a ground road silently creates an at-grade junction.
- **Documented failures:**
  > SUMO docs: OSM imports without --junctions.join create short internal edges that cause throughput loss, jams and deadlocks; restriction relations crossing the clip boundary are ignored with warnings. A/B Street (osm2streets lineage): one broken bridge in Seattle spread gridlock across the map, and short roads and ramps remained an unsolved geometry problem. osmnx examples notebook: naive geometric consolidation (rebuild_graph=False) would merge a street junction with the on-ramp junction of the overpass above it - the motivating case for topology-aware consolidation.
- **Validation approach:**
  > Pipeline acceptance checks to implement: (1) z-consistency - every node shared by two links must have equal z on both; any link with bridge=yes must have z>=1 (layer default 1) and no interior node shared with a z=0 link (an Overpass check on Bengaluru found 0 such cases among major roads today, so the check is cheap insurance); (2) flag layer>0 without bridge and layer<0 without tunnel (55 and 39 cases citywide); (3) strong connectivity of the drivable graph from every source to every sink (networkx strongly_connected_components), with dangling one-way stubs listed; (4) every connector's from-lanes and to-lanes within lane counts and every junction has at least one outgoing connector per incoming lane; (5) lane-sum sanity: lanes x width <= carriageway width when width is known; (6) diff against a netconvert run on the same clip (number of joined junctions, connections per junction); (7) visual overlay on imagery for the demo corridor.
- **Takeaway for our build:**
  > Do not import OSM at runtime and do not trust any tool's defaults. Build an offline, deterministic pipeline: Overpass clip (keep node IDs) -> osmnx graph with 'layer', 'turn:lanes', 'lanes:forward/backward', 'bridge', 'tunnel' added to useful_tags_way -> simplify_graph with edge_attrs_differ=['lanes','layer','bridge','oneway'] so lane-count and grade changes split links -> consolidate_intersections(rebuild_graph=True, tolerance about 10-15 m, max_length set so ramps are not used to link clusters) applied only to z=0 nodes, with z>0 nodes excluded from the tolerance dict -> custom builder that assigns z from layer (bridge without layer -> 1), fills lanes/width from an India class table (trunk 3 x 3.5 m per direction, primary 2 x 3.5 m, links 1-2 x 3.5 m, at-grade 3.0 m per the Hebbal DPR) overridden by a hand-edited patch file keyed by OSM way ID, generates connectors by lane-index matching with left-hand rules (keep-left, right turns from the rightmost lanes), and applies turn restrictions from relations -> run the acceptance checks -> emit network.json with ODbL metadata. Cross-check once with netconvert --lefthand --junctions.join --osm.layer-elevation 6, and keep osm2streets only as an optional visual reference for intersection polygons.

### Sources

- **Links:**
  - https://github.com/gboeing/osmnx
  - https://pypi.org/project/osmnx/
  - https://osmnx.readthedocs.io/en/stable/user-reference.html
  - https://github.com/gboeing/osmnx-examples/blob/main/notebooks/04-simplify-graph-consolidate-nodes.ipynb
  - https://sumo.dlr.de/docs/Networks/Import/OpenStreetMap.html
  - https://sumo.dlr.de/docs/netconvert.html
  - https://pypi.org/project/eclipse-sumo/
  - https://github.com/eclipse-sumo/sumo
  - https://github.com/a-b-street/osm2streets
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets/src/transform/mod.rs
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets/src/transform/dual_carriageways.rs
  - https://github.com/a-b-street/osm2streets/blob/main/osm2streets/src/road.rs
  - https://github.com/a-b-street/osm2streets/blob/main/osm2lanes/src/lib.rs
  - https://github.com/a-b-street/osm2streets/blob/main/osm2lanes/src/algorithm.rs
  - https://www.npmjs.com/package/osm2streets-js
  - https://a-b-street.github.io/docs/project/history/retrospective/index.html
  - https://overpass-api.de/api/interpreter
  - https://download.geofabrik.de/asia/india.html
  - https://wiki.openstreetmap.org/wiki/Key:layer
  - https://wiki.openstreetmap.org/wiki/Key:driving_side
  - https://opendatacommons.org/licenses/odbl/1-0/
  - https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
  - https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline
  - https://www.openstreetmap.org/copyright
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137/resource/1677ca40-d3cd-42b3-b9d0-78d339307019/download/integrated-traffic-microsimulation-report-bengaluru-projectv4.pdf

### Uncertain fields (left out above)

- data_access
- maintenance_health
- network_import
- performance


## 20 Scenario model and editor

*Outline id D04 · category architecture · priority high · source file `results/Scenario_model_and_editor.json`*

### Basic info

- **Name:** Scenario model and editor
- **Type:**
  > Design decision (architecture): scenario data model, editor scope, storage/sharing and baseline-vs-proposal comparison
- **Maintainer:**
  > Our project (synthesised from A/B Street by Dustin Carlino / A/B Street Ltd; Eclipse SUMO by DLR; traffic-simulation.de by Martin Treiber; PTV Vissim; Aimsun Next; Gaia3D-led Korean IITP project presented at FOSS4G 2025/2026; Streetmix)
- **First release:**
  > N/A for our design. Reference points: A/B Street started 2018; Vissim/Aimsun scenario managers are long-standing commercial features; Korean platform first presented at FOSS4G 2025 (Nov 2025), third year presented at FOSS4G 2026 (Sep 2026).
- **Last activity:**
  > 2026-09-01 (FOSS4G 2026 talk 'Web-Based High-Performance Traffic Simulator', third project year); Aimsun Next 26.0.x docs on scenarios/experiments current in 2026
- **Language:**
  > Our build: TypeScript (scenario schema as plain JSON). References: A/B Street Rust; traffic-simulation.de JavaScript; SUMO C++ with XML scenario files; Korean platform CesiumJS + OpenLayers + PostGIS
- **Maintenance health:**
  > A/B Street's original monolith slowed after a near-postmortem; the author split it into smaller tools and A/B Street Ltd now develops planning tools (README, 2025). Korean platform is grant-funded (IITP RS-2024-00459703), now in year 3. traffic-simulation.de is a single-author project with 550 commits. Implication: the scenario schema should not depend on any one upstream staying alive.

### Data

- **Network import:**
  > Patterns observed: (1) SUMO osmWebWizard pulls an OSM bounding box and writes osm_bbox.osm.xml, then builds osm.net.xml plus osm.poly.xml, osm.sumocfg and per-mode trips/routes into a timestamped folder; the network is a derived artefact, not the user-edited object. (2) A/B Street converts OSM into its own map model (slow, minutes) and then applies user edits incrementally on top, so edits must survive map regeneration from newer OSM. (3) The Korean platform takes Seoul/Daejeon network and station data as GeoJSON/PostGIS. Recommendation for our build: keep a versioned, immutable base network (hand-built preset or pre-converted OSM extract, identified by networkId + networkVersion) and store scenarios purely as edits keyed to stable link/node IDs, never as a copy of the network.
- **Demand input formats:**
  > Observed: SUMO routes/trips XML per mode, generated by osmWebWizard from a 'Count' (vehicles per hour per lane-km) and a 'Through Traffic Factor' weighting boundary edges; Aimsun scenario references a Traffic Demand object made of OD matrices that can be scaled by a factor (tutorial duplicates demand at 120%); traffic-simulation.de exposes only Inflow, On-ramp Flow and Truck percentage sliders; Korean platform lets users configure different demand conditions before running. Minimal schema for us: demand = list of {originZoneOrEntryLink, destinationZoneOrExitLink, vehiclesPerHour, timeProfile (constant or piecewise 15-min multipliers)} + one global vehicle-mix object {car, twoWheeler, autoRickshaw, bus, truck, bicycle shares summing to 1} + globalDemandMultiplier (slider, e.g. 0.5-1.5) + randomSeed + durationMinutes + warmUpMinutes.

### Engineering

- **Runs in browser or server:**
  > Scenario editor and storage: browser (localStorage/IndexedDB + file export + URL fragment). Engine: browser (leading option) or SUMO on a server; the schema should be engine-agnostic so either can consume it, matching the Korean platform's stated design of integrating with external simulation engines via import/export.
- **Wasm or streaming feasibility:**
  > Schema is plain JSON, so it works with an in-browser TypeScript engine directly and can be transpiled to SUMO XML (net edits via netconvert/netedit-equivalent operations, closures as rerouter closingReroute/closingLaneReroute in an additional file, bus stops/parking as additional elements, demand as route/trip XML) for a server path. Results should be stored as compact aggregate time series per link/junction, not full trajectories, so that baseline and proposal results can both be held client-side for comparison.
- **Api:**
  > Recommended internal API surface: loadBaseNetwork(networkId, version); applyEdits(network, edits[]) -> derivedNetwork (pure, deterministic, validates each edit); run(derivedNetwork, demand, seed, duration) -> ResultSet; compare(ResultSet baseline, ResultSet proposal) -> DeltaSet. This mirrors A/B Street's live-edit pipeline (diff edits vs current map, recompute only changed roads/intersections/turns, then refresh routing and drawing) and Vissim's base network + modifications + scenarios structure.
- **Gpu requirement:**
  > None for the scenario model. Rendering may use WebGL/Canvas (the Korean platform uses CesiumJS 3D and OpenLayers WebGL 2D), but a 72-hour build should use 2D canvas only.
- **Multi tenancy model:**
  > Client-side scenario state means zero per-user hosting cost for the editor; sharing via URL/JSON needs no server. If an anonymous share endpoint is added later, it is a write-once blob store (A/B Street pattern), which is cheap but cannot support edit/delete without accounts. The Korean platform instead uses a microservice architecture with PostGIS, which is heavier than a 72-hour budget allows.
- **Scenario editability:**
  > What reference tools let users edit: A/B Street - lane types (driving, bus, bike, parking; sidewalks fixed), speed limits, lane direction reversal, stop-sign priority, traffic-signal timing, plus closing lanes/roads to force rerouting. SUMO - network via netedit, closures via rerouters (time-bounded), parking areas and bus stops as additional-file elements, demand via route files. traffic-simulation.de - only global sliders (inflow, on-ramp flow, truck %, v0, time gap T, max accel a, politeness, LC threshold, right bias) on fixed geometries. Korean platform - roads, routes, simulation parameters, demand; 2026 adds precise editing of overpasses/underpasses. Recommended minimal scenario schema (fields): scenarioId; name; description; author (optional); createdAt; schemaVersion; baseNetworkId; baseNetworkVersion; parentScenarioId (null for baseline; enables baseline -> proposal lineage); edits[] where each edit = {editId, type, targetId, params, enabled} and type is one of: setLinkLanes {laneCount}; setLinkWidth {carriagewayWidthM, effectiveWidthM}; setLinkSpeedLimit {kmh}; setLinkDirection {oneWay|twoWay}; closeLink {from, to times optional, allowedClasses optional}; setParking {side, lengthM or fractionOfLink, effectiveWidthLossM}; addBusStop {linkId, offsetM, bayOrKerbside, dwellSeconds, busesPerHour}; setSignalPlan {junctionId, cycleS, phases[{greenS, amberS, movements[]}], offsetS}; setJunctionControl {signal|priority|uncontrolled|roundabout}; setTurnBan {fromLink, toLink}; setGradeSeparation {flyoverLinkId, enabled, rampLinks[]} (toggle a pre-drawn flyover rather than free-form 3D editing); demand {as in demand_input_formats}; sim {seed, durationMin, warmUpMin, stepS}; indianBehaviour {seepageEnabled, laneDisciplineFactor} as named presets rather than raw parameters. Each edit must be independently toggleable so a proposal can be bisected.
- **Output metrics supported:**
  > Views planners found useful in references: A/B Street trip-summary tab comparing trip times before vs after edits in aggregate with filters, side-by-side A/B runs, delay scatter plot, trip table; Korean platform side-by-side comparison view, time filter, route-change analyser, trip-line animation, OD matrix with flow arrows, congestion heatmaps, time-series layers with playback, dashboard reports; traffic-simulation.de virtual detector and trajectory export; Aimsun replications with distinct random seeds to show run-to-run variability. The IISc review of the 2026 Hebbal microsimulation report shows the failure to avoid: different metrics were reported for different scenarios, making comparison 'difficult, erroneous' and recommendations questionable. Recommended fixed metric set reported identically for every scenario: network-wide average travel time and delay per vehicle (by vehicle class); throughput (vehicles exiting per hour); max and average queue length per approach; link speed/density map coloured by level of service; per-junction delay table; vehicles still in network at end (unserved demand) and any gridlock/teleport count; delta view (proposal minus baseline) as a diverging-colour link map plus a summary table with absolute and percentage differences; result over multiple seeds (e.g. 3-5) shown as a range.

### Lessons

- **Known limitations:**
  > (1) URL-encoded state only works when the base network is fixed and versioned; if the base network changes, old edit lists may point to missing IDs (A/B Street had to make edits survive map regeneration). (2) Anonymous share links cannot be edited, deleted or attributed (A/B Street). (3) Edits interact: lane changes invalidate signal plans and junction geometry (A/B Street retrospective). (4) Slider-only tools (traffic-simulation.de) are easy to use but cannot express network proposals; free-form editors (netedit, Vissim) are too complex for lay users. (5) Vissim propagates base-network edits into all scenarios and some scenario-management actions cannot be undone, so PTV advises not editing the base network once scenarios exist. (6) A single stochastic run can mislead; Aimsun builds replications with distinct seeds for this reason. (7) Korean platform abstracts do not describe a scenario storage schema or comparison metrics in detail, so its design can only be inferred from talk abstracts.
- **Documented failures:**
  > A/B Street: the author calls the scope 'way too broad' and describes an identity crisis between a game and a planning tool; the results 'have to be met with much more skepticism' because the model was not calibrated, and critics used that to dismiss it; edits needed complex handling for undo/redo side effects. Hebbal (Bengaluru) 2026 microsimulation report, per IISc technical review: promised four scenarios but analysed two; reported different metrics for different scenarios; claimed no spill-over without supporting data; network-level analysis limited to one link. Vissim: scenario-management operations cannot be undone and some commands become unavailable once a scenario's simulation starts.
- **Validation approach:**
  > For the editor/schema (not traffic realism): round-trip tests (export JSON -> import -> identical edit list; encode URL -> decode -> identical); schema-version migration test; each edit type validated against the base network (target exists, lane count >= 1, width >= lane count x minimum lane width, signal phases cover all movements); determinism test (same scenario + same seed -> identical results), which is a precondition for baseline-vs-proposal deltas to be meaningful; a no-op proposal (all edits disabled) must give zero delta.
- **Takeaway for our build:**
  > Adopt a Vissim/A/B-Street-style 'base network + ordered, toggleable edit list' model: baseline = base network + demand with zero edits; a proposal = the same plus edits, linked by parentScenarioId. Never let users edit the base network in the UI. Keep the edit vocabulary to about 8 types relevant to Indian streets (lanes, carriageway width, closures, on-street parking width loss, bus stops, signal plan, turn bans, toggle a pre-drawn flyover) plus demand multiplier and vehicle mix. Store everything as versioned JSON (schemaVersion, baseNetworkId, baseNetworkVersion); share by URL fragment (compressed edit list) and by JSON download/upload, with no backend in the 72-hour scope. Run baseline and proposal with identical seeds (ideally 3-5 seeds) and present one fixed metric set for every scenario, with a delta map and an absolute + percentage table; always show unserved demand and gridlock counts so a proposal cannot look good by hiding stuck vehicles. Follow the Korean workflow labels in the UI (Edit -> Simulate -> Visualize -> Compare) and copy its time filter. UX mistakes to avoid: exposing raw model parameters (use named presets), free-form 3D/grade-separation drawing, allowing edits during a run, silently resetting results after an edit (mark results stale instead), and reporting only percentages without absolute values (the IISc review shows small absolute gains looking large as percentages).

### Sources

- **Links:**
  - https://a-b-street.github.io/docs/tech/map/edits.html
  - https://a-b-street.github.io/docs/software/ungap_the_map/tech_details.html
  - https://a-b-street.github.io/docs/project/history/retrospective/index.html
  - https://a-b-street.github.io/docs/tech/trafficsim/gridlock.html
  - https://github.com/a-b-street/abstreet
  - https://www.goodfirstissue.org/a-b-street/abstreet/issues/86
  - https://sumo.dlr.de/docs/Tutorials/OSMWebWizard.html
  - https://sumo.dlr.de/docs/Simulation/Rerouter.html
  - https://sumo.dlr.de/docs/Simulation/Why_Vehicles_are_teleporting.html
  - https://traffic-simulation.de/
  - https://github.com/movsim/traffic-simulation-de
  - https://cgi.ptvgroup.com/vision-help/VISSIM_2025_ENG/Content/13_Szenariomanagement/Sz_durchfuehren.htm
  - https://cgi.ptvgroup.com/vision-help/VISSIM_2022_ENG/Content/13_Szenariomanagement/Sz_ProjektExpl_arbeiten.htm
  - https://docs.aimsun.com/next/26.0.0/UsersManual/ScenariosExperimentsResultsReplications.html
  - https://docs.aimsun.com/next/latest/Tutorials/8_Scenario_Management/8_Scenario_Management.html
  - https://talks.osgeo.org/foss4g-2025/talk/GSE9DT/
  - https://talks.osgeo.org/foss4g-2025/talk/Q8C3FK/
  - https://talks.osgeo.org/foss4g-2026/talk/QY3TUS/
  - https://about.streetmix.net
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137/resource/26640ad3-9a60-4329-aeef-8bc1a815bfe4/download/av_technical_review_iitb_report.pdf

### Uncertain fields (left out above)

- build_complexity
- code_availability
- data_access
- emissions_support
- licence
- performance


---

# E. Lessons from prior work

## 21 Gridlock and deadlock handling

*Outline id E01 · category lesson · priority high · source file `results/Gridlock_and_deadlock_handling.json`*

### Basic info

- **Name:** Gridlock and deadlock handling
- **Type:** lesson
- **Maintainer:** Synthesised from SUMO documentation (DLR / Eclipse SUMO) and the sumo-user mailing list
- **Last activity:**
  > SUMO 1.28.0 (2026-10-08) ChangeLog still lists deadlock fixes (sublane deadlocks, meso time-to-teleport at stop edges); 1.27.1 fixed a deadlock on junctions with parallel internal lanes
- **Code availability:** N/A (lesson; mechanisms are in the open-source SUMO code at https://github.com/eclipse-sumo/sumo)

### Lessons

- **Known limitations:**
  > WHY JUNCTIONS LOCK UP. In microsimulation, a deadlock is a cycle of vehicles each waiting on the next. SUMO classifies stuck vehicles as: 'wrong lane' (no connection from the current lane to the next route edge, with 'highway' as the fast-road case), 'yield' (on a minor road with no gap in priority traffic), 'jam' (on a priority road with no space on the next edge), 'blocked' (behind a stopped vehicle), 'disconnected' (no permitted connection for the vClass), 'bidi' (oncoming traffic on a bidirectional lane) and 'railSignal'. Root causes are usually network errors, not driver behaviour: mis-modelled right-of-way, missing or wrong connections, junction clusters from OSM divided roads (short internal edges), keepClear=false connections, unsuitable signal plans, and demand above capacity with spillback into upstream junctions. POLICIES AVAILABLE IN SUMO. (1) Teleport: a vehicle first in line and below 0.1 m/s for --time-to-teleport (default 300 s; 0 or negative disables) is removed and moved along its route at average edge speed until space appears. Time at scheduled stops does not count. Variants: --time-to-teleport.highways (wrong lane on roads faster than 69 km/h, default 0 = off), .disconnected, .bidi, .railsignal-deadlock, .remove (delete instead of reinsert), --max-num-teleports (abort if exceeded, default -1). (2) Junction-blocker ignore: --ignore-junction-blocker <s> (default -1 = never) lets vehicles ignore foes that have stood inside the junction for that long, modelling drivers squeezing around. Note: no vType attribute literally named 'jmIgnoreJunctionBlocker' exists in current SUMO docs. The per-vType equivalents are jmIgnoreKeepClearTime (default -1), jmIgnoreFoeProb/jmIgnoreFoeSpeed, jmIgnoreJunctionFoeProb, and impatience (0 to 1, growing over --time-to-impatience, default 180 s). (3) Keep-clear (no-block) heuristic: on by default (--default.junctions.keep-clear true), so vehicles do not enter a junction unless they can leave it. It can be disabled per node or connection, which is a known cause of deadlocks. (4) Roundabout priority: netconvert --roundabouts.guess (default true; structures over 3500 m circumference excluded) gives circulating edges right of way over entering edges, which balances inflow and outflow. If guessing fails (for example when a cycle path crosses the ring), entering vehicles get priority and the ring locks. The fix is an explicit <roundabout edges=.../> in plain XML, or a priority junction type with raised edge priority inside the ring. Signalised roundabouts can still deadlock from downstream spillback or bad plans. (5) Insertion control: --max-depart-delay (default -1) drops vehicles that cannot enter; departLane=best avoids wrong-lane insertion. (6) Collisions: --collision.action defaults to teleport (none, warn, teleport, remove). LIMITATIONS OF THESE POLICIES. Teleports conserve vehicles but corrupt travel times, delay and queue metrics. Teleporting vehicles are invisible and absent from FCD output, so a visualisation silently 'loses' cars. --ignore-junction-blocker does not clear jams caused by wrong-lane vehicles unless their waiting time exceeds the threshold. Lowering time-to-teleport hides network errors rather than fixing them
- **Documented failures:**
  > (a) Roundabout not recognised because a bicycle path crossed it, so priority went to entering vehicles and the roundabout deadlocked (sumo-user). (b) An OSM-imported signalised roundabout where each node was its own traffic light kept collapsing; joining the signals under one controller did not stop it (sumo-user). (c) Networks with many keepClear=false connections produced a different kind of junction deadlock (sumo-user). (d) OSM divided roads without --junctions.join give clusters of short edges that cause throughput loss, jams and deadlocks (SUMO OSM import docs). (e) A user found --ignore-junction-blocker did not clear a jam caused by a wrong-lane vehicle; the maintainer said this was expected behaviour (sumo-user). (f) SUMO itself still fixes engine-level deadlocks: parallel internal lanes (1.27.1) and the sublane model (1.28.0, Git main), which is relevant because Indian scenarios will run the sublane model
- **Validation approach:**
  > SUMO emits a warning for every teleport with vehicle, lane, time and reason. Teleport counts appear in summary output ('teleports', due to jamming or collisions) and in meanData. Practitioners locate the hotspots in sumo-gui at the reported time and lane, fix the network or signal plan, and rerun until teleports approach zero. --max-num-teleports can act as a hard fail gate in automated runs
- **Takeaway for our build:**
  > Treat gridlock as a first-class, user-visible result, not an engine detail. Concretely: (1) keep SUMO's teleport on (300 s default) so runs always finish, but parse teleport warnings and summary output and show teleport count, reason and location on the map as a 'scenario health' panel; flag any run where teleports exceed about 1% of trips as unreliable, and exclude teleported trips from delay statistics or mark them. (2) Run a pre-flight network check after every user edit: netconvert with --junctions.join, --roundabouts.guess and --lefthand; reject or warn on disconnected edges and on removed keepClear. Re-emit explicit <roundabout> definitions for rings the user draws. (3) Use departLane=best and a finite --max-depart-delay so insertion backlogs are reported, not hidden. (4) Expose --ignore-junction-blocker (for example 30-60 s) and vType impatience as an 'Indian assertiveness' preset, since Indian drivers do squeeze past blockers, but label it as a behavioural assumption. (5) Cap wall-clock and step count per run, and set --max-num-teleports as a circuit breaker so a locked scenario fails fast instead of burning server time. (6) Pin a SUMO version of 1.28.0 or later, given the recent sublane deadlock fixes

### Sources

- **Links:**
  - https://sumo.dlr.de/docs/Simulation/Why_Vehicles_are_teleporting.html
  - https://sumo.dlr.de/docs/sumo.html
  - https://sumo.dlr.de/docs/Simulation/Intersections.html
  - https://sumo.dlr.de/docs/Definition_of_Vehicles%2C_Vehicle_Types%2C_and_Routes.html
  - https://sumo.dlr.de/docs/netconvert.html
  - https://sumo.dlr.de/docs/Networks/PlainXML.html
  - https://sumo.dlr.de/docs/Networks/Import/OpenStreetMap.html
  - https://sumo.dlr.de/docs/Simulation/Output/Summary.html
  - https://sumo.dlr.de/docs/ChangeLog.html
  - https://www.eclipse.org/lists/sumo-user/msg10135.html
  - https://www.eclipse.org/lists/sumo-user/msg10142.html
  - https://www.eclipse.org/lists/sumo-user/msg15106.html
  - https://www.eclipse.org/lists/sumo-user/msg06127.html
  - https://mail-archive.com/sumo-user@eclipse.org/msg09428.html
  - https://github.com/eclipse-sumo/sumo

### Uncertain fields (left out above)

- first_release


## 22 Calibration and validation practice

*Outline id E02 · category lesson · priority high · source file `results/Calibration_and_validation_practice.json`*

### Basic info

- **Name:**
  > Calibration and validation practice for traffic microsimulation (FHWA Toolbox Vol. III, UK TAG M3.1 / GEH, Indian Vissim and SUMO studies, data-free verification)
- **Type:** lesson
- **Maintainer:**
  > US FHWA (Traffic Analysis Toolbox Vol. III: Dowling et al. 2004, FHWA-HRT-04-040; 2019 update FHWA-HOP-18-036); UK Department for Transport (TAG Unit M3.1, which absorbed the older DMRB Vol. 12 criteria; TfL modelling guidance is referenced for saturation flow); Indian academic groups (IIT Bombay, IIT Madras, IIT Kharagpur and others) for Vissim and SUMO calibration studies.
- **Last activity:**
  > TAG M3.1 PDF dated May 2026; TxDOT microsimulation chapter applying FHWA 2004 and 2019 criteria, current.
- **Code availability:** Guidance documents only. Tooling that implements the multi-seed practice: SUMO runSeeds.py.
- **Maintenance health:**
  > FHWA moved in 2019 from fixed percentage targets to statistically derived bands (2-sigma and 1-sigma bands, bounded dynamic absolute and systematic error). TAG M3.1 is revised regularly and keeps the GEH and 15% criteria.

### Lessons

- **Documented failures:**
  > a) Fit-equals-validation: many studies tune parameters by GA on the same delay or travel-time data they then report as validation. TAG asks for data used in calibration and independent validation data to be reported separately, and says meeting the targets does not prove fitness for purpose. b) Non-transferability: Maheshwary et al. found class-dependent optima and recommended recalibration elsewhere; Prabhash and Amarasingha (Colombo) and Mer et al. warned that their parameters hold only for similar sites. c) Over-parameterisation: FHWA 2019 warns that more adjustable parameters give more freedom to fit one day, so the adjustable set should be kept small. d) Smoothing the target: averaging several days gives unrealistically smooth measures that a model cannot and should not reproduce (FHWA 2019). e) Single-run visuals: TAG C.3.13 warns against cherry-picked runs. f) Seed instability hiding bugs: FHWA 2019 says large differences between seeds point to coding errors or gridlock, not to natural variability. g) GEH on tiny flows: Dhaka and Chennai junction studies report GEH below 5 on 6 exits from 37 of 500 parameter combinations; many combinations pass, so passing GEH alone does not identify the parameters (ICCESD 2024 study).
- **Validation approach:**
  > TIER 0, verification without field data (all achievable in 72 hours, all automatable as tests): (1) Vehicle conservation per class and per link: vehicles entered = exited + present + explicitly removed, every step, and removals (teleports or deadlock clears) counted and shown. (2) No overlaps or collisions: no vehicle footprint intersects another, speeds never negative, accelerations within class bounds. (3) Fundamental diagram shape on a ring road or long straight link: the free-flow branch slope matches the desired speed v0; flow peaks then falls; the jam end approaches 1/(s0 + l) per class for single-class runs; for mixed runs, express density as area occupancy. (4) Capacity versus road width: capacity rises monotonically with carriageway width, and per-lane-equivalent values fall in a stated band around Indo-HCM (about 1200-2000 PCU/h/lane urban; saturation flow about 1140 - 60 W PCU/h per metre for 7-10.5 m approaches). (5) Determinism: same seed, scenario and timestep give a bit-identical state hash after N steps, on the same browser and on a second browser; use a seeded PRNG only, never Math.random, and a fixed timestep. (6) Timestep convergence: halving dt changes headline outputs by less than a stated tolerance. (7) Replications: run at least 5-10 seeds per scenario and report the mean with a 95% CI; use FHWA Table 8 to justify the count (e.g. CI/s = 2 at 95% needs 8 runs) and 4 runs per alternative to detect a 2-SD difference. (8) Scenario sanity: closing a lane lowers capacity; a red signal stops discharge; adding a flyover removes conflict delay. TIER 1, plausibility against published numbers: Indo-HCM capacities and saturation flow, and the Chennai Saidapet per-class speeds (cars 6.13, motorcycles 6.01, heavy 5.64, autos 5.06 m/s) on a 245 m x 11.2 m replay. TIER 2, calibration and validation to FHWA / TAG standards: needs site-specific counts, journey times and queues, which a 72-hour build does not have.
- **Takeaway for our build:**
  > Claim only what the evidence supports, and say it in the UI and README. A 72-hour build can credibly claim: 'verified' (Tier 0 tests pass in CI, with results published); 'plausible against Indian references' (capacity within X% of Indo-HCM for given widths, saturation flow within Y% of 1140 - 60 W, Chennai per-class mean speeds within Z%), with the tolerances stated beforehand; and 'stochastic results reported as mean +- 95% CI over N seeds'. It must NOT claim 'calibrated', 'validated', 'meets GEH/FHWA criteria', or accurate absolute delay, emissions or safety for a real junction. Those need site counts, a holdout dataset and the FHWA 2019 or TAG procedure. Design rules: (1) seeded PRNG plus fixed dt plus a state-hash test from day one; (2) a conservation counter and a deadlock or teleport counter shown in the results panel; (3) a built-in GEH and percentage-error calculator so users with their own counts can calibrate later, with the TAG thresholds (GEH below 5 on at least 85% of links, journey times within 15% and 60 s) shown as targets, not as achieved; (4) keep the user-tunable parameter set small (desired speed, time gap, minimum gap, lateral clearance per class); (5) results compare alternatives against each other under identical seeds rather than presenting absolute numbers as forecasts; (6) every chart shows how many seeds were run and the CI band, and never a single cherry-picked run.

### Sources

- **Links:**
  - https://ops.fhwa.dot.gov/trafficanalysistools/tat_vol3/sect5.htm
  - https://ops.fhwa.dot.gov/trafficanalysistools/tat_vol3/sectapp_b.htm
  - https://ops.fhwa.dot.gov/trafficanalysistools/tat_vol3/sectapp_e.htm
  - https://ops.fhwa.dot.gov/publications/fhwahop18036/chapter5.htm
  - https://www.txdot.gov/manuals/des/tsp/chapter-13-microsimulation-analysis/13-5-calibration/13-5-2-acceptability-criteria.html
  - https://www.txdot.gov/manuals/des/tsp/chapter-13-microsimulation-analysis/13-5-calibration/13-5-2-acceptability-criteria/13-5-2-4-fhwa-traffic-analysis-toolbox--volume-iii.html
  - https://assets.publishing.service.gov.uk/media/664dad464f29e1d07fadcc39/tag-m3-1-highway-assignment-modelling.pdf
  - https://www.gov.uk/government/publications/webtag-tag-unit-m3-1-highway-assignment-modelling
  - https://sumo.dlr.de/docs/Simulation/Randomness.html
  - https://structurae.net/en/literature/journal-article/calibration-of-microsimulation-models-for-nonlane-based-heterogeneous-traffic-at-signalized-intersections
  - https://trid.trb.org/view/1242159
  - https://link.springer.com/10.1007/978-981-15-3742-4_13
  - https://engrxiv.org/preprint/download/4441/7727/6372
  - https://www.scribd.com/document/520407871/Datta-2017
  - https://arxiv.org/abs/2405.10665
  - https://doi.org/10.1007/s11116-007-9156-2
  - https://toledo.net.technion.ac.il/files/2016/01/TRR_KanagarajEtAl_15.pdf
  - https://pdfcoffee.com/indo-hcm-2017pdf-pdf-free.html

### Uncertain fields (left out above)

- first_release
- known_limitations
- licence


## 23 Design mistakes in earlier simulators

*Outline id E04 · category lesson · priority high · source file `results/Design_mistakes_in_earlier_simulators.json`*

### Basic info

- **Name:** Design mistakes in earlier simulators
- **Type:** Lesson (cross-project failure analysis)
- **Maintainer:**
  > Synthesised from: BUET group (DhakaSim/RoadBird: Mushfiq, Toha, Salim, Mostak, Rahaman, Al-Nabhan, Sadri, Al Islam); Technical University of Crete TrafficFluid ERC project (Troullinos, Chalkiadakis, Manolis, Papamichail, Papageorgiou); IIT Bombay Transportation Lab (SiMTraM); Dustin Carlino (A/B Street); Prof. Ashish Verma, IISc IST Lab (review of the 2026 Hebbal microsimulation study); FHWA Traffic Analysis Toolbox Vol. III; Indian PCU literature
- **First release:**
  > Evidence spans 2013 (SiMTraM last SourceForge update) to 2026 (IISc review of Hebbal study, report dated 10 Aug 2026)
- **Last activity:**
  > 2026 (IISc technical review of 'Integrated Traffic Microsimulation Study - Bengaluru, Hebbal Flyover & Hebbal Short Tunnel'); TrafficFluid-Sim user manual May 2025
- **Maintenance health:**
  > SiMTraM last updated 2013-04-29 with 0 weekly downloads: effectively abandoned. TrafficFluid-Sim is pinned to SUMO commit 6c09f092 of 20 Oct 2020 and still documented on that base in May 2025, i.e. about 4.5 years of upstream drift. A/B Street's author wrote an 'Almost Postmortem' and later split the monolith into smaller tools under A/B Street Ltd. DhakaSim was superseded by RoadBird (2020).

### Lessons

- **Known limitations:**
  > This lesson set is drawn mostly from author self-reports and one expert review, not from a systematic survey. Several items (static PCU, lane-based models on Indian roads) rest on conference papers whose full texts were only partially read. The fork-drift figure is measured from the fork commit date to the manual date, not from a list of missing upstream fixes. Induced-demand evidence for Indian flyovers is largely expert opinion and press (Bengaluru), plus the IISc review; no before/after measured study was found.
- **Documented failures:**
  > 1. LANE-FREE-ONLY DESIGN (DhakaSim). Cause: built from scratch for Dhaka's non-lane traffic because VISSIM/MITSIM/SUMO were judged lane-based; the RoadBird paper states DhakaSim 'lacks the capability of simulating a lane-based structured traffic stream', so it could not compare lane vs non-lane designs and had to be extended into RoadBird. RoadBird's own results show neither paradigm dominates: non-lane is better on narrow roads with heterogeneous traffic, lane-based is better with homogeneous traffic, wide roads and high generation rates. Rule: support both lane-disciplined and lane-free behaviour per link (a laneDiscipline parameter/strip model), not one hard-coded paradigm. 2. FORK DRIFT (TrafficFluid-Sim). Cause: SUMO's lane-based core and TraCI socket latency pushed the team to fork SUMO (commit 6c09f092, 20 Oct 2020) and patch the internal car-following code; the May 2025 manual still targets that base, ships a Netedit executable 'tied to our version', and warns that editing the network in Netedit deletes their custom 'neigh lane' tags, which must be re-added by hand, and that many lane-based SUMO output variables are irrelevant or 'outright mishandled'. Rule: never fork a large engine in a 72-hour build; either use the upstream engine unmodified via its API, or own a small engine end to end. Keep custom data in your own schema, not as hand-injected tags in another tool's file format. 3. SIMULATOR GOING STALE (SiMTraM). Cause: IIT Bombay's heterogeneous-traffic extension of SUMO was released as a Windows binary (0.1.1) on SourceForge and last updated 2013-04-29; tied to an unspecified old SUMO version and a lab project, it was never folded upstream. Rule: publish source plus a pinned, reproducible build (lockfile, CI build, hosted demo) from day one, and keep India-specific behaviour as a separable module with its own tests. 4. STATIC PCU. Cause: Indo-HCM (2017) primarily uses static PCU factors to convert mixed traffic to car equivalents; studies report dynamic PCU, which varies with speed, flow and composition, describes flow-density with less scatter, and Indian authors argue dynamic values give more reliable design assessments. Caveat: one chapter finds dynamic PCU agrees well with the Indo-HCM saturation-flow method. Rule: simulate individual vehicle classes and report outputs per class and in vehicles; if PCU is shown, derive it from the simulation (area-occupancy or headway based) and label it, never hard-code a single static table as the capacity model. 5. NETWORK BOUNDARIES THAT HIDE DOWNSTREAM CONGESTION. Cause: FHWA guidance says the model must 'completely encompass all of the traffic congestion' in the influence area and that queues at the boundary mean the network should be extended. The IISc review of the 2026 Hebbal flyover/tunnel microsimulation found network-level analysis limited to the Mekhri Circle-Hebbal Junction link, a 'no spillover' recommendation with no supporting data, despite the report itself warning that both facilities could discharge onto the same downstream link. Rule: include at least one downstream junction beyond every proposal; measure queue at entry links and vehicles unable to enter (unserved demand) and flag any scenario where an entry or exit link is saturated. 6. LANE-BASED MODELS ON INDIAN ROADS. Cause: VISSIM, MITSIM and SUMO 'mainly focus on lane-based homogeneous' traffic (RoadBird); TrafficFluid authors say even SUMO's sublane model leaves the 'structural limitation of lanes' present; Indian VISSIM calibrations report that modifying default behavioural parameters is 'essential'. Rule: treat lateral position as a first-class state (strips or continuous) and calibrate defaults per class; do not ship default Western parameters. 7. INDUCED DEMAND AND SECOND-ORDER EFFECTS IGNORED IN FLYOVER STUDIES. Cause: the IISc review states mode share change, VKT growth and induced demand were 'not considered', diversion was set to arbitrary 50%/80% values copied from a tunnel DPR and applied to a flyover with different capacity, pier footprint reducing at-grade capacity was not modelled, and the intervention 'is pushing the point of congestion from one point to another'. Bengaluru flyover volume-capacity work (press) reported 8-10% traffic growth within a year. Rule: always offer a demand-response sensitivity (e.g. +10/+20% demand on the improved corridor) and model at-grade capacity loss under flyover piers; label results as fixed-demand. 8. UNVALIDATED DEMOS PRESENTED AS EVIDENCE. Cause: A/B Street was not calibrated to real volumes, so its author says results 'have to be met with much more skepticism' and critics dismissed it; RoadBird's validation used 63 Google Maps travel times (MAPE accuracy 82-95%); the Hebbal report did not disclose calibration parameters or data and its base-case speed (13.74 km/h) contradicted the DPR (4.29 km/h). Rule: display a persistent 'illustrative, not calibrated' badge unless a scenario is linked to a stated calibration dataset; report calibration target and error. 9. INCONSISTENT METRICS ACROSS SCENARIOS. Cause: Hebbal report gave travel time for 2027 but not 2047, delay for 2047 but not 2027, no queues or density at all; the reviewer says this makes comparison 'difficult, erroneous' and recommendations questionable; percentage improvements masked small absolute gains. Rule: compute the same fixed metric set for every scenario, show absolute and percentage deltas. 10. GRIDLOCK HIDDEN OR UNSOLVED. Cause: A/B Street vehicles got 'stuck. Like, permanently' on large maps due to broken intersection geometry, lane-changing quirks, poor signals and unrealistic demand, with 'only very modest success' fixing it; SUMO teleports vehicles stuck for 300 s by default and states grid-locks are 'rather common in congested simulation scenarios'. Rule: implement a deadlock detector, count and display stuck/teleported vehicles as a headline metric, never silently remove them. 11. SCOPE CREEP AND ABANDONMENT AFTER FUNDING/ENERGY ENDS. Cause: A/B Street scope 'way too broad', game-vs-planning-tool identity crisis, monolith sprawl, self-funding, no legal entity, 'Nobody's using it'; SiMTraM and DhakaSim lab projects stalled after their research cycle. Rule: one audience (planners/advocates exploring Indian junction and corridor proposals), one workflow, fixed feature list for 72 hours.
- **Validation approach:**
  > Each mistake was checked against a primary or near-primary source: RoadBird arXiv 2010.08590 full text (DhakaSim limitation, lane vs non-lane results, Google Maps validation); TrafficFluid-Sim user manual (May 2025) and SUMO Conference 2022 paper (fork commit and date, Netedit tag loss, TraCI and lane-based motivation); SiMTraM SourceForge page (last update 2013-04-29, binary only, GPLv3); A/B Street retrospective and gridlock design note (gridlock, no calibration, scope); SUMO teleport documentation; FHWA Traffic Analysis Toolbox Vol. III (boundary rule); IISc IST Lab technical review PDF (Hebbal: boundary, induced demand, metrics, calibration); PCU papers (static vs dynamic). Press items on Bengaluru flyovers are treated as secondary.
- **Takeaway for our build:**
  > Design rules for the 72-hour build: (1) One engine, owned end to end (custom TypeScript) or upstream SUMO used unmodified; no forks. (2) Per-link laneDiscipline so the same engine can run lane-based and lane-free/strip behaviour, and a built-in A/B toggle to compare them. (3) Vehicle classes simulated individually; any PCU shown is derived from the run, never a static input table. (4) Network presets must extend at least one junction downstream of every editable element; show entry-link queues and unserved demand; warn when queues reach the boundary. (5) Gridlock detector with stuck-vehicle count as a headline metric; no silent teleporting. (6) A demand sensitivity control (+/- % on corridor) and a fixed-demand warning on any flyover/capacity proposal; model capacity lost to piers/ramps at grade. (7) Same metric set for every scenario, absolute and percentage deltas, multiple seeds. (8) 'Illustrative, uncalibrated' badge by default, plus one documented sanity check (e.g. fundamental diagram or saturation flow per lane against an Indo-HCM-order-of-magnitude value) so the demo is not mistaken for evidence. (9) Source public with pinned, reproducible build and hosted static demo so it does not go stale like SiMTraM. (10) Narrow scope: planners/advocates testing Indian junction and corridor proposals; no game modes, no 3D, no city-wide OSM import in v1.

### Sources

- **Links:**
  - https://arxiv.org/abs/2010.08590
  - https://arxiv.org/pdf/2010.08590
  - https://sites.google.com/site/dhakasim/
  - https://sites.google.com/site/dhakasim/research
  - https://www.trafficfluid.tuc.gr/en/trafficfluid-sim
  - https://www.trafficfluid.tuc.gr/fileadmin/users_data/project_trafficfluid/_uploads/TrafficFluid_Sim_User_Manual.pdf
  - https://www.tib-op.org/ojs/index.php/scp/article/view/110
  - https://github.com/trafficfluid-dssl/trafficfluid-sim
  - https://sourceforge.net/projects/simtram/
  - https://a-b-street.github.io/docs/project/history/retrospective/index.html
  - https://a-b-street.github.io/docs/tech/trafficsim/gridlock.html
  - https://github.com/a-b-street/abstreet
  - https://sumo.dlr.de/docs/Simulation/Why_Vehicles_are_teleporting.html
  - https://ops.fhwa.dot.gov/trafficanalysistools/tat_vol3/sect2.htm
  - https://ops.fhwa.dot.gov/publications/fhwahop18036/chapter3.htm
  - https://data.opencity.in/dataset/6b11c60b-2d6d-4426-acfa-1e5464759137/resource/26640ad3-9a60-4329-aeef-8bc1a815bfe4/download/av_technical_review_iitb_report.pdf
  - https://www.thenewsminute.com/article/does-bengalurus-flyover-obsession-hurt-more-help-45170
  - https://www.deccanherald.com/amp/story/india%2Fkarnataka%2Fbengaluru%2Fbengaluru-flyovers-carrying-more-they-2062752
  - https://www.jstage.jst.go.jp/article/easts/12/0/12_1665/_article
  - https://books.aijr.org/index.php/press/catalog/book/179/chapter/3459
  - https://link.springer.com/chapter/10.1007/978-981-19-2273-2_4
  - https://trid.trb.org/View/1279997

### Uncertain fields (left out above)

- code_availability
- language
- licence
