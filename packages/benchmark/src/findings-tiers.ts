/**
 * What the runs of Tiers 2 to 5 showed, written by hand after reading their tables: as of the re-run of Tiers 2, 3 and T4.6
 * after ticket 24 (the first run's findings alone are in docs/benchmark-results-2026-11-12-tiers-2-to-5.md).
 * report-tiers.ts includes these texts as they are. If the tables are rebuilt from a later run,
 * re-read them against it.
 */
export const RUNS_NOTE = `
Two runs are in this document. The first (dates 2026-11-12, engine \`6c2bc94\`) ran every part; the parts marked "uncommitted
changes" ran from the working tree before its harness was committed, and the jobs' code that ran is that of commit \`4838f76\`.
The second (date 2026-11-12-after-ticket-24, engine \`34ef8ee\`) re-ran T2.1 to T2.4, Tier 3 and T4.6 for both engines after
ticket 24 changed how turning traffic is let into junctions; "uncommitted changes" there are measurement scripts outside the
engine and the harness. Every row of T2.1 to T2.4, Tier 3 and T4.6 is from the second run; T4.1 to T4.5 and Tier 5 are still
from the first. SUMO and its inputs are the same in both. Machine time of the second run: about 4 minutes of wall clock at six
processes.
`;

export const FINDINGS_TIERS = `
Written by hand against the runs described here. If the tables are rebuilt from a later run, re-read this section against them.
The findings of the first run alone are in [benchmark-results-2026-11-12-tiers-2-to-5.md](benchmark-results-2026-11-12-tiers-2-to-5.md).

**What changed between the runs (ticket 24).** Two rules in the engine, after measuring where discharge was lost at a saturated
four-way junction and beneath the flyover (the measurements are in ticket 24). (1) Turning lanes: on an approach that also goes
straight on, a turn leaves from the half of the lanes on its own side (\`turnLaneShare\` 0.5; straight on from any lane). Before,
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
On the same set-up in the engine's own test fixture (\`packages/engine/perf/t24-standing.ts\`, seeds 1 to 10), the
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
`;

export const NOT_IDENTICAL = `
1. **Entering traffic.** Ours puts a vehicle in the place with the longest clear road ahead (nearest the middle of equals),
   rear bumper at the start, when it has its desired following gap. SUMO: \`departLane="best"\` (lanes) or one wide lane with
   \`departPosLat="free"\` (mixed traffic), \`departPos="base"\`, \`departSpeed="avg"\`. Departure times are identical; when each
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
   14 m in Tier 5), SL2015 with its default parameters, \`latAlignment="arbitrary"\`, minGapLat = our side clearance and
   maxSpeedLat = our sideways speed cap. The same following rule and values in both.
9. **Position across the road (SUMO's posLat).** In a left-hand network SUMO's posLat is positive towards the right of the
   direction of travel; this was checked on the Tier 4 road before converting (a vehicle with \`departPosLat="left"\` ran at
   posLat +4.65 on the right-hand side).
10. **Junction size.** Each junction's area is SUMO's own, built from where the edges stop; the paths through it are close in
    length to ours (20.00 m against 20 m in T2.1) but not identical in general.
11. **Departure times** are given to SUMO as drawn (to 1 ms); our engine acts on them at the end of the step in which they fall.
`;

export const PROPOSED_AMENDMENTS = `
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
`;
