import { defaultBlock } from "../src/index";
import { priority, runsForAnHour } from "./built-runs";

// Lines of blocks, including a main road that widens and narrows from block to block, and a flyover over a priority junction.
runsForAnHour({
  "straight, signal four-way, flyover, priority T": [
    defaultBlock("straight"),
    defaultBlock("four-way"),
    defaultBlock("flyover"),
    priority(defaultBlock("t-junction")),
  ],
  "two lanes, a three-lane signal T, two lanes, a four-lane flyover over a priority junction": [
    { ...defaultBlock("straight"), lanes: 2, widthM: 7 },
    { ...defaultBlock("t-junction"), lanes: 3, widthM: 10.5 },
    { ...defaultBlock("straight"), lanes: 2, widthM: 7 },
    priority({ ...defaultBlock("flyover"), lanes: 4, widthM: 14 }),
  ],
});
