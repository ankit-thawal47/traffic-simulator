import { defaultBlock } from "../src/index";
import { priority, runsForAnHour } from "./built-runs";

// Each building block alone, continued.
runsForAnHour({
  "four-way junction, signal": [defaultBlock("four-way")],
  "four-way junction, priority": [priority(defaultBlock("four-way"))],
  "flyover over a signal junction": [defaultBlock("flyover")],
});
