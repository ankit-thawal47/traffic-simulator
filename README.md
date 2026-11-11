# Traffic Simulator

A what-if tool for Indian roads: a planner describes a road and a change to it, and compares how traffic behaves in each. Vocabulary is in `GLOSSARY.md`; decisions are in `docs/adr/`.

So far: mixed traffic on one straight road. Two-wheelers, cars, auto-rickshaws and buses enter, share the road's width strip by strip, follow and pass one another, and leave. They are drawn as 3D boxes to their own sizes, with the count of vehicles through and the mean delay per vehicle class. Lane discipline is a setting of the engine's input: on, vehicles keep to lanes.

## Layout

- `packages/engine` — the engine. Plain TypeScript with no browser or Node dependencies. Given a network, a demand and a seed, it advances a run step by step and gives back snapshots and results as plain data.
- `apps/web` — the app (React, Vite, three.js). It runs the engine in a background worker and draws the 3D view.

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

Results include, for each vehicle class, the mean delay: the time a vehicle has taken since the demand produced it, less the time the distance it has covered would take at its desired speed. Vehicles still on the network or waiting to enter count with their delay so far.

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
