# 24: Turning traffic at junctions

**What to build:** Signal and priority junctions carry turning traffic at a rate and with delays close to SUMO and the textbook references, and no vehicle waiting at a junction is starved of entry. Found by the benchmark (`docs/benchmark-results-2026-11-12-tiers-2-to-5.md`): Tier 2 signal delay and priority capacity fail; Tier 3 flows, travel times and queues fail at the junction beneath the flyover, where ours carries far less than SUMO and trips take 2 to 3 times longer; ours has stuck vehicles at a saturated four-way junction (T2.4) where SUMO has none. Likely causes reported by earlier tickets: no sorting by turn before the stop line (ticket 04), strict first-come let-in order so turns across oncoming traffic wait for long gaps (ticket 04), and let-in starvation where vehicles from other approaches keep being let in ahead of a waiting one (ticket 06; reproduced on the weaving scenario, seeds 82 and 85, on the engine before filtering).

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] The causes are established inside the engine, with numbers, before anything is changed
- [ ] No vehicle waiting at a junction stands 300 s or more in T2.4 and the weaving scenario, seeds 81 to 86
- [ ] Benchmark Tiers 2 and 3 re-run for both engines; results in a new dated document; each row pass or fail with the remaining gap and its cause
- [ ] Four-way junction throughput does not fall, and Tier 0, Tier 1 and Tier 4 rows involving junctions do not get worse
- [ ] Every new rule or constant is in the assumptions table as our choice, with the reason
- [ ] Consistency checks pass at saturating demand, several seeds, a simulated hour

## Causes, measured before any change (2026-11-12)

Measured on the engine at `4aa5c18` through the public interface (`packages/engine/perf/turning-discharge.ts`, seeds 1 to 3,
1800 s, 300 s warm-up) and with a throw-away instrumented copy of `run.ts` that recorded, every step on green, why the vehicle
at the head of each strip within asking distance was not let in. Four-way junction of `test/four-way.ts` (two lanes each way,
1500 veh/h an approach); "one at a time" is one approach at a time, 20 s green; "opposing" is the T2.4 plan (north-south, then
east-west, 30 s each), where right turns cross oncoming traffic.

**Discharge per green** (vehicles over an approach's stop line per green of that approach; mean of seeds 1 to 3):

| Scenario | Every movement (20/60/20) | Straight on only |
|---|---|---|
| One at a time, cars in lanes | 10.8 | 16.0 |
| One at a time, mixed traffic | 17.9 | 38.9 |
| Opposing (T2.4 plan), cars in lanes | 13.4 | 26.5 |
| Opposing, mixed traffic | 17.8 | 29.6 |
| Junction beneath the flyover (Tier 3 network, cars in lanes) | 9.4 | - |

**Head-of-strip time refused on green, by reason** (seed 1, 1800 s; seconds summed over strip heads):

| Reason | One at a time, lanes | Opposing, lanes | Flyover junction, lanes |
|---|---|---|---|
| (a) crossing a vehicle of its own approach on another turn | 850 | 1,444 | 961 |
| (b) crossing traffic of another approach (oncoming) | 20 | 1,121 | 53 |
| room beyond (keep clear) | 25 | 48 | 2 |

**(a) Turners in the wrong strips: the largest cause.** Every connection took the whole width of the approach (the narrower
of the two roads), so a right-turner could stand in the left lane and a left-turner in the right; each then crossed the path
of the traffic beside it from its own approach, and the two lanes discharged one after the other. With one approach at a time
(no other conflict) the queue discharged 10.8 vehicles a green against 16.0 straight on only (-33%). Counterfactual (an
engine copy where a turn leaves from, and joins, the half of the road on its own side, nothing else changed): 15.9 a green,
1,113 through against 754 (straight on only 1,122); opposing 13.4 -> 20.4; flyover junction 9.4 -> 15.1 (2,269 -> 2,563
through in 1800 s). In mixed traffic 17.9 -> 29.6 (straight on only 38.9): a residual remains, as a turner can still have a
straight-on vehicle beside it on its own side.

**(b) Turns across oncoming traffic under first-come let-in order.** An oncoming vehicle is let in when it is within its asking
distance of the stop line (a car at 13.9 m/s: 112 m, 8.1 s; at 11 m/s: 74 m, 6.7 s), and a turner is let in only when every
vehicle let in before it will have cleared its path. So a turner needs a gap in oncoming traffic of about the asking time plus
the time to clear, roughly twice the accepted gap of the priority junction (4.6 s for a car). Under saturated oncoming
discharge there is no such gap during green at all, and nobody is let in on amber or red: the right-turner at the head waits
whole cycles. Opposing, cars in lanes, at 400 and 700 veh/h an approach: right-turners refused at least once waited 10.9 s and
34.7 s on average from their first refusal, straight-on 3.0 and 2.9 s. In the other direction a turner let in first holds back
oncoming straight-on traffic (329 head-seconds "straight refused for an oncoming right-turner" with (a) removed).

**(c) Starvation.** The vehicle at the head is refused again and again while others are let in: the longest time from a
vehicle's first refusal to its letting in was 693 s (one at a time; a right-turner in the left lane, crossed by its own
approach's straight-on traffic in the right lane, which kept being let in), 705 s (opposing; a right-turner facing
saturated oncoming traffic; T2.4's stuck vehicles are these), 508 s (flyover junction). On the weaving scenario (seed 82,
94 vehicles stood 300 s; seed 83, 65) the head of `west-in`, a left-turner, was refused for 371 s by right-turners from
`east-in` let in one after another into the same strips of `south-out` (both turns join it; first come, first served gives
the near-side turn no priority). Seeds 81, 84, 85, 86: none stood 300 s. Stuck vehicles released in the examples and Hebbal
(`perf/stuck-counts.ts`): 0 in each.

**(d) Other.** With (a) removed, a saturated opposing junction still loses its right-turners entirely to (b) and (c): the
counterfactual still had a vehicle stand 700 s and one stuck vehicle released. Letting a vehicle that was at the head and
refused for crossing traffic when its green ended go once the crossing is free, before crossing traffic of the next phase
(counterfactual), cut the longest stand to 76 s and raised opposing discharge to 21.7 a green.
