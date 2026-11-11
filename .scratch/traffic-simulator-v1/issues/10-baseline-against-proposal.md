# 10: Baseline against proposal

**What to build:** A planner makes a proposal by changing the lanes or width of a road, runs baseline and proposal together, and watches them side by side in two 3D views that share one camera and one clock. Results appear for both, as absolute numbers and as change from the baseline, labelled as an uncalibrated estimate.

**Blocked by:** 01

**Status:** partly done (5 of 7 criteria merged at 59fba95; the lanes change and "narrowing lowers throughput" wait on ticket 05)

- [x] A scenario is a versioned description: network, list of changes, demand, seed
- [x] A proposal starts as a copy of the baseline and differs only by its changes
- [x] The planner can change the number of lanes or the width of a road
- [x] Baseline and proposal run together and are shown in two views sharing one camera and one clock
- [x] Results show each measure for both scenarios, as an absolute number and as a change from the baseline
- [x] Every result carries the uncalibrated estimate label
- [x] Narrowing a road lowers its throughput in the results

**Notes from the implementer:**

- "The planner can change the number of lanes or the width of a road" is left unticked: the width change is built and works in the app; the network has no lane count until ticket 05 adds one, so there is no lanes change yet.
- "Narrowing a road lowers its throughput in the results" is left unticked: with single-file cars on one road, width does not affect flow. The change is applied and both runs are compared; the criterion depends on mixed traffic (ticket 05).

**Notes from the implementer of ticket 13, who finished the two criteria above:**

- The lanes change (`road-lanes`) is in the scenario package and has a control in the app. Lanes and width are independent. With lane discipline off, as the app runs today, mixed traffic takes no notice of lanes, so a lanes change does not alter the estimate; the control says so. It takes effect with lane discipline on, which has no planner-facing switch until ticket 12.
- Narrowing lowers throughput when the demand is more than the narrower road can carry (`packages/scenario/test/narrowing.test.ts`): the mixed-traffic example at 6000 vehicles an hour, narrowed from 10.5 m to 3.5 m, puts 740 vehicles through in ten minutes against 945, with 211 held back at the entry, and at least 15% fewer for each of five seeds. Narrowing to 7 m at that demand changes almost nothing (939 against 945), because 7 m still carries it; at 12 000 vehicles an hour every narrowing from 10.5 m down to 3 m lowers throughput.
