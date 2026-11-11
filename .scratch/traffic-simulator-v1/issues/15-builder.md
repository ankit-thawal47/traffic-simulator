# 15: Builder

**What to build:** A planner assembles a network from building blocks joined in a line along one main road: straight road, T-junction, four-way junction, flyover over a junction. Each block's lanes, width, length, junction control and signal timing can be set. Layouts that cannot run are refused with a reason.

**Blocked by:** 07, 08

**Status:** ready-for-agent

- [ ] The four building blocks can be added, ordered and removed along one main road
- [ ] Each block's lanes, width and length can be set; junction blocks can be signal or priority junctions; signal timing can be set
- [ ] The builder produces a network in the same format the engine reads for any network
- [ ] A built network runs, with consistency checks passing
- [ ] An invalid layout is refused with a message that says why
- [ ] No change to the engine was needed to support the builder
