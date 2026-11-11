# Traffic Simulator

A what-if tool for Indian roads: a planner describes a road and a change to it, and compares how traffic behaves in each. Vocabulary is in `GLOSSARY.md`; decisions are in `docs/adr/`.

So far: mixed traffic on one straight road. Two-wheelers, cars, auto-rickshaws and buses enter, share the road's width strip by strip, follow and pass one another, and leave, each drawn as a 3D box to its own size. Lane discipline is a setting of the engine's input: on, vehicles keep to lanes. The planner changes the road's width in a proposal; baseline and proposal run together in two 3D views that share one camera and one clock, with results for both (among them the mean delay per vehicle class) and the change from the baseline.

## Layout

- `packages/engine` — the engine. Plain TypeScript with no browser or Node dependencies. Given a network, a demand and a seed, it advances a run step by step and gives back snapshots and results as plain data.
- `packages/scenario` — the scenario description (network, list of changes, demand, seed; versioned), `resolveScenario()` which applies the changes and gives the engine only network, demand and seed, and the comparison of results against the baseline. Plain TypeScript, no browser dependencies.
- `apps/web` — the app (React, Vite, three.js). It resolves the baseline and the proposal, runs both in one background worker on one clock, and draws the two 3D views. A second worker runs the seeds the planner does not watch.

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
- **Five seeds** per scenario: the scenario's own seed, then the four whole numbers after it (a scenario with seed 7 runs with 7, 8, 9, 10 and 11). The baseline and the proposal have the same seed, so they run with the same five. The first seed is the run the planner watches, at the speed they chose; the other four run unseen in a worker of their own, as fast as the engine goes.
- **Results** are the fixed result set (ADR 0005; so far vehicles through and mean delay per vehicle class), each as the average across seeds with the range from the lowest seed to the highest, for baseline and proposal, and the change between the averages. Each carries the "Uncalibrated estimate" label. Above the table the app shows progress across the seeds and says whether the figures are partial: a seed counts only once it has run to its end, and the watched run joins the figures when the planner has watched it to the end of its hour.
- **Excluding the warm-up**: vehicles through is the count of vehicles that left after the warm-up. The mean delay of a vehicle class is the delay added after the warm-up, divided by the vehicles of that class that were there after it (every vehicle the demand produced, less those that had already left when the warm-up ended). A vehicle produced during the warm-up counts with the delay it gained afterwards only.
- Vehicles still waiting to enter when the hour ends are shown as a note under the table, not as a result.
- Watching faster or slower, pausing and watching again change nothing in the results: the same scenario always gives the same averages and ranges.

The logic is tested from the command line: `packages/engine/src/warm-up.ts` (results that exclude the warm-up), `packages/scenario/src/run-plan.ts` (the run plan, the seeds, a run over the plan), `packages/scenario/src/comparison.ts` (average, range, change) and `apps/web/src/five-seeds.ts` (the unseen seeds and collecting results across seeds).

## Run the engine from the command line

```sh
pnpm engine                                   # the one-road example, one simulated hour
pnpm engine --duration 600 --seed 5           # ten minutes, another seed
pnpm engine --check                           # also apply the consistency checks
pnpm engine path/to/scenario.json --check     # your own { network, demand, seed }
pnpm engine packages/engine/examples/mixed-traffic.json --lane-discipline on   # the mixed-traffic example, kept to lanes
```

The example inputs are in `packages/engine/examples/`: `one-road.json` (cars only) and `mixed-traffic.json` (four vehicle classes, which the app shows).

## Engine input

- `network`: roads, each with a centreline, width, lane count and speed limit. `formatVersion` is 2; version 1 (no lane counts) still loads, with lanes taken from the width at 3.5 m each.
- `demand`: vehicles per hour for each entry-to-exit pair, and a `vehicleMix` giving the share of each vehicle class (cars only without one).
- `laneDiscipline`: `true` keeps vehicles to lanes; `false` (the default) is mixed traffic.
- `seed`: the same input and seed always give the same run.

Results include, for each vehicle class, the mean delay: the time a vehicle has taken since the demand produced it, less the time the distance it has covered would take at its desired speed. Vehicles still on the network or waiting to enter count with their delay so far. Beside each mean is the total delay it is the mean of (`totalDelayS`), which, unlike a mean, can be subtracted; `resultsExcludingWarmUp(atEndOfWarmUp, atEnd)` uses it to give the results of the period after a warm-up. The engine's own `results()` always count from the start of the run.

Every value the engine takes as given (sizes, following gaps, side clearances, sideways speed caps, the thresholds for shifting sideways) is in `packages/engine/src/assumptions.ts` with its source. None has been confirmed against its source yet.

## Test and typecheck

```sh
pnpm test         # all tests (Vitest)
pnpm typecheck    # engine and app
```

Engine tests go through its public interface only: `createRun({ network, demand, seed })`, then `step()`, `snapshot()` and `results()`.

Every test scenario should also pass the consistency checks (no vehicle lost, no overlap, no negative speed, no vehicle outside its road, same seed gives the same run):

```ts
import { checkRunConsistency } from "@traffic-simulator/engine/consistency-checks";

const report = checkRunConsistency({ network, demand, seed }, { durationS: 900 });
expect(report.violations).toEqual([]);
```
