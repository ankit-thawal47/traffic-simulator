# 18: Benchmark tiers 0 and 1

**What to build:** A reviewer can see how the engine compares with SUMO and with the reference equations on one-road tests, under the rules fixed in the benchmark standard. The results table is committed, including any failures.

**Blocked by:** 05

**Status:** done except T1.2, which cannot run on our engine (merged to integration branch; results in docs/benchmark-results-2026-11-12.md)

- [x] SUMO is installed at a pinned version and runs the same generated network and demand as the engine
- [x] Tier 0 tests run and their results are recorded
- [ ] Tier 1 tests run for the engine and for SUMO against the reference, with ten seeds where the test is stochastic
- [x] Results are written to a committed table, passes and failures alike
- [x] Any tolerance change is made only as a dated amendment in the benchmark standard before re-running
- [x] The benchmark runs as one separate command

**Notes (2026-11-12):** Results are in `docs/benchmark-results-2026-11-12.md`. The third criterion is left unticked: T1.2 cannot be run on our engine (no vehicle with a prescribed speed in its interface); SUMO ran it, and every other Tier 1 test ran on both engines with ten seeds where stochastic. T1.5 fails. No tolerance was changed; proposed amendments are listed in the results document, not applied.
