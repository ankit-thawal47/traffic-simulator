# Own browser engine built from published models; SUMO as cross-check only

We write our own simulation engine that runs in the browser, instead of running SUMO on a server or copying an existing simulator's code. The engine implements published models and measured values (IDM following, strip-based sideways movement, two-wheeler filtering, conflict-point junctions, Chennai vehicle parameters) and copies no source code. SUMO is used unmodified, offline, as the reference in `docs/benchmark-standard.md`.

## Considered options

- **SUMO on a server.** Mature, with a sublane model for mixed traffic. Rejected because it has no browser build, needs one process per concurrent planner, and free server hosting is unreliable. Indian behaviour would be limited to parameter tuning.
- **Fork or copy an existing engine.** Rejected: traffic-simulation.de and mixedTraffic are GPL-3.0, and both earlier forks of SUMO for Indian or lane-free traffic (SiMTraM, TrafficFluid-Sim) went stale.

## Consequences

- Proving the engine correct is our job; the benchmark standard exists for that.
- We do not claim to beat SUMO. The claim is narrower: an open browser simulator that combines Indian mixed traffic with flyover networks.
- We expect to lose to SUMO on speed, scale and feature count.
