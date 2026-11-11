# 19: Benchmark tiers 2 to 5

**What to build:** A reviewer can see the junction, network, Indian field-data and speed comparisons between the engine and SUMO, reported pass or fail, including where the engine does worse.

**Blocked by:** 06, 07, 08, 18

**Status:** ready-for-agent

- [ ] Tier 2 and tier 3 tests run for both engines and are recorded
- [ ] The Chennai dataset is fetched by a script and is not committed; its field figures are confirmed from the data
- [ ] Tier 4 tests score both engines against field data and Indian standards, and state which is closer per row
- [ ] SUMO is set up for mixed traffic in good faith, per its own documentation, with equal tuning effort
- [ ] Tier 5 speed, memory and feature coverage are reported
- [ ] Stuck vehicles and SUMO teleports are counted in every test
- [ ] The results are compared with the expected outcome written in advance
