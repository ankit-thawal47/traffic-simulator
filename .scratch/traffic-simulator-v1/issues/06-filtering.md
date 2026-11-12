# 06: Filtering

**What to build:** A planner watches two-wheelers move through the gaps in a signal queue and reach the front, while the vehicle at the head of the queue still gets away on green.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [x] At a red signal, two-wheelers advance through gaps wide enough for them
- [x] Larger vehicle classes do not filter
- [x] The head of the queue still discharges; filtering cannot starve it
- [ ] Two-wheeler delay falls and car delay rises compared with the same scenario without filtering
- [x] Consistency checks pass, including no overlap during filtering
