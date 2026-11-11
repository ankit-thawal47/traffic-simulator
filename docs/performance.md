# Performance: what was measured, and the state of the target

Measured on 11 November 2026. Ticket: `.scratch/traffic-simulator-v1/issues/03-performance-measured.md`.

The spec's target is: **3,000 vehicles on the network at once, at least 5 times faster than real time, with two 3D views.**

## Verdict

**Met, on the one machine measured, for the traffic the engine can produce today; not yet decidable for the finished v1.**

- With mixed traffic, a baseline and a proposal of about 3,000 vehicles each, advanced together by the app's worker and drawn in two 3D views, ran at 5.00 times real time at 120 frames a second (the display's limit) on an Apple M3 Pro with its own graphics card. Asked for 16 times (the fastest the app offers) it gave 16.00 times; asked for 80 times (the most the app's worker can give) it gave 79.7 times.
- The engine alone, in Node, ran 3,000 mixed-traffic vehicles at 249 simulated seconds per real second (232 to 253 over five repetitions): about 50 times the target.
- It is not yet decidable for v1 because the engine has no signals, junctions, queues, filtering at a stop line, flyover or stuck vehicles yet, and only one machine and one browser were measured. Every figure here is therefore a **floor on cost**. The measurement is one command (`pnpm perf`) so that it can be repeated as those arrive.

Nothing below is an estimate unless it says "derived"; derived figures are arithmetic on observed ones and say which.

## What was measured, and on what

| | |
|---|---|
| Machine | MacBook Pro (Mac15,7), Apple M3 Pro, 12 logical processors, 18 GB memory, on mains power |
| Operating system | macOS 27.0.1 (Darwin 27.0.0, arm64) |
| Node | v22.7.0 (V8 12.4.254.21) |
| Browser | Google Chrome 157.0.8103.51 |
| Graphics | Apple M3 Pro through ANGLE Metal (read from WebGL in the page); software drawing (SwiftShader) measured separately and labelled |
| Window | 1600 × 813 CSS pixels at device pixel ratio 2; two views are each half of it |
| Other load | The machine was busy with other work throughout (load average about 10 at the start), so the figures are, if anything, low |

Full tables, flags and raw values: `docs/performance/measurement-2026-11-11-mixed-traffic.md` and `.json`.

**Scenario ("mixed").** Mixed traffic without lane discipline, built from the engine's public input in `apps/web/perf/scenario.ts`. Parallel straight one-way roads, 1,000 m long, 10.5 m wide (3 lanes), speed limit 13.9 m/s, no junctions; 8, 24 and 40 roads for 1,000, 3,000 and 5,000 vehicles. Each road starts with 125 vehicles of the Bengaluru vehicle mix and has a demand of 6,000 vehicles an hour, which replaces those that leave, so the count stays near the target (observed 2,928 to 3,164 when 3,000 was asked for). Traffic is busy but flowing. A second scenario, "cars-only" (single-file cars on 2,000 m roads), is kept for comparison.

## Engine alone (Node, command line)

Five repetitions, each a new process with its own seed; 1,500 steps of warm-up thrown away, then 3,000 timed steps of 0.2 simulated seconds.

| Vehicles on the network | Simulated seconds per real second: median (min to max) | ms per step |
|---|---|---|
| about 1,000 | 757 (728 to 798) | 0.264 |
| about 3,000 | 249 (232 to 253) | 0.805 |
| about 5,000 | 152 (141 to 152) | 1.320 |

Building a snapshot after every step, which is needed only when the run is watched, lowers these to 560, 178 and 103.

Cars in single file cost the same as mixed traffic on this engine (763, 252 and 152), so the cost is the strip machinery, not the vehicle mix.

Inside a Chrome worker the same code ran at 918, 301 and 179: the browser is no slower than Node.

## The app's worker and two 3D views (Chrome, real graphics card)

The app's own worker and 3D view, unchanged, in a visible Chrome window. "Two runs" is a baseline and a proposal: one worker advancing both, one message carrying both snapshots, two views side by side. Each view was warmed up for 4 seconds and measured for 10.

| Vehicles in each run | Speed asked for | Runs and views | Speed achieved | Frames per second | Drawing work per frame on the page's thread, ms |
|---|---|---|---|---|---|
| about 1,000 | 5× | 1 | 5.00× | 120.1 | 0.75 |
| about 1,000 | 5× | 2 | 5.00× | 120.0 | 0.78 |
| about 3,000 | 5× | 1 | 5.00× | 120.1 | 1.06 |
| **about 3,000** | **5×** | **2** | **5.00×** | **120.1** | **2.10** |
| about 5,000 | 5× | 1 | 5.00× | 119.8 | 1.55 |
| about 5,000 | 5× | 2 | 5.00× | 120.0 | 3.05 |
| about 3,000 | 16× | 2 | 16.00× | 120.0 | 2.41 |
| about 5,000 | 16× | 2 | 15.99× | 120.0 | 3.37 |
| about 3,000 | 80× | 2 | 79.73× | 120.0 | 2.43 |
| about 5,000 | 80× | 2 | 51.48× | 120.0 | 3.30 |

- 120 frames a second is the display's refresh rate, not the limit of the drawing. With Chrome's frame cap removed, two views of 3,000 vehicles drew at 353 frames a second and two of 5,000 at 268.
- The first place the app fell short was two runs of 5,000 vehicles asked for 80×: it gave 51× (62× with nothing drawn). That is the worker's thread running out, not the drawing.
- The 3D view draws at most 4,000 vehicles (`MAX_VEHICLES_DRAWN`), so at 5,000 about a fifth of the vehicles are silently not drawn and the 5,000 rows understate drawing cost.
- In headless Chrome on the same graphics card the frame rate was 60 in every case (headless Chrome's own cap) and the speeds achieved at 5× and 16× were the same.

**Software drawing is not the product's frame rate.** Headless Chrome with SwiftShader drew two views of 3,000 vehicles at 1.3 frames a second and one view of 1,000 at 3.1. The speed achieved was still 5.00×, because the engine runs in the worker. These figures say only that the app must not be judged, or tested for frame rate, in a browser without a graphics card.

## Cost of moving snapshots from the worker to the page

The engine ran flat out in a worker and posted after every step (300 steps, three repetitions). Real milliseconds per step, one run:

| Vehicles | Step | Build the snapshot | Post it as objects (worker) | Read it (page) | Pack and transfer a typed array instead (worker) | Read the typed array (page) |
|---|---|---|---|---|---|---|
| about 1,000 | 0.264 | 0.063 | 0.153 | 0.291 | 0.037 | 0.0016 |
| about 3,000 | 0.761 | 0.330 | 0.460 | 0.850 | 0.038 | 0.0016 |
| about 5,000 | 1.293 | 0.570 | 0.824 | 1.424 | 0.052 | 0.0017 |

- Today's protocol (whole objects) costs, per snapshot of 3,000 vehicles, about as much as two engine steps: 0.33 ms to build, 0.46 ms to post and 0.85 ms to read on the page.
- The typed-array column is a prototype inside the measurement only (six numbers a vehicle in a transferred `Float32Array`); it is not in the product. It cut posting from 0.46 ms to 0.04 ms and reading from 0.85 ms to 0.002 ms. It still pays to build the object snapshot first, because that is all the engine's interface offers.
- In the app, the page spent 1.79 ms reading and storing each message that carried two snapshots of 3,000 vehicles. At 5× the worker sends 25 messages a second, so that is about 45 ms of the page's thread each second (derived: 25 × 1.79), under 5%. At 16× it is 40 messages a second, about 76 ms each second (derived).

## What this means

1. **The engine is not the constraint for watching.** At 3,000 vehicles a step takes 0.8 ms and 5× needs 25 steps a second for each run.
2. **The snapshot protocol is not the constraint either, at this size.** It is the largest avoidable cost, and it is on the page's thread, where it competes with drawing.
3. **Drawing is not the constraint on a machine with a graphics card.** Two views used about 2 ms of the page's thread per frame at 3,000 vehicles.
4. **The 5× target says nothing about the wait that matters most.** A comparison is two scenarios × five seeds × 70 simulated minutes (an hour and a 10 minute warm-up) = 42,000 simulated seconds. At exactly 5× that would be 2 hours 20 minutes. At the 249× measured for the engine alone it is about 2 minutes 50 seconds on one thread (derived: 42,000 ÷ 249).

## Recommendations

**Target (for the orchestrator to put in the spec; this ticket does not edit it).** Replace the single target with two, and name the reference machine:

- *Watching:* a baseline and a proposal of 3,000 vehicles each, in two 3D views, at 16 times real time (the fastest speed the app offers) and at least 30 frames a second, on the reference machine with a graphics card. Measured today: 16.00× at 120 frames a second.
- *Running unseen:* the engine alone, 3,000 vehicles, at least 100 simulated seconds per real second, so that the ten runs of a comparison finish in about 7 minutes on one thread (derived: 42,000 ÷ 100), less if seeds run in parallel workers. Measured today: 249. The gap between 100 and 249 is the room left for signals, junctions and queues.
- Reference machine: the one above, until a slower one is measured. Story 30 ("told when a run is slower than the stated target") should compare against the *running unseen* figure.

**Protocol.** No change is needed to meet the target. Three changes are worth making when the worker is next touched, in this order:

1. Runs that are not watched (seeds two to five) must not build or post snapshots at all. Building alone costs 40% on top of a step (249 → 178).
2. Raise or remove the 4,000-vehicle limit in the 3D view, or say on screen when vehicles are not drawn.
3. Move to a transferred typed array when a run exceeds about 5,000 vehicles or a slower machine is measured and found short. The prototype shows the gain: the page's cost per snapshot falls from 0.85 ms to 0.002 ms at 3,000 vehicles.

**Drawing.** Keep the single instanced batch. Measure again after visual polish (shadows, vehicle shapes), which is the first thing likely to cost the graphics card real work.

**If a later measurement misses the target**, the order of response suggested by these figures is: stop building snapshots for unseen runs; typed-array snapshots; run seeds in parallel workers; and only then a smaller network or a shorter period.

## What was not measured

- Any traffic with signals, junctions, queues, filtering at a stop line, a flyover, route choice or stuck vehicles: the engine does not have them yet. Stopped, dense traffic may cost more per vehicle than the flowing traffic measured.
- Any other machine. An M3 Pro is fast; a planner's laptop with integrated graphics was not measured.
- Any browser other than Chrome 157.
- A close camera, shadows, or detailed vehicle shapes. The camera was the app's default angled view of the whole network, so each vehicle covers few pixels.
- The deployed site. The page measured was a production build served locally.
- Memory use, battery power, and long runs (each view was measured for 10 seconds).
- Whether the visible window was on a lit screen. The page reported itself visible and drew at the display's 120 Hz, but nobody was watching it.
- Five seeds at once in several workers.

## History

- `docs/performance/measurement-2026-11-11-cars-only.md`: the first measurement, taken the same day before mixed traffic was merged (engine with cars in single file, one worker per run). The engine alone then ran 3,000 cars at 1,751 simulated seconds per real second; mixed traffic made a step about 7 times dearer (0.114 ms → 0.805 ms). Its tables were produced by the measurement as it stood at commit `b8b3d97`.
- `docs/performance/measurement-2026-11-11-mixed-traffic.md`: the measurement this document reports.

## Repeating it

```sh
pnpm perf                   # everything: about 30 minutes, opens a Chrome window; leave the machine alone
pnpm perf --only engine     # the engine alone, in Node: about a minute
pnpm perf --quick           # a short pass, to check the measurement itself works
```

It writes `docs/performance/measurement-<date>.md` and `.json` (`--date` sets the name). The measurement is in `apps/web/perf`; `product.ts` there is the one file that reaches into the app, and `scenario.ts` is where a scenario with a signal or a junction should be added once the engine has them. Repeat it after tickets 04 and 06 to 09, and after visual polish.
