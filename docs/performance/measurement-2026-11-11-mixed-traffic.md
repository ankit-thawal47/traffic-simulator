# Performance measurement, 2026-11-11-mixed-traffic

Written by `pnpm perf` (`apps/web/perf/measure.mjs`). Every figure below was observed in that run; nothing is typed by hand.
What the figures mean, and what follows from them, is in `docs/performance.md`.

## Machine

- Machine: Mac15,7, Apple M3 Pro, 12 logical processors, 18 GB memory
- Operating system: macOS 27.0.1 (Darwin 27.0.0 (arm64))
- Node v22.7.0 (V8 12.4.254.21-node.18)
- Chrome: Google Chrome 157.0.8103.51
- Power: Now drawing from 'AC Power'
- Display: Resolution: 3456 x 2234 Retina
- Load average when the measurement started (1, 5, 15 minutes): 10.01, 8.65, 8.39
- Options: counts 1000, 3000, 5000; speeds asked for 5, 16, 80; 5 repetitions of the engine measurement; 3 of the snapshot measurement; views warmed up for 4 s and measured for 10 s

## Scenarios

Built in `apps/web/perf/scenario.ts` from the engine's public input.

- **mixed.** Mixed traffic without lane discipline. Parallel straight one-way roads, 1,000 m long, 10.5 m wide (3 lanes), 25 m apart, speed limit 13.9 m/s, no junctions. One road for every 125 vehicles asked for (8, 24 and 40 roads for 1,000, 3,000 and 5,000 vehicles). Each road starts with 125 vehicles of the Bengaluru vehicle mix in three files at 12 m/s and has a demand of 6,000 vehicles an hour of the same mix, which replaces the vehicles that leave. Traffic is busy but flowing: there is no signal and no queue.
- **cars-only.** Cars only, single file. Parallel straight one-way roads, 2,000 m long, 3.5 m wide (1 lane), 25 m apart, speed limit 13.9 m/s, no junctions. One road for every 50 vehicles asked for (20, 60 and 100 roads). Each road starts with 50 cars spaced evenly at 13 m/s and has a demand of 1,200 cars an hour.

## Engine alone, in Node

Each repetition is a new Node process with its own seed: 1500 steps of warm-up thrown away, then 3000 timed steps of 0.2 simulated seconds.

| Scenario | Vehicles asked for | Vehicles on the network (min, mean, max) | What is timed | Simulated s per real s: median (min to max) | ms per step: median | Repetitions |
|---|---|---|---|---|---|---|
| mixed | 1000 | 915, 1004, 1068 | step only | 757 (728 to 798) | 0.264 | 5 |
| mixed | 1000 | 915, 1004, 1068 | step + build a snapshot | 560 (467 to 580) | 0.357 | 5 |
| mixed | 3000 | 2928, 3027, 3164 | step only | 249 (232 to 253) | 0.805 | 5 |
| mixed | 3000 | 2928, 3027, 3164 | step + build a snapshot | 178 (168 to 182) | 1.126 | 5 |
| mixed | 5000 | 4916, 5045, 5201 | step only | 152 (141 to 152) | 1.320 | 5 |
| mixed | 5000 | 4916, 5045, 5201 | step + build a snapshot | 103 (102 to 107) | 1.938 | 5 |
| cars-only | 1000 | 956, 1009, 1096 | step only | 763 (642 to 784) | 0.262 | 5 |
| cars-only | 1000 | 956, 1009, 1096 | step + build a snapshot | 579 (569 to 591) | 0.346 | 5 |
| cars-only | 3000 | 2955, 3051, 3167 | step only | 252 (246 to 258) | 0.794 | 5 |
| cars-only | 3000 | 2955, 3051, 3167 | step + build a snapshot | 188 (181 to 191) | 1.066 | 5 |
| cars-only | 5000 | 4957, 5094, 5221 | step only | 152 (140 to 155) | 1.316 | 5 |
| cars-only | 5000 | 4957, 5094, 5221 | step + build a snapshot | 109 (109 to 113) | 1.830 | 5 |

## Chrome, headed-gpu

- Drawn with: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --window-position=40,40`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Scenario | Vehicles asked for | Vehicles on the network | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 977 | 918 (805 to 941) | 0.264 | 0.063 | 0.153 | 0.291 | 0.037 | 0.0016 | 1986 (1621 to 2135) | 2758 (2640 to 2828) | 3 |
| mixed | 3000 | 3020 | 301 (299 to 305) | 0.761 | 0.330 | 0.460 | 0.850 | 0.038 | 0.0016 | 641 (640 to 644) | 885 (880 to 888) | 3 |
| mixed | 5000 | 5070 | 179 (178 to 179) | 1.293 | 0.570 | 0.824 | 1.424 | 0.052 | 0.0017 | 372 (367 to 376) | 525 (471 to 527) | 3 |

### The app's worker and 3D view

The runs are advanced together by the app's own worker (`apps/web/src/run.worker.ts`), which posts one message holding a snapshot of every run, and each run is drawn, where drawn, by the app's own 3D view (`apps/web/src/RoadScene.tsx`), all unchanged. Two runs stand for a baseline and a proposal: one worker, two views side by side, each half the window. The view draws at most 4,000 vehicles. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Scenario | Vehicles asked for | Speed asked for | Runs | Drawn | Speed achieved | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Messages received per s | Reading and storing one message, ms | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 5× | 1 | no | 5.00× | 120.1 | 8.3 / 9.3 / 10.3 | – | 25.0 | 0.69 | 972 |
| mixed | 1000 | 5× | 1 | yes | 5.00× | 120.1 | 8.3 / 9.3 / 9.3 | 0.75 | 25.0 | 0.57 | 970 |
| mixed | 1000 | 5× | 2 | no | 5.00× | 120.0 | 8.3 / 9.3 / 10.5 | – | 25.0 | 0.59 | 972, 1001 |
| mixed | 1000 | 5× | 2 | yes | 5.00× | 120.0 | 8.3 / 9.3 / 11.8 | 0.78 | 25.0 | 0.66 | 970, 998 |
| mixed | 3000 | 5× | 1 | no | 5.00× | 120.0 | 8.3 / 9.2 / 11.3 | – | 25.0 | 0.85 | 2823 |
| mixed | 3000 | 5× | 1 | yes | 5.00× | 120.1 | 8.3 / 9.3 / 10.5 | 1.06 | 25.0 | 0.90 | 2821 |
| mixed | 3000 | 5× | 2 | no | 5.01× | 120.0 | 8.3 / 9.2 / 10.4 | – | 25.0 | 1.68 | 2823, 2921 |
| mixed | 3000 | 5× | 2 | yes | 5.00× | 120.1 | 8.3 / 9.3 / 9.3 | 2.10 | 25.0 | 1.79 | 2812, 2910 |
| mixed | 5000 | 5× | 1 | no | 5.00× | 120.0 | 8.3 / 9.2 / 9.3 | – | 25.0 | 1.41 | 4877 |
| mixed | 5000 | 5× | 1 | yes | 5.00× | 119.8 | 8.3 / 9.0 / 10.9 | 1.55 | 25.0 | 1.50 | 4871 |
| mixed | 5000 | 5× | 2 | no | 5.00× | 120.0 | 8.3 / 9.3 / 13.2 | – | 25.0 | 2.85 | 4877, 4898 |
| mixed | 5000 | 5× | 2 | yes | 5.00× | 120.0 | 8.3 / 9.2 / 10.2 | 3.05 | 25.0 | 2.98 | 4871, 4887 |
| mixed | 1000 | 16× | 1 | no | 16.01× | 120.1 | 8.3 / 9.3 / 9.4 | – | 40.0 | 0.92 | 937 |
| mixed | 1000 | 16× | 1 | yes | 16.00× | 119.9 | 8.3 / 9.3 / 16.8 | 0.91 | 40.0 | 0.68 | 934 |
| mixed | 1000 | 16× | 2 | no | 16.00× | 120.0 | 8.3 / 9.3 / 9.3 | – | 40.0 | 0.62 | 937, 1066 |
| mixed | 1000 | 16× | 2 | yes | 16.00× | 120.0 | 8.3 / 9.3 / 9.3 | 0.90 | 40.0 | 0.67 | 927, 1068 |
| mixed | 3000 | 16× | 1 | no | 15.99× | 120.1 | 8.3 / 9.3 / 9.3 | – | 40.0 | 1.27 | 2960 |
| mixed | 3000 | 16× | 1 | yes | 16.00× | 119.9 | 8.3 / 9.2 / 13.1 | 1.45 | 40.0 | 1.11 | 2959 |
| mixed | 3000 | 16× | 2 | no | 16.00× | 120.1 | 8.3 / 9.3 / 9.3 | – | 40.0 | 1.98 | 2960, 3080 |
| mixed | 3000 | 16× | 2 | yes | 16.00× | 120.0 | 8.3 / 9.3 / 11.5 | 2.41 | 40.0 | 1.89 | 2959, 3072 |
| mixed | 5000 | 16× | 1 | no | 16.00× | 120.0 | 8.3 / 9.3 / 10.7 | – | 40.0 | 1.89 | 4936 |
| mixed | 5000 | 16× | 1 | yes | 16.00× | 120.0 | 8.3 / 9.3 / 9.3 | 1.79 | 40.0 | 1.59 | 4931 |
| mixed | 5000 | 16× | 2 | no | 16.00× | 120.0 | 8.3 / 9.3 / 12.3 | – | 39.9 | 2.99 | 4931, 5216 |
| mixed | 5000 | 16× | 2 | yes | 15.99× | 120.0 | 8.3 / 9.3 / 9.3 | 3.37 | 40.0 | 3.12 | 4935, 5202 |
| mixed | 1000 | 80× | 1 | no | 77.15× | 120.0 | 8.3 / 9.3 / 10.5 | – | 40.0 | 0.34 | 1028 |
| mixed | 1000 | 80× | 1 | yes | 76.26× | 120.0 | 8.3 / 9.1 / 9.3 | 0.49 | 40.0 | 0.36 | 1003 |
| mixed | 1000 | 80× | 2 | no | 75.96× | 119.9 | 8.3 / 9.2 / 14.3 | – | 40.0 | 0.63 | 1015, 995 |
| mixed | 1000 | 80× | 2 | yes | 76.48× | 120.0 | 8.3 / 9.3 / 9.3 | 0.89 | 40.0 | 0.69 | 1001, 1004 |
| mixed | 3000 | 80× | 1 | no | 76.69× | 120.0 | 8.3 / 9.2 / 9.3 | – | 40.0 | 0.91 | 3015 |
| mixed | 3000 | 80× | 1 | yes | 77.24× | 120.0 | 8.3 / 9.3 / 10.2 | 1.27 | 40.0 | 0.98 | 3015 |
| mixed | 3000 | 80× | 2 | no | 79.89× | 120.0 | 8.3 / 9.3 / 9.3 | – | 40.0 | 1.79 | 2974, 3061 |
| mixed | 3000 | 80× | 2 | yes | 79.73× | 120.0 | 8.3 / 9.3 / 13.6 | 2.43 | 40.1 | 1.89 | 3005, 3072 |
| mixed | 5000 | 80× | 1 | no | 78.74× | 120.0 | 8.3 / 8.9 / 9.3 | – | 40.0 | 1.49 | 4932 |
| mixed | 5000 | 80× | 1 | yes | 78.97× | 120.0 | 8.3 / 9.3 / 10.5 | 1.74 | 40.1 | 1.57 | 4929 |
| mixed | 5000 | 80× | 2 | no | 61.87× | 119.8 | 8.3 / 9.3 / 16.7 | – | 30.9 | 2.96 | 5015, 5087 |
| mixed | 5000 | 80× | 2 | yes | 51.48× | 120.0 | 8.3 / 9.3 / 9.3 | 3.30 | 25.8 | 3.11 | 5248, 4988 |

## Chrome, headed-gpu-uncapped

- Drawn with: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --window-position=40,40 --disable-frame-rate-limit --disable-gpu-vsync`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Scenario | Vehicles asked for | Vehicles on the network | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 977 | 875 (854 to 883) | 0.265 | 0.078 | 0.152 | 0.284 | 0.030 | 0.0016 | 2022 (1904 to 2025) | 2701 (2677 to 2704) | 3 |
| mixed | 3000 | 3020 | 279 (271 to 282) | 0.820 | 0.358 | 0.513 | 0.876 | 0.049 | 0.0035 | 594 (579 to 599) | 821 (818 to 824) | 3 |
| mixed | 5000 | 5070 | 167 (157 to 169) | 1.402 | 0.612 | 0.856 | 1.462 | 0.064 | 0.0052 | 347 (315 to 349) | 482 (449 to 493) | 3 |

### The app's worker and 3D view

The runs are advanced together by the app's own worker (`apps/web/src/run.worker.ts`), which posts one message holding a snapshot of every run, and each run is drawn, where drawn, by the app's own 3D view (`apps/web/src/RoadScene.tsx`), all unchanged. Two runs stand for a baseline and a proposal: one worker, two views side by side, each half the window. The view draws at most 4,000 vehicles. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Scenario | Vehicles asked for | Speed asked for | Runs | Drawn | Speed achieved | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Messages received per s | Reading and storing one message, ms | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 5× | 1 | no | 5.00× | 81.6 | 17.2 / 17.7 / 18.2 | – | 25.0 | 0.34 | 972 |
| mixed | 1000 | 5× | 1 | yes | 5.00× | 440.4 | 2.5 / 3.5 / 5.2 | 2.08 | 25.0 | 0.42 | 970 |
| mixed | 1000 | 5× | 2 | no | 5.00× | 81.5 | 17.2 / 17.7 / 18.2 | – | 25.0 | 0.64 | 972, 1001 |
| mixed | 1000 | 5× | 2 | yes | 5.00× | 374.8 | 2.7 / 5.3 / 12.4 | 2.35 | 25.0 | 0.75 | 967, 994 |
| mixed | 3000 | 5× | 1 | no | 5.01× | 81.6 | 17.3 / 17.7 / 18.6 | – | 25.0 | 0.89 | 2823 |
| mixed | 3000 | 5× | 1 | yes | 5.00× | 429.7 | 2.5 / 3.1 / 7.8 | 2.11 | 25.0 | 1.04 | 2821 |
| mixed | 3000 | 5× | 2 | no | 5.00× | 81.4 | 17.4 / 17.7 / 17.9 | – | 25.0 | 2.92 | 2823, 2921 |
| mixed | 3000 | 5× | 2 | yes | 5.00× | 352.7 | 2.5 / 4.7 / 12.2 | 2.47 | 25.0 | 1.91 | 2812, 2910 |
| mixed | 5000 | 5× | 1 | no | 5.00× | 81.6 | 17.4 / 17.7 / 17.8 | – | 25.0 | 1.41 | 4877 |
| mixed | 5000 | 5× | 1 | yes | 5.00× | 438.7 | 2.3 / 3.7 / 7.9 | 2.03 | 25.0 | 1.61 | 4871 |
| mixed | 5000 | 5× | 2 | no | 5.00× | 81.6 | 17.3 / 17.7 / 18.5 | – | 25.0 | 2.88 | 4877, 4898 |
| mixed | 5000 | 5× | 2 | yes | 5.00× | 267.9 | 3.3 / 6.5 / 8.5 | 3.31 | 25.0 | 3.10 | 4853, 4868 |

## Chrome, headless-gpu

- Drawn with: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --headless=new --enable-gpu --use-angle=metal`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Scenario | Vehicles asked for | Vehicles on the network | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 977 | 865 (863 to 878) | 0.263 | 0.074 | 0.151 | 0.293 | 0.033 | 0.0019 | 2027 (2008 to 2031) | 2675 (2585 to 2687) | 3 |
| mixed | 3000 | 3020 | 286 (285 to 287) | 0.809 | 0.353 | 0.481 | 0.866 | 0.036 | 0.0027 | 605 (599 to 609) | 835 (831 to 837) | 3 |
| mixed | 5000 | 5070 | 167 (165 to 168) | 1.379 | 0.614 | 0.817 | 1.445 | 0.037 | 0.0041 | 354 (353 to 355) | 496 (489 to 497) | 3 |

### The app's worker and 3D view

The runs are advanced together by the app's own worker (`apps/web/src/run.worker.ts`), which posts one message holding a snapshot of every run, and each run is drawn, where drawn, by the app's own 3D view (`apps/web/src/RoadScene.tsx`), all unchanged. Two runs stand for a baseline and a proposal: one worker, two views side by side, each half the window. The view draws at most 4,000 vehicles. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Scenario | Vehicles asked for | Speed asked for | Runs | Drawn | Speed achieved | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Messages received per s | Reading and storing one message, ms | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 5× | 1 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 0.34 | 972 |
| mixed | 1000 | 5× | 1 | yes | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 0.47 | 25.0 | 0.35 | 967 |
| mixed | 1000 | 5× | 2 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 0.60 | 972, 1001 |
| mixed | 1000 | 5× | 2 | yes | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 0.89 | 25.0 | 0.65 | 970, 998 |
| mixed | 3000 | 5× | 1 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 1.99 | 2823 |
| mixed | 3000 | 5× | 1 | yes | 5.00× | 60.1 | 16.7 / 16.7 / 16.7 | 1.58 | 25.0 | 1.24 | 2821 |
| mixed | 3000 | 5× | 2 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 1.73 | 2823, 2921 |
| mixed | 3000 | 5× | 2 | yes | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 2.80 | 25.0 | 2.19 | 2812, 2910 |
| mixed | 5000 | 5× | 1 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 1.48 | 4877 |
| mixed | 5000 | 5× | 1 | yes | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 1.77 | 25.0 | 1.59 | 4871 |
| mixed | 5000 | 5× | 2 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 3.71 | 4877, 4898 |
| mixed | 5000 | 5× | 2 | yes | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 3.40 | 25.0 | 3.17 | 4853, 4868 |
| mixed | 1000 | 16× | 1 | no | 16.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 40.0 | 0.45 | 937 |
| mixed | 1000 | 16× | 1 | yes | 16.00× | 60.0 | 16.7 / 16.7 / 16.7 | 0.48 | 40.0 | 0.34 | 934 |
| mixed | 1000 | 16× | 2 | no | 16.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 40.0 | 1.29 | 937, 1066 |
| mixed | 1000 | 16× | 2 | yes | 16.00× | 60.0 | 16.7 / 16.7 / 16.7 | 1.55 | 40.0 | 1.10 | 932, 1062 |
| mixed | 3000 | 16× | 1 | no | 16.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 40.0 | 1.01 | 2960 |
| mixed | 3000 | 16× | 1 | yes | 16.00× | 60.0 | 16.7 / 16.7 / 16.7 | 1.28 | 40.0 | 0.98 | 2958 |
| mixed | 3000 | 16× | 2 | no | 16.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 40.0 | 1.73 | 2960, 3080 |
| mixed | 3000 | 16× | 2 | yes | 16.00× | 60.1 | 16.7 / 16.7 / 16.7 | 2.53 | 40.0 | 1.90 | 2959, 3072 |
| mixed | 5000 | 16× | 1 | no | 15.99× | 60.0 | 16.7 / 16.7 / 16.7 | – | 40.0 | 1.70 | 4936 |
| mixed | 5000 | 16× | 1 | yes | 15.99× | 60.0 | 16.7 / 16.7 / 16.7 | 2.15 | 40.0 | 1.78 | 4931 |
| mixed | 5000 | 16× | 2 | no | 16.01× | 60.0 | 16.7 / 16.7 / 16.7 | – | 40.0 | 2.91 | 4931, 5216 |
| mixed | 5000 | 16× | 2 | yes | 15.99× | 60.0 | 16.7 / 16.7 / 16.7 | 3.50 | 40.0 | 3.12 | 4924, 5201 |
| mixed | 1000 | 80× | 1 | no | 77.46× | 60.0 | 16.7 / 16.7 / 16.7 | – | 40.0 | 0.33 | 1020 |
| mixed | 1000 | 80× | 1 | yes | 77.96× | 60.0 | 16.7 / 16.7 / 16.7 | 0.82 | 40.0 | 0.56 | 1027 |
| mixed | 1000 | 80× | 2 | no | 78.78× | 60.0 | 16.7 / 16.7 / 16.7 | – | 40.0 | 0.73 | 1015, 967 |
| mixed | 1000 | 80× | 2 | yes | 77.42× | 60.0 | 16.7 / 16.7 / 16.7 | 0.93 | 40.0 | 0.67 | 1013, 1011 |
| mixed | 3000 | 80× | 1 | no | 77.39× | 60.0 | 16.7 / 16.7 / 16.7 | – | 39.9 | 0.94 | 3016 |
| mixed | 3000 | 80× | 1 | yes | 77.22× | 60.0 | 16.7 / 16.7 / 16.7 | 1.37 | 39.9 | 0.99 | 2972 |
| mixed | 3000 | 80× | 2 | no | 79.89× | 60.1 | 16.7 / 16.7 / 16.7 | – | 40.0 | 1.80 | 2976, 3067 |
| mixed | 3000 | 80× | 2 | yes | 80.00× | 60.0 | 16.7 / 16.7 / 16.7 | 2.48 | 40.0 | 1.88 | 2999, 3091 |
| mixed | 5000 | 80× | 1 | no | 79.32× | 60.0 | 16.7 / 16.7 / 16.7 | – | 40.0 | 1.46 | 4895 |
| mixed | 5000 | 80× | 1 | yes | 78.54× | 60.0 | 16.7 / 16.7 / 16.7 | 1.84 | 40.0 | 1.61 | 4913 |
| mixed | 5000 | 80× | 2 | no | 59.61× | 60.0 | 16.7 / 16.7 / 16.7 | – | 29.8 | 2.99 | 5009, 5097 |
| mixed | 5000 | 80× | 2 | yes | 60.72× | 60.0 | 16.7 / 16.7 / 16.7 | 3.49 | 30.4 | 3.18 | 5108, 5145 |

## Chrome, headless-software

- Drawn with: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver) — **software drawing; these frame rates are not the product's**
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Scenario | Vehicles asked for | Vehicles on the network | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 977 | 859 (846 to 879) | 0.270 | 0.070 | 0.154 | 0.291 | 0.037 | 0.0020 | 2003 (1984 to 2035) | 2685 (2570 to 2701) | 3 |
| mixed | 3000 | 3020 | 274 (265 to 274) | 0.838 | 0.440 | 0.542 | 0.904 | 0.062 | 0.0045 | 579 (397 to 587) | 779 (719 to 799) | 3 |
| mixed | 5000 | 5070 | 157 (152 to 159) | 1.463 | 0.680 | 0.928 | 1.540 | 0.036 | 0.0033 | 324 (321 to 325) | 460 (455 to 472) | 3 |

### The app's worker and 3D view

The runs are advanced together by the app's own worker (`apps/web/src/run.worker.ts`), which posts one message holding a snapshot of every run, and each run is drawn, where drawn, by the app's own 3D view (`apps/web/src/RoadScene.tsx`), all unchanged. Two runs stand for a baseline and a proposal: one worker, two views side by side, each half the window. The view draws at most 4,000 vehicles. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Scenario | Vehicles asked for | Speed asked for | Runs | Drawn | Speed achieved | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Messages received per s | Reading and storing one message, ms | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mixed | 1000 | 5× | 1 | no | 5.00× | 59.0 | 16.7 / 16.7 / 83.3 | – | 25.0 | 0.35 | 972 |
| mixed | 1000 | 5× | 1 | yes | 5.00× | 3.1 | 283.3 / 566.6 / 600.0 | 0.69 | 25.0 | 0.36 | 965 |
| mixed | 1000 | 5× | 2 | no | 5.00× | 54.9 | 16.7 / 16.7 / 166.7 | – | 25.0 | 0.62 | 970, 998 |
| mixed | 1000 | 5× | 2 | yes | 5.00× | 1.8 | 466.6 / 1033.3 / 1033.3 | 1.27 | 25.0 | 0.69 | 966, 1000 |
| mixed | 3000 | 5× | 1 | no | 5.00× | 47.1 | 16.7 / 50.0 / 133.3 | – | 25.0 | 0.88 | 2823 |
| mixed | 3000 | 5× | 1 | yes | 5.00× | 1.2 | 650.0 / 1233.3 / 1233.3 | 1.58 | 25.0 | 0.96 | 2825 |
| mixed | 3000 | 5× | 2 | no | 4.99× | 45.2 | 16.7 / 50.0 / 183.3 | – | 24.9 | 1.84 | 2821, 2914 |
| mixed | 3000 | 5× | 2 | yes | 5.00× | 1.3 | 716.6 / 1199.9 / 1199.9 | 3.12 | 25.1 | 1.93 | 2824, 2923 |
| mixed | 5000 | 5× | 1 | no | 4.99× | 51.6 | 16.7 / 33.3 / 116.7 | – | 25.0 | 1.53 | 4877 |
| mixed | 5000 | 5× | 1 | yes | 5.00× | 1.0 | 833.3 / 2016.6 / 2016.6 | 2.61 | 25.0 | 1.61 | 4846 |
| mixed | 5000 | 5× | 2 | no | 5.00× | 39.6 | 16.7 / 83.3 / 183.3 | – | 25.0 | 2.92 | 4871, 4887 |
| mixed | 5000 | 5× | 2 | yes | 5.00× | 0.7 | 2349.9 / 2649.9 / 2649.9 | 4.31 | 25.0 | 3.05 | 4883, 4915 |
