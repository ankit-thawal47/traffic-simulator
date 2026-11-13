// Orchestrator: run the five suggested test scenarios through the scenario package (five seeds, warm-up excluded),
// so the planner-facing write-up quotes numbers that were observed, not guessed.
import { EXAMPLES } from "../src/examples";
import { createProposal, resolveScenario, runEverySeed, withDemandScale, withFlyover, withLaneClosure, withLaneDiscipline, withLostWidth, withSignalTiming, isFlyoverRoad, type Scenario } from "@traffic-simulator/scenario";
const ex = (id: string) => EXAMPLES.find((e) => e.id === id)!.scenario;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
function run(s: Scenario) {
  const r = runEverySeed(resolveScenario(s));
  const d = (c: string) => mean(r.map((x: any) => x.delayByVehicleClass[c]?.meanDelayS ?? 0));
  const q = (a: string) => mean(r.map((x: any) => x.longestQueueByApproach?.[a]?.lengthM ?? 0));
  return { through: mean(r.map((x) => x.vehiclesThrough)), waiting: mean(r.map((x) => x.vehiclesWaitingToEnter)), stuck: mean(r.map((x: any) => x.stuckVehicles ?? 0)), tw: d("two-wheeler"), car: d("car"), bus: d("bus"), q, approaches: Object.keys(r[0]!.longestQueueByApproach ?? {}) };
}
function show(title: string, b: Scenario, p: Scenario, queues: string[] = []) {
  const t = Date.now(); const B = run(b), P = run(p);
  const f = (x: number) => x.toFixed(1);
  console.log(`\n## ${title}  (${((Date.now() - t) / 1000).toFixed(0)} s)`);
  console.log(`through ${f(B.through)} -> ${f(P.through)} | waiting ${f(B.waiting)} -> ${f(P.waiting)} | stuck ${f(B.stuck)} -> ${f(P.stuck)}`);
  console.log(`delay 2W ${f(B.tw)} -> ${f(P.tw)} | car ${f(B.car)} -> ${f(P.car)} | bus ${f(B.bus)} -> ${f(P.bus)}`);
  for (const a of queues) console.log(`queue ${a}: ${f(B.q(a))} -> ${f(P.q(a))}`);
}
const which = process.argv[2] ?? "12345";
// 1. Flyover benefit, and how much survives induced demand.
if (which.includes("1")) {
  const unbuilt = ex("flyover-proposed"); const flyRoads = unbuilt.network!.roads.filter(isFlyoverRoad).map((r) => r.id);
  let built = createProposal(unbuilt, "p"); for (const id of flyRoads) built = withFlyover(built, id, true);
  show("1a flyover built, same demand", unbuilt, built, ["south-in", "north-in", "west-in", "east-in"]);
  show("1b flyover built, demand +20%", unbuilt, withDemandScale(built, 1.2), ["south-in", "north-in", "west-in", "east-in"]);
}
// 2. Mixed traffic against lane discipline on the same road, at demand above capacity.
if (which.includes("2")) {
  const busy = withDemandScale(createProposal(ex("one-road"), "b"), 2);
  show("2 lane discipline on, demand x2", busy, withLaneDiscipline(busy, true));
}
// 3. Roadside friction against a lane closure that removes the same width.
if (which.includes("3")) {
  const busy = withDemandScale(createProposal(ex("one-road"), "b"), 2);
  show("3a hawkers take 3.5 m", busy, withLostWidth(busy, "main", 3.5, "hawkers"));
  show("3b one lane closed (3.5 m)", busy, withLaneClosure(busy, "main", 1));
}
// 4. Signal retiming at a busy four-way junction: who gains, who pays.
if (which.includes("4")) {
  const busy = withDemandScale(createProposal(ex("signal-junction"), "b"), 2.5);
  show("4 south-in green 25 -> 40 s (others 25)", busy, withSignalTiming(busy, "cross", [25, 25, 40, 25]), ["north-in", "east-in", "south-in", "west-in"]);
}
// 5. Hebbal: retime the junction beneath the flyover for the Tumkur Road queue; check downstream.
if (which.includes("5")) {
  const h = ex("hebbal-city-bound");
  show("5 Hebbal: Tumkur phase 57 -> 70 s, airport phase 37 -> 24 s", h, withSignalTiming(createProposal(h, "p"), "hebbal", [24, 70, 47, 7]), ["airport-ground-in", "tumkur-in", "krpuram-in", "cbi-service-in", "cbi-road-west-in"]);
}
