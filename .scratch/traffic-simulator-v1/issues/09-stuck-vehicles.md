# 09: Stuck vehicles

**What to build:** When vehicles lock each other so that none can move, the run detects it, releases one by force, and reports how many times it did so. The planner sees the stuck-vehicle count as a headline result.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] A vehicle that has been unable to move for a set time while blocked by a cycle of other vehicles is detected
- [x] One vehicle is released, and each release is counted
- [x] The stuck-vehicle count is part of the results and shown
- [x] A scenario built to lock up produces a count above zero and still finishes
- [x] An ordinary scenario produces a count of zero
