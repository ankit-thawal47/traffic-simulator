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

The parts marked "uncommitted changes" ran from the working tree before its harness was committed; the jobs' code that ran is
that of commit `4838f76` (afterwards only the document's text and findings changed). The engine is the same in every part.
Machine time in all: about 6.5 minutes of wall clock for Tiers 2 to 4 at six processes, 10.4 minutes for Tier 5.

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
| T2.4 | Four-way junction, all approaches saturated, 30 min: stuck vehicles (ours) and teleports (SUMO) | none | zero; otherwise report the count | 10 in 10 runs | 0 in 10 runs | **FAIL** | pass |  |
| T3.1 | Small network: hourly flow per link, GEH (mean flows over ten seeds) | SUMO | GEH < 5 on at least 85% of links | 16 of 20 links (80%); per seed 45% to 85% | (reference) | **FAIL** | - |  |
| T3.2 | Mean travel time per origin-destination pair | SUMO | 15% | 2 of 16 pairs within 15% | (reference) | **FAIL** | - |  |
| T3.3 | Longest queue per approach (an approach with no queue in either engine is not scored) | SUMO | 25% | 2 of 12 approaches within 25% | (reference) | **FAIL** | - |  |
| T3.4 | Share of through traffic south-entry to far-north-out taking the flyover | SUMO | 5 percentage points | 95.7% ± 0.4 | 92.3% ± 4.8 | pass (+3.4 points) | - |  |
| T3.4 | Share of through traffic far-north-in to south-exit taking the flyover | SUMO | 5 percentage points | 96.0% ± 0.3 | 98.3% ± 1.1 | pass (-2.3 points) | - |  |
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
| T4.6 | Signal approach 7 m wide, mixed traffic, **without two-wheeler filtering** (not built: ticket 06): saturation flow | Indo-HCM 2017: W (1140 - 60 W) = 5,040 PCU/h (secondary) | 20% | 4,244 ± 48 PCU/h (-15.8%) | 5,472 ± 54 PCU/h (+8.6%) | pass | pass | SUMO |
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
| T2.4 | 10 | 10 | 7 | 0 | 10 | 0 | 0 | 0 | 14 |
| Tier 3 | 10 | 11 | 8 | 0 | 10 | 119 | 5 | 0 | 1003 |
| T4.1-T4.4 | 20 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 0 |
| T4.5 | 10 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 |
| T4.6 | 10 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 96 |

## Findings

Written by hand against the runs described here. If the tables are rebuilt from a later run, re-read this section against them.

**What was run.** Every test of Tiers 2 to 5 in the standard, with these exceptions and changes: T4.1 to T4.4 with demand at the
observed rate rather than the observed arrivals; T4.6 without filtering, which is not built; T5.1 in Node only, not in a browser.
In all: 1 + 80 + 60 + 10 jobs for Tier 2, 10 for Tier 3, 2 + 20 + 10 + 10 for Tier 4 (each job one seed through both engines)
and 12 measurements for Tier 5; ten seeds per stochastic test per engine, none dropped. Tiers 2 to 4 ran six processes at a time
on a machine shared with other work (load average 4 to 22 at the starts); Tier 5 one process at a time, but the machine's
load average was 15 to 32 while it ran, so its timings are slower than an idle machine would give, for both engines alike.
Ticket 08 (priority junction) was merged before the run, so T2.3 ran for both engines.

**T2.1 passes for both, and the two engines agree to 0.2%.** Saturation flow 1,670 veh/h ours, 1,667 SUMO, 1,710 the IDM
reference through the same red and green (-2.3% and -2.5%). How the queue was formed matters more than either engine: a queue
standing at exactly the standstill gap discharges at 1,992 veh/h in the reference, one that closed up during a 90 s red at 1,710.

**T2.2 fails for both engines against Webster, at every demand.** Ours is 34% to 97% above Webster's delay up to 90% of capacity,
SUMO 53% to 452%; ours is the nearer at every share. Two things stand between the engines and the formula, and neither was tuned
away. First, Webster counts queueing, not the time lost slowing down and speeding up, and with the car's a = b = 1 m/s² a stop
costs about 16 s on top of the time stood (8.5 s to accelerate from rest, worked out from the IDM; about 7.5 s to brake): at 30%
of capacity, where queues are short, ours is 5 s above Webster and SUMO 7.5 s. Second, the capacity fed to Webster
(732 veh/h, from the reference's saturation flow and green + amber - start-up lost time) is more than either engine carries: in
the 130% runs ours let through 675 veh/h and SUMO 624, so at 90% both are close to or past their own capacity and the delay
grows without bound. Ours against SUMO is within 15% only at 30% of capacity. SUMO's lower capacity goes with its cars stopping at
the amber when they can: it braked as an emergency 115 times in the 80 runs, and the 108 warnings kept (the first five of a run)
are all on the approach lane.

**T2.3: side-road capacity falls with main-road flow in both engines, as it must; against the formula ours passes at
200 veh/h only, SUMO nowhere.** Ours: 1,030 veh/h at 200 down to 148 at 1,200; SUMO: 742 down to 53 (with 57 teleports of side-road
cars that waited 300 s, at the two highest flows). The formula, with tc = 4.6 s and tf = 0.6 tc, gives 1,176 down to 682. The
formula's inputs are a choice (amendment 3); with them both engines fall far faster than it as the main road gets busier, SUMO
most. SUMO's caution follows from the car's comfortable deceleration of 1 m/s²: SUMO's junction model does not send a side-road
car if a main-road car would have to brake harder than that.

**T2.4 fails for ours: 10 stuck vehicles in 7 of 10 runs; SUMO had no teleport.** At a junction where opposite approaches share a
green and turns cross oncoming traffic, our engine released 10 stuck vehicles, in 7 of the 10 runs. It
also carried 8% less: 1,300 vehicles through in 30 minutes against SUMO's 1,408.

**Tier 3 fails on three of four measures; the flyover share passes.** Through traffic split the same way in both engines (96%
over the flyover each way in ours, 92% and 98% in SUMO: within 5 points). Everything at the junctions differs. The junction
beneath the flyover (one approach at a time, 20 s each) carries much less in ours: its approaches are queued to their full
200 m, its cross traffic got in at 452 and 361 veh/h against SUMO's 589 and 596 (demand 600), and travel times through it are
two to three times SUMO's. GEH is under 5 on 16 of 20 links (80%; 85% needed), the four failures all at that junction; 2 of 16
origin-destination pairs are within 15%; 2 of 12 queued approaches within 25%. SUMO is not well either: it teleported 119
vehicles in 5 of 10 runs and braked as an emergency 1,003 times (of the warnings kept, the first five a run, most are at or in
the downstream junction), and its northbound approach to the downstream junction is queued to its full 200 m while ours is
not (57 m). Ours released 11 stuck vehicles in 8 of 10 runs. The junction rules are where the
engine is weakest, as T2.2, T2.4 and Tier 3 all show: less is let through each green when turning traffic is in the queue.

**Tier 4: neither engine wins outright.** On the Chennai section the cars, auto-rickshaws and buses of both engines are within
15% of the field's speeds (ours the nearer in all three); both engines' two-wheelers are too fast (ours +41%, SUMO +21%: ours
at 16.4 m/s, near their desired speed of 18 m/s). Throughput is within 3% for both, as it must be when the demand is
the observed flow. Sideways positions are nearer the field's in ours for every class (earth mover's distance 0.8 to 1.5 m,
SUMO's 1.4 to 3.3 m); speed minute by minute is nearer in SUMO (RMSE 1.97 m/s, ours 2.96). The data itself has a problem: its
speed column is half the speed its positions give, and the figures the paper reports are that column; against it both engines
are more than 100% too fast. Mid-block capacity (T4.5) is far above Indo-HCM's 2,700 PCU/h in both engines (ours 5,298, +96%;
SUMO 8,625, +220%): ours took in 8,867 vehicles an hour (5,982 of them two-wheelers) and SUMO 14,450 (9,740), where the
standard's figure would be about 4,500 of this mix; ours is the nearer. The signal approach (T4.6) passes for
both: ours 4,244 PCU/h (-16%), SUMO 5,472 (+9%, the nearer), against Indo-HCM's 5,040, ours without filtering. The Indo-HCM values
used are secondary.

**Tier 5: our engine was faster than SUMO in every measurement, which is the opposite of what was expected, and the scenario
is the reason to read it with care.** Cars in lanes: 626, 190 and 47 times real time at 1,000, 5,000 and 20,000 vehicles in
Node, against SUMO's 122, 43 and 7. Mixed traffic: ours 433, 122 and 31; SUMO's sublane model 2.3, 0.4 and 0.1 (slower than real
time from 5,000 vehicles). The scenario is the lightest there is: uniform traffic on straight roads, nobody needing to brake,
change lane or cross a junction, so it measures the cost of a step with little happening. SUMO evaluates its lane-change model
for every vehicle every step whatever happens; how much of our lead survives junctions and congestion is not measured here
(in the Tier 3 jobs, six at a time on the loaded machine and with the harness's measuring work included in both, our engine took
13.8 s of wall clock on average for the 70 simulated minutes and SUMO 15.7 s). Peak memory is higher for ours at every size (96 to 148 MB, of which most is Node and tsx
themselves) than SUMO's (52 to 131 MB). The machine was loaded (load average 15 to 32) throughout, for both engines alike; the
figures would be higher on an idle machine. Feature coverage is SUMO's by a wide margin, as expected. The browser worker was not
measured.

**Against the outcome expected in advance (standard, section 5):**

- *Lose all of Tier 5*: not so in this scenario. Lost on feature coverage (by a wide margin) and on peak memory; faster than
  SUMO at every size measured, in lanes and in mixed traffic, on a scenario with little happening (see above).
- *Match Tiers 0 and 1*: not part of this run (see the Tier 0 and 1 results).
- *Tiers 2 and 3 uncertain; junction logic weakest*: as expected. The single-lane discharge matches SUMO and the IDM; everything
  with turning traffic in the queue does not: T2.2 fails against Webster (both engines), T2.3 below the formula above 200 veh/h,
  T2.4 has stuck vehicles in ours and none in SUMO, Tier 3 fails on flows, travel times and queues.
- *Tier 4 unknown*: split. Ours is nearer the field in T4.1 (three classes of four), T4.2, T4.3 (all four classes) and T4.5; SUMO
  in T4.1 for two-wheelers, T4.4 and T4.6. Both fail T4.5 by a wide margin and pass T4.6.
- *Might be ahead at T4.6 (filtering)*: not tested, as filtering is not built. Without it ours is further from Indo-HCM than SUMO.
- *Deployment in a browser*: not a simulation-quality claim and not measured here.

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
| Ours | 1,300 ± 66 | 1,518 ± 64 | 1,463 ± 90 | 10 |
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
| south-in | 361 | 412 | 2.62 | yes |
| flyover-north | 1,407 | 1,358 | 1.31 | yes |
| north-out | 133 | 297 | 11.14 | no |
| north-exit | 1,541 | 1,641 | 2.51 | yes |
| north-entry | 1,839 | 1,740 | 2.34 | yes |
| north-in | 363 | 321 | 2.27 | yes |
| flyover-south | 1,469 | 1,436 | 0.86 | yes |
| south-out | 117 | 211 | 7.35 | no |
| south-exit | 1,585 | 1,641 | 1.40 | yes |
| west-in | 452 | 589 | 6.02 | no |
| east-out | 638 | 669 | 1.21 | yes |
| east-in | 361 | 596 | 10.77 | no |
| west-out | 589 | 680 | 3.60 | yes |
| far-north-out | 1,602 | 1,702 | 2.46 | yes |
| far-north-in | 1,779 | 1,686 | 2.25 | yes |
| far-west-in | 357 | 406 | 2.51 | yes |
| far-east-out | 248 | 307 | 3.53 | yes |
| far-east-in | 370 | 392 | 1.14 | yes |
| far-west-out | 267 | 294 | 1.64 | yes |

**T3.2 Mean travel time per origin-destination pair**, from being placed on the network to leaving it (waiting to enter left out),
vehicles placed in the measured hour that left by its end (count in brackets, all seeds). A vehicle our engine released as stuck is
left out.

| From, to | Ours (s) | SUMO (s) | Ours against SUMO | Within 15% |
|---|---|---|---|---|
| east-in to far-north-out | 553.7 ± 124.6 (47) | 308.0 ± 67.8 (867) | +79.8% | no |
| east-in to south-exit | 487.0 ± 30.2 (142) | 213.4 ± 30.8 (916) | +128.2% | no |
| east-in to west-out | 462.4 ± 27.0 (2797) | 203.0 ± 34.1 (3664) | +127.8% | no |
| far-east-in to far-north-out | 539.4 ± 121.3 (649) | 626.5 ± 218.9 (753) | -13.9% | yes |
| far-east-in to far-west-out | 461.3 ± 67.1 (2457) | 146.2 ± 73.0 (2821) | +215.5% | no |
| far-north-in to east-out | 592.5 ± 76.9 (1179) | 238.0 ± 85.9 (1397) | +148.9% | no |
| far-north-in to south-exit | 116.0 ± 2.6 (14229) | 174.9 ± 43.7 (13082) | -33.7% | no |
| far-north-in to west-out | 598.0 ± 69.1 (1197) | 197.0 ± 62.2 (1412) | +203.6% | no |
| far-west-in to far-east-out | 385.6 ± 80.5 (2348) | 163.0 ± 80.9 (2942) | +136.6% | no |
| far-west-in to south-exit | 607.0 ± 153.2 (618) | 568.7 ± 239.9 (771) | +6.7% | yes |
| south-entry to east-out | 530.6 ± 62.0 (1150) | 204.8 ± 115.6 (1357) | +159.1% | no |
| south-entry to far-north-out | 113.8 ± 3.1 (14328) | 230.2 ± 106.3 (13901) | -50.6% | no |
| south-entry to west-out | 522.6 ± 55.6 (1282) | 201.6 ± 108.5 (1464) | +159.3% | no |
| west-in to east-out | 462.5 ± 12.4 (3460) | 208.0 ± 43.8 (3707) | +122.4% | no |
| west-in to far-north-out | 538.4 ± 20.7 (443) | 338.3 ± 109.0 (904) | +59.1% | no |
| west-in to south-exit | 654.7 ± 130.2 (73) | 221.6 ± 43.5 (864) | +195.5% | no |

**T3.3 Longest queue per approach** in the measured hour, sampled once a second in both engines with the engine's own rule (a
vehicle on the approach, short of the stop line, below 1.4 m/s is queued; counted back from the stop line to the first gap
over 10 m), applied by the harness to both. "Ours, engine's own" is the engine's own longestQueueByApproach (every step) for comparison.

| Approach | Ours (m) | Ours, engine's own (m) | SUMO (m) | Ours against SUMO | Within 25% |
|---|---|---|---|---|---|
| south-entry | 83.7 ± 38.5 | 84.6 ± 38.2 | 75.3 ± 61.9 | +11.1% | yes |
| north-out | 0.0 ± 0.0 | 0.0 ± 0.0 | 56.2 ± 60.6 | -100.0% | no |
| flyover-north | 0.0 ± 0.0 | 0.0 ± 0.0 | 200.4 ± 112.1 | -100.0% | no |
| north-entry | 96.1 ± 39.9 | 96.6 ± 39.9 | 20.9 ± 16.8 | +359.4% | no |
| south-out | 0.0 ± 0.0 | 0.0 ± 0.0 | 0.0 ± 0.0 | both 0 | - |
| flyover-south | 0.0 ± 0.0 | 0.0 ± 0.0 | 0.0 ± 0.0 | both 0 | - |
| south-in | 178.2 ± 2.9 | 178.4 ± 2.9 | 133.8 ± 40.6 | +33.2% | no |
| north-in | 179.4 ± 0.2 | 179.7 ± 0.2 | 106.7 ± 37.0 | +68.2% | no |
| west-in | 200.0 ± 0.0 | 200.0 ± 0.0 | 159.8 ± 30.0 | +25.1% | no |
| east-in | 200.0 ± 0.0 | 200.0 ± 0.0 | 162.1 ± 27.5 | +23.4% | yes |
| north-exit | 57.3 ± 3.7 | 58.8 ± 3.7 | 202.7 ± 2.0 | -71.7% | no |
| far-north-in | 72.9 ± 8.0 | 73.6 ± 7.7 | 178.5 ± 20.6 | -59.1% | no |
| far-west-in | 198.4 ± 3.5 | 198.5 ± 3.4 | 140.5 ± 41.2 | +41.3% | no |
| far-east-in | 199.1 ± 2.1 | 199.1 ± 1.9 | 147.7 ± 38.3 | +34.8% | no |

**T3.4 Through traffic taking the flyover**, vehicles placed in the measured hour that left by its end:

| Through flow | Ours | SUMO |
|---|---|---|
| south-entry to far-north-out | 95.7% ± 0.4 | 92.3% ± 4.8 |
| far-north-in to south-exit | 96.0% ± 0.3 | 98.3% ± 1.1 |

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
In vehicles: ours 7,139 ± 103, SUMO 9,228 ± 181 veh/h of green.

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
   junction model makes them yield to oncoming traffic; ours lets vehicles into the junction in one order, the first let in going
   first where paths cross, with no rule that oncoming traffic goes first.
4. **Lanes at a junction.** SUMO's netconvert decides which lanes lead to which exits (left lane left, and so on) and its cars
   change lane to reach them; ours lets a vehicle turn from strips that lead onto its turn, chosen when it enters the network.
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
