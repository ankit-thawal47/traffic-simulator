# One network format, three ways to produce it

The engine runs any network handed to it in one format and knows nothing about where the network came from. Three producers write that format: a prepared corridor (a real place, imported and checked by hand), the builder (the planner assembles building blocks), and, later, free-form drawing and import of any place from OpenStreetMap. v1 ships the prepared corridor and the building-block builder. v2 adds any-place import first, then free-form drawing; v2 is built inside the 72 hours only after v1 passes its test gate.

We staged it this way because OpenStreetMap in Bengaluru carries lane counts on about half of road length and widths on about 1%, so an unchecked import gives results built on guessed road sizes, and free-form drawing needs automatic generation of every crossing and turning path. Building blocks avoid both: the planner supplies the sizes, and each block's turning paths are known in advance.

## Consequences

- No network is hardcoded in the engine; the prepared corridor is data.
- A v2 producer is new code beside the engine, not a change to it.
