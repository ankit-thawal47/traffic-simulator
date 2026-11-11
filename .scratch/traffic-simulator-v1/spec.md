# Traffic simulator v1: compare a baseline against a proposal on Indian roads

Status: ready-for-agent

Vocabulary follows `GLOSSARY.md`. Decisions already recorded: `docs/adr/0001` to `0007`.
How the engine is measured: `docs/benchmark-standard.md`.

## Problem Statement

A planner who wants to know what a road change will do to traffic on an Indian road has no accessible tool for it. The open simulators assume vehicles keep to lanes, need installing and configuring, and say nothing by default about two-wheelers filtering through queues or auto-rickshaws sharing a road with buses. Commissioned studies of Indian flyovers have been criticised for analysing only the flyover itself, for reporting different measures for different scenarios, for percentages that hide small absolute gains, and for not disclosing their assumptions. A planner therefore cannot easily ask "if I add a flyover here, or take a lane away there, where does the queue go?" and get an answer whose assumptions are in plain sight.

## Solution

A website where a planner picks a network, describes a change to it, and watches the baseline and the proposal run side by side in 3D with mixed traffic. The network is either the prepared Hebbal corridor or one the planner assembles from building blocks. Each run reports the same fixed set of results for both scenarios, as absolute numbers and as changes from the baseline, labelled as an uncalibrated estimate. Every assumption is listed with its source. Nothing needs installing and no account is needed; a scenario is shared as a link or a file.

## User Stories

### Choosing a network

1. As a planner, I want to open the Hebbal corridor ready to run, so that I can see the product working on a real place without building anything.
2. As a planner, I want the Hebbal corridor to include the flyover, the signal junction beneath it and the next junction downstream, so that I can see whether a queue moves downstream.
3. As a planner, I want to assemble a network from building blocks, so that I can study a road that is not Hebbal.
4. As a planner, I want building blocks for a straight road, a T-junction, a four-way junction and a flyover over a junction, so that I can represent the common pieces of an urban corridor.
5. As a planner, I want to join building blocks in a line along one main road with side roads at junction blocks, so that I can lay out a corridor quickly.
6. As a planner, I want to set each building block's lanes, width and length, so that roads of different widths and capacities are represented.
7. As a planner, I want to set whether a junction block is a signal junction or a priority junction, so that I can match the place I have in mind.
8. As a planner, I want to set the signal timing of a signal junction, so that the signal plan matches reality.
9. As a planner, I want the builder to stop me making a network that cannot run, so that I do not waste a run on an invalid layout.

### Describing demand

10. As a planner, I want to set vehicles per hour for each entry-to-exit pair, so that the demand matches counts I know.
11. As a planner, I want to set the share of each vehicle class, so that the mixed traffic matches my road.
12. As a planner, I want a sensible Indian default vehicle mix, so that I can run without having counts.
13. As a planner, I want one control that scales all demand up or down, so that I can ask what happens if a change attracts more traffic.

### Making a proposal

14. As a planner, I want to start a proposal as a copy of the baseline, so that only my changes differ.
15. As a planner, I want to change the number of lanes or the width of a road, so that I can test widening or narrowing.
16. As a planner, I want to close a lane or a road, so that I can test roadworks or a closure.
17. As a planner, I want to change signal timing, so that I can test a retimed junction.
18. As a planner, I want to add or remove a flyover over a junction, so that I can test the commonest Indian road proposal.
19. As a planner, I want to change demand and vehicle mix in the proposal, so that I can test growth.
20. As a planner, I want to remove usable width from a road for roadside activity such as parking or hawkers, so that I can represent side friction.
21. As a planner, I want to switch lane discipline on or off, so that I can see what mixed traffic does to the same road.
22. As a planner, I want to see the list of changes that make up my proposal, so that I know exactly what I am comparing.
23. As a planner, I want to undo a single change, so that I can try variations.

### Running

24. As a planner, I want to run the baseline and the proposal together, so that I compare like with like.
25. As a planner, I want a run to cover one hour after a warm-up that is not counted, so that results describe a full network and not an empty one filling up.
26. As a planner, I want each scenario run with five different seeds, so that I can tell a real difference from chance.
27. As a planner, I want the page to stay responsive during a run, so that I can keep looking around.
28. As a planner, I want to see progress while seeds are running, so that I know how long to wait.
29. As a planner, I want the same scenario to give the same results every time, so that I can trust and repeat a finding.
30. As a planner, I want to be told when a run is slower than the stated performance target, so that I understand a long wait.

### Watching

31. As a planner, I want to watch traffic move in 3D, so that I understand what is happening and not only the numbers.
32. As a planner, I want each vehicle drawn to scale and recognisable by vehicle class, so that I can see two-wheelers, cars, auto-rickshaws and buses.
33. As a planner, I want to see two-wheelers filtering to the front of a signal queue, so that the Indian behaviour is visible.
34. As a planner, I want the flyover drawn as a raised structure with ramps, so that I can tell flyover traffic from traffic beneath.
35. As a planner, I want to orbit, pan and zoom the camera, so that I can look at any junction.
36. As a planner, I want a straight-down camera preset, so that I can see gaps and queues without perspective hiding them.
37. As a planner, I want to speed up, slow down and pause what I am watching, so that I can study a moment or skim an hour.
38. As a planner, I want to colour vehicles by speed instead of by vehicle class, so that queues stand out.
39. As a planner, I want the baseline and the proposal shown as two views side by side, so that I can see the difference directly.
40. As a planner, I want the two views to share one camera and one clock, so that I am always comparing the same place at the same moment.
41. As a planner, I want to watch a run again, so that I can re-check something I saw.

### Reading results

42. As a planner, I want the number of vehicles that got through, so that I know the throughput.
43. As a planner, I want mean travel time, so that I know how long a trip takes.
44. As a planner, I want mean delay for each vehicle class, so that I can see who gains and who loses.
45. As a planner, I want the longest queue on each approach, so that I can see where queues form.
46. As a planner, I want the number of stuck vehicles, so that I know when a run locked up and should not be trusted.
47. As a planner, I want every result shown as an absolute number and as a change from the baseline, so that a large percentage cannot hide a small gain.
48. As a planner, I want the same results for every scenario, so that scenarios are always comparable.
49. As a planner, I want each result shown as an average with its range across seeds, so that I can judge whether a difference is real.
50. As a planner, I want results for the junction downstream of my change, so that I can see whether I only moved the queue.
51. As a planner, I want every result labelled as an uncalibrated estimate, so that I do not mistake it for a measured fact.
52. As a planner, I want a plain list of what is not modelled, so that I know the limits of the estimate.

### Trusting it

53. As a planner, I want an assumptions panel listing every assumption with its source, so that nothing is hidden.
54. As a reviewer, I want to see how the engine compares with SUMO and with field data, including where it does worse, so that I can judge its credibility.
55. As a reviewer, I want the comparison rules to have been fixed before the engine was built, so that I know they were not shaped to the result.

### Saving and sharing

56. As a planner, I want to share a scenario as a link, so that a colleague sees exactly what I set up.
57. As a planner, I want to save a scenario as a file and load it later, so that I keep my work without an account.
58. As a planner, I want a link or file made today to still open after the product changes, so that my saved work is not lost.
59. As a planner, I want a clear message when a link or file cannot be read, so that I know what went wrong.

### Keeping it running

60. As a maintainer, I want the engine to run from the command line with no browser, so that I can test and benchmark it automatically.
61. As a maintainer, I want every test scenario checked for lost vehicles, overlaps and repeatability, so that a regression is caught at once.
62. As a maintainer, I want a new way of producing a network to need no change to the engine, so that v2 can be added safely.
63. As a maintainer, I want where scenarios are stored to be replaceable, so that a backend can be added later.
64. As a maintainer, I want the site redeployed automatically when the repository changes, so that the live site matches the code.

## Implementation Decisions

### Modules

- **Engine.** A standalone TypeScript package with no browser dependencies (ADR 0004). Given a network, a scenario and a seed, it advances a run step by step and gives back vehicle positions and results as plain data. It is a deep module: a small interface over all traffic behaviour.
- **Network format.** One versioned description of a network: roads, junctions, the connections between them, widths, lane counts, levels, signal plans. Every producer writes it; the engine reads only it (ADR 0003).
- **Corridor importer.** TypeScript code that turns OpenStreetMap data plus a hand-written corrections file (lanes, widths, levels) into a network. Used offline for Hebbal in v1; the same code is meant to run in the browser for v2.
- **Builder.** Turns a line of building blocks and their settings into a network. Each building block's turning paths are defined in advance.
- **Scenario format and storage.** A versioned description of a scenario: which network, the list of changes, demand, vehicle mix, demand scale, lane discipline, seed. Encodes to a link and to a file. All saving and loading goes through one storage module (ADR 0001).
- **Run coordinator.** Runs the engine in a background worker: the first seed is shown as it runs, the other seeds run unseen. Collects results across seeds.
- **3D view.** One three.js scene for corridor and builder networks; vehicles are shapes generated in code and drawn in batches; orbit camera and a straight-down preset; two views sharing a camera for comparison (ADR 0007).
- **Results and comparison.** The fixed result set, absolute and change from baseline, average and range across seeds, the uncalibrated label, and the list of what is not modelled (ADR 0005).
- **Assumptions.** One table of assumptions with sources, read by both the engine and the assumptions panel, so what is shown is what is used.
- **Benchmark harness.** A separate command that runs the tests in the benchmark standard against the engine and against SUMO.

### Engine behaviour

- **Time.** Fixed step of 0.2 simulated seconds. The engine does not wait for real time.
- **Decide, then apply.** Every vehicle decides from the same state; all moves are applied together, so results do not depend on processing order.
- **Following.** One rule for all vehicle classes: the Intelligent Driver Model, with assumptions per vehicle class.
- **Strips.** Road width is divided into strips of 0.5 m. A vehicle occupies as many strips as its width plus side clearance needs. Its leader is the nearest vehicle ahead that overlaps its strips.
- **Sideways movement.** A vehicle shifts strips when that gives a large enough gain, the side clearance holds, and the vehicle behind in the new strips need not brake hard. Sideways speed is capped.
- **Same-space conflicts.** When two vehicles choose the same free space in one step, one rule decides who gets it (the vehicle further ahead). This rule is ours, not published, and must be proven by the no-overlap check.
- **Lane discipline.** A setting. With it on, vehicles keep to lanes; with it off, the road carries mixed traffic. One engine does both.
- **Filtering.** At a signal queue, two-wheelers move through gaps to the front, with a cap so the head of the queue still discharges.
- **Restrictions as leaders.** A red signal, the end of a road and a closure act as a stopped vehicle ahead; the road edge is a boundary. The following rule then handles them.
- **Signal junctions.** Fixed-time plans. Hebbal uses its published plan.
- **Priority junctions.** Side-road traffic enters when the gap in main-road traffic is large enough, with accepted gaps per vehicle class.
- **Crossing paths.** Points where turning paths cross are found once when the network loads. A vehicle reserves its time at each before entering, and does not enter unless it can clear the junction.
- **Flyovers.** A flyover is a separate road that shares no junction with the road beneath. A vehicle looks for neighbours only on its own road, so the two levels never interact.
- **Routes.** Chosen once at entry. Fastest path on empty roads, except where through traffic can take a flyover or the junction beneath: there the choice is a probability based on each route's current measured travel time (ADR 0006).
- **Demand.** Vehicles enter at random times at the set rate per entry-to-exit pair, with vehicle class drawn from the vehicle mix.
- **Randomness.** All random choices come from the seed, with a separate stream per concern, so a run repeats exactly.
- **Stuck vehicles.** The engine detects vehicles that cannot move, releases one by force, and counts it. The count is a result.
- **Left-hand traffic** throughout.

### Runs and results

- A run is one simulated hour after a 10 minute warm-up; results exclude the warm-up.
- Five seeds per scenario; results are the average and range.
- Fixed result set: vehicles through, mean travel time, mean delay per vehicle class, longest queue per approach, stuck vehicles.
- Performance target, revised on 12 November 2026 from the ticket 03 measurement (`docs/performance.md`). Reference machine: MacBook Pro, Apple M3 Pro, Chrome.
  - Watching: baseline and proposal of 3,000 vehicles each, two 3D views, at the app's fastest watching speed (16 times real time), at 30 frames a second or more.
  - Running unseen: the engine alone at 3,000 vehicles, at least 100 simulated seconds per real second.
  - The original target (3,000 vehicles, 5 times real time, two views) was met with a wide margin on the reference machine, so it was tightened. The measurement covers straight roads in mixed traffic only; it must be repeated after junctions, filtering and the flyover exist, and after visual polish. If a later measurement misses: first send vehicle positions as typed arrays, then run seeds in parallel workers, then reduce the network or the period.

### Vehicle classes and assumptions

- Four vehicle classes: two-wheeler, car, auto-rickshaw, bus.
- Starting assumptions come from published Chennai measurements and are confirmed against the sources before use: sizes of about 2.0 × 0.7 m (two-wheeler), 4.4 × 1.9 m (car), 2.9 × 1.4 m (auto-rickshaw), 10 to 12 m × 2.1 to 2.9 m (bus); following time gaps from about 0.3 s (two-wheeler) to 1.0 s (bus).

### Delivery

- Static site on Vercel, deployed from the GitHub repository. No backend.
- **Order of work:**
  1. A thin slice, deployed: one small network, one kind of change, a run, one result, shown in 3D with plain boxes. Target: about hour 24 of the 72.
  2. The rest of v1: Hebbal, the builder, all seven kinds of change, the full result set, comparison, assumptions panel.
  3. The v1 gate (below).
  4. Visual polish, capped at 8 hours: vehicle shapes, shadows, lighting, road markings, pillars, a few Hebbal buildings.
  5. v2, only if the gate is passed by hour 48.
- **v1 gate:** deployed on a public URL; Hebbal, the builder and the comparison all work; benchmark tiers 0 and 1 pass; tiers 2 to 4 have been run and reported, pass or fail.

## Testing Decisions

- **A good test here** gives the engine a network, a scenario and a seed, and checks what comes out. It never looks inside the engine, so the engine's internals can change freely.
- **Main seam: the engine's public interface.** Agreed during design. All behaviour tests go through it.
- **Consistency checks on every test scenario** (benchmark tier 0): no vehicle lost, no two vehicles overlapping, no negative speed, no vehicle outside its road, identical results for the same seed.
- **Behaviour tests through the same seam:** a vehicle stops at a red signal; a queue discharges on green; a two-wheeler passes where a car cannot fit; with lane discipline on, vehicles keep to lanes; flyover traffic and traffic beneath never react to each other; a closure reduces throughput; a narrower road carries less.
- **Network producers** (importer, builder) are tested by their output: the network is valid, and it runs through the engine with the consistency checks passing.
- **Scenario format** is tested by round trip (encode, decode, same scenario) and by loading saved examples of each older version.
- **Benchmark harness** is a separate command, not part of the ordinary test run. Its tests, references and tolerances are those in the benchmark standard and may change only by a dated amendment there.
- **The 3D view** is checked by running the app, not by unit tests.
- **Prior art:** none; the repository has no code yet.

## Out of Scope

- **v2 (inside the 72 hours only after the v1 gate):** import of any place from OpenStreetMap, then free-form drawing of networks.
- **v3 (outside the 72 hours):** a backend with accounts, a saved-scenario library and run history.
- **Not modelled:** forced entry at priority junctions, adaptive signals, roundabouts, pedestrians, wrong-side driving, bus stops, turn bans, rerouting beyond the flyover-or-junction choice, equilibrium routing, induced demand, emissions.
- **Roadside activity** beyond lost road width.
- **Editing assumptions** in the app.
- **Replay from stored positions**; watching again means running the same seed again.
- **Map tiles** and real-world surroundings beyond what we draw.
- **Any claim of calibration or validation.**

## Further Notes

- **Evidence status.** The research behind these decisions was gathered by research agents and has not been re-read against its sources by the main session. Values to confirm before use: the vehicle assumptions, the Hebbal signal plan, and the Chennai field figures used by the benchmark.
- **Open design risks.** The same-space conflict rule and the strip rules as a whole have no published reference implementation. Browser performance is unmeasured. No open field data exists for Indian junctions.
- **Schedule.** The 72 hours end on 14 November 2026 at 14:37 IST. 3D adds about a day over 2D by estimate, so v1 is expected to reach its gate close to hour 48, leaving little or no room for v2.
- **Scenario versus engine input (settled after ticket 01).** A scenario (network, list of changes, demand, seed) is an app-level description. Before a run, the app resolves it: the changes are applied to the network and demand, and the engine receives only the resulting network, demand and seed. The engine knows nothing about baselines, proposals or changes.
- **Working constraint.** All development happens in one coding session with commits made from inside it; the session is never cleared or restarted.
