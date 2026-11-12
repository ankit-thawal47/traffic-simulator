# v1 gate check

Checked 2026-11-12, about hour 24.5 of 72, against ticket 20's four conditions.

| Condition | State | Evidence |
|---|---|---|
| Deployed on a public URL | met | https://traffic-simulator-omega.vercel.app, loaded without a Vercel login |
| Hebbal corridor, builder and comparison work on the deployed site | met | deployed from `main` at d5ada09 |
| Benchmark Tiers 0 and 1 pass | **not met** | Tier 0 passes. T1.5 (lane drop) is 19.5% below SUMO against a 10% tolerance; T1.2 cannot run on our engine (no vehicle with a prescribed speed). See `docs/benchmark-results-2026-11-12-after-ticket-23.md` |
| Benchmark Tiers 2 to 4 run and reported | met | `docs/benchmark-results-2026-11-12-tiers-2-to-5.md` and `...-after-ticket-24-tiers-2-to-5.md`, failures included |

## Decision

The owner chose to go ahead with v2 with the gate failure on record rather than spend
the remaining hours chasing T1.5. The cause of the remaining T1.5 gap is established
(a lane change takes 5.8 s and holds two lanes; with equally slow lane changes SUMO
loses about 7%); fixing it changes lane changing everywhere and would require re-running
every tier.

v2 scope, by the owner's decision: import of any place from OpenStreetMap now; free-form
drawing deferred to after the 72 hours.
