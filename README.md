# Traffic Simulator

A what-if tool for Indian roads: a planner describes a road and a change to it, and compares how traffic behaves in each. Vocabulary is in `GLOSSARY.md`; decisions are in `docs/adr/`.

**Live:** https://traffic-simulator-omega.vercel.app (deployed by Vercel from the `main` branch on every push).

So far: mixed traffic on one straight road. Two-wheelers, cars, auto-rickshaws and buses enter, share the road's width strip by strip, follow and pass one another, and leave, each drawn to its own size with a shape for its class (a two-wheeler with its rider, a car, an auto-rickshaw, a bus), generated in code. Roads have kerbs, and lane and edge lines only where traffic keeps to lanes; the sun casts soft shadows while the camera is near enough to see them, and a view that cannot keep 40 frames a second with them drops them. Lane discipline is a setting of the engine's input: on, vehicles keep to lanes. The planner changes the road's width or its number of lanes in a proposal, and shares the scenario as a link or saves it as a file; baseline and proposal run together in two 3D views that share one camera and one clock, with results for both (among them the mean delay per vehicle class) and the change from the baseline.

## Layout

- `packages/engine` — the engine. Plain TypeScript with no browser or Node dependencies. Given a network, a demand and a seed, it advances a run step by step and gives back snapshots and results as plain data.
- `packages/scenario` — the scenario description (network, list of changes, demand, lane discipline, seed; versioned), `resolveScenario()` which applies the changes and gives the engine only its input, reading a scenario back from a link or a file (checked in full, older versions upgraded), and the comparison of results against the baseline. Plain TypeScript, no browser dependencies.
- `apps/web` — the app (React, Vite, three.js). It resolves the baseline and the proposal, runs both in one background worker on one clock, and draws the two 3D views. A second worker runs the five seeds behind the figures.

## Install

Needs Node 22 and pnpm 10.

```sh
pnpm install
```

## Run the app

```sh
pnpm dev        # development server; open the address it prints
pnpm build      # production build into apps/web/dist
```

### Watch controls

Above the two views, shared by both:

- **Pause, Slower, Faster** — from 0.25 to 16 times real time. These change only how fast the runs are shown; the results at any run time are the same at every speed.
- **Watch again** — starts the same runs from the beginning with the same seeds, so the identical runs.
- **Camera** — drag to orbit, right-drag to pan, scroll to zoom; "Straight down" and "Angled" send the shared camera to a preset.
- **Colour vehicles by** — vehicle class, or speed in bands (queued vehicles in red), with a legend.

The logic behind them is in `apps/web/src` and tested from the command line: `watch-clock.ts` and `watch.ts` (speed, pause, watch again), `camera-presets.ts`, `vehicle-colours.ts`, `frame-store.ts`.

The views open on a close-up of the first road, 50 m from where traffic enters it, near enough to tell the vehicle classes apart by size; "Close up" returns to it, and "Straight down" and "Angled" show the whole network.

### Runs, seeds and results

- **A run** covers one simulated hour after a 10 minute warm-up. The warm-up fills the network and is left out of the results. The watched run stops at the end of its hour.
- **Five seeds** per scenario: the scenario's own seed, then the four whole numbers after it (a scenario with seed 7 runs with 7, 8, 9, 10 and 11). The baseline and the proposal have the same seed, so they run with the same five. All five run unseen in a worker of their own, as fast as the engine goes, and the figures come from them alone. The run the planner watches is the first seed again, at the speed they chose: one of the five runs behind the figures, shown.
- **Results** are the fixed result set (ADR 0005; so far vehicles through, mean delay per vehicle class, stuck vehicles and longest queue per approach), each as the average across seeds with the range from the lowest seed to the highest, for baseline and proposal, and the change between the averages. Each carries the "Uncalibrated estimate" label. Above the table the app shows how many seeds have finished, and says the figures are partial until all have: a seed counts only once it has run to its end. The figures do not wait for the planner to watch anything.
- **Excluding the warm-up**: vehicles through is the count of vehicles that left after the warm-up. The mean delay of a vehicle class is the delay added after the warm-up, divided by the vehicles of that class that were there after it (every vehicle the demand produced, less those that had already left when the warm-up ended). A vehicle produced during the warm-up counts with the delay it gained afterwards only.
- **Longest queues** are given for the approaches of signal junctions only. The engine also reports one for every road that ends where a road divides or roads join; nothing holds traffic there, so those are left out of the table.
- **Stuck vehicles.** When vehicles lock each other so that none can move, the engine takes one off the network and counts it as a stuck vehicle (`packages/engine/src/stuck-vehicles.ts`). The test: a vehicle at the front of its queue that has stood (slower than 0.1 m/s) for 300 s, not counting time held by a red or amber signal or behind a stationary vehicle it has no way round; a vehicle standing behind another standing vehicle is queued and collects no time, so a queue at a red, or one whose front is moving, is never released, and a queue behind a lock loses only its front vehicle. One vehicle is released at a time, and every vehicle's time then restarts. Stationary vehicles (breakdowns) are never released. A stuck vehicle is not counted through; its delay up to the release stays in its vehicle class's mean delay, which is therefore understated. The count leaves out the warm-up like the other results, and when any seed has one the table's caption says the run locked up and its figures are less reliable. The example scenarios at their own demand have none; the weaving section below, with lane discipline on and far more traffic than it carries, has a few in an hour.
- **Percentages.** A change is also given as a percentage only when the baseline figure is at least 5 s, 10 m or 10 vehicles (`SMALLEST_BASELINE_FOR_PERCENT` in `packages/scenario/src/comparison.ts`). Against a baseline of zero or close to it a percentage is enormous and says nothing the absolute change does not, so only the absolute change is shown. The thresholds are a judgement: a mean delay under 5 s, a queue of one or two vehicles, a count too small to take a share of.
- **What is drawn.** A view draws at most 10,000 vehicles (`apps/web/src/vehicles-drawn.ts`), over three times the performance target. A run with more is still run and measured in full, and the view says how many vehicles it is not drawing.
- Vehicles still waiting to enter when the hour ends are shown as a note under the table, not as a result.
- Watching faster or slower, pausing and watching again change nothing in the results: the same scenario always gives the same averages and ranges.

The logic is tested from the command line: `packages/engine/src/warm-up.ts` (results that exclude the warm-up), `packages/scenario/src/run-plan.ts` (the run plan, the seeds, a run over the plan), `packages/scenario/src/comparison.ts` (average, range, change) and `apps/web/src/five-seeds.ts` (running the seeds unseen and collecting their results).

### Making a proposal

The proposal starts as a copy of the baseline (pick an example, or open a link or a file). Under "Make a change" there is one control for each kind of change, each in its own file in `apps/web/src`: for a road, its width, lanes, closed lanes, width lost at the roadside and closing it; signal timing; building or removing a flyover road; scaling all demand, a flow rate and the vehicle mix; and lane discipline. The list of changes gives each in plain words with an Undo of its own. A change the engine would refuse is not made, and the reason is shown.

### Save and share

Under the proposal's changes:

- **Copy link** — a link to the page with the scenario in the fragment of the address (`#scenario=d.…`), which a browser never sends to a server. Opening it shows the same baseline and proposal.
- **Save to file**, **Open file…** — the scenario as a `.scenario.json` file, with no account.

A link or a file that cannot be read gives a message saying why, and the scenario shown stays as it was.

## The scenario description

What is saved is one scenario description: a name, the network as it is today, the list of changes, the demand, lane discipline and the seed. It holds the whole comparison: the proposal is the description as saved, and the baseline is the same description without its changes.

- **Versions.** `formatVersion` is 3. Version 1 had no lane discipline (it loads with lane discipline off) and only the road width change. Version 2 had only the width and lanes changes and no roads left unbuilt (it loads with every road of its network built). This number is separate from the network's own `formatVersion` (the engine's network format, 1 to 4), which the network inside carries.
- **Older versions keep loading.** `packages/scenario/src/upgrade.ts` has one upgrade step per older version, and `packages/scenario/test/fixtures/` has a saved example of every version, as a file and as a link, which the tests open. A new version raises the number, adds one step and one example; existing steps and examples are never edited.
- **Changes.** Every change names the road, junction or flow it changes by its identifier, and a proposal has at most one change of a kind to each. The kinds (`packages/scenario/src/scenario.ts`):
  - `road-width` sets a road's width; `road-lanes` sets its number of lanes. Lanes and width are independent: each change leaves the other as it is, and the lanes share the width equally. With lane discipline on, every lane must be wide enough for the widest vehicle class in the demand; with it off the road carries mixed traffic, which takes no notice of lanes, so a lanes change does not alter the estimate.
  - `lane-closure` closes some of a road's lanes: the road keeps its other lanes at the width they have, along its whole length (a closure part-way along a road cannot be described). At least one lane stays open.
  - `lost-width` takes usable width from a road for roadside activity, with the reason (parking, hawkers, stopped vehicles, other). It is listed apart from a width change; the lanes stay as many, each narrower.
  - `road-closure` takes a road out of the network, with its connections and its green time. Traffic that used it takes the fastest route that is left. A closure that leaves a flow with no route, or closes a road the demand enters or leaves by, is refused: traffic is never taken off the network.
  - `flyover` builds or removes one flyover road (one direction of a flyover) that the network has drawn. A flyover is not drawn freely. To add one, the scenario carries it in its network and names it in `unbuiltRoadIds`: the baseline runs without those roads, and a `flyover` change with `built: true` builds one in the proposal.
  - `signal-timing` sets the green time of each phase of a signal junction; amber and all-red stay.
  - `flow-rate` sets the vehicles per hour of one entry-to-exit pair; `vehicle-mix` replaces the vehicle mix; `demand-scale` multiplies every entry-to-exit rate together (after any flow rate changes). Scaling all demand is how to ask what happens if a change attracts more traffic: induced demand is not modelled (ADR 0006).
  - `lane-discipline` switches lane discipline on or off in the proposal; the scenario's own `laneDiscipline` is the baseline's.
- **Order.** The order of the list does not alter the result: `resolveScenario()` applies the kinds in a fixed order (width, lanes, closed lanes, lost width, signal timing, flow rates, vehicle mix, demand scale, lane discipline, then roads taken out).
- **Width where a flyover leaves the road.** Where a road divides or roads join side by side, a road's width changes about its centreline. A road there can be made narrower; a change that would leave it lying over the road beside it, or outside the road it divides from, is refused with the reason (`packages/scenario/src/side-by-side.ts`).
- **In plain words.** `describeChange()` gives each change as the proposal's list shows it, from what the baseline has to what the proposal has; any one change can be undone on its own.
- **Nothing the engine refuses is saved or opened.** A change that would leave a road too narrow for a vehicle class in the vehicle mix (or its lanes too narrow, with lane discipline on) is not made, and the planner is told why; the same check runs before a scenario is saved and after one is read.
- **Reading is strict.** Everything from a link or a file is checked before use: types, ranges (`SCENARIO_LIMITS`), references to roads that exist, known kinds of change, known versions. Anything else that came with it is dropped.
- **Link length.** A link is the description as compact JSON, compressed (raw DEFLATE) and written in URL-safe base64. With a 34-character page address the mixed-traffic example is 384 characters, 420 with a width change and a lanes change, and the one-road example 320. Links are made up to 2000 characters, the length that survives being pasted into chat and mail; that is about 35 two-point roads. Beyond it no link is made and the planner is told to save a file, which has no such limit.
- **One storage module.** In the app every save and load goes through `ScenarioStorage` in `apps/web/src/scenario-storage.ts`; a backend could implement the same interface later (ADR 0001).

## Run the engine from the command line

```sh
pnpm engine                                   # the one-road example, one simulated hour
pnpm engine --duration 600 --seed 5           # ten minutes, another seed
pnpm engine --check                           # also apply the consistency checks
pnpm engine path/to/scenario.json --check     # your own { network, demand, seed }
pnpm engine packages/engine/examples/mixed-traffic.json --lane-discipline on   # the mixed-traffic example, kept to lanes
```

The example inputs are in `packages/engine/examples/`: `one-road.json` (cars only), `mixed-traffic.json` (four vehicle classes, which the app opens with) `signal-junction.json` (a four-way signal junction) and `flyover.json` (a flyover each way over a signal junction); the app offers the last two under "Start from an example".

## Engine input

- `network`: roads, each with a centreline, width, lane count and speed limit, and junctions. `formatVersion` is 4. Version 3 (no flyovers), version 2 (no junctions) and version 1 (no lane counts either; lanes are taken from the width at 3.5 m each) still load.
  - A road is one carriageway in one direction; a two-way street is two roads. This is left-hand traffic: facing the junction, the road towards it is on the left of the road away from it.
  - A junction has an `id`, `control: "signal"`, its `connections` (`fromRoadId` to `toRoadId`: the only ways through) and a `signalPlan`: `phases` in order, each with the approaches that have green (`greenRoadIds`) and for how long (`greenS`), then `amberS` of amber for them and `allRedS` of red for everyone before the next phase. Signals are per approach, not per movement: when an approach has green, all its movements may go.
  - From version 4, a point of a road may have a height `z` in metres (the ground without one). A flyover is a road with heights: it rises on a ramp, passes over what is beneath and comes down. Lengths are measured on the plan.
  - From version 4, a junction may have `control: "none"` and no signal plan: a diverge or a merge, where roads lying side by side divide or join (where a flyover leaves the main road and where it rejoins it). Its roads must run straight on, and each connection takes the part of the wider road's width that the narrower road lines up with.
  - The path of each connection is worked out from where its two roads end and start. A turn must be at least as long as the longest vehicle that takes it (10.1 m for a bus), so stop lines need setting back from the corner.
- `demand`: vehicles per hour for each entry-to-exit pair, and a `vehicleMix` giving the share of each vehicle class (cars only without one).
- `laneDiscipline`: `true` keeps vehicles to lanes; `false` (the default) is mixed traffic.
- `seed`: the same input and seed always give the same run.

Results include, for each vehicle class, the mean delay: the time a vehicle has taken since the demand produced it, less the time the distance it has covered would take at its desired speed. Vehicles still on the network or waiting to enter count with their delay so far. Beside each mean is the total delay it is the mean of (`totalDelayS`), which, unlike a mean, can be subtracted; `resultsExcludingWarmUp(atEndOfWarmUp, atEnd)` uses it to give the results of the period after a warm-up. The engine's own `results()` always count from the start of the run.

Results also give the longest queue on each approach (`longestQueueByApproach`). A vehicle is queued when it is on the approach, short of the stop line, and slower than 5 km/h; the queue runs from the stop line back to the rear of the last queued vehicle, stopping at the first gap of more than 10 m with no queued vehicle in it. It is kept minute by minute, so that `resultsExcludingWarmUp` can give the longest queue of the hour after the warm-up.

### How a signal junction works

- **Signals.** A signal that is not green acts as a stopped vehicle at the stop line across the whole approach. A vehicle asks to be let in when it is as near the stop line as the gap the following rule wants to a stopped vehicle at its speed, so one that is refused can still stop comfortably. It is let in only on green, and only if it can reach the stop line before the amber ends. A vehicle let in late and then slowed by the vehicle ahead can cross a moment into the red.
- **Order.** A vehicle is let in only after every vehicle ahead of it in its strips, and those let in go in the order they were let in: at every place where the paths of two of them cross, the one let in first goes first, and the other stops short of that place until the first one's rear bumper has passed it. Because the order is one order for the whole junction, vehicles inside it cannot end up waiting for each other in a ring.
- **Crossing paths.** Each connection is a band of strips, as many as the narrower of its two roads has (lined up with the left of both roads for a left turn or straight on, with the right for a right turn). When the network loads, the engine finds where every strip of every connection crosses every strip of every other. A vehicle is let in only if each such place will be free when it gets there: the soonest it can reach it must be a second later than the time by which each vehicle let in before it should have cleared it.
- **Keep clear.** A vehicle is let in only if the road beyond has room for it behind the last vehicle in its strips, after the vehicles already let in and heading for those strips have taken theirs.
- **Inside the junction** a vehicle keeps the strips it entered in, all the way along its turning path; it does not shift sideways from being let in until its rear bumper has left the junction. It slows for a turn. Its footprint follows the turning path, which is how the consistency checks compare vehicles inside a junction.
- **What it does not do.** Vehicles do not sort themselves by turn before the stop line, so a right-turning vehicle on the left of the approach waits for the through traffic beside it, which lowers the discharge of an approach with mixed turns. A later vehicle never goes before an earlier one, so a turn across oncoming traffic waits for a longer gap than a driver would take. There are no signals per movement, no turn bans, and no U-turns unless the roads are far enough apart. Where the road out is narrower than the approach, vehicles enter the network already in the strips that lead onto it; a vehicle that arrives in other strips (from an earlier junction) has to shift over and can be boxed in.

### How a flyover works

- **Two levels.** A flyover is a road of its own that shares no junction with what it passes over. A vehicle looks for neighbours only on its own road and in the junction it is in, so traffic on the flyover and traffic beneath never react to each other. Heights are used for drawing and by the consistency checks: two vehicles that overlap on the plan overlap unless their heights differ by 3 m or more. A ramp's slope does not slow vehicles.
- **Diverge and merge.** Where the flyover leaves the main road the road divides by position across it: the strips in front of the ramp lead onto the flyover, the others to the junction beneath. Where it rejoins a road wide enough for both, the two streams arrive side by side and share no space. Where two roads join onto the same strips, vehicles are let in first come, first served, by the same rules as at a signal junction (order, crossing paths, keep clear) with every approach always green; no road has priority.
- **Sorting for the way on.** A vehicle enters the network in strips that lead on through every junction of its route, where there are such strips, and keeps to them. One that comes onto a road on the wrong side (off a flyover, or out of a junction, bound for an exit on the other side) moves across. If it reaches the junction still on the wrong side it waits (at the stop line if it has to move right, 15 m short of it if it has to move left) and vehicles behind it in the strip it needs next give way. This rule is ours and is not calibrated: a weaving section runs, but how much it carries is not to be relied on. With lane discipline on and demand far above what the road carries, a weaving section jams back into the junction before it and vehicles there can stand for many minutes; some are released as stuck vehicles (3 to 7 an hour in seeds 81 to 83).
- **Route choice** (ADR 0006). Through traffic that can take the flyover or the junction beneath chooses once, when it comes to enter the network, and never changes. Each route's share is in proportion to its measured travel time to the power minus 4, and every route keeps at least 5%. A route's measured travel time is the mean over the vehicles of the same demand flow that completed it in the last 60 s (the last one to complete it, if none did; its time on empty roads before any has), or the time so far of the vehicle longest on it if that is more. Traffic with only one way to its exit has no choice, and everywhere else the route is the fastest path on empty roads. When both routes are over capacity the split swings between them over some minutes, because a travel time is only known once vehicles have got through. Equilibrium routing and induced demand are not modelled.

Every value the engine takes as given (sizes, following gaps, side clearances, sideways speed caps, the thresholds for shifting sideways, and the junction values: turn speed, crossing margin, keep-clear room, what counts as queued) is in `packages/engine/src/assumptions.ts` with its source. None has been confirmed against its source yet.

## Test and typecheck

```sh
pnpm test         # all tests (Vitest)
pnpm typecheck    # engine and app
```

## Measure performance

```sh
pnpm perf                   # everything: about 30 minutes, opens a Chrome window; leave the machine alone
pnpm perf --only engine     # the engine alone, in Node: about a minute
pnpm perf --quick           # a short pass, to check the measurement itself works
```

It writes `docs/performance/measurement-<date>.md` and `.json`. What the figures mean, and the state of the performance target, is in `docs/performance.md`. The measurement lives in `apps/web/perf`; repeat it whenever the engine's work per vehicle or the way snapshots reach the page changes.

Engine tests go through its public interface only: `createRun({ network, demand, seed })`, then `step()`, `snapshot()` and `results()`.

Every test scenario should also pass the consistency checks (no vehicle lost, no overlap, no negative speed, no vehicle outside its road, same seed gives the same run):

```ts
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";

const report = checkRunConsistency({ network, demand, seed }, { durationS: 900 });
expect(report.violations).toEqual([]);
```
