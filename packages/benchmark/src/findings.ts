/**
 * What the run of 2026-11-12 showed, written by hand after reading its
 * tables. report.ts includes this text as it is. It is prose about one run:
 * if the tables are rebuilt from a later run, re-read it against them.
 */
export const FINDINGS = `
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
traffic is configured: with \`departSpeed="max"\` SUMO lets in too few cars to load the drop at all, and its lower figure
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
`;
