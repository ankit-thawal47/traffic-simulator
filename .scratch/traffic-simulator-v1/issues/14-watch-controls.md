# 14: Watch controls

**What to build:** A planner controls what they watch: faster, slower, pause, a straight-down camera preset beside the free camera, colouring vehicles by speed instead of by vehicle class, and watching the same run again.

**Blocked by:** 01

**Status:** done (merged to integration branch, commit 8040dea)

- [x] Speed can be raised, lowered and paused without changing the results
- [x] A straight-down preset and a free orbit, pan and zoom camera are both available
- [x] Vehicles can be coloured by vehicle class or by speed
- [x] Watching again shows the identical run

**Notes from the implementer:**

- Speed, pause and watching again are proved at the logic level in `apps/web/src/watch.test.ts` (same scenarios at 0.25, 1 and 8 times, with a change of speed part-way, and paused then resumed, give identical frames at the same run time; watching again gives the identical frames), and were checked in the running app.
- Colour by vehicle class: only "car" exists until ticket 05 merges. Colours for two-wheeler, auto-rickshaw and bus are already defined and tested; the legend lists whatever vehicle classes the engine has. If ticket 05 names a vehicle class differently from the glossary, it gets the fallback colour until `vehicle-colours.ts` is given its name.
- Colour by speed: the one-road scenario never forms a queue, so in the running app every car was in the fastest band. The slower bands, including the red for queued vehicles, are covered by tests but have not been seen on screen.
