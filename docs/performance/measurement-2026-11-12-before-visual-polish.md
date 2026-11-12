# Performance measurement, 2026-11-12

Written by `pnpm perf` (`apps/web/perf/measure.mjs`). Every figure below was observed in that run; nothing is typed by hand.
What the figures mean, and what follows from them, is in `docs/performance.md`.

## Machine

- Machine: Mac15,7, Apple M3 Pro, 12 logical processors, 18 GB memory
- Operating system: macOS 27.0.1 (Darwin 27.0.0 (arm64))
- Node v22.7.0 (V8 12.4.254.21-node.18)
- Chrome: Google Chrome 157.0.8103.51
- Power: Now drawing from 'AC Power'
- Display: Resolution: 3456 x 2234 Retina
- Load average when the measurement started (1, 5, 15 minutes): 10.83, 11.41, 12.83
- Options: counts 3000; speeds asked for 16; 2 repetitions of the engine measurement; 1 of the snapshot measurement; views warmed up for 2 s and measured for 4 s; QUICK MODE, not for quoting

## Scenarios

Built in `apps/web/perf/scenario.ts` from the engine's public input.

- **mixed.** Mixed traffic without lane discipline. Parallel straight one-way roads, 1,000 m long, 10.5 m wide (3 lanes), 25 m apart, speed limit 13.9 m/s, no junctions. One road for every 125 vehicles asked for (8, 24 and 40 roads for 1,000, 3,000 and 5,000 vehicles). Each road starts with 125 vehicles of the Bengaluru vehicle mix in three files at 12 m/s and has a demand of 6,000 vehicles an hour of the same mix, which replaces the vehicles that leave. Traffic is busy but flowing: there is no signal and no queue.
- **cars-only.** Cars only, single file. Parallel straight one-way roads, 2,000 m long, 3.5 m wide (1 lane), 25 m apart, speed limit 13.9 m/s, no junctions. One road for every 50 vehicles asked for (20, 60 and 100 roads). Each road starts with 50 cars spaced evenly at 13 m/s and has a demand of 1,200 cars an hour.

## Chrome, headed-gpu

- Drawn with: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --window-position=40,40`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Scenario | Vehicles asked for | Vehicles on the network | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 3000 | 3145 | 209 (209 to 209) | 1.010 | 0.424 | 0.676 | 0.970 | 0.091 | 0.0021 | 472 (472 to 472) | 659 (659 to 659) | 1 |

### The app's worker and 3D view

The runs are advanced together by the app's own worker (`apps/web/src/run.worker.ts`), which posts one message holding a snapshot of every run, and each run is drawn, where drawn, by the app's own 3D view (`apps/web/src/RoadScene.tsx`), all unchanged. Two runs stand for a baseline and a proposal: one worker, two views side by side, each half the window. Where "seeds running unseen" says yes, the app's second worker (`apps/web/src/seeds.worker.ts`) was also running every seed of the same inputs flat out, as it does in the app while the planner watches. The view draws at most 4,000 vehicles. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Scenario | Vehicles asked for | Speed asked for | Runs | Drawn | Seeds running unseen | Speed achieved | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Messages received per s | Reading and storing one message, ms | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 3000 | 16× | 1 | no | yes | 16.01× | 120.0 | 8.3 / 8.7 / 9.3 | – | 40.0 | 0.86 | 2898 |
| mixed | 3000 | 16× | 1 | yes | yes | 16.01× | 120.2 | 8.3 / 9.2 / 9.3 | 1.23 | 40.0 | 0.94 | 2903 |
| mixed | 3000 | 16× | 2 | no | yes | 16.00× | 120.0 | 8.3 / 8.6 / 9.3 | – | 40.2 | 1.70 | 2898, 3046 |
| mixed | 3000 | 16× | 2 | yes | yes | 15.99× | 120.0 | 8.3 / 8.8 / 9.3 | 2.39 | 40.0 | 1.82 | 2901, 3042 |

## Chrome, headed-gpu-uncapped

- Drawn with: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --window-position=40,40 --disable-frame-rate-limit --disable-gpu-vsync`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Scenario | Vehicles asked for | Vehicles on the network | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 3000 | 3145 | 206 (206 to 206) | 1.002 | 0.359 | 0.750 | 0.955 | 0.199 | 0.0038 | 472 (472 to 472) | 645 (645 to 645) | 1 |

### The app's worker and 3D view

The runs are advanced together by the app's own worker (`apps/web/src/run.worker.ts`), which posts one message holding a snapshot of every run, and each run is drawn, where drawn, by the app's own 3D view (`apps/web/src/RoadScene.tsx`), all unchanged. Two runs stand for a baseline and a proposal: one worker, two views side by side, each half the window. Where "seeds running unseen" says yes, the app's second worker (`apps/web/src/seeds.worker.ts`) was also running every seed of the same inputs flat out, as it does in the app while the planner watches. The view draws at most 4,000 vehicles. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Scenario | Vehicles asked for | Speed asked for | Runs | Drawn | Seeds running unseen | Speed achieved | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Messages received per s | Reading and storing one message, ms | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 3000 | 16× | 1 | no | yes | 16.00× | 96.2 | 17.0 / 17.7 / 17.7 | – | 40.0 | 0.86 | 2898 |
| mixed | 3000 | 16× | 1 | yes | yes | 16.00× | 428.4 | 2.5 / 3.0 / 8.7 | 2.06 | 40.0 | 0.99 | 2901 |
| mixed | 3000 | 16× | 2 | no | yes | 16.00× | 96.2 | 16.9 / 17.7 / 17.7 | – | 40.0 | 1.72 | 2897, 3040 |
| mixed | 3000 | 16× | 2 | yes | yes | 16.01× | 320.4 | 2.8 / 4.7 / 9.3 | 2.64 | 40.2 | 1.91 | 2903, 3055 |
