# 01: Cars on one road, seen in 3D

**What to build:** A planner opens the app and sees cars enter a straight road, follow one another without colliding, and leave, drawn as plain 3D boxes. The count of vehicles through is shown. This ticket also sets up the project: the engine as a standalone package, the app, the test runner, and the consistency checks that every later test scenario reuses.

**Blocked by:** None (can start immediately)

**Status:** done (merged to integration branch, commit 5d5132b)

- [x] The engine is a standalone package with no browser dependencies and runs from the command line
- [x] Given a one-road network, a demand and a seed, cars enter, follow using the following rule, and leave
- [x] The app runs the engine in a background worker and draws each car as a 3D box that moves smoothly
- [x] The number of vehicles through is shown and matches the engine's count
- [x] Consistency checks pass on the test scenario: no vehicle lost, no overlap, no negative speed, no vehicle outside its road
- [x] The same scenario and seed give identical results on a second run
- [x] A car stops behind a stopped car and never passes through it
