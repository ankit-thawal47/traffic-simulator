# 12: All seven kinds of change

**What to build:** A planner can make every kind of change: lanes or width, closing a lane or road, signal timing, adding or removing a flyover, demand and vehicle mix including the control that scales all demand, lost width from roadside activity, and lane discipline. The proposal shows its list of changes and any one can be undone.

**Blocked by:** 05, 07, 10

**Status:** ready-for-agent

- [x] Each of the seven kinds of change can be made, and each alters the run in the expected direction
- [x] The control that scales all demand changes every entry-to-exit rate together
- [x] The proposal lists its changes in plain words
- [x] Undoing one change restores that part of the baseline and leaves the others
- [x] Changes are stored against stable identifiers of roads and junctions
- [x] The list of what is not modelled includes rerouting beyond the flyover choice and induced demand
