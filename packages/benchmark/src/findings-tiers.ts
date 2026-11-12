/**
 * What the runs of Tiers 2 to 5 on 2026-11-12 showed, written by hand after reading their tables.
 * report-tiers.ts includes these texts as they are. If the tables are rebuilt from a later run,
 * re-read them against it.
 */
export const FINDINGS_TIERS = `
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
