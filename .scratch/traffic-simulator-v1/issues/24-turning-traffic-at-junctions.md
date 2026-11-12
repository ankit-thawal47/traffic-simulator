# 24: Turning traffic at junctions

**What to build:** Signal and priority junctions carry turning traffic at a rate and with delays close to SUMO and the textbook references, and no vehicle waiting at a junction is starved of entry. Found by the benchmark (`docs/benchmark-results-2026-11-12-tiers-2-to-5.md`): Tier 2 signal delay and priority capacity fail; Tier 3 flows, travel times and queues fail at the junction beneath the flyover, where ours carries far less than SUMO and trips take 2 to 3 times longer; ours has stuck vehicles at a saturated four-way junction (T2.4) where SUMO has none. Likely causes reported by earlier tickets: no sorting by turn before the stop line (ticket 04), strict first-come let-in order so turns across oncoming traffic wait for long gaps (ticket 04), and let-in starvation where vehicles from other approaches keep being let in ahead of a waiting one (ticket 06; reproduced on the weaving scenario, seeds 82 and 85, on the engine before filtering).

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] The causes are established inside the engine, with numbers, before anything is changed
- [ ] No vehicle waiting at a junction stands 300 s or more in T2.4 and the weaving scenario, seeds 81 to 86
- [ ] Benchmark Tiers 2 and 3 re-run for both engines; results in a new dated document; each row pass or fail with the remaining gap and its cause
- [ ] Four-way junction throughput does not fall, and Tier 0, Tier 1 and Tier 4 rows involving junctions do not get worse
- [ ] Every new rule or constant is in the assumptions table as our choice, with the reason
- [ ] Consistency checks pass at saturating demand, several seeds, a simulated hour
