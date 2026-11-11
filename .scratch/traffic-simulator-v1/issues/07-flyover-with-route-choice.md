# 07: Flyover with route choice

**What to build:** A planner watches a flyover carry through traffic over a signal junction. The flyover is drawn raised, with ramps. Traffic on the flyover and traffic beneath never react to each other. Through traffic splits between the flyover and the junction according to their current travel times.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] A network can contain a flyover that shares no junction with the road beneath it
- [ ] A vehicle on the flyover is unaffected by vehicles beneath, and the reverse
- [ ] Vehicles merge onto and leave the flyover at its ramps without overlapping
- [ ] Turning traffic uses the junction; through traffic chooses between flyover and junction once, at entry
- [ ] The choice follows current measured travel times as a probability; when the flyover is jammed its share falls, and it never switches all-or-nothing
- [ ] The flyover is drawn as raised geometry with ramps
- [ ] Consistency checks pass on the flyover test scenario
