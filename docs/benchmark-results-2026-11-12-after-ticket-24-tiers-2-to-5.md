# Benchmark results: Tiers 2 to 5 (2026-11-12)

Results of Tiers 2 to 5 of [the benchmark standard](benchmark-standard.md) for our engine and for SUMO, against the references
the standard names. This document is written by `packages/benchmark` (`pnpm --filter @traffic-simulator/benchmark bench:tiers`)
from the raw results in `packages/benchmark/results/raw/tiers-2-to-5`; every number in its tables was measured in the runs
listed here. Failures are in the same table as passes. There is no overall score. Tiers 0 and 1 are in
[benchmark-results-2026-11-12-after-ticket-23.md](benchmark-results-2026-11-12-after-ticket-23.md).

SUMO is not ground truth. Agreement with SUMO in Tiers 2 and 3 shows the implementation is sane, not realistic. In Tier 4 both
engines are scored against field data and Indian standards and the closer one is named per row. Nothing here tests behaviour at
an Indian junction against field data: there is none.

## The runs

|  |  |
|---|---|
| Machine | Apple M3 Pro, 12 cores, 18 GB, darwin 27.0.0 arm64 |
| Runtime | Node v22.7.0; SUMO 1.28.0 headless (`eclipse-sumo` wheel in `~/.cache/traffic-simulator/sumo-1.28.0`) |
| Step | 0.2 s in both engines |
| Seeds | 10 per stochastic test per engine (seeds 1 to 10), mean ± 95% confidence interval (Student's t), none dropped; T2.1 is not stochastic (one run per engine) |
| Machine load | Shared with other work: the load average at the start of each part is in the table below. Tier 5 was run one process at a time; its load average is in its table. |

| Part run | Date | Commit | Engine commit | SUMO | Parallel processes | Load average at start | Jobs run | Wall clock (min) |
|---|---|---|---|---|---|---|---|---|
| t2.1 | 2026-11-12 | `738d6e0e7e` (uncommitted changes) | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 6 | 4.4 | 1 | 0.0 |
| t2.2 | 2026-11-12 | `738d6e0e7e` (uncommitted changes) | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 6 | 12.5 | 80 | 0.6 |
| t2.3 | 2026-11-12 | `738d6e0e7e` (uncommitted changes) | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 6 | 12.9 | 60 | 0.9 |
| t2.4 | 2026-11-12 | `738d6e0e7e` (uncommitted changes) | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 6 | 22.3 | 10 | 0.3 |
| t3 | 2026-11-12 | `738d6e0e7e` (uncommitted changes) | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 6 | 18.5 | 10 | 1.1 |
| t4-field | 2026-11-12 | `738d6e0e7e` (uncommitted changes) | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 6 | 18.5 | 2 | 0.0 |
| t4-chennai | 2026-11-12 | `738d6e0e7e` (uncommitted changes) | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 6 | 17.9 | 20 | 0.2 |
| t4.5 | 2026-11-12 | `738d6e0e7e` (uncommitted changes) | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 6 | 15.9 | 10 | 1.7 |
| t4.6 | 2026-11-12 | `4838f76d50` | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 6 | 21.4 | 10 | 1.8 |
| t5 | 2026-11-12 | `4838f76d50` (uncommitted changes) | `6c2bc94af7` | Eclipse SUMO sumo 1.28.0 | 1 | 6.3 | 12 | 10.4 |
| t2.1 | 2026-11-12-after-ticket-24 | `34ef8eecd3` (uncommitted changes) | `34ef8eecd3` | Eclipse SUMO sumo 1.28.0 | 6 | 6.6 | 1 | 0.0 |
| t2.2 | 2026-11-12-after-ticket-24 | `34ef8eecd3` (uncommitted changes) | `34ef8eecd3` | Eclipse SUMO sumo 1.28.0 | 6 | 8.7 | 80 | 0.5 |
| t2.3 | 2026-11-12-after-ticket-24 | `34ef8eecd3` (uncommitted changes) | `34ef8eecd3` | Eclipse SUMO sumo 1.28.0 | 6 | 17.0 | 60 | 0.9 |
| t2.4 | 2026-11-12-after-ticket-24 | `34ef8eecd3` (uncommitted changes) | `34ef8eecd3` | Eclipse SUMO sumo 1.28.0 | 6 | 15.5 | 10 | 0.2 |
| t3 | 2026-11-12-after-ticket-24 | `34ef8eecd3` (uncommitted changes) | `34ef8eecd3` | Eclipse SUMO sumo 1.28.0 | 6 | 11.4 | 10 | 0.7 |
| t4.6 | 2026-11-12-after-ticket-24 | `34ef8eecd3` (uncommitted changes) | `34ef8eecd3` | Eclipse SUMO sumo 1.28.0 | 6 | 8.3 | 10 | 1.3 |

Two runs are in this document. The first (dates 2026-11-12, engine `6c2bc94`) ran every part; the parts marked "uncommitted
changes" ran from the working tree before its harness was committed, and the jobs' code that ran is that of commit `4838f76`.
The second (date 2026-11-12-after-ticket-24, engine `34ef8ee`) re-ran T2.1 to T2.4, Tier 3 and T4.6 for both engines after
ticket 24 changed how turning traffic is let into junctions; "uncommitted changes" there are measurement scripts outside the
engine and the harness. Every row of T2.1 to T2.4, Tier 3 and T4.6 is from the second run; T4.1 to T4.5 and Tier 5 are still
from the first. SUMO and its inputs are the same in both. Machine time of the second run: about 4 minutes of wall clock at six
processes.

## Results table

The two columns after the values are pass or fail of each engine against the reference and tolerance. Percentages in brackets are
differences from the reference. In Tier 3 SUMO is the reference, so only our engine has a verdict.

| ID | Test and metric | Reference | Tolerance | Ours | SUMO | Ours | SUMO | Ours against SUMO, or closer to the reference (Tier 4) |
|---|---|---|---|---|---|---|---|---|
| T2.1 | Queue discharge at a signal, one lane: saturation flow (headways from the 5th car to the 30th) | SUMO; IDM at 0.001 s through the same red and green: 1,710 veh/h | 5% | 1,670 veh/h (-2.3% from IDM) | 1,667 veh/h (-2.5% from IDM) | pass against SUMO; pass against IDM | pass against IDM | +0.18% |
| T2.2 | Fixed-time signal at 30% of capacity (220 veh/h): mean delay | Webster: 14.1 s; SUMO | 15% up to 90% of capacity | 19.1 ± 0.7 s (+35.6%) | 21.6 ± 0.9 s (+53.4%) | **FAIL** | **FAIL** | -11.6%: pass |
| T2.2 | Fixed-time signal at 50% of capacity (366 veh/h): mean delay | Webster: 16.3 s; SUMO | 15% up to 90% of capacity | 21.8 ± 0.7 s (+33.6%) | 26.2 ± 0.8 s (+60.4%) | **FAIL** | **FAIL** | -16.7%: **FAIL** |
| T2.2 | Fixed-time signal at 70% of capacity (512 veh/h): mean delay | Webster: 19.8 s; SUMO | 15% up to 90% of capacity | 26.5 ± 1.4 s (+33.8%) | 34.6 ± 2.8 s (+74.5%) | **FAIL** | **FAIL** | -23.3%: **FAIL** |
| T2.2 | Fixed-time signal at 80% of capacity (586 veh/h): mean delay | Webster: 23.7 s; SUMO | 15% up to 90% of capacity | 34.9 ± 3.9 s (+47.5%) | 57.5 ± 10.3 s (+143.0%) | **FAIL** | **FAIL** | -39.3%: **FAIL** |
| T2.2 | Fixed-time signal at 90% of capacity (659 veh/h): mean delay | Webster: 35.4 s; SUMO | 15% up to 90% of capacity | 69.6 ± 17.5 s (+96.7%) | 195.3 ± 56.1 s (+452.0%) | **FAIL** | **FAIL** | -64.4%: **FAIL** |
| T2.2 | Fixed-time signal at 95% of capacity (695 veh/h): mean delay | Webster: 59.5 s; SUMO | report only above 90% | 143.1 ± 47.2 s (+140.4%) | 326.5 ± 66.1 s (+448.4%) | report only | report only | -56.2% |
| T2.2 | Fixed-time signal at 100% of capacity (732 veh/h): mean delay | Webster: no finite delay at x = 1; SUMO | report only above 90% | 255.0 ± 60.7 s (-) | 468.0 ± 67.0 s (-) | report only | report only | -45.5% |
| T2.3 | Priority junction, main road 200 veh/h: side-road capacity | Gap acceptance (Siegloch), tc 4.6 s, tf 2.76 s: 1,176 veh/h; SUMO | 20% | 1,030 ± 31 veh/h (-12.4%) | 742 ± 30 veh/h (-36.9%) | pass | **FAIL** | +38.9%: **FAIL** |
| T2.3 | Priority junction, main road 400 veh/h: side-road capacity | Gap acceptance (Siegloch), tc 4.6 s, tf 2.76 s: 1,059 veh/h; SUMO | 20% | 757 ± 26 veh/h (-28.5%) | 437 ± 27 veh/h (-58.8%) | **FAIL** | **FAIL** | +73.4%: **FAIL** |
| T2.3 | Priority junction, main road 600 veh/h: side-road capacity | Gap acceptance (Siegloch), tc 4.6 s, tf 2.76 s: 951 veh/h; SUMO | 20% | 540 ± 32 veh/h (-43.2%) | 254 ± 27 veh/h (-73.3%) | **FAIL** | **FAIL** | +112.9%: **FAIL** |
| T2.3 | Priority junction, main road 800 veh/h: side-road capacity | Gap acceptance (Siegloch), tc 4.6 s, tf 2.76 s: 853 veh/h; SUMO | 20% | 377 ± 28 veh/h (-55.8%) | 142 ± 22 veh/h (-83.3%) | **FAIL** | **FAIL** | +165.4%: **FAIL** |
| T2.3 | Priority junction, main road 1000 veh/h: side-road capacity | Gap acceptance (Siegloch), tc 4.6 s, tf 2.76 s: 764 veh/h; SUMO | 20% | 245 ± 27 veh/h (-67.9%) | 86 ± 10 veh/h (-88.8%) | **FAIL** | **FAIL** | +185.6%: **FAIL** |
| T2.3 | Priority junction, main road 1200 veh/h: side-road capacity | Gap acceptance (Siegloch), tc 4.6 s, tf 2.76 s: 682 veh/h; SUMO | 20% | 148 ± 29 veh/h (-78.3%) | 53 ± 6 veh/h (-92.2%) | **FAIL** | **FAIL** | +178.0%: **FAIL** |
| T2.3 | Side-road capacity falls as main-road flow rises (means over seeds) | - | must fall monotonically |  |  | pass | pass |  |
| T2.4 | Four-way junction, all approaches saturated, 30 min: stuck vehicles (ours) and teleports (SUMO) | none | zero; otherwise report the count | 0 in 10 runs | 0 in 10 runs | pass | pass |  |
| T3.1 | Small network: hourly flow per link, GEH (mean flows over ten seeds) | SUMO | GEH < 5 on at least 85% of links | 16 of 20 links (80%); per seed 70% to 90% | (reference) | **FAIL** | - |  |
| T3.2 | Mean travel time per origin-destination pair | SUMO | 15% | 4 of 16 pairs within 15% | (reference) | **FAIL** | - |  |
| T3.3 | Longest queue per approach (an approach with no queue in either engine is not scored) | SUMO | 25% | 4 of 12 approaches within 25% | (reference) | **FAIL** | - |  |
| T3.4 | Share of through traffic south-entry to far-north-out taking the flyover | SUMO | 5 percentage points | 84.3% ± 0.9 | 92.3% ± 4.8 | **FAIL** (-8.0 points) | - |  |
| T3.4 | Share of through traffic far-north-in to south-exit taking the flyover | SUMO | 5 percentage points | 85.2% ± 1.0 | 98.3% ± 1.1 | **FAIL** (-13.2 points) | - |  |
| T4.1 | Chennai section: mean speed, two-wheeler | field (from positions): 11.60 m/s | 15% from field | 16.37 ± 0.06 m/s (+41.2%) | 13.98 ± 0.08 m/s (+20.6%) | **FAIL** | **FAIL** | SUMO |
| T4.1 | Chennai section: mean speed, car | field (from positions): 11.83 m/s | 15% from field | 13.10 ± 0.08 m/s (+10.8%) | 13.32 ± 0.06 m/s (+12.6%) | pass | pass | ours |
| T4.1 | Chennai section: mean speed, auto-rickshaw | field (from positions): 9.79 m/s | 15% from field | 10.70 ± 0.03 m/s (+9.3%) | 10.73 ± 0.01 m/s (+9.7%) | pass | pass | ours |
| T4.1 | Chennai section: mean speed, bus | field (from positions): 10.67 m/s | 15% from field | 11.33 ± 0.11 m/s (+6.2%) | 11.63 ± 0.03 m/s (+9.0%) | pass | pass | ours |
| T4.2 | Chennai section: throughput (front bumpers past 200 m) | field: 5,970 veh/h | 10% from field | 5,852 ± 138 veh/h (-2.0%) | 5,834 ± 137 veh/h (-2.3%) | pass | pass | ours |
| T4.3 | Chennai section: sideways positions, two-wheeler: earth mover's distance to the field's | field | report; no pass line | 1.39 ± 0.06 m | 2.64 ± 0.04 m | report | report | ours |
| T4.3 | Chennai section: sideways positions, car: earth mover's distance to the field's | field | report; no pass line | 1.54 ± 0.08 m | 3.28 ± 0.10 m | report | report | ours |
| T4.3 | Chennai section: sideways positions, auto-rickshaw: earth mover's distance to the field's | field | report; no pass line | 1.11 ± 0.15 m | 2.73 ± 0.10 m | report | report | ours |
| T4.3 | Chennai section: sideways positions, bus: earth mover's distance to the field's | field | report; no pass line | 0.81 ± 0.05 m | 1.35 ± 0.25 m | report | report | ours |
| T4.4 | Chennai section: speed each minute against the field's same minute, RMSE | field | report RMSE; no pass line | 2.96 ± 0.04 m/s | 1.97 ± 0.06 m/s | report | report | SUMO |
| T4.5 | Mid-block capacity, one carriageway of a 4-lane divided road (7.5 m), Bengaluru mix | Indo-HCM 2017 base capacity 2,700 PCU/h (secondary) | 15% | 5,298 ± 33 PCU/h (+96.2%) | 8,625 ± 36 PCU/h (+219.5%) | **FAIL** | **FAIL** | ours |
| T4.6 | Signal approach 7 m wide, mixed traffic, **without two-wheeler filtering** (not built: ticket 06): saturation flow | Indo-HCM 2017: W (1140 - 60 W) = 5,040 PCU/h (secondary) | 20% | 4,258 ± 62 PCU/h (-15.5%) | 5,472 ± 54 PCU/h (+8.6%) | pass | pass | SUMO |
| T5.3 | Largest count measured that ran faster than real time, cars in lanes, ours (Node) | - | report only | 20,000 |  | report | report | faster at every size measured (up to 20,000) |
| T5.3 | Largest count measured that ran faster than real time, cars in lanes, SUMO | - | report only |  | 20,000 | report | report | faster at every size measured (up to 20,000) |
| T5.3 | Largest count measured that ran faster than real time, mixed traffic, ours (Node) | - | report only | 20,000 |  | report | report | faster at every size measured (up to 20,000) |
| T5.3 | Largest count measured that ran faster than real time, mixed traffic, SUMO | - | report only |  | 1,000 | report | report | slower than real time at 5,000, 20,000 |
| T5.1, T5.2 | Speed and peak memory at 1,000, 5,000 and 20,000 vehicles | - | report only | see Tier 5 table | see Tier 5 table | report | report |  |
| T5.1 (browser) | Speed in a browser worker | - | report only | **not measured** | - | not run | - | no browser was driven in this run |
| T5.4 | Feature coverage | - | report only | see checklist | see checklist | report | report |  |

### Stuck vehicles, teleports and collisions, per test (fairness rule 7)

Our engine now releases stuck vehicles itself and counts them (`Results.stuckVehicles`); that count is what is reported. "Conservation" counts
steps at which vehicles entered differed from those through plus on the network plus released (none expected). SUMO ran with
`--time-to-teleport 300` and `--collision.action warn`; its statistics give the counts.

| Test | Our runs | Our stuck vehicles | Our runs with any | Conservation violations | SUMO runs | SUMO teleports | SUMO runs with any | SUMO collisions | SUMO emergency braking |
|---|---|---|---|---|---|---|---|---|---|
| T2.1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| T2.2 | 80 | 0 | 0 | 0 | 80 | 0 | 0 | 0 | 115 |
| T2.3 | 60 | 0 | 0 | 0 | 60 | 57 | 18 | 0 | 0 |
| T2.4 | 10 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 14 |
| Tier 3 | 10 | 0 | 0 | 0 | 10 | 119 | 5 | 0 | 1003 |
| T4.1-T4.4 | 20 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 0 |
| T4.5 | 10 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 |
| T4.6 | 10 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 96 |

## Findings

Written by hand against the runs described here. If the tables are rebuilt from a later run, re-read this section against them.
The findings of the first run alone are in [benchmark-results-2026-11-12-tiers-2-to-5.md](benchmark-results-2026-11-12-tiers-2-to-5.md).

**What changed between the runs (ticket 24).** Two rules in the engine, after measuring where discharge was lost at a saturated
four-way junction and beneath the flyover (the measurements are in ticket 24). (1) Turning lanes: on an approach that also goes
straight on, a turn leaves from the half of the lanes on its own side (`turnLaneShare` 0.5; straight on from any lane). Before,
a turner could stand in the far lane and cross the traffic beside it from its own approach, so the two lanes discharged one after
the other. (2) Clearing after green: a vehicle at the front of its strips refused on its green because traffic let in before it
would cross its path (a turner facing oncoming traffic that left no gap) is let in after the green once that traffic has passed,
and no crossing traffic of the next phase is let in ahead of it. Before, nobody was let in after the green, so such a turner
waited whole cycles.

**T2.1, T2.2 and T2.3 are unchanged, bit for bit.** One lane and no turning lanes to choose (T2.1, T2.2), and a priority junction
with one-lane roads where a turn already had the whole road and no signal (T2.3): neither rule applies. What was found in the first
run stands: T2.1 passes for both (ours 1,670 veh/h, SUMO 1,667, the IDM reference 1,710). T2.2 fails for both against Webster
(ours 34% to 97% above it up to 90% of capacity, SUMO 53% to 452%); Webster counts queueing, not the 16 s a stop costs with
a = b = 1 m/s², and the capacity fed to it (732 veh/h) is above what either engine carries (ours 675, SUMO 624); see amendment 2.
T2.3 passes against the formula at 200 veh/h only (ours 1,030 against 1,176). The remaining gap and its cause, measured for ticket 24:
a side-road car is let in only if the next main-road vehicle's lag is at least its accepted gap (4.6 s) **and** at least the
time it needs to be clear of the crossing plus the 1 s margin; from rest at a = 1 m/s² a car needs about 7 s to clear a
crossing of both main-road lanes and its own length, so the gap it really needs is about 8 s, not 4.6 s. Letting a side-road car
go ahead of main-road vehicles already let in, when the gap allows, was tried on a copy of the engine and raised side-road capacity
by 2% to 10% only (563 to 583 veh/h at 600 veh/h on the main road, 269 to 296 at 1,000), so it was not kept. SUMO is further
from the formula than ours at every flow.

**T2.4 now passes: no stuck vehicle in 10 runs (10 in 7 of 10 before), and ours carries more than SUMO.** 2,025 ± 29 vehicles
through in 30 minutes against 1,300 ± 66 before; SUMO 1,408 ± 7. The stuck vehicles before were right-turners that stood at the
stop line facing saturated oncoming traffic until released; clearing after green lets one through after each green.
On the same set-up in the engine's own test fixture (`packages/engine/perf/t24-standing.ts`, seeds 1 to 10), the
longest any vehicle stood on end fell from 133 to 757 s a seed (9 of 10 seeds with vehicles standing 300 s or more, up to 125 of
them) to 64 to 76 s (none). Ours now carries 44% more than SUMO. Not established here why SUMO carries less;
its right-turners wait inside the junction on a permissive green and hold their lane, and its lane changes to the turning lanes
are its own (see "where SUMO could not be made identical", 3 and 4).

**Tier 3: the junction beneath the flyover now carries what SUMO does; flows, travel times and queues still fail as wholes, and the
flyover share now fails.** Cross traffic got in at 579 and 596 veh/h (west-in, east-in) against SUMO's 589 and 596 (before: 452 and
361); those four approaches' queues are within 25% of SUMO's (before: 2 of 12 approaches in all, now 4 of 12); travel times that
crossed the junction beneath, 2 to 3 times SUMO's before, are now within 25% of SUMO's or below it (for example west-in to east-out
257 s against 208 s, before 463 s; east-in to west-out 196 s against 203 s, before 462 s). Our engine released no stuck vehicle
(11 in 8 of 10 runs before). What still fails, and why:
- *T3.1 (16 of 20 links, 80%; 85% needed)*: the four failing links are now south-in, north-in, north-out and south-out, the
  junction route of the through traffic. With the junction beneath discharging as well as SUMO's, more through traffic takes it:
  ours sends 15% and 16% of through traffic beneath the flyover (T3.4: 84.3% and 85.2% over it), SUMO 8% and 2%. That is route
  choice (Kirchhoff split, smallest share 5%, against SUMO's all-or-nothing rerouting at insertion; "where SUMO could not be made
  identical", 6), and it also fails T3.4 now (by 8.0 and 13.2 points; it passed before, when the junction route was slow enough to
  push nearly all through traffic over the flyover).
- *T3.2 (4 of 16 pairs within 15%)*: ours is now faster than SUMO on most pairs, by 19% to 77%. SUMO is congested at the
  downstream junction (it teleported 119 vehicles in 5 of 10 runs and braked as an emergency 1,003 times; its north-exit approach is
  queued to its full 200 m, ours to 77 m), so pairs through that junction take SUMO longer.
- *T3.3 (4 of 12 approaches within 25%)*: the four approaches of the junction beneath pass; the downstream junction's approaches
  and the flyover's merges are queued in SUMO and hardly in ours (the same congestion).

**T4.6 is not worse: 4,258 ± 62 PCU/h, against 4,244 ± 48 before (Indo-HCM 5,040; pass).** One approach straight on, so neither
rule applies; the difference is within the confidence intervals. Since ticket 06 the engine filters two-wheelers at a red by
default, so this run is with filtering: the "without two-wheeler filtering (not built)" wording of the T4.6 row and details is
the harness's own and out of date. T4.1 to T4.5 have no junction and were not re-run. Tiers 0 and 1 have no scenario with a junction.

**Tier 5** was not re-run; its findings are those of the first run.

## Details

## Tier 2 details

### T2.1 Queue discharge at a signal, one lane

30 cars stand at rest 12 m apart (front to front) on a one-lane approach 500 m long,
the first 2 m short of the stop line, and close up to the red under each engine's own rules. The main road's
green starts at 90 s. The moment each front bumper crosses the stop line is read from every step (interpolated);
saturation flow is 3600 over the mean headway from the 5th car to the last. Not stochastic: one run per engine.
The reference is the IDM integrated at 0.001 s from the same places through the same red (a standing vehicle whose rear is
at the stop line) and green. "Ideal queue" is the IDM from a queue at exactly the standstill gap, for information: a queue
that formed during a red is looser than that, and discharges more slowly.

|  | Saturation headway (s) | Saturation flow (veh/h) | Mean headway, last ten (s) | Start-up lost time (s) | First car crosses (s after green) |
|---|---|---|---|---|---|
| IDM reference, same start | 2.105 | 1,710 | 2.004 | 3.03 | 2.00 |
| IDM, ideal queue (information) | 1.808 | 1,992 | 1.670 | 3.85 | 2.00 |
| Ours | 2.156 | 1,670 | 2.057 | 2.99 | 2.00 |
| SUMO | 2.160 | 1,667 | 2.057 | 2.62 | 1.21 |

The junction is 20 m across in our engine; SUMO's internal lane through it is 20.00 m.
SUMO's first car moves up to the stop line itself during the red; ours stands its standstill gap short of it.

### T2.2 Fixed-time signal, demand from 30% to 100% of capacity

One lane, cars, Poisson arrivals at the given share of the reference capacity. Signal: main road 30 s
green, cross road 30 s, amber 3 s, all-red 2 s: cycle 70 s. Ten seeds per share per engine;
warm-up 600 s, then the vehicles the demand produced in the next 3600 s are followed until they leave (up to
900 s more). A vehicle's delay is its waiting to enter plus, for each step on the network, the step times
(1 - speed / desired speed): in SUMO, departDelay + timeLoss from its trip record, the same quantity.

**Webster's inputs**, fixed before the runs from the T2.1 reference: saturation flow 1,710 veh/h; effective
green = green + amber - start-up lost time = 29.97 s (the amber taken as used to its end); capacity
732.1 veh/h. Webster (1958): d = c(1-λ)²/(2(1-λx)) + x²/(2q(1-x)) - 0.65 (c/q²)^(1/3) x^(2+5λ).
The last row (130%) is beyond capacity: it is run only to read each engine's own capacity (vehicles through an hour).

| Share of capacity | Flow (veh/h) | Webster (s) | Ours: mean delay (s) | SUMO: mean delay (s) | Ours: through (veh/h) | SUMO: through (veh/h) | Vehicles not out by the end, ours / SUMO (all seeds) |
|---|---|---|---|---|---|---|---|
| 30% | 220 | 14.1 | 19.1 ± 0.7 | 21.6 ± 0.9 | 221 ± 8 | 221 ± 9 | 0 / 0 |
| 50% | 366 | 16.3 | 21.8 ± 0.7 | 26.2 ± 0.8 | 368 ± 12 | 368 ± 12 | 0 / 0 |
| 70% | 512 | 19.8 | 26.5 ± 1.4 | 34.6 ± 2.8 | 515 ± 15 | 515 ± 15 | 0 / 0 |
| 80% | 586 | 23.7 | 34.9 ± 3.9 | 57.5 ± 10.3 | 586 ± 17 | 585 ± 14 | 0 / 0 |
| 90% | 659 | 35.4 | 69.6 ± 17.5 | 195.3 ± 56.1 | 654 ± 13 | 622 ± 3 | 0 / 0 |
| 95% | 695 | 59.5 | 143.1 ± 47.2 | 326.5 ± 66.1 | 670 ± 5 | 624 ± 0 | 0 / 15 |
| 100% | 732 | infinite | 255.0 ± 60.7 | 468.0 ± 67.0 | 675 ± 1 | 624 ± 0 | 0 / 85 |
| 130% | 952 | infinite | 951.0 ± 58.8 | 1,139.4 ± 56.7 | 675 ± 0 | 624 ± 0 | 1686 / 2384 |

### T2.3 Priority junction

A T-junction in left-hand traffic built the way the engine's own tests build it: the main road east-west, one lane each way,
its flow split equally between the two directions; the side road from the south, 2000 veh/h (more than it can take),
half turning each way. Cars, lane discipline on. Network format 5: `control: "priority"`, main-road approaches named. In SUMO
a `priority` node whose main-road edges are ranked above the side road's, with SUMO's default junction model.
Side-road vehicles crossing the stop line in 3600 s after a 300 s warm-up; ten seeds each.

The standard names "the gap-acceptance capacity formula" without its inputs. Here: Siegloch's c = q e^(-q(tc - tf/2)) / (1 - e^(-q tf)),
q the whole main-road flow, tc = the engine's accepted gap for a car (4.6 s, Kota et al. 2025, read from the engine's assumptions
table), and tf = 0.6 tc = 2.76 s, a rule of thumb: neither the standard nor the engine gives a follow-up time.

| Main-road flow (veh/h) | Formula (veh/h) | Ours (veh/h) | SUMO (veh/h) | SUMO teleports for yielding (all seeds) |
|---|---|---|---|---|
| 200 | 1,176 | 1,030 ± 31 | 742 ± 30 | 0 |
| 400 | 1,059 | 757 ± 26 | 437 ± 27 | 0 |
| 600 | 951 | 540 ± 32 | 254 ± 27 | 0 |
| 800 | 853 | 377 ± 28 | 142 ± 22 | 0 |
| 1000 | 764 | 245 ± 27 | 86 ± 10 | 19 |
| 1200 | 682 | 148 ± 29 | 53 ± 6 | 38 |

### T2.4 Four-way junction, all approaches saturated

Two lanes each way on every arm (200 m), stop lines 15 m from the centre. Two phases: north-south together, then
east-west together (30 s green each, amber 3 s, all-red 2 s), so turns across oncoming traffic meet it; in SUMO
those turns have a permissive green ('g') and yield. Demand 1500 veh/h per approach (20% left, 60% straight on,
20% right), more than an approach can take. Cars, lane discipline on, 30 minutes, ten seeds.

|  | Vehicles through (mean ± 95%) | Vehicles let onto the network | Still waiting to enter at the end | Stuck vehicles / teleports (all seeds) |
|---|---|---|---|---|
| Ours | 2,025 ± 29 | 2,236 ± 29 | 745 ± 59 | 0 |
| SUMO | 1,408 ± 7 | 1,638 ± 7 | 1,344 ± 42 | 0 |

## Tier 3 details

The engine's flyover example (`packages/engine/examples/flyover.json`): a flyover each way over a signal junction (four phases of
20 s, one approach at a time), the diverges and merges where it leaves and rejoins the main road; with a second signal junction
added 215 m beyond the north end (two phases: north-south 40 s, east-west 20 s; amber 3 s, all-red 2 s), its own east-west arms,
and the north entry and exit moved beyond it. Cars only, lane discipline on (the example runs the Bengaluru mix in mixed traffic;
here the mix is replaced by cars so that SUMO's ordinary lane model applies). The example's flows, with the new junction's own
cross traffic (300 straight on and 100 turning, each way). Warm-up 600 s, measured 3600 s, ten seeds.

Route choice: the through flows can take the flyover or the junction beneath. Our engine chooses once per vehicle, when it
enters, by its Kirchhoff split on travel times measured over the last minute. SUMO is given both routes and its rerouting device
(`--device.rerouting.probability 1`, `period 0`: routed once, when the vehicle is inserted; edge travel times averaged over
the last 60 s), which takes the fastest route at that moment.

**T3.1 Flow per link** (vehicles entering the road in the measured hour, mean over seeds; SUMO's `entered + departed` from its edge data):

| Road | Ours (veh/h) | SUMO (veh/h) | GEH | Below 5 |
|---|---|---|---|---|
| south-entry | 1,788 | 1,784 | 0.10 | yes |
| south-in | 538 | 412 | 5.76 | no |
| flyover-north | 1,249 | 1,358 | 3.03 | yes |
| north-out | 414 | 297 | 6.25 | no |
| north-exit | 1,663 | 1,641 | 0.54 | yes |
| north-entry | 1,870 | 1,740 | 3.05 | yes |
| north-in | 552 | 321 | 11.06 | no |
| flyover-south | 1,332 | 1,436 | 2.79 | yes |
| south-out | 435 | 211 | 12.49 | no |
| south-exit | 1,763 | 1,641 | 2.96 | yes |
| west-in | 579 | 589 | 0.43 | yes |
| east-out | 673 | 669 | 0.16 | yes |
| east-in | 596 | 596 | 0.01 | yes |
| west-out | 689 | 680 | 0.34 | yes |
| far-north-out | 1,749 | 1,702 | 1.12 | yes |
| far-north-in | 1,779 | 1,686 | 2.25 | yes |
| far-west-in | 410 | 406 | 0.17 | yes |
| far-east-out | 313 | 307 | 0.35 | yes |
| far-east-in | 397 | 392 | 0.28 | yes |
| far-west-out | 300 | 294 | 0.30 | yes |

**T3.2 Mean travel time per origin-destination pair**, from being placed on the network to leaving it (waiting to enter left out),
vehicles placed in the measured hour that left by its end (count in brackets, all seeds). A vehicle our engine released as stuck is
left out.

| From, to | Ours (s) | SUMO (s) | Ours against SUMO | Within 15% |
|---|---|---|---|---|
| east-in to far-north-out | 250.5 ± 34.0 (870) | 308.0 ± 67.8 (867) | -18.7% | no |
| east-in to south-exit | 212.9 ± 31.5 (915) | 213.4 ± 30.8 (916) | -0.2% | yes |
| east-in to west-out | 196.3 ± 34.4 (3671) | 203.0 ± 34.1 (3664) | -3.3% | yes |
| far-east-in to far-north-out | 145.4 ± 18.4 (942) | 626.5 ± 218.9 (753) | -76.8% | no |
| far-east-in to far-west-out | 92.5 ± 4.9 (2879) | 146.2 ± 73.0 (2821) | -36.7% | no |
| far-north-in to east-out | 183.6 ± 10.0 (1454) | 238.0 ± 85.9 (1397) | -22.9% | no |
| far-north-in to south-exit | 114.9 ± 2.2 (14315) | 174.9 ± 43.7 (13082) | -34.3% | no |
| far-north-in to west-out | 185.2 ± 16.1 (1420) | 197.0 ± 62.2 (1412) | -6.0% | yes |
| far-west-in to far-east-out | 106.2 ± 9.1 (3017) | 163.0 ± 80.9 (2942) | -34.8% | no |
| far-west-in to south-exit | 267.0 ± 36.6 (925) | 568.7 ± 239.9 (771) | -53.1% | no |
| south-entry to east-out | 131.0 ± 8.9 (1385) | 204.8 ± 115.6 (1357) | -36.0% | no |
| south-entry to far-north-out | 111.0 ± 1.5 (14392) | 230.2 ± 106.3 (13901) | -51.8% | no |
| south-entry to west-out | 134.6 ± 7.5 (1505) | 201.6 ± 108.5 (1464) | -33.2% | no |
| west-in to east-out | 256.9 ± 47.0 (3645) | 208.0 ± 43.8 (3707) | +23.5% | no |
| west-in to far-north-out | 295.6 ± 41.5 (861) | 338.3 ± 109.0 (904) | -12.6% | yes |
| west-in to south-exit | 277.9 ± 48.3 (810) | 221.6 ± 43.5 (864) | +25.4% | no |

**T3.3 Longest queue per approach** in the measured hour, sampled once a second in both engines with the engine's own rule (a
vehicle on the approach, short of the stop line, below 1.4 m/s is queued; counted back from the stop line to the first gap
over 10 m), applied by the harness to both. "Ours, engine's own" is the engine's own longestQueueByApproach (every step) for comparison.

| Approach | Ours (m) | Ours, engine's own (m) | SUMO (m) | Ours against SUMO | Within 25% |
|---|---|---|---|---|---|
| south-entry | 0.0 ± 0.0 | 0.0 ± 0.0 | 75.3 ± 61.9 | -100.0% | no |
| north-out | 1.2 ± 2.7 | 1.2 ± 2.7 | 56.2 ± 60.6 | -97.9% | no |
| flyover-north | 0.0 ± 0.0 | 0.0 ± 0.0 | 200.4 ± 112.1 | -100.0% | no |
| north-entry | 1.9 ± 4.3 | 2.0 ± 4.4 | 20.9 ± 16.8 | -90.9% | no |
| south-out | 0.0 ± 0.0 | 0.0 ± 0.0 | 0.0 ± 0.0 | both 0 | - |
| flyover-south | 0.0 ± 0.0 | 0.0 ± 0.0 | 0.0 ± 0.0 | both 0 | - |
| south-in | 105.5 ± 9.1 | 107.2 ± 10.0 | 133.8 ± 40.6 | -21.1% | yes |
| north-in | 120.9 ± 18.8 | 121.3 ± 18.9 | 106.7 ± 37.0 | +13.3% | yes |
| west-in | 182.9 ± 27.4 | 183.5 ± 26.2 | 159.8 ± 30.0 | +14.4% | yes |
| east-in | 160.4 ± 25.8 | 160.6 ± 25.7 | 162.1 ± 27.5 | -1.0% | yes |
| north-exit | 76.8 ± 5.1 | 78.4 ± 6.6 | 202.7 ± 2.0 | -62.1% | no |
| far-north-in | 87.7 ± 8.5 | 89.3 ± 7.5 | 178.5 ± 20.6 | -50.8% | no |
| far-west-in | 95.0 ± 14.0 | 95.6 ± 14.2 | 140.5 ± 41.2 | -32.3% | no |
| far-east-in | 83.6 ± 7.2 | 84.0 ± 7.2 | 147.7 ± 38.3 | -43.4% | no |

**T3.4 Through traffic taking the flyover**, vehicles placed in the measured hour that left by its end:

| Through flow | Ours | SUMO |
|---|---|---|
| south-entry to far-north-out | 84.3% ± 0.9 | 92.3% ± 4.8 |
| far-north-in to south-exit | 85.2% ± 1.0 | 98.3% ± 1.1 |

## Tier 4 details

### The Chennai data, as read here

Fetched by `packages/benchmark/scripts/fetch-chennai.sh` into `data/external/chennai` (ignored by git; not committed). Every figure
below was computed by `src/chennai.ts` and `chennaiField()` in `src/tier4.ts` from the two downloaded files: 3,005 vehicles in all.

|  | 2:45 to 3:00 pm | 3:00 to 3:15 pm |
|---|---|---|
| File | `ChennaiTrajectoryData2.45-3.00PM.xlsx` | `ChennaiTrajectoryData3.00-3.15PM.xlsx` |
| Vehicles (trajectories) | 1,514 | 1,491 |
| Observations (rows) | 57,494 | 55,165 |
| Observations flagged as corrected by hand | 2,452 (4.3%) | 1,746 (3.2%) |
| Vehicles by type | motorcycle 852, car 401, bus 45, truck 7, light commercial vehicle 17, auto-rickshaw 192 | motorcycle 843, car 399, bus 50, truck 2, light commercial vehicle 23, auto-rickshaw 174 |
| Furthest front bumper (m) | 242.8 | 244.6 |
| Sideways positions, least and greatest (m) | -0.05 to 10.93 | 0.08 to 10.93 |
| Last time stamp (s) | 901.5 | 908.5 |
| Flow: vehicles in the file per hour | 6,056 | 5,964 |
| Speed column: mean of all observations (m/s) | 5.903 | 5.838 |
| Speed column, by type (m/s) | motorcycle 6.04, car 6.12, bus 5.79, truck 5.27, light commercial vehicle 5.96, auto-rickshaw 5.06 | motorcycle 5.95, car 6.10, bus 5.29, truck 5.91, light commercial vehicle 5.92, auto-rickshaw 5.04 |
| Speed from positions: mean over successive observations 0.5 s apart (m/s) | 11.367 | 11.193 |
| Speed from positions in 30-220 m, by engine class (m/s) | two-wheeler 11.70, car 11.90, auto-rickshaw 9.83, bus 11.08 | two-wheeler 11.49, car 11.75, auto-rickshaw 9.75, bus 10.26 |
| Mix given to the engines | two-wheeler 56.3%, car 27.6%, auto-rickshaw 12.7%, bus 3.4% | two-wheeler 56.5%, car 28.3%, auto-rickshaw 11.7%, bus 3.5% |

**The speed column disagrees with the positions by a factor of about two.** Between two successive observations of a vehicle,
0.5 s apart by the time column, the front bumper moves on average 11.37 and
11.19 m/s in the two periods; the speed column, over all observations, averages 5.90 and
5.84 m/s (the overall 5.88 m/s that the research agent read in the paper matches the speed column, as do its
per-class figures). The positions and the time column agree with the counted flow: 6,016 and
5,924 vehicles an hour past 200 m at a mean of 147 and
143 vehicles per km in the stretch is a speed near 11 m/s (flow / density), not 6. Which
column is wrong is not known; the legend gives no help. **Decided before any model run was looked at:** T4.1 is scored against
speeds from the positions (distance covered over time taken in the stretch 30 to 220 m), because the throughput and the density
the engines are given and scored on come from the same positions and times. The speed column's figures are shown below for comparison.

The engines' four classes stand for the data's six: motorcycle as two-wheeler, car and light commercial vehicle as car, bus and
truck as bus, auto-rickshaw as auto-rickshaw. The field's figures are grouped the same way.

### T4.1 to T4.4 Replay of the section

**Not a replay of the observed arrivals.** The engine's interface takes a demand as flows (Poisson arrivals at a rate) and cannot
be given an arrival schedule. Each 15-minute period is run with its observed rate and vehicle mix as the demand, on an empty road
245 m x 11.2 m (mixed traffic; three nominal lanes, which mixed traffic ignores), speed limit 20 m/s so that each class's own
desired speed applies; SUMO gets the identical departures. Ten seeds per period per engine; the rows above average the two
periods. Measured in the stretch 30 to 220 m (where every vehicle in the data is tracked); throughput where front bumpers cross
200 m. Engines sampled once a second; the field at its 0.5 s. Sideways positions: the time each class spends in each 0.2 m
across the road, compared as an earth mover's distance (metres of sideways shift needed to turn one distribution into the other).
T4.2's throughput is close to the demand by construction whenever the section is not congested: it shows the section carries the
demand, not that the engine reproduces the field's flow.

Against the speed column instead of the positions (mean of the two periods; m/s):

| Class | Field, speed column | Ours | SUMO | Closer |
|---|---|---|---|---|
| two-wheeler | 6.03 | 16.37 (+171.3%) | 13.98 (+131.7%) | SUMO |
| car | 6.18 | 13.10 (+112.0%) | 13.32 (+115.5%) | ours |
| auto-rickshaw | 5.10 | 10.70 (+109.8%) | 10.73 (+110.5%) | ours |
| bus | 5.55 | 11.33 (+104.1%) | 11.63 (+109.5%) | ours |

Each minute of the first period, density (veh/km) and speed (m/s), engines' means over ten seeds:

| Minute | Field density | Field speed | Ours density / speed | SUMO density / speed |
|---|---|---|---|---|
| 1 | 91 | 12.53 | 102 / 14.31 | 110 / 13.41 |
| 2 | 124 | 12.03 | 122 / 13.96 | 131 / 13.01 |
| 3 | 162 | 11.94 | 112 / 14.56 | 122 / 13.35 |
| 4 | 161 | 11.57 | 117 / 14.18 | 126 / 13.15 |
| 5 | 120 | 11.80 | 115 / 14.28 | 125 / 13.26 |
| 6 | 149 | 11.35 | 122 / 14.08 | 131 / 13.10 |
| 7 | 119 | 11.64 | 120 / 14.17 | 129 / 13.05 |
| 8 | 215 | 10.21 | 116 / 14.22 | 126 / 13.17 |
| 9 | 128 | 11.47 | 124 / 14.03 | 134 / 13.06 |
| 10 | 198 | 11.21 | 116 / 14.15 | 124 / 13.17 |
| 11 | 116 | 12.03 | 108 / 14.50 | 116 / 13.45 |
| 12 | 165 | 11.80 | 114 / 14.18 | 123 / 13.14 |
| 13 | 158 | 11.07 | 119 / 14.30 | 129 / 13.29 |
| 14 | 167 | 11.07 | 115 / 14.48 | 126 / 13.22 |
| 15 | 124 | 11.44 | 118 / 14.32 | 129 / 13.05 |

### T4.5 Mid-block capacity

One carriageway 7.5 m wide (Indo-HCM's nominal width of a 4-lane divided road: two 3.5 m lanes and 0.25 m kerb shyness each
side), 500 m, mixed traffic, the Bengaluru vehicle mix at 20,000 veh/h (more than either engine lets in). Vehicles
past 400 m in 1800 s after a 300 s warm-up, ten seeds, converted with Indo-HCM's midblock PCU for 4-lane divided roads
(two-wheeler 0.2, auto-rickshaw 0.8, car 1, bus 4.58). With demand
beyond capacity both engines are limited where vehicles enter, so this is the most the road takes in from its start: neither
engine has a bottleneck downstream on this road.

Vehicles per hour by class: ours two-wheeler 5,982, car 2,026, auto-rickshaw 492, bus 367; SUMO two-wheeler 9,740, car 3,290, auto-rickshaw 824, bus 596. In vehicles: ours 8,867 ± 68 veh/h, SUMO
14,450 ± 79 veh/h.

Indo-HCM values (all as read by the project's research agent from a third-party copy of the manual, whose table layout was partly
scrambled; **secondary**, not confirmed here from the primary text): base capacity 5,400 PCU/h for a 4-lane divided urban road,
2,700 per direction (Table 5.4); PCU medians as above (Table 5.3, column mapping marked uncertain by the agent).

### T4.6 Saturation flow of a signal approach

The standard's T4.6 is with two-wheeler filtering. **Filtering is not built in our engine** (ticket 06 not started), so this is the
engine as it is: two-wheelers do not move up between queued vehicles during the red. SUMO's sublane model lets narrow vehicles
use any free sublanes, which includes moving up beside queued vehicles where there is room; nothing was added to SUMO for it.

Approach 7 m wide, 300 m long, through traffic only, Bengaluru mix at 6,000 veh/h (more than the approach can take, so
the queue never clears). Green 40 s in a 70 s cycle. Saturation flow: vehicles crossing the stop line per hour of green, leaving out the
first 6 s of each green, over 1800 s after a 300 s warm-up; ten seeds. PCU at signals (Indo-HCM Table 6.3 as read by the research
agent, secondary, mapping uncertain): two-wheeler 0.4, auto-rickshaw 0.5, car 1, bus 1.6.
The width formula (unit base saturation flow 1140 - 60 W PCU/h per metre, 7 <= W <= 10.5 m) is also as read by the agent (secondary).
In vehicles: ours 7,176 ± 172, SUMO 9,228 ± 181 veh/h of green.

## Tier 5 details

Report only. Vehicles on the network from the start, 25 per km per lane on parallel 10 km roads of four lanes (1,000 vehicles a
road, with 1 km of clear road ahead so none leaves), at the speed of uniform traffic at that density; 60 simulated seconds. The
speed is simulated seconds per wall-clock second over the stepping alone (ours: around the steps, snapshots not read; SUMO: the
"Duration" it prints, loading left out); set-up and loading are given apart. Peak memory is the maximum resident set size of
the process (`/usr/bin/time -l`); for ours that includes Node and tsx. One process at a time; one measurement each, not repeated.
SUMO's mixed traffic is its sublane model at 0.5 m on 14 m lanes (four lanes of 3.5 m are one lane here, as in Tier 4).

| Traffic | Vehicles | Ours (Node), speed | SUMO, speed | Ours, peak memory | SUMO, peak memory | Set-up / loading (s), ours / SUMO | Load average, ours / SUMO | Vehicles at the end, ours / SUMO |
|---|---|---|---|---|---|---|---|---|
| cars, lanes | 1,000 | 626.1x | 122.4x | 96 MB | 56 MB | 0.00 / 0.30 | 19.2 / 19.2 | 1000 / 1000 |
| cars, lanes | 5,000 | 190.1x | 43.2x | 106 MB | 71 MB | 0.01 / 0.22 | 15.2 / 15.2 | 5000 / 5000 |
| cars, lanes | 20,000 | 46.8x | 7.0x | 136 MB | 131 MB | 0.02 / 0.29 | 31.5 / 31.5 | 20000 / 20000 |
| Bengaluru mix, mixed traffic | 1,000 | 433.1x | 2.3x | 99 MB | 52 MB | 0.01 / 0.29 | 19.2 / 19.2 | 1000 / 1000 |
| Bengaluru mix, mixed traffic | 5,000 | 122.3x | 0.4x | 112 MB | 68 MB | 0.01 / 0.34 | 15.2 / 15.2 | 5000 / 5000 |
| Bengaluru mix, mixed traffic | 20,000 | 30.5x | 0.1x | 148 MB | 122 MB | 0.02 / 0.30 | 27.7 / 26.6 | 20000 / 20000 |

**T5.4 Feature coverage** (from each engine's documentation; for ours, its "not modelled" list):

| Feature | Ours | SUMO 1.28 |
|---|---|---|
| Rerouting | No; one choice between a flyover and the junction beneath, made once at entry | Yes (rerouting device, routing algorithms, dynamic user assignment) |
| Actuated signals | No; fixed-time plans only | Yes (actuated, delay-based, NEMA, others) |
| Public transport | No; buses drive through without stopping | Yes (stops, schedules, lines) |
| Pedestrians | No | Yes |
| Emissions | No | Yes (HBEFA, PHEMlight and others) |
| Map import | No (networks are drawn in the app or written as JSON) | Yes (OpenStreetMap and other formats, by netconvert) |
| Output formats | Results as JSON (delay per class, vehicles through, longest queues, stuck vehicles); snapshots | Many (trip info, edge and lane data, FCD, detectors, queues, emissions, summaries) |
| Priority junctions | Yes (ticket 08) | Yes |
| Mixed traffic without lanes | Yes (strips) | Yes (sublane model) |
| Runs in a browser with nothing to install | Yes | No |

## How SUMO was set up, and where it could not be made identical

Every network is written once in our engine's format and translated by `src/sumo-network.ts`: each road an edge with its own
centreline (`spreadType="center"`) and its plan length, lanes and width; each junction a node at the middle of its roads' ends, SUMO
building the junction area from where the edges stop; signal programmes written from the engine's plans; only the engine's
connections (any other netconvert adds is deleted); `--lefthand` networks. Vehicle types from the engine's assumptions table
(IDM, delta 4, same a, b, T, s0, length, width, desired speed, `speedFactor="1" speedDev="0"`, `stepping="0.2"`). Departures are the
engine's own (`src/demand-replay.ts` repeats the engine's demand streams and every job checks the count per class against the
engine's results). Options: `--step-length 0.2 --step-method.ballistic true --time-to-teleport 300 --collision.action warn`.

Not identical:

1. **Entering traffic.** Ours puts a vehicle in the place with the longest clear road ahead (nearest the middle of equals),
   rear bumper at the start, when it has its desired following gap. SUMO: `departLane="best"` (lanes) or one wide lane with
   `departPosLat="free"` (mixed traffic), `departPos="base"`, `departSpeed="avg"`. Departure times are identical; when each
   vehicle actually gets in is decided by each engine. In T4.5 the road's intake is what is measured, so this matters there.
2. **Red and amber.** Ours treats a signal that is not green as a stopped vehicle at the stop line across the approach, and lets
   a vehicle into the junction only on green and only if it can reach the stop line before the amber ends. SUMO's first car
   stops at the stop line itself (ours stands its standstill gap, 2 m, short of it), and a SUMO car facing amber stops if it can,
   sometimes by emergency braking (counted in the stuck-vehicle table).
3. **Turns across oncoming traffic** (T2.4, the downstream junction of Tier 3). SUMO gives them a permissive green ('g') and its
   junction model makes them yield to oncoming traffic; a turning car waits inside the junction. Ours lets vehicles into the
   junction in one order, the first let in going first where paths cross, with no rule that oncoming traffic goes first and no
   waiting inside the junction; since ticket 24 a vehicle at the front of its strips refused on its green for crossing traffic is
   let in after the green once that traffic has passed (clearing after green).
4. **Lanes at a junction.** SUMO's netconvert decides which lanes lead to which exits (left lane left, and so on) and its cars
   change lane to reach them. Ours, since ticket 24: on an approach that also goes straight on, a turn leaves from the half of
   the lanes on its own side (straight on from any); a vehicle enters the network in strips that lead onto its turn, or sorts
   to them on the way.
5. **Priority junction (T2.3).** SUMO's junction model with its defaults decides when a side-road car may go: it looks at
   whether main-road vehicles would have to brake, with each vehicle's own braking ability (decel = 1 m/s² for the car here, from
   our assumptions table, which makes SUMO cautious). Ours: an accepted gap of 4.6 s to the next main-road vehicle's arrival at
   the crossing place. The concepts differ, so no parameter was carried across.
6. **Route choice (T3.4).** Ours: Kirchhoff split on measured travel times (power 4, smallest share 5%). SUMO: its rerouting
   device, routing each vehicle once at insertion to the fastest route on edge times averaged over 60 s (all-or-nothing at that
   moment). Same once-only timing and averaging period; different choice rule.
7. **Stuck vehicles.** Ours takes a stuck vehicle off the network after 300 s at the front of its queue (not held by a red or a
   priority junction); SUMO teleports it further along its route after 300 s of waiting. Both are counted.
8. **Mixed traffic (Tier 4).** Ours: strips 0.5 m wide, a vehicle taking as many as its width and side clearance need, sideways
   moves by the engine's own rule. SUMO: one lane as wide as the road, sublanes of 0.4 m (11.2 m road) or 0.5 m (7 and 7.5 m roads,
   14 m in Tier 5), SL2015 with its default parameters, `latAlignment="arbitrary"`, minGapLat = our side clearance and
   maxSpeedLat = our sideways speed cap. The same following rule and values in both.
9. **Position across the road (SUMO's posLat).** In a left-hand network SUMO's posLat is positive towards the right of the
   direction of travel; this was checked on the Tier 4 road before converting (a vehicle with `departPosLat="left"` ran at
   posLat +4.65 on the right-hand side).
10. **Junction size.** Each junction's area is SUMO's own, built from where the edges stop; the paths through it are close in
    length to ours (20.00 m against 20 m in T2.1) but not identical in general.
11. **Departure times** are given to SUMO as drawn (to 1 ms); our engine acts on them at the end of the step in which they fall.

## Tests that could not be run as written

| Test | Engine | What was done instead | Why |
|---|---|---|---|
| T4.1 to T4.4 | both | Demand at each 15-minute period's observed rate and class mix (Poisson), identical in both engines; the road starts empty. | The engine's interface cannot take an arrival schedule; arrivals are drawn from a rate. |
| T4.1 | both | Scored against speeds from the positions; the data's speed column shown beside it. | The data's speed column and its positions disagree by a factor of about two (see Tier 4 details). |
| T4.6 | ours | Run as the engine is, without filtering. | Two-wheeler filtering at signals is not built (ticket 06 not started). |
| T2.3 | both | Formula drawn with tf = 0.6 tc. | The standard gives no critical gap or follow-up time for the formula; the engine gives a critical gap only. |
| T5.1 | ours | Node only. | No browser was driven in this run. |
| T5.3 | both | The largest of the measured sizes (1,000, 5,000, 20,000) that ran faster than real time. | Not searched for between the sizes. |

## Proposed amendments to the standard

None has been applied; section 7 of the standard is unchanged. Proposals, dated 2026-11-12, for whoever owns the standard. No
tolerance change is proposed.

1. **T2.1.** State the starting state: the queue forms at a red under each engine's own rules (here 30 cars, 12 m apart, red for
   90 s), and the IDM reference is integrated through the same red and green, the red being a standing vehicle at the stop line.
   A queue placed at exactly the standstill gap gives a saturation flow 16% higher (1,992 against 1,710 veh/h) than one that
   formed. In a trial run before the recorded one, SUMO given a queue at the standstill gap with a 15 s red closed it up further
   during the red and discharged 1,718 veh/h while ours gave about 1,970: the result depends on this choice.
2. **T2.2.** Webster's formula counts the time spent queueing, not the time lost slowing down and speeding up, which with the
   car's a = b = 1 m/s² is large (about 8.5 s to accelerate from rest to 15 m/s by the IDM, integrated here, and 7.5 s to brake
   at b). State which delay is compared (for example: stopped or queueing delay; or the measured delay less a measured per-stop
   loss), and fix Webster's inputs (saturation flow and lost time from T2.1's reference, or from each engine's own T2.1).
3. **T2.3.** Name the formula and its inputs: here Siegloch, conflicting flow = all main-road flow, tc = the engine's accepted gap
   for a car, tf = 0.6 tc; and the movement measured (here both side-road turns together).
4. **T2.4.** Fix the geometry, phases and demand (here two lanes, two phases with turns across oncoming traffic, 1,500 veh/h per
   approach).
5. **Tier 3.** Fix the network (here the flyover example with a downstream junction), the demand, cars or mixed traffic, the
   warm-up and measured hour, and SUMO's route choice (here the rerouting device at insertion); define "link" for T3.1 (here every
   road), and how T3.2 and T3.3 are scored across pairs and approaches (here: all within tolerance to pass).
6. **T4.1 to T4.4.** Allow demand at the observed rate and mix while the engine cannot take an arrival schedule, and say so in the
   result. Record that the Chennai data's speed column disagrees with its positions by a factor of about two, and fix which is the
   reference (here the positions). Fix the stretch measured (here 30 to 220 m) and where throughput is counted (here 200 m).
7. **T4.5.** Fix the road (here one carriageway 7.5 m wide, 500 m), the measuring point and the PCU set, and say that with demand
   above capacity on a plain road the result is the road's intake where vehicles enter.
8. **T4.6.** Keep the test as written, but until the engine has filtering report it as here, "without filtering"; fix the PCU set
   and the part of green counted (here from 6 s after the start of green).
9. **Tier 5.** Fix the scenario (here vehicles placed on parallel 10 km four-lane roads, 60 simulated seconds), that speed is over
   stepping alone, and how the browser worker is measured.
10. **Indo-HCM values.** Have the base capacity, the PCU tables and the saturation-flow width formula confirmed from the primary
    text of Indo-HCM 2017 before they are used as pass lines; here they are secondary.

## How to run it again

```sh
pnpm install
sh packages/benchmark/scripts/install-sumo.sh            # SUMO 1.28.0 into ~/.cache/traffic-simulator; needs uv
sh packages/benchmark/scripts/fetch-chennai.sh           # the Chennai data into data/external/chennai (ignored by git)
pnpm --filter @traffic-simulator/benchmark bench:tiers --jobs 6            # Tiers 2 to 4 (and 5); resumable
pnpm --filter @traffic-simulator/benchmark bench:tiers --only t5 --jobs 1  # Tier 5 alone, one process at a time
pnpm --filter @traffic-simulator/benchmark bench:tiers --report-only       # rebuild this document from the raw results
```

Options: `--only <kind or job id>` (kinds: t2.1, t2.2, t2.3, t2.4, t3, t4-field, t4-chennai, t4.5, t4.6, t5), `--jobs N`,
`--no-sumo`, `--fresh` (ignore finished jobs kept in `.work/tiers-cache`), `--keep-work` (keep SUMO's files), `--date`.
A single job can be repeated by hand with `tsx src/tiers-job-cli.ts <job.json> <result.json>`.
