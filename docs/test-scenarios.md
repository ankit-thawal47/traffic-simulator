# Five test scenarios

Questions a transport researcher would ask of this tool, each with the steps in the
live app and the figures the engine produced when run from the command line on
2026-11-13 (`apps/web/perf/five-scenarios-check.ts`, five seeds, one hour after a
10-minute warm-up, commit 9f0edd6). The app should show the same averages.
All figures are uncalibrated estimates.

## 1. Does a flyover pay off, and how much survives induced demand?

Start from "Signal junction, flyover not yet built". Proposal: build both flyover roads.
Then add "scale all demand" 1.2 to the same proposal.

| | No flyover | Flyover | Flyover, demand +20% |
|---|---|---|---|
| Vehicles through | 3,687 | 4,755 | 5,724 |
| Still waiting to enter | 819 | 0 | 0 |
| Mean car delay | 613 s | 22 s | 23 s |
| Longest queue, south approach | 180 m (full) | 41 m | 54 m |
| Longest queue, west approach (cross road) | 45 m | 46 m | 54 m |

Read: the flyover removes the bottleneck; at +20% demand the cross road starts to
lose. Limits: induced demand is not modelled, only scaled by hand; the junction
without the flyover keeps the flyover's 14 m entry feeding a 7 m road, which is
harsher than a junction designed without one.

## 2. What does weak lane discipline do to capacity?

Start from "One road". Baseline: scale all demand 2. Proposal: lane discipline on.

| | Mixed traffic | Lane discipline |
|---|---|---|
| Vehicles through | 11,938 | 6,675 |
| Still waiting to enter | 104 | 6,197 |
| Mean two-wheeler delay | 26 s | 987 s |

Read: on this road mixed traffic carries 79% more. Limits: our lane changes take
5.8 s and hold two lanes, which depresses lane-discipline capacity (benchmark T1.5,
19.5% below SUMO); part of this gap is the engine, not Indian behaviour.

## 3. Is roadside friction the same as closing a lane?

Start from "One road", demand scale 2. Proposal A: 3.5 m lost to hawkers.
Proposal B: one lane closed.

| | Baseline | A: hawkers 3.5 m | B: one lane closed |
|---|---|---|---|
| Vehicles through | 11,938 | 8,276 | 8,276 |
| Mean car delay | 33 s | 708 s | 708 s |

Read: identical. In mixed traffic the model treats both as 3.5 m less road along its
whole length. Real side friction (stopping, pedestrians, vehicles pulling out) is not
modelled; this scenario shows that limit plainly.

## 4. Retiming a saturated junction: who gains, who pays?

Start from "Four-way signal junction", demand scale 2.5. Proposal: south approach
green 25 s to 40 s, others unchanged.

| | Baseline | South green 40 s |
|---|---|---|
| Longest queue, south | 195 m | 94 m |
| Longest queue, north, east, west | 200 m (full) | 200 m (full) |
| Vehicles through | 4,470 | 4,305 |
| Mean car delay | 349 s | 423 s |

Read: the favoured approach clears, but the longer cycle costs the junction overall.
Limits: queues are capped at the 200 m approach length, so spill-back beyond it is
hidden; signals are fixed-time, not adaptive.

## 5. Hebbal: can retiming fix the Tumkur Road queue?

Start from "Hebbal, city-bound (Bengaluru)". Proposal: signal timing at the Hebbal
junction, phase 2 (Tumkur Road and K.R. Puram) 57 s to 70 s, phase 1 (airport ground
road) 37 s to 24 s.

| | Baseline | Retimed |
|---|---|---|
| Longest queue, Outer Ring Road from Tumkur Road | 300 m (full) | 300 m (full) |
| Longest queue, ground road from the airport | 117 m | 394 m (full) |
| Longest queue, CBI Road junction downstream | 30 m and 51 m | 28 m and 51 m |
| Vehicles through | 5,107 | 5,044 |

Read: no. The Tumkur queue does not respond to green time, so its cause is
elsewhere (the loop, the merge, or the modelled geometry); the airport road pays.
Limits: demand is 30% of the published 2019 counts, widths are assumed, the signal
plan is from 2010, and the plan's per-movement greens are approximated per approach.
