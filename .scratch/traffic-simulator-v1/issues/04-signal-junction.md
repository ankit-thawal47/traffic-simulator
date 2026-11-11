# 04: Signal junction

**What to build:** A planner watches a four-way signal junction work: vehicles stop on red, discharge on green, turn left, right or go straight, and cross each other's paths without colliding. The longest queue on each approach is shown.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] A network can contain a signal junction with a fixed-time signal plan
- [x] Vehicles stop at a red signal and move off on green
- [x] Vehicles follow their route through the junction, including turns, in left-hand traffic
- [x] Vehicles whose paths cross never overlap inside the junction
- [x] A vehicle does not enter the junction unless it can clear it
- [x] The longest queue per approach is reported and shown
- [x] Consistency checks pass on the junction test scenario
