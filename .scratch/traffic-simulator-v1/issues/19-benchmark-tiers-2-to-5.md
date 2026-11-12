# 19: Benchmark tiers 2 to 5

**What to build:** A reviewer can see the junction, network, Indian field-data and speed comparisons between the engine and SUMO, reported pass or fail, including where the engine does worse.

**Blocked by:** 06, 07, 08, 18

**Status:** ready-for-agent

- [x] Tier 2 and tier 3 tests run for both engines and are recorded
- [x] The Chennai dataset is fetched by a script and is not committed; its field figures are confirmed from the data
- [x] Tier 4 tests score both engines against field data and Indian standards, and state which is closer per row
- [x] SUMO is set up for mixed traffic in good faith, per its own documentation, with equal tuning effort
- [x] Tier 5 speed, memory and feature coverage are reported
- [ ] Stuck vehicles and SUMO teleports are counted in every test
- [x] The results are compared with the expected outcome written in advance

Notes (2026-11-12, results in `docs/benchmark-results-2026-11-12-tiers-2-to-5.md`):
- Counted in every test of Tiers 2 to 4; the Tier 5 speed runs report the vehicles left at the end (all of them, in both engines) but not stuck vehicles or teleports.
- Tier 5 speed is measured in Node only; the browser worker was not measured.
- T4.1 to T4.4 run with demand at the observed rate, not the observed arrivals (the engine cannot take an arrival schedule); T4.6 runs without filtering (ticket 06 not built). The Indo-HCM values used are secondary.
