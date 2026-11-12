/**
 * What the runs of Tiers 2 to 5 on 2026-11-12 showed, written by hand after reading their tables.
 * report-tiers.ts includes these texts as they are. If the tables are rebuilt from a later run,
 * re-read them against it.
 */
export const FINDINGS_TIERS = `
(to be written after the run)
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
