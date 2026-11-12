import { defaultBlock } from "../src/index";
import { priority, runsForAnHour } from "./built-runs";

// Each building block alone.
runsForAnHour({
  "straight road": [defaultBlock("straight")],
  "T-junction, signal": [defaultBlock("t-junction")],
  "T-junction, priority": [priority(defaultBlock("t-junction"))],
});
