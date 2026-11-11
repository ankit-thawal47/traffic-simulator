# Performance measurement, 2026-11-11-with-unseen-seeds

Written by `pnpm perf` (`apps/web/perf/measure.mjs`). Every figure below was observed in that run; nothing is typed by hand.
What the figures mean, and what follows from them, is in `docs/performance.md`.

## Machine

- Machine: Mac15,7, Apple M3 Pro, 12 logical processors, 18 GB memory
- Operating system: macOS 27.0.1 (Darwin 27.0.0 (arm64))
- Node v22.7.0 (V8 12.4.254.21-node.18)
- Chrome: Google Chrome 157.0.8103.51
- Power: Now drawing from 'AC Power'
- Display: Resolution: 3456 x 2234 Retina
- Load average when the measurement started (1, 5, 15 minutes): 59.36, 54.42, 33.31
- Options: counts 1000, 3000, 5000; speeds asked for 5, 16, 80; 5 repetitions of the engine measurement; 3 of the snapshot measurement; views warmed up for 4 s and measured for 10 s

## Scenarios

Built in `apps/web/perf/scenario.ts` from the engine's public input.

- **mixed.** Mixed traffic without lane discipline. Parallel straight one-way roads, 1,000 m long, 10.5 m wide (3 lanes), 25 m apart, speed limit 13.9 m/s, no junctions. One road for every 125 vehicles asked for (8, 24 and 40 roads for 1,000, 3,000 and 5,000 vehicles). Each road starts with 125 vehicles of the Bengaluru vehicle mix in three files at 12 m/s and has a demand of 6,000 vehicles an hour of the same mix, which replaces the vehicles that leave. Traffic is busy but flowing: there is no signal and no queue.
- **cars-only.** Cars only, single file. Parallel straight one-way roads, 2,000 m long, 3.5 m wide (1 lane), 25 m apart, speed limit 13.9 m/s, no junctions. One road for every 50 vehicles asked for (20, 60 and 100 roads). Each road starts with 50 cars spaced evenly at 13 m/s and has a demand of 1,200 cars an hour.

## Engine alone, in Node

Each repetition is a new Node process with its own seed: 1500 steps of warm-up thrown away, then 3000 timed steps of 0.2 simulated seconds.

| Scenario | Vehicles asked for | Vehicles on the network (min, mean, max) | What is timed | Simulated s per real s: median (min to max) | ms per step: median | Repetitions |
|---|---|---|---|---|---|---|
| mixed | 1000 | 915, 1004, 1068 | step only | 430 (295 to 456) | 0.465 | 5 |
| mixed | 1000 | 915, 1004, 1068 | step + build a snapshot | 232 (103 to 353) | 0.861 | 5 |
| mixed | 3000 | 2928, 3027, 3164 | step only | 99 (97 to 133) | 2.016 | 5 |
| mixed | 3000 | 2928, 3027, 3164 | step + build a snapshot | 75 (65 to 81) | 2.678 | 5 |
| mixed | 5000 | 4916, 5045, 5201 | step only | 71 (63 to 75) | 2.830 | 5 |
| mixed | 5000 | 4916, 5045, 5201 | step + build a snapshot | 48 (39 to 48) | 4.198 | 5 |
| cars-only | 1000 | 956, 1009, 1096 | step only | 383 (376 to 421) | 0.523 | 5 |
| cars-only | 1000 | 956, 1009, 1096 | step + build a snapshot | 310 (221 to 318) | 0.645 | 5 |
| cars-only | 3000 | 2955, 3051, 3167 | step only | 127 (122 to 129) | 1.580 | 5 |
| cars-only | 3000 | 2955, 3051, 3167 | step + build a snapshot | 78 (71 to 90) | 2.581 | 5 |
| cars-only | 5000 | 4957, 5094, 5221 | step only | 62 (59 to 71) | 3.212 | 5 |
| cars-only | 5000 | 4957, 5094, 5221 | step + build a snapshot | 45 (44 to 47) | 4.430 | 5 |

## Chrome, headed-gpu

- Drawn with: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --window-position=40,40`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Scenario | Vehicles asked for | Vehicles on the network | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 977 | 750 (504 to 790) | 0.301 | 0.059 | 0.238 | 0.314 | 0.050 | 0.0035 | 1667 (1663 to 1688) | 2403 (2272 to 2434) | 3 |
| mixed | 3000 | 3020 | 242 (225 to 246) | 0.951 | 0.421 | 0.666 | 0.930 | 0.107 | 0.0095 | 508 (409 to 514) | 712 (574 to 725) | 3 |
| mixed | 5000 | 5070 | 141 (131 to 144) | 1.597 | 0.767 | 1.079 | 1.487 | 0.060 | 0.0111 | 287 (283 to 290) | 414 (318 to 415) | 3 |

### The app's worker and 3D view

The runs are advanced together by the app's own worker (`apps/web/src/run.worker.ts`), which posts one message holding a snapshot of every run, and each run is drawn, where drawn, by the app's own 3D view (`apps/web/src/RoadScene.tsx`), all unchanged. Two runs stand for a baseline and a proposal: one worker, two views side by side, each half the window. Where "seeds running unseen" says yes, the app's second worker (`apps/web/src/seeds.worker.ts`) was also running every seed of the same inputs flat out, as it does in the app while the planner watches. The view draws at most 4,000 vehicles. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Scenario | Vehicles asked for | Speed asked for | Runs | Drawn | Seeds running unseen | Speed achieved | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Messages received per s | Reading and storing one message, ms | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 5× | 1 | no | yes | 5.00× | 120.0 | 8.3 / 9.3 / 9.3 | – | 25.0 | 0.34 | 972 |
| mixed | 1000 | 5× | 1 | yes | yes | 4.99× | 120.0 | 8.3 / 9.1 / 9.3 | 0.56 | 24.9 | 0.38 | 968 |
| mixed | 1000 | 5× | 2 | no | yes | 5.00× | 120.0 | 8.3 / 9.2 / 9.3 | – | 25.0 | 0.65 | 972, 1001 |
| mixed | 1000 | 5× | 2 | yes | yes | 5.00× | 120.0 | 8.3 / 9.2 / 9.3 | 1.08 | 25.0 | 0.79 | 967, 994 |
| mixed | 3000 | 5× | 1 | no | yes | 5.00× | 120.0 | 8.3 / 9.2 / 9.3 | – | 25.0 | 0.92 | 2823 |
| mixed | 3000 | 5× | 1 | yes | yes | 5.00× | 120.0 | 8.3 / 9.3 / 9.3 | 1.43 | 25.0 | 1.10 | 2814 |
| mixed | 3000 | 5× | 2 | no | yes | 5.00× | 120.1 | 8.3 / 9.2 / 9.3 | – | 25.0 | 1.83 | 2821, 2914 |
| mixed | 3000 | 5× | 2 | yes | yes | 5.00× | 120.0 | 8.3 / 9.2 / 9.3 | 3.10 | 25.0 | 2.23 | 2812, 2910 |
| mixed | 5000 | 5× | 1 | no | yes | 5.00× | 120.0 | 8.3 / 9.2 / 9.3 | – | 25.0 | 1.52 | 4877 |
| mixed | 5000 | 5× | 1 | yes | yes | 5.00× | 120.0 | 8.3 / 9.3 / 9.3 | 2.19 | 25.0 | 1.74 | 4871 |
| mixed | 5000 | 5× | 2 | no | yes | 5.00× | 120.1 | 8.3 / 9.2 / 9.3 | – | 25.0 | 2.97 | 4871, 4887 |
| mixed | 5000 | 5× | 2 | yes | yes | 4.99× | 120.0 | 8.3 / 9.2 / 9.3 | 4.28 | 25.0 | 3.43 | 4853, 4868 |
| mixed | 1000 | 16× | 1 | no | yes | 16.00× | 120.1 | 8.3 / 9.3 / 9.3 | – | 40.0 | 0.39 | 934 |
| mixed | 1000 | 16× | 1 | yes | yes | 16.00× | 120.1 | 8.3 / 9.1 / 9.7 | 0.59 | 40.0 | 0.42 | 927 |
| mixed | 1000 | 16× | 2 | no | yes | 16.00× | 120.1 | 8.3 / 9.2 / 9.3 | – | 40.0 | 0.64 | 934, 1067 |
| mixed | 1000 | 16× | 2 | yes | yes | 16.00× | 120.0 | 8.3 / 9.2 / 9.3 | 1.11 | 40.0 | 0.75 | 927, 1068 |
| mixed | 3000 | 16× | 1 | no | yes | 16.00× | 120.0 | 8.3 / 9.2 / 9.3 | – | 40.0 | 0.95 | 2959 |
| mixed | 3000 | 16× | 1 | yes | yes | 16.00× | 120.0 | 8.3 / 9.2 / 9.3 | 1.50 | 40.0 | 1.09 | 2958 |
| mixed | 3000 | 16× | 2 | no | yes | 15.99× | 119.7 | 8.3 / 9.2 / 34.1 | – | 40.0 | 1.85 | 2959, 3090 |
| mixed | 3000 | 16× | 2 | yes | yes | 16.00× | 120.0 | 8.3 / 9.3 / 9.3 | 3.05 | 40.0 | 2.11 | 2960, 3078 |
| mixed | 5000 | 16× | 1 | no | yes | 16.01× | 120.0 | 8.3 / 9.2 / 9.3 | – | 40.0 | 1.53 | 4924 |
| mixed | 5000 | 16× | 1 | yes | yes | 16.00× | 119.7 | 8.3 / 9.3 / 16.4 | 2.56 | 39.5 | 2.03 | 4928 |
| mixed | 5000 | 16× | 2 | no | yes | 16.00× | 120.0 | 8.3 / 9.3 / 9.3 | – | 40.0 | 3.00 | 4924, 5208 |
| mixed | 5000 | 16× | 2 | yes | yes | 15.98× | 119.3 | 8.3 / 9.3 / 17.0 | 4.46 | 40.0 | 3.54 | 4926, 5215 |
| mixed | 1000 | 80× | 1 | no | yes | 73.68× | 120.0 | 8.3 / 10.2 / 10.3 | – | 40.0 | 0.37 | 995 |
| mixed | 1000 | 80× | 1 | yes | yes | 72.19× | 120.0 | 8.3 / 8.4 / 10.2 | 0.48 | 40.0 | 0.38 | 1022 |
| mixed | 1000 | 80× | 2 | no | yes | 77.62× | 120.0 | 8.3 / 8.4 / 10.3 | – | 40.0 | 0.63 | 1019, 987 |
| mixed | 1000 | 80× | 2 | yes | yes | 77.46× | 120.0 | 8.3 / 8.6 / 10.3 | 0.92 | 40.0 | 0.68 | 1021, 990 |
| mixed | 3000 | 80× | 1 | no | yes | 75.86× | 120.0 | 8.3 / 8.6 / 10.2 | – | 40.0 | 0.92 | 2966 |
| mixed | 3000 | 80× | 1 | yes | yes | 76.60× | 120.0 | 8.3 / 8.7 / 10.3 | 1.24 | 40.0 | 1.01 | 2988 |
| mixed | 3000 | 80× | 2 | no | yes | 77.36× | 120.1 | 8.3 / 8.8 / 10.2 | – | 40.0 | 1.79 | 3030, 3031 |
| mixed | 3000 | 80× | 2 | yes | yes | 75.90× | 120.0 | 8.3 / 9.0 / 10.3 | 2.42 | 40.0 | 1.93 | 2960, 2959 |
| mixed | 5000 | 80× | 1 | no | yes | 75.44× | 120.0 | 8.3 / 9.5 / 10.3 | – | 40.0 | 1.52 | 4952 |
| mixed | 5000 | 80× | 1 | yes | yes | 75.29× | 120.0 | 8.3 / 9.4 / 10.3 | 1.78 | 40.1 | 1.64 | 4926 |
| mixed | 5000 | 80× | 2 | no | yes | 56.00× | 120.0 | 8.3 / 8.4 / 10.3 | – | 28.0 | 2.95 | 5195, 5159 |
| mixed | 5000 | 80× | 2 | yes | yes | 48.11× | 120.0 | 8.3 / 9.2 / 10.3 | 3.26 | 24.0 | 3.24 | 5010, 5008 |
