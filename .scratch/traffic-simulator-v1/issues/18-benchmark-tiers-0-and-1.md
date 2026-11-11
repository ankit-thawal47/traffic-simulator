# 18: Benchmark tiers 0 and 1

**What to build:** A reviewer can see how the engine compares with SUMO and with the reference equations on one-road tests, under the rules fixed in the benchmark standard. The results table is committed, including any failures.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] SUMO is installed at a pinned version and runs the same generated network and demand as the engine
- [ ] Tier 0 tests run and their results are recorded
- [ ] Tier 1 tests run for the engine and for SUMO against the reference, with ten seeds where the test is stochastic
- [ ] Results are written to a committed table, passes and failures alike
- [ ] Any tolerance change is made only as a dated amendment in the benchmark standard before re-running
- [ ] The benchmark runs as one separate command
