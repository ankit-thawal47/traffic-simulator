# 05: Mixed traffic

**What to build:** A planner sees mixed traffic: two-wheelers, cars, auto-rickshaws and buses of different sizes sharing the road width, with a two-wheeler passing through a space a car cannot fit. Lane discipline is a switch: on, vehicles keep to lanes; off, the road carries mixed traffic. Mean delay per vehicle class is shown.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Four vehicle classes exist, each with its own size and following assumptions, held in one assumptions table
- [x] Road width is divided into strips; a vehicle's leader is the nearest vehicle ahead that overlaps its strips
- [x] A vehicle shifts sideways when it gains from it and it is safe to do so
- [x] On the same road behind the same slow bus, a two-wheeler passes and a car queues
- [x] When two vehicles choose the same free space in one step, exactly one gets it and no overlap results
- [x] With lane discipline on, vehicles stay in lanes
- [x] Mean delay per vehicle class is reported and shown
- [x] Each vehicle class is drawn to its own size
- [x] Consistency checks pass with mixed traffic at high density
