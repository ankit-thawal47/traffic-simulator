/**
 * What the run of 2026-11-12 after ticket 23 showed, written by hand after
 * reading its tables. report.ts includes this text as it is. It is prose about
 * one run: if the tables are rebuilt from a later run, re-read it against them.
 * The findings of the first run are in docs/benchmark-results-2026-11-12.md.
 */
export const FINDINGS = `
Written by hand against the run described here. If the tables in this document are rebuilt from a later run, re-read
this section against them. The first run, of the engine before ticket 23, is in
[benchmark-results-2026-11-12.md](benchmark-results-2026-11-12.md); its findings are not repeated here except where
they changed.

**What was run again, and what was carried over.** Ticket 23 added one rule to the engine (leaving a blocked strip) and
changed how giving way is weighed. On the changed engine these kinds of job were run again in full, ten seeds each: all
of Tier 0 (60 runs), T1.1, the part of T1.2 our engine can run, T1.5 (both engines), and the open road (240 runs). The
ring runs of T1.3 and T1.4 (450 jobs) and SUMO's T1.2 were **not** run again: their rows and tables here are those of
the first run, on the engine as of commit 706f72f. The ring has no stationary vehicle and no junction, so the new rule
has nothing to act on there; six ring jobs were run again on the changed engine to check that (one lane at 62 veh/km
seed 1; two lanes at 30 seed 3 and 90 seed 1; three lanes at 60 seed 1, 100 seed 1 and 140 seed 2, without SUMO) and
our engine's figures were identical to the first run's in all six.

**T1.5 still fails, by less, and no vehicle is stuck.** Our discharge flow past the closed lane rose from 2,466 to
2,929 veh/h; SUMO's is 3,640, so the difference went from 32% to 20%, against a tolerance of 10%. In the first run every
run of our engine had stuck vehicles (about 240 a run stood 300 s or more); now none does, in any of the ten seeds. Lane
changes fell from about 17,000 a run to about 4,300.

What was found inside the engine before it was changed (seed 1, the 1,800 s measured):

- A car standing in the closed lane within 500 m of the closure tried to move over on every step and was given the
  space on 0.46% of them. On 45% a car was alongside in the next lane; on 49% the car behind in the next lane would
  have had to brake harder than the safe limit, and nothing made that car hold back; on 6% the place was no better.
- Of the changes that did happen in the last kilometre before the closure, 4,000 were out of the closed lane and 3,552
  were into it: cars in the queued open lane moved into any gap in the closed lane and had to come out again. Three in
  four changes began from a stand.
- A lane change takes 5.8 s (3.5 m at the car's sideways speed cap of 0.6 m/s), the car occupies both lanes for all of
  it, and a car that starts from a stand behind another does not move forward during it. With lane changes made
  instant, as an experiment, the same road discharged 4,390 veh/h, and 444 cars were stuck: the two open lanes then ran
  freely at about 2,200 each, past a closed lane nobody could leave.
- The rule that puts entering cars on the road was not the cause: it fed the three lanes about equally, and the cars
  let in matched the cars discharged.

What the rule does: within 200 m of a stationary vehicle in its lane, a vehicle counts moving to the nearest clear
lane as a gain, slows comfortably to fall in behind the vehicle it would follow there, and is given way to once it has
slowed to queue speed; no vehicle moves into a lane that is blocked within 200 m.

Why 20% remains. A car that reaches the queue in the closed lane, or the closure itself, still moves over from a
stand, and each such move holds the open lane beside it for the 5.8 s of the shift: in the run about 160 cars an hour
reach the last 50 m before the closure still in the closed lane, and about 1,400 an hour begin their move out of it
from a stand, most of them in the queue further back. The open lane beside the closed one carries about 1,150 veh/h at
the closure and the far lane about 1,600; SUMO's two lanes carry 1,820 each. The distance of 200 m is our choice and
was not tuned to this test; the discharge rises slowly with it (mean of seeds 1 and 2: 2,658 at 50 m, 2,881 at 100,
2,915 at 200, 2,993 at 400, 3,099 at 800), and no distance tried came within the tolerance.

How much of the difference is the test and how much the engine. SUMO changes lane within one step. Given a lane change
that takes time (\`--lanechange.duration\`), SUMO on seed 1 discharged 3,662 veh/h at 3 s and 3,364 at 5.8 s, against
3,624 with its default: so a lane change as long as ours costs SUMO about 7%, and our engine (2,880 on that seed) is
14% below SUMO even then. Most of the difference is therefore the engine and not the test. The closed lane being a row of stationary cars
rather than a real lane drop was not separated out: the engine still has no road whose lane count changes.

**Tier 0: the roads with a stationary vehicle carry more; nothing else moved.** The three scenarios without a
stationary vehicle gave results identical to the first run's. With a stationary car on a saturated road, vehicles
through in 30 minutes rose from 2,408 to 3,170 in mixed traffic and from 1,112 to 2,249 with lane discipline on. On the
T1.5 road, 7 of 10 seeds had stuck vehicles in the first run and none has now. No lost vehicle, no overlap, no negative
speed, no vehicle outside its road, and identical repeats, in every run.

**Capacity per lane on the open road is unchanged, to the last digit.** All 240 open-road runs gave results identical
to the first run's: with the Bengaluru vehicle mix and lane discipline on, 3,574, 2,843 and 2,164 vehicles per lane on
1, 2 and 3 lanes; cars alone 2,221, 2,220 and 2,220. The rule acts only where a stationary vehicle is ahead, and these
roads have none. The first run's account of this fall stands (lane changes between vehicle classes that want different
speeds, each holding two lanes for several seconds), and ticket 23 did not address it; what was found inside the engine
on the T1.5 road (changes that begin from a stand, in queued traffic, for the sake of a few metres) is the same cost.

**T1.1, the part of T1.2 our engine can run, T1.3 and T1.4** are as in the first run: T1.1 and the T1.2 part were run
again and are identical; T1.3 and T1.4 are carried over, as said above.
`;
