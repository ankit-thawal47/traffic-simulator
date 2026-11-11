# Benchmark standard: our engine against SUMO

Written 2026-11-11, **before any engine code exists**. The tests, references and
tolerances below are fixed now so they cannot be shaped to flatter the result.

## 1. What this comparison can and cannot show

- **SUMO is not ground truth.** It is a mature reference implementation. Agreeing
  with SUMO shows our implementation is sane; it does not show either engine is
  realistic.
- **For ordinary lane-based traffic** SUMO and textbook theory are trustworthy
  references. Here we are expected to match them.
- **For Indian mixed traffic** neither engine is the reference. Both are scored
  against field data and Indian standards, and the closer one wins that row,
  including when it is SUMO.
- **At Indian junctions there is no open field data.** Nothing in this standard
  can show that either engine is right there.

## 2. Fairness rules

1. **Same inputs.** One script generates the network and the demand for both
   engines: identical departures (time, vehicle class, origin, destination, route).
2. **Same model where the concept exists in both.** SUMO runs with
   `carFollowModel="IDM"` and the same per-class parameters as ours, the same step
   length, and `--lefthand` networks.
3. **SUMO is configured in good faith.** For mixed traffic it uses its sublane
   model (`--lateral-resolution`, SL2015 parameters) set up per its own
   documentation. No strawman defaults.
4. **Equal tuning effort.** If we tune our parameters on a dataset, SUMO gets the
   same procedure and the same number of trials. Otherwise both run untuned on the
   same published parameter values.
5. **Hold-out data.** Any tuning uses the first half of a dataset (by time); the
   reported score uses the second half.
6. **Seeds.** Every stochastic test runs 10 seeds per engine. Report the mean and
   the 95% confidence interval. No dropping seeds.
7. **Stuck vehicles are counted, never hidden.** SUMO teleports and our forced
   releases are reported for every test. A run with any is flagged.
8. **Version pinning.** Record the exact SUMO version, our git commit, the machine
   and the browser.

## 3. Reporting rules

1. Every test below is run and reported. Failures and losses appear in the same
   table as passes and wins.
2. No single overall score. Weights invite gaming; the table is the result.
3. A tolerance may be changed only by a dated amendment in section 7 that states
   the reason, written before the changed test is re-run.
4. Scripts, configuration files and raw outputs are committed to the repo.

## 4. The tests

Tolerance means the allowed relative difference from the stated reference.
"Both" means each engine is scored against the reference separately, and the
difference between the two engines is also reported.

### Tier 0: internal consistency (no reference needed)

| ID | Test | Pass condition |
|---|---|---|
| T0.1 | Vehicle conservation: entered = left + still inside | exact, every step |
| T0.2 | No two vehicles overlap | zero overlaps in all runs |
| T0.3 | Same scenario and seed give the same result | bit-identical metrics |
| T0.4 | No negative speeds, no vehicle outside its road | zero occurrences |

### Tier 1: one road, identical model, cars only, lane discipline on

Reference: the IDM equations integrated numerically at a 0.001 s step, and the
IDM equilibrium flow-density curve.

| ID | Test | Metric | Tolerance |
|---|---|---|---|
| T1.1 | One car accelerates from rest on an empty road | time to reach 95% of desired speed | 2%, both |
| T1.2 | One car follows a leader with a fixed speed profile (cruise, brake to stop, restart) | speed RMSE over the run; minimum gap | RMSE at most 0.2 m/s; gap never below zero, both |
| T1.3 | Ring road, 1 km, one lane, densities 10 to 140 vehicles/km | flow at each density; capacity | 5% per point in the stable range; capacity 3%, both |
| T1.4 | Same as T1.3 with 2 and 3 lanes | capacity per lane | 10% between our engine and SUMO |
| T1.5 | Lane drop, 3 lanes to 2, demand above capacity | discharge flow downstream | 10% between our engine and SUMO |

### Tier 2: one junction, cars only

| ID | Test | Reference | Tolerance |
|---|---|---|---|
| T2.1 | Queue discharge at a signal, one lane | SUMO; also the IDM-implied saturation headway | saturation flow 5% |
| T2.2 | Fixed-time signal, demand from 30% to 100% of capacity | Webster's delay formula and SUMO | mean delay 15% up to 90% of capacity; above that, report only |
| T2.3 | Priority junction: minor-road capacity as major-road flow rises from 200 to 1,200 vehicles/h | gap-acceptance capacity formula and SUMO | 20%; must fall monotonically |
| T2.4 | Four-way junction, all approaches saturated, 30 minutes | none | zero teleports or forced releases; otherwise report the count |

### Tier 3: small network (flyover, junction beneath, next junction downstream)

Reference: SUMO, same network and demand.

| ID | Metric | Tolerance |
|---|---|---|
| T3.1 | Hourly flow per link, GEH statistic | GEH below 5 on at least 85% of links |
| T3.2 | Mean travel time per origin-destination pair | 15% |
| T3.3 | Maximum queue length per approach | 25% |
| T3.4 | Share of traffic using the flyover versus the junction | 5 percentage points |

GEH = sqrt( 2 (M - C)^2 / (M + C) ), with M and C the two hourly flows.

### Tier 4: Indian mixed traffic, both engines against field data

Reference: the Chennai Saidapet trajectory set (Kanagaraj et al. 2015) and
Indo-HCM 2017. Field values are confirmed from the downloaded data before use;
the figures seen so far come from a research agent's reading.

| ID | Test | Metric | Target |
|---|---|---|---|
| T4.1 | Replay observed arrivals on the 245 m × 11.2 m section | mean speed per vehicle class | 15% from field, per class |
| T4.2 | Same run | throughput (vehicles/h) | 10% from field |
| T4.3 | Same run | sideways-position distribution per class | report a distance measure; no pass line |
| T4.4 | Same run | speed-density cloud at 1-minute intervals | report RMSE; no pass line |
| T4.5 | Mid-block capacity of a 4-lane divided road, Bengaluru vehicle mix | capacity in PCU/h against the Indo-HCM base value | 15% |
| T4.6 | Signal approach, mixed traffic, two-wheeler filtering | saturation flow against the Indo-HCM width formula | 20% |

For each row: state which engine is closer to the reference.

### Tier 5: engineering (report only, no pass line)

| ID | Measure | How |
|---|---|---|
| T5.1 | Simulated seconds per wall-clock second at 1,000, 5,000 and 20,000 vehicles | SUMO headless; ours in Node and, separately, in a browser worker; same machine |
| T5.2 | Peak memory at those sizes | same |
| T5.3 | Largest vehicle count that stays faster than real time | same |
| T5.4 | Feature coverage | checklist: rerouting, actuated signals, public transport, pedestrians, emissions, map import, output formats |

## 5. Expected outcome, stated in advance

Written before any result exists, so the report can be checked against it.

- **We expect to lose:** all of Tier 5 (SUMO is compiled C++ with two decades of
  work), and feature coverage by a wide margin.
- **We expect to match within tolerance, if our implementation is correct:**
  Tiers 0 and 1.
- **Uncertain:** Tiers 2 and 3. Junction logic is where a new engine is weakest.
- **Unknown:** Tier 4. SUMO's sublane model may do as well as our strips, or better.
- **Where we might be ahead:** T4.6 (filtering at signals), and deployment
  (runs in a browser with nothing to install), which is not a simulation-quality
  claim.

## 6. Known limits of this standard

1. Tier 4 rests on one mid-block road section in one city.
2. No tier tests behaviour at Indian junctions against field data.
3. Tier 1 uses cars with lane discipline, which is the least Indian case.
4. SUMO's IDM has internal details (such as its own sub-stepping) that may cause
   small differences from the reference integration even when both are correct.
   If so, record it as an amendment; do not loosen the tolerance silently.
5. Passing every tier still does not make the engine "calibrated" or "validated".

## 7. Amendments

None.
