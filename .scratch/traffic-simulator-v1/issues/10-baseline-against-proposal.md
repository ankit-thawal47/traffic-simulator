# 10: Baseline against proposal

**What to build:** A planner makes a proposal by changing the lanes or width of a road, runs baseline and proposal together, and watches them side by side in two 3D views that share one camera and one clock. Results appear for both, as absolute numbers and as change from the baseline, labelled as an uncalibrated estimate.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] A scenario is a versioned description: network, list of changes, demand, seed
- [x] A proposal starts as a copy of the baseline and differs only by its changes
- [ ] The planner can change the number of lanes or the width of a road
- [x] Baseline and proposal run together and are shown in two views sharing one camera and one clock
- [x] Results show each measure for both scenarios, as an absolute number and as a change from the baseline
- [x] Every result carries the uncalibrated estimate label
- [ ] Narrowing a road lowers its throughput in the results

**Notes from the implementer:**

- "The planner can change the number of lanes or the width of a road" is left unticked: the width change is built and works in the app; the network has no lane count until ticket 05 adds one, so there is no lanes change yet.
- "Narrowing a road lowers its throughput in the results" is left unticked: with single-file cars on one road, width does not affect flow. The change is applied and both runs are compared; the criterion depends on mixed traffic (ticket 05).
