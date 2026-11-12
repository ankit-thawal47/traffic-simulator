import type { Demand, Network } from "@traffic-simulator/engine";
import flyover from "@traffic-simulator/engine/examples/flyover.json";
import mixedTraffic from "@traffic-simulator/engine/examples/mixed-traffic.json";
import priorityJunction from "@traffic-simulator/engine/examples/priority-junction.json";
import signalJunction from "@traffic-simulator/engine/examples/signal-junction.json";
import { createBaseline, isFlyoverRoad, type Scenario } from "@traffic-simulator/scenario";

/** The scenarios the planner can start from. The first is the one the page opens with. */
export const EXAMPLES: readonly { id: string; scenario: Scenario }[] = [
  {
    id: "one-road",
    scenario: createBaseline({
      name: "One road",
      network: mixedTraffic.network as Network,
      demand: mixedTraffic.demand as Demand,
      seed: mixedTraffic.seed,
    }),
  },
  {
    id: "signal-junction",
    scenario: createBaseline({
      name: "Four-way signal junction",
      network: signalJunction.network as Network,
      demand: signalJunction.demand as Demand,
      seed: signalJunction.seed,
    }),
  },
  {
    id: "priority-junction",
    scenario: createBaseline({
      name: "Priority junction (T, no signal)",
      network: priorityJunction.network as Network,
      demand: priorityJunction.demand as Demand,
      seed: priorityJunction.seed,
    }),
  },
  {
    id: "flyover",
    scenario: createBaseline({
      name: "Flyover over a signal junction",
      network: flyover.network as Network,
      demand: flyover.demand as Demand,
      seed: flyover.seed,
    }),
  },
  {
    // The same network with its flyover drawn but not built today, so that a proposal can add it.
    id: "flyover-proposed",
    scenario: createBaseline({
      name: "Signal junction, flyover not yet built",
      network: flyover.network as Network,
      unbuiltRoadIds: (flyover.network as Network).roads.filter(isFlyoverRoad).map((road) => road.id),
      demand: flyover.demand as Demand,
      seed: flyover.seed,
    }),
  },
];
