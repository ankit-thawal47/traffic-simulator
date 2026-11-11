# Traffic Simulator

A what-if tool for Indian roads: a planner describes a road and a change to it, and compares how traffic behaves in each. Vocabulary is in `GLOSSARY.md`; decisions are in `docs/adr/`.

So far: cars enter one straight road, follow one another, and leave. The planner changes the road's width in a proposal; baseline and proposal run together in two 3D views that share one camera and one clock, with results for both and the change from the baseline.

## Layout

- `packages/engine` — the engine. Plain TypeScript with no browser or Node dependencies. Given a network, a demand and a seed, it advances a run step by step and gives back snapshots and results as plain data.
- `packages/scenario` — the scenario description (network, list of changes, demand, seed; versioned), `resolveScenario()` which applies the changes and gives the engine only network, demand and seed, and the comparison of results against the baseline. Plain TypeScript, no browser dependencies.
- `apps/web` — the app (React, Vite, three.js). It resolves the baseline and the proposal, runs both in one background worker on one clock, and draws the two 3D views.

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

## Run the engine from the command line

```sh
pnpm engine                                   # the one-road example, one simulated hour
pnpm engine --duration 600 --seed 5           # ten minutes, another seed
pnpm engine --check                           # also apply the consistency checks
pnpm engine path/to/scenario.json --check     # your own { network, demand, seed }
```

The example input is `packages/engine/examples/one-road.json`.

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
