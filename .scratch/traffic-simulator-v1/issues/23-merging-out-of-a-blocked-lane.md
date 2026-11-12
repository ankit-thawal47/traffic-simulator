# 23: Merging out of a blocked lane

**What to build:** When a lane is blocked ahead (a closure, a lane drop, the end of a merge), vehicles queued in it get into the flowing lanes beside them instead of standing indefinitely, and the road discharges at a rate close to what the open lanes can carry. Found by benchmark test T1.5 (`docs/benchmark-results-2026-11-12.md`): with three lanes and one closed, our engine discharged 2,466 vehicles an hour against SUMO's 3,640 (32% low), with about 240 vehicles per run standing for five minutes or more; SUMO had none. The same family of behaviour lowers capacity per lane when vehicle classes with different desired speeds share several lanes (each lane change holds two lanes for about 3.7 s).

**Blocked by:** 07 (the flyover's ramp merge is the same situation; build on whatever merge rule it lands)

**Status:** partly done (merged: no stuck vehicles, T1.5 improved from -32% to -19.5% of SUMO; still outside the 10% tolerance; ring tests not fully re-run)

- [x] The cause is established inside the engine, with evidence, before anything is changed
- [x] Benchmark test T1.5 is re-run with ten seeds; discharge is within 10% of SUMO's, or the remaining difference is reported with its cause
- [x] No vehicle stands for 300 s or more in the T1.5 scenario or in the Tier 0 "lane closed" scenario
- [x] Capacity per lane with the Bengaluru vehicle mix and lane discipline on is re-measured for 1, 2 and 3 lanes and reported
- [ ] Tier 0 and the rest of Tier 1 are re-run and still pass; no tolerance is changed
  (Not fully: Tier 0, T1.1, the T1.2 part and the open road were re-run and pass or are identical; the 450 ring jobs of T1.3/T1.4 were not, only 6 of them, identical. See docs/benchmark-results-2026-11-12-after-ticket-23.md.)
- [x] Any new rule or constant is in the assumptions table as our choice, with the reason
- [x] Consistency checks pass at saturating demand, several seeds, a simulated hour
