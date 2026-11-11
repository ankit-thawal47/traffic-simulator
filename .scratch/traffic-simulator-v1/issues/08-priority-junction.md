# 08: Priority junction

**What to build:** A planner watches a junction with no signal: main-road traffic goes first, and side-road traffic waits for a large enough gap, with smaller vehicle classes accepting smaller gaps.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] A network can contain a priority junction with a main road and a side road
- [ ] Side-road vehicles enter only when the gap in main-road traffic is at least their accepted gap
- [ ] Accepted gaps differ by vehicle class and come from the assumptions table
- [ ] Side-road throughput falls as main-road flow rises
- [ ] Consistency checks pass on the priority junction test scenario
