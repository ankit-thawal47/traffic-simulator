# 25: Import any place from OpenStreetMap

**What to build:** A planner picks an area on a map of India (a few hundred metres to about 2 km), and the app imports its roads, junctions and flyovers from OpenStreetMap in the browser, using the same importer that prepared the Hebbal corridor. Every value OpenStreetMap does not give (lane counts, widths, heights, signal plans, demand) is guessed by a stated rule, marked as guessed on screen, and changeable by the planner before running. The imported network then works like any other: baseline, proposal, changes, five seeds, save and share.

**Blocked by:** 20

**Status:** ready-for-agent

- [x] The importer runs in the browser and produces a network in the engine's format, with no engine change
- [x] Every guessed value is listed and marked on screen, with the rule that produced it
- [x] The planner can correct lanes, widths and signal plans before running
- [x] An area that cannot be imported (too large, no roads, a shape the importer cannot express) is refused with a reason
- [x] Imports of at least three Indian areas run for a simulated hour with the consistency checks; stuck vehicles reported
- [x] A scenario of an imported area saves and shares without carrying the whole network if it is too large for a link
- [x] OpenStreetMap attribution and licence are shown and met
