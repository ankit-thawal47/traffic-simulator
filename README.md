# Traffic Simulator

A what-if tool for Indian roads: a planner describes a road and a change to it, and compares how traffic behaves in each. Vocabulary is in `GLOSSARY.md`; decisions are in `docs/adr/`.

So far: cars enter one straight road, follow one another, and leave, drawn as 3D boxes with the count of vehicles through.

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
```

The example input is `packages/engine/examples/one-road.json`.

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
