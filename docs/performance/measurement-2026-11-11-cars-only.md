# Performance measurement, 2026-11-11

Written by `pnpm perf` (`apps/web/perf/measure.mjs`). Every figure below was observed in that run; nothing is typed by hand.
What the figures mean, and what follows from them, is in `docs/performance.md`.

## Machine

- Machine: Mac15,7, Apple M3 Pro, 12 logical processors, 18 GB memory
- Operating system: macOS 27.0.1 (Darwin 27.0.0 (arm64))
- Node v22.7.0 (V8 12.4.254.21-node.18)
- Chrome: Google Chrome 157.0.8103.51
- Power: Now drawing from 'AC Power'
- Display: Resolution: 3456 x 2234 Retina
- Load average when the measurement started (1, 5, 15 minutes): 11.17, 9.35, 7.88
- Options: counts 1000, 3000, 5000; 5 repetitions of the engine measurement; 3 of the snapshot measurement; views warmed up for 4 s and measured for 10 s

## Scenario

Parallel straight one-way roads, 2,000 m long, 12 m apart, cars only, single file, speed limit 13.9 m/s. One road for every 50 vehicles asked for (20, 60 and 100 roads for 1,000, 3,000 and 5,000 vehicles). Each road starts with 50 cars spaced evenly at 13 m/s and has a demand of 1,200 vehicles an hour, which replaces the cars that leave. Built in `apps/web/perf/scenario.ts` from the engine's public input.

## Engine alone, in Node

Each repetition is a new Node process with its own seed: 1500 steps of warm-up thrown away, then 3000 timed steps of 0.2 simulated seconds.

| Vehicles asked for | Vehicles on the network (min, mean, max) | What is timed | Simulated s per real s: median (min to max) | ms per step: median | Repetitions |
|---|---|---|---|---|---|
| 1000 | 956, 1009, 1096 | step only | 5427 (5308 to 5607) | 0.037 | 5 |
| 1000 | 956, 1009, 1096 | step + build a snapshot | 1724 (1646 to 1804) | 0.116 | 5 |
| 3000 | 2955, 3051, 3167 | step only | 1751 (1740 to 1799) | 0.114 | 5 |
| 3000 | 2955, 3051, 3167 | step + build a snapshot | 512 (500 to 516) | 0.390 | 5 |
| 5000 | 4957, 5094, 5221 | step only | 1039 (999 to 1054) | 0.192 | 5 |
| 5000 | 4957, 5094, 5221 | step + build a snapshot | 285 (260 to 298) | 0.702 | 5 |

## Chrome, headed-gpu

- Drawn with: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --window-position=40,40`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Vehicles | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|
| 1000 | 6562 (4841 to 6695) | 0.032 | 0.076 | 0.154 | 0.296 | 0.020 | 0.0013 | 3223 (2294 to 3480) | 12029 (10025 to 12796) | 3 |
| 3000 | 1996 (1987 to 2010) | 0.105 | 0.246 | 0.453 | 0.933 | 0.070 | 0.0014 | 1059 (1044 to 1064) | 3623 (3620 to 3690) | 3 |
| 5000 | 1208 (1163 to 1219) | 0.178 | 0.434 | 0.787 | 1.507 | 0.081 | 0.0014 | 640 (636 to 647) | 1895 (1794 to 1983) | 3 |

### The app's worker and 3D view

Each run is the app's own worker (`apps/web/src/run.worker.ts`) and, where drawn, the app's own 3D view (`apps/web/src/RoadScene.tsx`), unchanged. Two runs are two workers and two views side by side. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Vehicles | Speed asked for | Runs | Drawn | Speed achieved, each run | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Snapshots received per s, each run | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|
| 1000 | 5× | 1 | no | 5.00× | 120.0 | 8.3 / 9.3 / 10.6 | – | 25.0 | 952 |
| 1000 | 5× | 1 | yes | 5.00× | 120.0 | 8.3 / 9.3 / 9.3 | 0.34 | 25.0 | 951 |
| 1000 | 5× | 2 | no | 5.00×, 5.00× | 120.0 | 8.3 / 9.3 / 9.4 | – | 25.0, 25.0 | 952, 969 |
| 1000 | 5× | 2 | yes | 5.00×, 5.00× | 120.0 | 8.3 / 9.3 / 11.1 | 0.84 | 25.0, 25.0 | 951, 965 |
| 3000 | 5× | 1 | no | 5.00× | 120.0 | 8.3 / 9.3 / 11.4 | – | 25.0 | 2910 |
| 3000 | 5× | 1 | yes | 5.00× | 120.0 | 8.3 / 9.3 / 11.0 | 1.04 | 25.0 | 2905 |
| 3000 | 5× | 2 | no | 5.00×, 5.00× | 120.0 | 8.3 / 9.3 / 14.6 | – | 25.0, 25.0 | 2910, 2920 |
| 3000 | 5× | 2 | yes | 5.00×, 5.00× | 120.0 | 8.3 / 9.3 / 9.3 | 1.35 | 25.0, 25.0 | 2903, 2912 |
| 5000 | 5× | 1 | no | 5.00× | 120.0 | 8.3 / 9.3 / 10.5 | – | 25.0 | 4840 |
| 5000 | 5× | 1 | yes | 5.00× | 120.0 | 8.3 / 9.3 / 16.1 | 1.24 | 25.0 | 4834 |
| 5000 | 5× | 2 | no | 5.00×, 5.00× | 120.1 | 8.3 / 9.3 / 9.3 | – | 25.0, 25.0 | 4840, 4893 |
| 5000 | 5× | 2 | yes | 5.00×, 5.00× | 120.1 | 8.3 / 9.3 / 9.3 | 1.88 | 25.0, 25.0 | 4831, 4881 |
| 1000 | 20× | 1 | no | 20.00× | 120.0 | 8.3 / 9.3 / 9.3 | – | 100.1 | 983 |
| 1000 | 20× | 1 | yes | 20.00× | 120.0 | 8.3 / 9.3 / 9.3 | 0.66 | 100.1 | 982 |
| 1000 | 20× | 2 | no | 20.00×, 20.00× | 120.0 | 8.3 / 9.3 / 9.3 | – | 100.0, 100.0 | 984, 1010 |
| 1000 | 20× | 2 | yes | 20.00×, 20.00× | 119.9 | 8.3 / 9.3 / 10.1 | 0.77 | 100.0, 100.0 | 985, 1008 |
| 3000 | 20× | 1 | no | 20.00× | 120.0 | 8.3 / 9.3 / 9.3 | – | 100.0 | 3096 |
| 3000 | 20× | 1 | yes | 20.00× | 120.0 | 8.3 / 9.3 / 10.5 | 1.00 | 100.0 | 3090 |
| 3000 | 20× | 2 | no | 20.00×, 20.00× | 120.0 | 8.3 / 9.3 / 9.3 | – | 100.0, 100.0 | 3096, 3084 |
| 3000 | 20× | 2 | yes | 20.00×, 20.00× | 119.9 | 8.3 / 9.3 / 11.4 | 1.38 | 100.0, 100.0 | 3093, 3078 |
| 5000 | 20× | 1 | no | 20.00× | 120.0 | 8.3 / 9.3 / 10.5 | – | 100.0 | 5144 |
| 5000 | 20× | 1 | yes | 20.00× | 119.9 | 8.3 / 9.3 / 10.5 | 1.18 | 100.0 | 5140 |
| 5000 | 20× | 2 | no | 20.00×, 20.00× | 120.0 | 8.3 / 9.3 / 10.5 | – | 100.0, 100.0 | 5144, 5193 |
| 5000 | 20× | 2 | yes | 20.00×, 20.00× | 120.1 | 8.3 / 9.3 / 9.3 | 1.98 | 100.0, 100.0 | 5147, 5183 |
| 1000 | 100× | 1 | no | 100.01× | 120.1 | 8.3 / 9.3 / 13.0 | – | 250.0 | 1070 |
| 1000 | 100× | 1 | yes | 99.99× | 119.9 | 8.3 / 9.3 / 16.8 | 0.55 | 250.0 | 1068 |
| 1000 | 100× | 2 | no | 99.99×, 99.99× | 120.0 | 8.3 / 9.3 / 9.3 | – | 250.0, 250.0 | 1071, 1003 |
| 1000 | 100× | 2 | yes | 99.99×, 100.01× | 120.0 | 8.3 / 9.3 / 10.5 | 0.55 | 249.7, 249.8 | 1071, 998 |
| 3000 | 100× | 1 | no | 100.00× | 120.0 | 8.3 / 9.3 / 9.3 | – | 249.8 | 3181 |
| 3000 | 100× | 1 | yes | 100.00× | 120.0 | 8.3 / 9.3 / 9.3 | 0.79 | 250.0 | 3163 |
| 3000 | 100× | 2 | no | 100.01×, 99.98× | 119.0 | 8.3 / 9.3 / 84.2 | – | 248.3, 248.4 | 3181, 3047 |
| 3000 | 100× | 2 | yes | 100.03×, 100.07× | 120.1 | 8.3 / 8.9 / 9.3 | 1.47 | 249.9, 249.9 | 3155, 3051 |
| 5000 | 100× | 1 | no | 99.99× | 120.0 | 8.3 / 8.9 / 9.3 | – | 249.9 | 5162 |
| 5000 | 100× | 1 | yes | 99.99× | 120.0 | 8.3 / 8.9 / 9.3 | 1.11 | 250.1 | 5150 |
| 5000 | 100× | 2 | no | 99.85×, 99.88× | 117.2 | 8.3 / 9.0 / 50.6 | – | 248.8, 248.7 | 5145, 5051 |
| 5000 | 100× | 2 | yes | 99.93×, 99.96× | 69.9 | 16.6 / 25.0 / 49.9 | 2.33 | 249.2, 249.3 | 5136, 5056 |

## Chrome, headed-gpu-uncapped

- Drawn with: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --window-position=40,40 --disable-frame-rate-limit --disable-gpu-vsync`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Vehicles | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|
| 1000 | 6304 (4047 to 6640) | 0.035 | 0.076 | 0.152 | 0.291 | 0.016 | 0.0014 | 3320 (2985 to 3330) | 10517 (10361 to 12053) | 3 |
| 3000 | 2021 (1985 to 2036) | 0.100 | 0.245 | 0.451 | 0.923 | 0.069 | 0.0014 | 1061 (1043 to 1115) | 3631 (3348 to 3762) | 3 |
| 5000 | 1202 (1202 to 1219) | 0.172 | 0.437 | 0.791 | 1.471 | 0.089 | 0.0016 | 659 (625 to 660) | 1743 (1713 to 1770) | 3 |

### The app's worker and 3D view

Each run is the app's own worker (`apps/web/src/run.worker.ts`) and, where drawn, the app's own 3D view (`apps/web/src/RoadScene.tsx`), unchanged. Two runs are two workers and two views side by side. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Vehicles | Speed asked for | Runs | Drawn | Speed achieved, each run | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Snapshots received per s, each run | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|
| 1000 | 5× | 1 | no | 5.00× | 81.1 | 17.2 / 17.8 / 18.4 | – | 25.0 | 952 |
| 1000 | 5× | 1 | yes | 5.00× | 463.3 | 2.4 / 3.6 / 39.6 | 2.00 | 25.0 | 951 |
| 1000 | 5× | 2 | no | 5.00×, 5.00× | 82.9 | 17.2 / 17.7 / 19.4 | – | 25.0, 25.0 | 952, 969 |
| 1000 | 5× | 2 | yes | 5.00×, 5.00× | 391.1 | 2.8 / 4.2 / 13.6 | 2.23 | 25.0, 25.0 | 951, 965 |
| 3000 | 5× | 1 | no | 5.00× | 81.6 | 17.3 / 17.7 / 18.1 | – | 25.0 | 2910 |
| 3000 | 5× | 1 | yes | 5.00× | 427.3 | 2.6 / 3.5 / 7.0 | 2.13 | 25.0 | 2905 |
| 3000 | 5× | 2 | no | 5.00×, 5.00× | 83.3 | 17.2 / 17.7 / 17.8 | – | 25.0, 25.0 | 2910, 2920 |
| 3000 | 5× | 2 | yes | 5.00×, 5.00× | 342.6 | 3.0 / 4.7 / 16.0 | 2.46 | 25.0, 25.0 | 2903, 2912 |
| 5000 | 5× | 1 | no | 5.00× | 81.7 | 17.3 / 17.7 / 17.9 | – | 25.0 | 4840 |
| 5000 | 5× | 1 | yes | 5.00× | 412.0 | 2.7 / 3.4 / 12.0 | 2.18 | 25.0 | 4821 |
| 5000 | 5× | 2 | no | 5.00×, 5.00× | 82.6 | 17.2 / 17.7 / 17.8 | – | 25.0, 25.0 | 4840, 4893 |
| 5000 | 5× | 2 | yes | 5.00×, 5.00× | 333.2 | 2.8 / 4.6 / 9.2 | 2.50 | 25.0, 25.0 | 4831, 4881 |

## Chrome, headless-gpu

- Drawn with: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --headless=new --enable-gpu --use-angle=metal`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Vehicles | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|
| 1000 | 6432 (5365 to 6470) | 0.033 | 0.076 | 0.154 | 0.289 | 0.019 | 0.0012 | 3352 (3186 to 3447) | 11623 (9589 to 12310) | 3 |
| 3000 | 1940 (1935 to 1971) | 0.109 | 0.253 | 0.451 | 0.945 | 0.062 | 0.0015 | 1045 (1016 to 1048) | 3664 (3624 to 3714) | 3 |
| 5000 | 1159 (1158 to 1177) | 0.177 | 0.442 | 0.831 | 1.518 | 0.091 | 0.0014 | 635 (633 to 637) | 1729 (1702 to 1777) | 3 |

### The app's worker and 3D view

Each run is the app's own worker (`apps/web/src/run.worker.ts`) and, where drawn, the app's own 3D view (`apps/web/src/RoadScene.tsx`), unchanged. Two runs are two workers and two views side by side. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Vehicles | Speed asked for | Runs | Drawn | Speed achieved, each run | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Snapshots received per s, each run | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|
| 1000 | 5× | 1 | no | 5.00× | 60.1 | 16.7 / 16.7 / 16.7 | – | 25.0 | 952 |
| 1000 | 5× | 1 | yes | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 0.26 | 25.0 | 952 |
| 1000 | 5× | 2 | no | 5.00×, 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0, 25.0 | 952, 969 |
| 1000 | 5× | 2 | yes | 5.00×, 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 1.16 | 25.0, 25.0 | 951, 965 |
| 3000 | 5× | 1 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 2910 |
| 3000 | 5× | 1 | yes | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 0.99 | 25.0 | 2910 |
| 3000 | 5× | 2 | no | 5.00×, 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0, 25.0 | 2910, 2920 |
| 3000 | 5× | 2 | yes | 5.00×, 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 1.96 | 25.0, 25.0 | 2905, 2915 |
| 5000 | 5× | 1 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 4840 |
| 5000 | 5× | 1 | yes | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 1.70 | 25.0 | 4834 |
| 5000 | 5× | 2 | no | 5.00×, 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0, 25.0 | 4840, 4893 |
| 5000 | 5× | 2 | yes | 5.00×, 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | 2.01 | 25.0, 25.0 | 4825, 4873 |
| 1000 | 20× | 1 | no | 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 99.9 | 983 |
| 1000 | 20× | 1 | yes | 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | 0.58 | 99.8 | 982 |
| 1000 | 20× | 2 | no | 20.00×, 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 99.9, 100.0 | 984, 1010 |
| 1000 | 20× | 2 | yes | 20.00×, 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | 1.08 | 100.0, 100.0 | 981, 1009 |
| 3000 | 20× | 1 | no | 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 99.9 | 3096 |
| 3000 | 20× | 1 | yes | 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | 0.81 | 99.9 | 3093 |
| 3000 | 20× | 2 | no | 20.00×, 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 100.0, 100.0 | 3089, 3084 |
| 3000 | 20× | 2 | yes | 20.00×, 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | 1.61 | 100.0, 100.0 | 3094, 3080 |
| 5000 | 20× | 1 | no | 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 100.0 | 5144 |
| 5000 | 20× | 1 | yes | 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | 1.14 | 100.0 | 5147 |
| 5000 | 20× | 2 | no | 20.00×, 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 99.9, 99.9 | 5144, 5193 |
| 5000 | 20× | 2 | yes | 20.00×, 20.00× | 60.0 | 16.7 / 16.7 / 16.7 | 2.11 | 100.0, 100.0 | 5140, 5184 |
| 1000 | 100× | 1 | no | 100.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 249.8 | 1070 |
| 1000 | 100× | 1 | yes | 99.99× | 60.0 | 16.7 / 16.7 / 16.7 | 0.31 | 249.9 | 1073 |
| 1000 | 100× | 2 | no | 99.98×, 99.99× | 60.0 | 16.7 / 16.7 / 16.7 | – | 250.0, 249.9 | 1072, 1003 |
| 1000 | 100× | 2 | yes | 100.00×, 99.99× | 60.0 | 16.7 / 16.7 / 16.7 | 0.81 | 249.4, 249.5 | 1068, 993 |
| 3000 | 100× | 1 | no | 99.98× | 60.0 | 16.7 / 16.7 / 16.7 | – | 250.0 | 3174 |
| 3000 | 100× | 1 | yes | 100.01× | 60.1 | 16.7 / 16.7 / 16.7 | 0.85 | 249.9 | 3164 |
| 3000 | 100× | 2 | no | 100.00×, 100.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 250.0, 250.0 | 3174, 3047 |
| 3000 | 100× | 2 | yes | 99.99×, 99.98× | 60.0 | 16.7 / 16.7 / 16.7 | 1.58 | 250.0, 249.9 | 3162, 3049 |
| 5000 | 100× | 1 | no | 99.90× | 60.0 | 16.7 / 16.7 / 16.7 | – | 244.4 | 5159 |
| 5000 | 100× | 1 | yes | 100.01× | 60.0 | 16.7 / 16.7 / 16.7 | 1.20 | 249.0 | 5141 |
| 5000 | 100× | 2 | no | 100.01×, 99.97× | 60.1 | 16.7 / 16.7 / 16.7 | – | 249.8, 249.8 | 5156, 5055 |
| 5000 | 100× | 2 | yes | 100.00×, 100.03× | 45.7 | 16.7 / 33.3 / 33.3 | 2.62 | 249.9, 249.5 | 5146, 5050 |

## Chrome, headless-software

- Drawn with: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver) — **software drawing; these frame rates are not the product's**
- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36
- Window 1600 × 813 CSS pixels, device pixel ratio 2; page visible; 12 logical processors
- Flags: `--user-data-dir=<temporary profile> --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --window-size=1600,900 --force-device-scale-factor=2 --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`

### Cost of moving snapshots from the worker to the page

The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after "step" is the extra cost of that part. "Whole pipeline" is steps per real second from the page seeing the first message to seeing the last.

| Vehicles | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |
|---|---|---|---|---|---|---|---|---|---|---|
| 1000 | 6140 (5110 to 6173) | 0.033 | 0.081 | 0.169 | 0.305 | 0.030 | 0.0016 | 3153 (3004 to 3326) | 8450 (7590 to 11134) | 3 |
| 3000 | 1852 (1839 to 1856) | 0.112 | 0.263 | 0.520 | 0.972 | 0.069 | 0.0018 | 989 (973 to 1033) | 2933 (2792 to 3215) | 3 |
| 5000 | 1144 (1098 to 1150) | 0.183 | 0.457 | 0.920 | 1.593 | 0.090 | 0.0022 | 604 (531 to 618) | 1554 (1443 to 1715) | 3 |

### The app's worker and 3D view

Each run is the app's own worker (`apps/web/src/run.worker.ts`) and, where drawn, the app's own 3D view (`apps/web/src/RoadScene.tsx`), unchanged. Two runs are two workers and two views side by side. "Drawing work per frame" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.

| Vehicles | Speed asked for | Runs | Drawn | Speed achieved, each run | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Snapshots received per s, each run | Vehicles on the network, each run |
|---|---|---|---|---|---|---|---|---|---|
| 1000 | 5× | 1 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 952 |
| 1000 | 5× | 1 | yes | 5.00× | 15.3 | 66.7 / 66.7 / 116.7 | 0.36 | 25.0 | 951 |
| 1000 | 5× | 2 | no | 5.00×, 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0, 25.0 | 952, 969 |
| 1000 | 5× | 2 | yes | 5.00×, 5.00× | 13.5 | 66.7 / 83.3 / 83.3 | 0.63 | 25.0, 25.0 | 951, 965 |
| 3000 | 5× | 1 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 2910 |
| 3000 | 5× | 1 | yes | 5.00× | 10.6 | 83.3 / 133.3 / 150.0 | 0.77 | 25.0 | 2903 |
| 3000 | 5× | 2 | no | 5.00×, 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0, 25.0 | 2910, 2920 |
| 3000 | 5× | 2 | yes | 5.00×, 5.00× | 9.1 | 116.7 / 116.7 / 116.7 | 1.40 | 25.0, 25.0 | 2903, 2912 |
| 5000 | 5× | 1 | no | 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0 | 4840 |
| 5000 | 5× | 1 | yes | 5.00× | 9.8 | 100.0 / 116.7 / 116.7 | 1.09 | 25.0 | 4831 |
| 5000 | 5× | 2 | no | 5.00×, 5.00× | 60.0 | 16.7 / 16.7 / 16.7 | – | 25.0, 25.0 | 4840, 4893 |
| 5000 | 5× | 2 | yes | 5.00×, 5.00× | 6.9 | 150.0 / 150.0 / 200.0 | 2.15 | 25.0, 25.0 | 4831, 4881 |
