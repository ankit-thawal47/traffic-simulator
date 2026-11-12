# Traffic Simulator

A what-if tool for Indian roads: a planner describes a road and a change to it, and compares how traffic behaves in each.

## Language

**Planner**:
The person who uses the product to compare a road as it is against a change to it.
_Avoid_: User, operator, analyst

**Scenario**:
A complete description of one situation to simulate: the roads, the changes made to them, and the traffic that enters.
_Avoid_: Simulation, case, configuration

**Baseline**:
The scenario that describes the road as it is today.
_Avoid_: Base case, as-is, current state

**Proposal**:
A scenario that differs from the baseline by one or more changes the planner wants to assess.
_Avoid_: Alternative, option, what-if

**Run**:
One execution of a scenario from its start time to its end time.
_Avoid_: Simulation, job, execution

**Estimate**:
A result produced by a run. An estimate is never presented as calibrated; what has been verified, and against what, is stated in the benchmark results.
_Avoid_: Prediction, forecast

**Network**:
The roads, junctions and flyovers that a scenario runs on.
_Avoid_: Map, graph, canvas

**Corridor**:
A network of a real place, prepared and checked by hand. The first corridor is Hebbal, Bengaluru, city-bound.
_Avoid_: Prepared network, preset, hardcoded map

**Imported area**:
A network of a real place imported from OpenStreetMap in the browser, with nothing checked by hand: every value OpenStreetMap does not give is guessed by a stated rule.
_Avoid_: Corridor (a corridor is checked by hand), map import

**Guessed value**:
A value of an imported area that a stated rule gave because OpenStreetMap does not: lanes, width, speed limit, height, junction control, signal plan, demand. Shown as guessed; the planner can correct lanes, widths and green times.
_Avoid_: Default, estimate (an estimate is a result)

**Correction**:
What the planner says an imported area is today, where the import guessed. It alters the baseline; a change alters only the proposal.
_Avoid_: Change, override

**Building block**:
A ready-made piece of network (straight road, T-junction, four-way junction, flyover over a junction) whose lanes, width, length and signal timing the planner sets.
_Avoid_: Template, component, tile

**Builder**:
The part of the product where a planner assembles a network from building blocks.
_Avoid_: Editor, canvas, designer

**Vehicle class**:
A kind of vehicle with its own size and driving behaviour. v1 has four: two-wheeler, car, auto-rickshaw, bus.
_Avoid_: Vehicle type, mode, category

**Mixed traffic**:
Traffic in which vehicle classes of very different sizes share the same road width without keeping to lanes.
_Avoid_: Heterogeneous traffic, chaotic traffic, lane-free traffic

**Strip**:
A narrow band of road width, much narrower than a lane, used to describe where a vehicle sits across the road.
_Avoid_: Sublane, slot, cell

**Filtering**:
Two-wheelers moving through the spaces between larger vehicles to reach the front of a queue.
_Avoid_: Seepage, lane splitting, creeping

**Change**:
One difference between a proposal and the baseline, such as a lane removed, a signal retimed or a flyover added.
_Avoid_: Edit, modification, tweak

**Stuck vehicle**:
A vehicle that the run had to release by force because it could not move.
_Avoid_: Teleport, deadlocked vehicle, gridlock victim

**Signal junction**:
A junction where a fixed, repeating signal plan decides which movements may go.
_Avoid_: Traffic light, signalised intersection, controlled junction

**Priority junction**:
A junction with no signal, where traffic on the main road goes first and side-road traffic waits for a gap.
_Avoid_: Unsignalised junction, give-way junction, uncontrolled junction

**Approach**:
One road arriving at a junction; queues are measured per approach.
_Avoid_: Arm, leg, inbound

**Warm-up**:
The first minutes of a run, used to fill the network with traffic and left out of the results.
_Avoid_: Burn-in, ramp-up, initialisation

**Demand**:
The traffic a scenario sends into the network: vehicles per hour for each entry-to-exit pair, and the share of each vehicle class.
_Avoid_: Volume, load, traffic input

**Route**:
The sequence of roads a vehicle follows from its entry to its exit.
_Avoid_: Path, trip, journey

**Lane discipline**:
The setting that makes vehicles keep to marked lanes. With it off, the road carries mixed traffic.
_Avoid_: Lane mode, lane-based mode, ordered traffic

**Assumption**:
A value the engine takes as given, such as a vehicle class's size or following gap, shown to the planner with its source.
_Avoid_: Parameter, constant, default
