# 10: Baseline against proposal

**What to build:** A planner makes a proposal by changing the lanes or width of a road, runs baseline and proposal together, and watches them side by side in two 3D views that share one camera and one clock. Results appear for both, as absolute numbers and as change from the baseline, labelled as an uncalibrated estimate.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A scenario is a versioned description: network, list of changes, demand, seed
- [ ] A proposal starts as a copy of the baseline and differs only by its changes
- [ ] The planner can change the number of lanes or the width of a road
- [ ] Baseline and proposal run together and are shown in two views sharing one camera and one clock
- [ ] Results show each measure for both scenarios, as an absolute number and as a change from the baseline
- [ ] Every result carries the uncalibrated estimate label
- [ ] Narrowing a road lowers its throughput in the results
