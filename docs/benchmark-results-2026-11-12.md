# Benchmark results: Tiers 0 and 1 (2026-11-12)

Results of Tier 0 and Tier 1 of [the benchmark standard](benchmark-standard.md) for our engine, for SUMO and for the
reference equations. This document is written by `packages/benchmark` from the raw results in
`packages/benchmark/results/raw`; every number below was measured in the run described here. Failures are in the same
tables as passes. There is no overall score.

Passing these tiers does not make the engine calibrated or validated. Tier 1 is cars only with lane discipline on, the
least Indian case; agreement with SUMO shows the implementation is sane, not that either engine is realistic.

## The run

| | |
|---|---|
| Date | 2026-11-12 |
| Our engine | commit `706f72f06cafa878be15106d54d94dfb04a32966` (last change to `packages/engine`); harness at `3b4e33ba3eb5e5c9c4daf7631107dab492f9837f` |
| SUMO | Eclipse SUMO sumo 1.28.0 (pinned 1.28.0; `eclipse-sumo`, `libsumo`, `traci` wheels in `~/.cache/traffic-simulator/sumo-1.28.0`), headless |
| Machine | Apple M3 Pro, 12 cores, 18 GB, darwin 27.0.0 arm64 |
| Runtime | Node v22.7.0; no browser is involved in these tiers |
| Step | 0.2 s in both engines; reference integrated at 0.001 s |
| Seeds | 10 per stochastic test per engine (seeds 1 to 10), mean ± 95% confidence interval (Student's t), none dropped |
| Work | 10 parallel processes; no timing is reported (the machine slept during the run) |

## Results table

The two columns headed "Ours" and "SUMO" after the values are pass or fail of each engine against the reference and
tolerance of the standard; where the standard's tolerance is between the two engines, the verdict is in the last column.
Percentages in brackets are differences from the reference.

| ID | Test and metric | Reference | Tolerance | Ours | SUMO | Ours | SUMO | Ours against SUMO |
|---|---|---|---|---|---|---|---|---|
| T0.1 | Vehicle conservation | none | exact, every step | 0 violations in 6,331,562 steps of 762 runs | 0 violations in 80 summary rows (T1.5 runs, every 600 s; not every step) | pass | no violation seen (partly checked) |  |
| T0.2 | No two vehicles overlap | none | zero in all runs | 0 overlaps | 0 collisions in 913 runs | pass | pass |  |
| T0.3 | Same scenario and seed, same result | none | bit-identical | 60 of 60 scenario-seed pairs identical at every step | 2 of 2 repeated runs identical (T1.1; T1.5 seed 1) | pass | pass |  |
| T0.4 | No negative speed, no vehicle outside its road | none | zero | 0 negative speeds, 0 outside the road | 0 negative speeds in recorded cars; position not checked | pass | no violation seen (partly checked) |  |
| T1.1 | One car from rest: time to 95% of desired speed | 19.436 s | 2%, both | 19.269 s (-0.86%) | 19.269 s (-0.86%) | pass | pass | +0.0000% |
| T1.2 | Follow a leader with a fixed speed profile: speed RMSE | 0 (IDM at 0.001 s behind the same leader) | at most 0.2 m/s, both | **not runnable** | 0.0218 m/s | not runnable | pass |  |
| T1.2 | Same run: minimum gap | 1.694 m | never below zero, both | **not runnable** | 1.722 m | not runnable | pass |  |
| T1.3 | Ring, one lane: flow at each density in the stable range (8 densities) | IDM equilibrium flow | 5% per point, both | 8 of 8 within tolerance; largest difference 0.00% | 8 of 8 within tolerance; largest difference 0.00% | pass | pass | see per-density table |
| T1.3 | Ring, one lane: capacity | 2,315.7 veh/h | 3%, both | 2,315.7 ± 0.0 veh/h (-0.00%) | 2,315.7 ± 0.0 veh/h (-0.00%) | pass | pass | +0.0000% |
| T1.4 | Ring, 2 lanes: capacity per lane | the other engine | 10% between the engines | 2,315.7 ± 0.0 veh/h | 2,315.7 ± 0.0 veh/h | between engines | between engines | +0.00%: pass |
| T1.4 | Ring, 3 lanes: capacity per lane | the other engine | 10% between the engines | 2,315.7 ± 0.0 veh/h | 2,315.7 ± 0.0 veh/h | between engines | between engines | +0.00%: pass |
| T1.5 | Lane drop 3 to 2, demand above capacity: discharge flow downstream | the other engine | 10% between the engines | 2,465.8 ± 129.3 veh/h; **flagged**: 240 stuck vehicles per run | 3,640.0 ± 22.9 veh/h | between engines | between engines | -32.26%: **FAIL** |

### Stuck vehicles, teleports and collisions, per test (fairness rule 7)

A run with any stuck vehicle or teleport is flagged. Our engine has no forced release at this commit and reports no such
count, so stuck vehicles are counted from outside: a vehicle, other than one placed as stationary, that stood still for
300 s or more, which is the wait after which SUMO teleports by default. SUMO ran with `--time-to-teleport 300` and
`--collision.action warn`, and its own statistics give the counts.

| Test | Our runs | Our stuck vehicles | SUMO runs | SUMO teleports | SUMO collisions | SUMO emergency braking | SUMO warnings |
|---|---|---|---|---|---|---|---|
| Tier 0 scenarios | 60 | 1359 (in 7 runs) **flagged** | - | - | - | - | - |
| T1.1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| T1.2 (part) | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| T1.3 | 150 | 0 | 150 | 0 | 0 | 0 | 0 |
| T1.4 (3 lanes) | 150 | 0 | 150 | 0 | 0 | 0 | 0 |
| T1.4 (2 lanes) | 150 | 0 | 150 | 0 | 0 | 0 | 0 |
| T1.5 | 10 | 2404 (in 10 runs) **flagged** | 10 | 0 | 0 | 0 | 0 |
| Open road (capacity per lane) | 240 | 0 | - | - | - | - | - |
| T1.2 | - | not runnable | 1 | 0 | 0 | 0 | 0 |
| T1.3, true ring | - | not runnable | 150 | 0 | 0 | 0 | 0 |
| T1.4 (3 lanes), true ring | - | not runnable | 150 | 0 | 0 | 0 | 0 |
| T1.4 (2 lanes), true ring | - | not runnable | 150 | 0 | 0 | 0 | 0 |

## Findings

Written by hand against the run of 2026-11-12. If the tables in this document are rebuilt from a later run, re-read
this section against them.

**Where the two engines are the same model, they agree with each other and with the reference.** In T1.1, in the part of
T1.2 our engine can run, and in T1.3, our engine and SUMO differ from each other only in the last digits SUMO prints.
Both reach 95% of desired speed 0.86% sooner than the 0.001 s reference, which is the error of a 0.2 s step. On the
one-lane ring both sit on the equilibrium curve throughout the stable range, and both have the reference's capacity.
Above the stable range both engines give the same flow as each other, 2% to 14% below the ring integrated at 0.001 s:
within the 600 s of a run the stop-and-go waves grow further at the 0.2 s step than at 0.001 s.

**T1.2 could not be run on our engine.** Its interface has no vehicle with a prescribed speed. SUMO passes it. The part
our engine can run (a leader that brakes to a stop behind a stationary car, with no restart) agrees with the reference
to about 0.01 m/s, but it is not the standard's test and carries no verdict.

**T1.4 passes, and says less than it seems to.** Every lane starts with the same number of cars, so up to 80 veh/km per
lane no car in our engine changes lane and each lane behaves as the one-lane ring. SUMO moves its cars to the kerb lane
when traffic is light, which lowers its flow per lane at 10 and 20 veh/km by 1% to 2%, but not near capacity, so
capacity per lane is the same in both engines for 1, 2 and 3 lanes. Cars-only capacity per lane does not fall as lanes
are added, on the ring or on the open road. In stop-and-go traffic (90 veh/km and above) our cars do change lane, and
our flow per lane is then lower than SUMO's, by up to 8% at 100 veh/km on three lanes: the same lane-change cost that
shows on the open road below. Those densities are outside the stable range and carry no verdict.

**T1.5 fails, and every run of our engine is flagged for stuck vehicles.** Our discharge flow past the lane drop is about
a third below SUMO's, against a tolerance of 10%. What can be seen from outside the engine: cars in the lane that is
closed ahead drive up to the stationary cars and stop; by the end of the warm-up that lane holds a standing queue of
about 160 cars and the two open lanes upstream of the closure have slowed to about 3 m/s. Many of the queued cars stand
for more than 300 s, which is what the stuck count shows. Over the run cars move over in some 17,000 lane changes, and
the two open lanes carry between them little more than one lane's capacity. No SUMO car was teleported. Two
cautions. Our lane drop is a lane filled with stationary cars, the only way the engine's interface can express one; it
may be harsher than a real lane drop will be once the engine has one. And SUMO's own figure depends on how entering
traffic is configured: with `departSpeed="max"` SUMO lets in too few cars to load the drop at all, and its lower figure
then measures its insertion, not the lane drop.

**Capacity per lane on the open road: the fall is real, it needs mixed vehicle classes, and it tracks lane changing.**
The orchestrator's observation is reproduced: with the Bengaluru vehicle mix, lane discipline on and saturating demand,
vehicles through per lane fall as lanes are added. With one vehicle class it does not happen: cars, auto-rickshaws and
buses each carry the same per lane on 1, 2 and 3 lanes, with no lane change at all. (Two-wheelers alone on 2 or 3 lanes
are limited by the demand of 12,000/h, not by the road, so those rows say nothing about capacity.) What the measurements
show about the mix:

- With one lane there are no lane changes; with two and three there are thousands, and throughput per lane and mean
  speed fall as their number rises.
- A lane change in our engine takes several seconds (the lane width at the vehicle class's sideways speed cap), and the
  snapshots show the vehicle between the two lanes for all of that time. With three lanes, vehicles spend about a
  seventh of their time between lanes.
- Making a lane change take longer (wider lanes, same number of lanes) lowers throughput further; making it shorter
  (2.5 m lanes) raises it.
- Giving every class the same desired speed (a speed limit at the slowest class's desired speed) removes most of the
  lane changes and most of the fall.

So the cause, as far as it can be seen from outside, is the cost of lane changes between classes that want different
speeds: each change holds two lanes for several seconds, and with more lanes there are many more changes. This has not
been confirmed inside the engine, and the measurements do not say how much of the remaining fall comes from how
vehicles are let onto the road. Whether it is a defect is a modelling question: a real lane change also takes seconds,
but a real vehicle does not block both lanes for all of them. SUMO, without its sublane model, changes lane within one
step.

**Tier 0 holds everywhere it was checked.** No lost vehicle, no overlap, no negative speed, no vehicle outside its road,
and identical repeats, over every run in this document, mixed traffic included. The engine has no forced release yet,
so the stuck vehicles above stay stuck; they are counted here from outside.

## Details

### Tier 0

The Tier 0 checks are the benchmark's own (they read only snapshots and results) and ran on every step of every run of
our engine in this document: 762 runs, 6,331,562 steps. T0.3 ran on the scenarios below, each
run twice per seed for 1800 simulated seconds and compared step by step.

| Scenario | Seeds | Steps checked | T0.1 violations | T0.2 overlaps | T0.3 identical | T0.4 violations | Stuck vehicles |
|---|---|---|---|---|---|---|---|
| one-road example (cars, 1,200/h) | 10 | 90,010 | 0 | 0 | 10 of 10 | 0 | 0 |
| mixed-traffic example (4 classes, 6,000/h, mixed traffic) | 10 | 90,010 | 0 | 0 | 10 of 10 | 0 | 0 |
| mixed-traffic example, lane discipline on | 10 | 90,010 | 0 | 0 | 10 of 10 | 0 | 0 |
| saturated mixed traffic (12,000/h, 500 m x 10.5 m) with a stationary car | 10 | 90,010 | 0 | 0 | 10 of 10 | 0 | 0 |
| saturated, lane discipline on, with a stationary car | 10 | 90,010 | 0 | 0 | 10 of 10 | 0 | 0 |
| lane closed by stationary cars (the T1.5 road) | 10 | 90,010 | 0 | 0 | 10 of 10 | 0 | 1359 |

SUMO's side of Tier 0 is only partly checked, from what SUMO writes: collisions from its statistics (T0.2), a repeated
run compared by its output (T0.3), counts at 600 s intervals in the T1.5 runs (T0.1), and the speeds of recorded cars
(T0.4).

### T1.1 One car accelerates from rest

One car at rest on an empty 1 km road with a 15 m/s limit. The time at which its speed reaches
14.25 m/s is read from the speeds at each 0.2 s step by linear interpolation. Not
stochastic; one run per engine.

### T1.2 One car follows a leader with a fixed speed profile

Profile: cruise at 12 m/s for 30 s, brake at 1.5 m/s² to a stop,
stand 15 s, restart at 1 m/s² back to 12 m/s, cruise 25 s.
The follower starts at its equilibrium gap. Not stochastic.

**Our engine: not runnable yet.** The engine's public interface has no vehicle with a prescribed speed. A vehicle is
either stationary for the whole run or driven by the engine's own following rule, and nothing in the interface removes
an obstacle during a run, so a leader cannot be made to stop and restart. SUMO ran the test as written, the leader's
speed being set at every step through SUMO's control interface (libsumo); the leader reproduced the profile to 3.3e-16 m/s RMSE.

**The part our engine can run (not the standard's T1.2; no pass line).** The leader's profile is produced by the model
instead of being prescribed: it starts at its desired speed and brakes to a stop behind a stationary car 800 m ahead;
the follower follows it; 120 s; there is no restart. The reference is the same three cars integrated at
0.001 s. Speed RMSE is against the reference, sampled every step.

| Car | Our speed RMSE | SUMO speed RMSE | Reference minimum gap | Our minimum gap | SUMO minimum gap |
|---|---|---|---|---|---|
| Leader (stops behind the stationary car) | 0.0065 m/s | 0.0065 m/s | 1.724 m | 1.743 m | 1.741 m |
| Follower | 0.0099 m/s | 0.0098 m/s | 1.705 m | 1.727 m | 1.727 m |

### T1.3 Ring road, 1 km, one lane

Each run: 600 s, flow measured over the last 300 s as density times the mean speed of the
cars of one lap. Cars start evenly spaced at the equilibrium speed, each moved by a random share (up to ±10%) of its
spare gap; the seed sets those moves. The engines themselves use no random numbers in this test.

**How the ring is run.** Our engine cannot express a ring road: a road's end does not join its start, and a route is one
road. The ring is instead laid out on a long straight road as the same 1 km of cars repeated many times. A car in one
copy has in front of it exactly what it would have on the ring, for as long as the copy ahead still behaves as a ring;
only the first copy has open road ahead, and that difference travels back by at most one vehicle per step. With at least
as many cars ahead per lane as the run has steps (3000), the measured copy is a ring for the whole run. For more
than one lane the same number of cars is placed behind as well, since a car looks behind before changing lane. Both
engines are given this identical road (3,030 to 20,280 cars). Two checks of the method, over all densities and seeds:

| Lanes | Ours: largest difference between two neighbouring copies | SUMO: the same | SUMO: largest difference between this road and a true 1 km ring |
|---|---|---|---|
| 1 | +0.0000% | +0.0000% | +0.0139% |
| 2 | +0.0000% | +0.0000% | +0.3166% |
| 3 | +0.0000% | +0.0000% | +0.2852% |

**Stable range.** The standard does not define it. Here it is the densities at which uniform flow is linearly
string-stable in the continuous model (computed from the reference equations): 10, 20, 30, 40, 50, 60, 62, 70 veh/km.
Outside it the flow depends on how far stop-and-go waves have grown in the run, and the rows are reported without a
pass line. "Reference ring" is the ring integrated at 0.001 s from the same starting positions, mean over seeds.

| Density (veh/km) | Stable | Equilibrium flow (veh/h) | Reference ring at 0.001 s (veh/h) | Ours (veh/h) | SUMO (veh/h) | Ours | SUMO | Ours against SUMO |
|---|---|---|---|---|---|---|---|---|
| 10 | yes | 537.1 | 537.1 ± 0.0 | 537.1 ± 0.0 (-0.00%) | 537.1 ± 0.0 (-0.00%) | pass | pass | -0.00% |
| 20 | yes | 1,054.7 | 1,054.7 ± 0.0 | 1,054.7 ± 0.0 (-0.00%) | 1,054.7 ± 0.0 (-0.00%) | pass | pass | +0.00% |
| 30 | yes | 1,526.5 | 1,526.5 ± 0.0 | 1,526.5 ± 0.0 (-0.00%) | 1,526.5 ± 0.0 (-0.00%) | pass | pass | -0.00% |
| 40 | yes | 1,918.5 | 1,918.5 ± 0.0 | 1,918.5 ± 0.0 (-0.00%) | 1,918.5 ± 0.0 (-0.00%) | pass | pass | -0.00% |
| 50 | yes | 2,191.2 | 2,191.2 ± 0.0 | 2,191.2 ± 0.0 (-0.00%) | 2,191.2 ± 0.0 (-0.00%) | pass | pass | -0.00% |
| 60 | yes | 2,311.2 | 2,311.2 ± 0.0 | 2,311.2 ± 0.0 (-0.00%) | 2,311.2 ± 0.0 (-0.00%) | pass | pass | +0.00% |
| 62 | yes | 2,315.7 | 2,315.7 ± 0.0 | 2,315.7 ± 0.0 (-0.00%) | 2,315.7 ± 0.0 (-0.00%) | pass | pass | +0.00% |
| 70 | yes | 2,273.2 | 2,273.2 ± 0.0 | 2,273.2 ± 0.0 (-0.00%) | 2,273.2 ± 0.0 (-0.00%) | pass | pass | +0.00% |
| 80 | no | 2,111.6 | 2,111.6 ± 0.0 | 2,111.6 ± 0.0 (-0.00%) | 2,111.6 ± 0.0 (-0.00%) | report only | report only | -0.00% |
| 90 | no | 1,877.6 | 1,872.0 ± 3.1 | 1,840.1 ± 20.6 (-2.00%) | 1,840.1 ± 20.6 (-2.00%) | report only | report only | +0.00% |
| 100 | no | 1,610.0 | 1,093.8 ± 46.3 | 939.6 ± 24.0 (-41.64%) | 939.3 ± 24.0 (-41.66%) | report only | report only | +0.03% |
| 110 | no | 1,329.1 | 761.2 ± 1.5 | 732.8 ± 0.0 (-44.87%) | 732.4 ± 0.0 (-44.90%) | report only | report only | +0.05% |
| 120 | no | 1,043.3 | 619.1 ± 0.0 | 594.8 ± 0.0 (-42.98%) | 594.6 ± 0.0 (-43.01%) | report only | report only | +0.04% |
| 130 | no | 755.9 | 477.7 ± 0.3 | 456.6 ± 0.1 (-39.59%) | 456.7 ± 0.1 (-39.58%) | report only | report only | -0.02% |
| 140 | no | 468.0 | 334.8 ± 0.5 | 318.2 ± 0.4 (-32.02%) | 318.3 ± 0.3 (-31.99%) | report only | report only | -0.03% |

**Capacity** is the highest flow over the tested densities, taken per seed. The reference is the highest equilibrium
flow over the same densities (2,315.7 veh/h); the peak of the continuous curve is 2,315.8 veh/h at
62.4 veh/km.

### T1.4 The same ring with 2 and 3 lanes

Density is per lane; every lane starts with the same number of cars, staggered against each other. Capacity per lane is
the highest flow per lane over the tested densities, per seed. "SUMO true ring" is SUMO on a real 1 km ring with the
same cars.

| Lanes | Ours: capacity per lane (veh/h) | SUMO: capacity per lane (veh/h) | SUMO true ring (veh/h) | Ours against SUMO | Within 10% |
|---|---|---|---|---|---|
| 1 | 2,315.7 ± 0.0 | 2,315.7 ± 0.0 | 2,315.7 ± 0.0 | +0.00% | (T1.3) |
| 2 | 2,315.7 ± 0.0 | 2,315.7 ± 0.0 | 2,315.7 ± 0.0 | +0.00% | pass |
| 3 | 2,315.7 ± 0.0 | 2,315.7 ± 0.0 | 2,315.7 ± 0.0 | +0.00% | pass |

Flow per lane at each density, 2 lanes ("between lanes" is the share of our cars' time spent changing lane):

| Density per lane (veh/km) | Equilibrium (veh/h) | Ours (veh/h per lane) | SUMO (veh/h per lane) | Ours against SUMO | Ours between lanes |
|---|---|---|---|---|---|
| 10 | 537.1 | 537.1 ± 0.0 | 531.5 ± 2.9 | +1.06% | 0.00% |
| 20 | 1,054.7 | 1,054.7 ± 0.0 | 1,051.9 ± 4.2 | +0.26% | 0.00% |
| 30 | 1,526.5 | 1,526.5 ± 0.0 | 1,526.5 ± 0.0 | +0.00% | 0.00% |
| 40 | 1,918.5 | 1,918.5 ± 0.0 | 1,918.5 ± 0.0 | -0.00% | 0.00% |
| 50 | 2,191.2 | 2,191.2 ± 0.0 | 2,191.2 ± 0.0 | +0.00% | 0.00% |
| 60 | 2,311.2 | 2,311.2 ± 0.0 | 2,311.2 ± 0.0 | -0.00% | 0.00% |
| 62 | 2,315.7 | 2,315.7 ± 0.0 | 2,315.7 ± 0.0 | +0.00% | 0.00% |
| 70 | 2,273.2 | 2,273.2 ± 0.0 | 2,273.2 ± 0.0 | +0.00% | 0.00% |
| 80 | 2,111.6 | 2,111.6 ± 0.0 | 2,111.6 ± 0.0 | +0.00% | 0.00% |
| 90 | 1,877.6 | 1,846.7 ± 14.1 | 1,847.0 ± 13.8 | -0.02% | 0.02% |
| 100 | 1,610.0 | 943.2 ± 22.4 | 969.2 ± 23.0 | -2.69% | 1.37% |
| 110 | 1,329.1 | 718.6 ± 14.0 | 732.4 ± 0.1 | -1.89% | 0.94% |
| 120 | 1,043.3 | 594.1 ± 3.1 | 594.6 ± 0.0 | -0.08% | 0.07% |
| 130 | 755.9 | 456.7 ± 0.1 | 456.8 ± 0.1 | -0.01% | 0.00% |
| 140 | 468.0 | 317.8 ± 0.2 | 317.9 ± 0.2 | -0.05% | 0.00% |

3 lanes:

| Density per lane (veh/km) | Equilibrium (veh/h) | Ours (veh/h per lane) | SUMO (veh/h per lane) | Ours against SUMO | Ours between lanes |
|---|---|---|---|---|---|
| 10 | 537.1 | 537.1 ± 0.0 | 526.2 ± 1.0 | +2.07% | 0.00% |
| 20 | 1,054.7 | 1,054.7 ± 0.0 | 1,044.0 ± 8.2 | +1.02% | 0.00% |
| 30 | 1,526.5 | 1,526.5 ± 0.0 | 1,526.5 ± 0.0 | +0.00% | 0.00% |
| 40 | 1,918.5 | 1,918.5 ± 0.0 | 1,918.5 ± 0.0 | +0.00% | 0.00% |
| 50 | 2,191.2 | 2,191.2 ± 0.0 | 2,191.2 ± 0.0 | +0.00% | 0.00% |
| 60 | 2,311.2 | 2,311.2 ± 0.0 | 2,311.2 ± 0.0 | +0.00% | 0.00% |
| 62 | 2,315.7 | 2,315.7 ± 0.0 | 2,315.7 ± 0.0 | +0.00% | 0.00% |
| 70 | 2,273.2 | 2,273.2 ± 0.0 | 2,273.2 ± 0.0 | -0.00% | 0.00% |
| 80 | 2,111.6 | 2,111.6 ± 0.0 | 2,111.6 ± 0.0 | -0.00% | 0.00% |
| 90 | 1,877.6 | 1,842.8 ± 12.7 | 1,843.5 ± 12.0 | -0.03% | 0.03% |
| 100 | 1,610.0 | 863.8 ± 18.0 | 940.5 ± 20.1 | -8.15% | 3.59% |
| 110 | 1,329.1 | 713.0 ± 12.2 | 732.3 ± 0.0 | -2.65% | 1.48% |
| 120 | 1,043.3 | 582.7 ± 12.1 | 594.6 ± 0.0 | -2.00% | 0.57% |
| 130 | 755.9 | 456.7 ± 0.1 | 456.7 ± 0.1 | -0.01% | 0.00% |
| 140 | 468.0 | 317.9 ± 0.2 | 318.0 ± 0.2 | -0.03% | 0.00% |

### T1.5 Lane drop, 3 lanes to 2

A 3000 m road with 3 lanes; lane 2 (the one furthest from the kerb) ends at 2000 m. Demand 6,000 cars/h
(two lanes' equilibrium capacity is 4,632). Discharge flow is the cars leaving the end of the road, 1 km
past the drop, over 1800 s after a 600 s warm-up.

- **Our engine** has no road whose lane count changes. The dropped lane is expressed with what the interface has:
  stationary cars filling that lane nose to tail from 2000 m to the end of the road.
- **SUMO** gets a real lane drop: a 3-lane edge joined to a 2-lane edge.
- **Departures** are the same in both: the engine draws them from its seed, the harness reads them back (to the step) from
  the engine's results, and SUMO is given those departure times.

|  | Ours | SUMO (departSpeed avg) | SUMO (departSpeed max, for comparison) |
|---|---|---|---|
| Discharge flow (veh/h) | 2,465.8 ± 129.3 | 3,640.0 ± 22.9 | 2,644.8 ± 3.2 |
| Cars let onto the road in 40 min | 2,109 ± 90 | 2,773 ± 13 | 1,793 ± 13 |
| Our engine at the end of the warm-up: cars standing in the closed lane, upstream of the closure | 157 ± 60 | - | - |
| Our engine at the end of the warm-up: mean speed in the two open lanes, upstream of the closure (m/s) | 2.9 ± 1.3 | - | - |
| Our engine: lane changes started in 40 min | 17,165 ± 2,053 | - | - |
| Stuck vehicles / teleports per run | 240 ± 74 stuck | 0.0 teleports | 0.0 teleports |

### Capacity per lane on an open road (our engine only)

Not a test of the standard: a measurement asked for alongside T1.4. A 500 m road, demand 12,000 vehicles/h (more than
the road can take), lane discipline on, speed limit 13.9 m/s, one simulated hour with no warm-up; vehicles through the
end of the road in that hour, 10 seeds. "At one desired speed" lowers the speed limit to the slowest class's desired
speed so that every class wants the same speed.

| Vehicle mix | Lanes | Lane width (m) | Vehicles through | Per lane | Mean speed (m/s) | Lane changes started | Mean lane change (s) | Vehicle time between lanes |
|---|---|---|---|---|---|---|---|---|
| cars | 1 | 3.5 | 2,221 ± 0 | 2,221 ± 0 | 10.07 | 0 | - | 0.0% |
| cars | 2 | 3.5 | 4,441 ± 1 | 2,220 ± 0 | 10.07 | 0 | - | 0.0% |
| cars | 3 | 3.5 | 6,661 ± 1 | 2,220 ± 0 | 10.07 | 0 | - | 0.0% |
| bengaluru | 1 | 3.5 | 3,574 ± 23 | 3,574 ± 23 | 9.25 | 0 | - | 0.0% |
| bengaluru | 2 | 3.5 | 5,685 ± 50 | 2,843 ± 25 | 9.83 | 4,649 | 3.7 | 5.6% |
| bengaluru | 3 | 3.5 | 6,491 ± 33 | 2,164 ± 11 | 6.44 | 21,394 | 3.7 | 15.0% |
| two-wheeler | 1 | 3.5 | 5,846 ± 1 | 5,846 ± 1 | 9.85 | 0 | - | 0.0% |
| two-wheeler | 2 | 3.5 | 11,648 ± 25 | 5,824 ± 13 | 9.95 | 1 | 3.6 | 0.0% |
| two-wheeler | 3 | 3.5 | 11,886 ± 70 | 3,962 ± 23 | 12.96 | 23 | 3.6 | 0.0% |
| auto-rickshaw | 1 | 3.5 | 1,954 ± 0 | 1,954 ± 0 | 7.49 | 0 | - | 0.0% |
| auto-rickshaw | 2 | 3.5 | 3,908 ± 0 | 1,954 ± 0 | 7.49 | 0 | - | 0.0% |
| auto-rickshaw | 3 | 3.5 | 5,861 ± 1 | 1,954 ± 0 | 7.49 | 0 | - | 0.0% |
| bus | 1 | 3.5 | 1,376 ± 0 | 1,376 ± 0 | 9.33 | 0 | - | 0.0% |
| bus | 2 | 3.5 | 2,752 ± 0 | 1,376 ± 0 | 9.33 | 0 | - | 0.0% |
| bus | 3 | 3.5 | 4,128 ± 0 | 1,376 ± 0 | 9.33 | 0 | - | 0.0% |
| two-wheelers and cars | 1 | 3.5 | 4,142 ± 24 | 4,142 ± 24 | 9.83 | 0 | - | 0.0% |
| two-wheelers and cars | 2 | 3.5 | 7,011 ± 32 | 3,506 ± 16 | 11.63 | 1,037 | 3.7 | 1.2% |
| two-wheelers and cars | 3 | 3.5 | 7,441 ± 158 | 2,480 ± 53 | 8.36 | 14,332 | 3.7 | 11.3% |
| bengaluru at one desired speed | 1 | 3.5 | 3,289 ± 20 | 3,289 ± 20 | 8.13 | 0 | - | 0.0% |
| bengaluru at one desired speed | 2 | 3.5 | 6,019 ± 34 | 3,009 ± 17 | 9.31 | 860 | 3.5 | 0.9% |
| bengaluru at one desired speed | 3 | 3.5 | 8,386 ± 78 | 2,795 ± 26 | 9.52 | 2,651 | 3.6 | 2.0% |
| bengaluru | 3 | 2.5 | 6,925 ± 42 | 2,308 ± 14 | 7.54 | 21,387 | 2.7 | 11.6% |
| bengaluru | 3 | 5.0 | 6,275 ± 51 | 2,092 ± 17 | 6.04 | 19,048 | 5.2 | 18.1% |
| bengaluru | 3 | 7.0 | 6,147 ± 52 | 2,049 ± 17 | 5.90 | 15,680 | 7.1 | 20.7% |

## How SUMO was set up, and where it could not be made identical

Vehicle type given to SUMO, from the engine's assumptions table for the car:

```
<vType id="car" vClass="passenger" carFollowModel="IDM" length="4.4" width="1.9" minGap="2" accel="1" decel="1" tau="0.8" delta="4" stepping="0.2" maxSpeed="15" speedFactor="1" speedDev="0"/>
```

Options: `--step-length 0.2 --step-method.ballistic true --time-to-teleport 300 --collision.action warn`, networks built by
`netconvert --lefthand true`. The generated inputs of five runs are in `packages/benchmark/results/sumo-inputs`.

Made the same:

- **Following rule.** `carFollowModel="IDM"` with accel = a, decel = b, tau = T, minGap = s0, delta = 4. SUMO 1.28's IDM
  (`MSCFModel_IDM.cpp`) uses s* = minGap + max(0, v T + v dv / (2 sqrt(accel decel))), the form the reference uses.
- **Desired speed.** SUMO gives each passenger car its own desired speed by default (`speedFactor` normc(1,0.1,0.2,2));
  set to `speedFactor="1" speedDev="0"`, with `maxSpeed` and the edge speed at the car's desired speed.
- **Update scheme.** SUMO's default is an Euler update (speed constant over a step). `--step-method.ballistic`
  (acceleration constant over a step) is what our engine does, so it is switched on.
- **Internal sub-stepping** (limit 4 in section 6 of the standard). SUMO's IDM iterates round(step-length / stepping)
  times within a step; with `stepping="0.2"` (and with its default of 0.25) that is once at a 0.2 s step, so
  there is no sub-stepping in these runs.
- **Starting state.** Placed cars use `insertionChecks="none"`, so SUMO starts from the identical positions and speeds.

Not identical:

1. **Lane changing.** SUMO uses its LC2013 model with default parameters; ours is a MOBIL-like rule on lanes. SUMO changes
   lane within one step; our cars take several seconds (3.5 m at the sideways speed cap) and occupy both lanes meanwhile.
   In left-hand networks SUMO also moves cars towards the kerb lane when there is room; ours has no such rule. SUMO's
   documentation warns that IDM with default lane-change parameters is conservative in accepting gaps.
2. **Braking limit.** SUMO bounds the braking of a car at `emergencyDecel` (9 m/s² by default) and counts braking
   beyond max(decel, 1.5 m/s²) that it had to apply as emergency braking; ours applies the IDM value unbounded, with its
   own rule that a car never advances further than the clear gap at the start of the step.
3. **Entering traffic (T1.5 only).** The engines decide differently when a waiting car may enter. Ours: the lane with
   the longest clear road, rear bumper at the start, when the gap is at least s0 + v T. SUMO: `departLane="free"
   departPos="base" departSpeed="avg"`, following SUMO's documentation for a high insertion flow. With
   `departSpeed="max"` SUMO lets in so few cars that the lane drop is never loaded above its capacity; that variant is
   shown beside the result.
4. **The lane drop itself (T1.5).** SUMO has a real one, with a short junction (about 9 m of internal lanes); ours is a
   lane filled with stationary cars. SUMO's network says that the lane does not continue, and its lane-change model can
   act on that; our cars meet the stationary cars as an obstacle and nothing tells them of it before.
5. **Stuck vehicles.** SUMO teleports a vehicle after 300 s of waiting; ours has no forced release yet, so a stuck
   vehicle stays stuck. Both are counted.
6. **The prescribed leader (T1.2)** exists only in SUMO, through libsumo, with the leader's own model switched off
   (speed mode 0).
7. **Departure times** are passed to SUMO to the nearest step (0.2 s), which is also when the engine acts on them.

## Tests that could not be run as written

| Test | Engine | What was done instead | Why |
|---|---|---|---|
| T1.2 | ours | Not run. A part of it (no restart, leader not prescribed) is reported without a pass line. | No vehicle with a prescribed speed in the engine's public interface. |
| T1.3, T1.4 | both | A long periodic road that is provably, and by measurement, the same as the ring; SUMO also on a true ring. | The engine has no ring road. |
| T1.5 | ours | The dropped lane is filled with stationary cars. | The engine has no road whose lane count changes. |
| T0.1, T0.4 | SUMO | Partly checked from SUMO's own outputs. | The standard does not say Tier 0 applies to SUMO; it is given for information. |

## Proposed amendments to the standard

None has been applied; section 7 of the standard is unchanged. These are proposals, dated 2026-11-12, for whoever owns the
standard. No tolerance change is proposed.

1. **T1.3 and T1.4, the ring.** State that the ring may be run as a long periodic road (the 1 km pattern repeated, with
   at least one car ahead per lane per simulated step, and as many behind when there is more than one lane) until the
   engine has ring roads, and that SUMO is then given the same road and is also checked on a true ring.
2. **T1.3, "stable range".** Define it: the densities at which uniform flow is linearly string-stable for the reference
   model and parameters. With the car's current assumptions that is up to about 70 veh/km.
3. **T1.3, the densities and the run.** Fix the list of densities (here 10 to 140 in tens, plus 62), the run length
   (600 s), the measuring time (last 300 s), the starting state and that capacity is the highest flow over the
   listed densities, compared with the equilibrium curve over the same densities.
4. **T1.2.** Either add a vehicle with a prescribed speed profile to the engine's interface, or state that until then
   T1.2 is "not runnable" for our engine. Fix the profile (the one used here is in this document).
5. **T1.5.** Fix the geometry, the demand, the measuring point and time, and how entering traffic is configured in SUMO
   (`departLane`, `departPos`, `departSpeed`), since the result depends on it. State whether a lane closed by stationary
   vehicles is an acceptable stand-in for a lane drop until the engine has one.
6. **Fairness rule 2, update scheme.** Add that SUMO runs with `--step-method.ballistic`, the scheme our engine uses,
   and with `speedFactor="1" speedDev="0"`.
7. **Fairness rule 7.** Our engine has no forced release yet. Define a stuck vehicle for our engine as one standing for
   300 s (SUMO's teleport time), counted from outside, until the engine reports its own count.
8. **Tier 0 and SUMO.** State whether Tier 0 is scored for SUMO; if so, which SUMO outputs count as the check.

## How to run it again

```sh
pnpm install
sh packages/benchmark/scripts/install-sumo.sh           # SUMO 1.28.0 into ~/.cache/traffic-simulator, outside the repo; needs uv
pnpm --filter @traffic-simulator/benchmark bench        # everything; writes results/raw and this document
pnpm --filter @traffic-simulator/benchmark bench --report-only   # rebuild this document from results/raw
```

The benchmark is not part of `pnpm test`. Options: `--jobs N` (parallel processes), `--only <kind or job id>`,
`--no-sumo`, `--fresh` (ignore finished jobs kept in `.work`), `--keep-work` (keep SUMO's files), `--date`.
Without SUMO installed the engine and reference parts still run and SUMO's columns read "not run".
