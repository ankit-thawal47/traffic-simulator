#!/usr/bin/env node
/**
 * The performance measurement, as one command:
 *
 *   pnpm perf                      everything (about 30 minutes; opens a Chrome window)
 *   pnpm perf --quick              fewer repetitions and shorter windows, to check that it works
 *   pnpm perf --only engine        the engine alone, in Node, no browser
 *   pnpm perf --only browser       the browser parts only
 *   pnpm perf --browsers headed-gpu,headless-software
 *   pnpm perf --counts 1000,3000,5000 --reps 5 --date 2026-11-11
 *   pnpm perf --scenarios mixed,cars-only --browser-scenarios mixed --speeds 5,16,80
 *   pnpm perf --no-unseen-seeds    watch without the app's second worker running the seeds unseen
 *
 * The scenarios are described in scenario.ts. By default the engine is measured on both
 * and the browser parts on mixed traffic only.
 *
 * It writes docs/performance/measurement-<date>.json (everything observed) and
 * docs/performance/measurement-<date>.md (the same as tables). Nothing in either
 * file is typed by hand.
 *
 * Three things are measured, at each vehicle count:
 *   1. the engine alone, in Node: simulated seconds per real second;
 *   2. the cost of moving snapshots from a worker to the page, in Chrome;
 *   3. the app's own worker and 3D view, in Chrome: speed achieved and frames per second,
 *      with one and two runs, drawn and not drawn, at each speed asked for. The app's worker
 *      looks at the clock every 25 ms and does at most 10 steps each time, so 80 times real
 *      time is the most it can give; 16 times is the fastest the app offers.
 *
 * Chrome is started in up to four ways (--browsers):
 *   headed-gpu            a visible window, real graphics card, frame rate capped by the display
 *   headed-gpu-uncapped   the same with the display cap removed, to see the headroom
 *   headless-gpu          no window, real graphics card if Chrome will use it
 *   headless-software     no window, software drawing (SwiftShader); NOT the product's frame rate
 * What Chrome actually drew with is read from WebGL and written beside every figure.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

// ---------------------------------------------------------------- options

const args = process.argv.slice(2).filter((arg) => arg !== "--");
function option(name, fallback) {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
}
const quick = args.includes("--quick");
const only = option("only", "all");
const counts = option("counts", "1000,3000,5000").split(",").map(Number);
const reps = Number(option("reps", quick ? 2 : 5));
const protocolReps = quick ? 1 : 3;
const speeds = option("speeds", quick ? "5" : "5,16,80").split(",").map(Number);
const engineScenarios = option("scenarios", "mixed,cars-only").split(",");
const browserScenarios = option("browser-scenarios", "mixed").split(",");
const unseenSeeds = args.includes("--no-unseen-seeds") ? 0 : 1;
const warmS = quick ? 2 : 4;
const measureS = quick ? 4 : 10;
const date = option("date", new Date().toISOString().slice(0, 10));
const outDir = resolve(repoRoot, option("out-dir", "docs/performance"));
const browserModes = option("browsers", "headed-gpu,headed-gpu-uncapped,headless-gpu,headless-software").split(",");
const WINDOW = { width: 1600, height: 900, scale: 2 };

// ---------------------------------------------------------------- helpers

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return {
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    n: sorted.length,
  };
}
const round = (value, digits = 0) => (Number.isFinite(value) ? value.toFixed(digits) : "–");
const spread = (s, digits = 0) => `${round(s.median, digits)} (${round(s.min, digits)} to ${round(s.max, digits)})`;
const log = (message) => console.error(`[perf] ${message}`);

function tryCommand(command, commandArgs) {
  try {
    return execFileSync(command, commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function machine() {
  const cpus = os.cpus();
  return {
    date,
    measuredAt: new Date().toISOString(),
    model: tryCommand("sysctl", ["-n", "hw.model"]) ?? "unknown",
    cpu: cpus[0]?.model ?? "unknown",
    logicalCpus: cpus.length,
    memoryGB: Math.round(os.totalmem() / 2 ** 30),
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    osProduct: [tryCommand("sw_vers", ["-productName"]), tryCommand("sw_vers", ["-productVersion"])].filter(Boolean).join(" ") || undefined,
    node: process.version,
    v8: process.versions.v8,
    power: tryCommand("pmset", ["-g", "batt"])?.split("\n")[0],
    display: tryCommand("system_profiler", ["SPDisplaysDataType"])
      ?.split("\n")
      .filter((line) => /Resolution|Display Asleep|Refresh/i.test(line))
      .map((line) => line.trim())
      .join("; "),
    loadAverageAtStart: os.loadavg().map((value) => Number(value.toFixed(2))),
  };
}

// ---------------------------------------------------------------- 1. engine alone, in Node

async function buildNodeBundle() {
  const outDirNode = join(here, "dist", "node");
  await build({
    configFile: false,
    root: here,
    logLevel: "warn",
    ssr: { noExternal: true },
    build: { ssr: join(here, "engine-bench.ts"), outDir: outDirNode, emptyOutDir: true, minify: false },
  });
  return join(outDirNode, "engine-bench.js");
}

function measureEngineInNode(bundle) {
  const rows = [];
  for (const scenario of engineScenarios) for (const targetVehicles of counts) {
    for (const snapshotEveryStep of [false, true]) {
      const runs = [];
      for (let rep = 0; rep < reps; rep++) {
        // A new process each time, so every repetition warms up from cold and none inherits another's memory.
        const options = { scenario, targetVehicles, seed: rep + 1, warmUpSteps: quick ? 500 : 1500, blocks: 5, stepsPerBlock: quick ? 200 : 600, snapshotEveryStep };
        const out = execFileSync(process.execPath, [join(here, "engine-bench-node.mjs"), bundle, JSON.stringify(options)], { encoding: "utf8" });
        runs.push(JSON.parse(out));
      }
      const row = {
        scenario,
        targetVehicles,
        snapshotEveryStep,
        repetitions: reps,
        simSecondsPerRealSecond: summary(runs.map((run) => run.simSecondsPerRealSecond)),
        msPerStep: summary(runs.map((run) => run.msPerStep)),
        blockRates: summary(runs.flatMap((run) => run.blockRates)),
        vehiclesWaitingToEnterAtEnd: Math.max(...runs.map((run) => run.vehiclesWaitingToEnterAtEnd)),
        vehiclesOnNetwork: {
          min: Math.min(...runs.map((run) => run.vehiclesOnNetwork.min)),
          mean: runs.reduce((sum, run) => sum + run.vehiclesOnNetwork.mean, 0) / runs.length,
          max: Math.max(...runs.map((run) => run.vehiclesOnNetwork.max)),
        },
        warmUpSteps: runs[0].warmUpSteps,
        timedSteps: runs[0].blocks * runs[0].stepsPerBlock,
        stepSeconds: runs[0].stepSeconds,
        runs,
      };
      rows.push(row);
      log(`engine, ${scenario}, ${targetVehicles} vehicles${snapshotEveryStep ? ", snapshot every step" : ""}: ${spread(row.simSecondsPerRealSecond)} simulated s per real s`);
    }
  }
  return rows;
}

// ---------------------------------------------------------------- 2 and 3. in Chrome

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

async function buildPage() {
  const outDirWeb = join(here, "dist", "web");
  await build({
    configFile: false,
    root: here,
    base: "./",
    logLevel: "warn",
    plugins: [react()],
    worker: { format: "es" },
    build: { outDir: outDirWeb, emptyOutDir: true },
  });
  return outDirWeb;
}

/** Serves the built page and collects the results it posts. */
function startServer(webDir) {
  const state = { queue: [], onResult: () => {} };
  const server = createServer((request, response) => {
    // Cross-origin isolation gives the page's clock its finest resolution.
    const headers = { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp", "Cache-Control": "no-store" };
    if (request.method === "POST" && request.url === "/result") {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        const next = state.onResult(JSON.parse(body));
        response.writeHead(200, { ...headers, "content-type": "application/json" });
        response.end(JSON.stringify({ next }));
      });
      return;
    }
    const path = new URL(request.url, "http://localhost").pathname;
    const file = join(webDir, path === "/" ? "index.html" : path);
    if (!file.startsWith(webDir) || !existsSync(file)) {
      response.writeHead(404, headers);
      response.end();
      return;
    }
    response.writeHead(200, { ...headers, "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    response.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done({ server, state, port: server.address().port })));
}

function chromeFlags(mode, profileDir) {
  const common = [
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion",
    `--window-size=${WINDOW.width},${WINDOW.height}`,
    `--force-device-scale-factor=${WINDOW.scale}`,
  ];
  switch (mode) {
    case "headed-gpu":
      return [...common, "--window-position=40,40"];
    case "headed-gpu-uncapped":
      return [...common, "--window-position=40,40", "--disable-frame-rate-limit", "--disable-gpu-vsync"];
    case "headless-gpu":
      return [...common, "--headless=new", "--enable-gpu", ...(process.platform === "darwin" ? ["--use-angle=metal"] : [])];
    case "headless-software":
      return [...common, "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
    default:
      throw new Error(`Unknown browser mode: ${mode}`);
  }
}

function pageAddresses(mode) {
  // The uncapped and software modes are about drawing only, so they use the first speed.
  const speedsHere = mode === "headed-gpu" || mode === "headless-gpu" ? speeds : speeds.slice(0, 1);
  const addresses = [];
  for (const scenario of browserScenarios) {
    for (const n of counts) {
      for (let rep = 0; rep < protocolReps; rep++) addresses.push(`?mode=protocol&scenario=${scenario}&n=${n}&steps=${quick ? 100 : 300}&rep=${rep}`);
    }
    for (const speed of speedsHere) {
      for (const n of counts) {
        for (const [runs, draw] of [[1, 0], [1, 1], [2, 0], [2, 1]]) {
          addresses.push(`?mode=views&scenario=${scenario}&n=${n}&runs=${runs}&draw=${draw}&seeds=${unseenSeeds}&speed=${speed}&warm=${warmS}&measure=${measureS}`);
        }
      }
    }
  }
  return addresses;
}

/** Open every address in one Chrome, one after another; restart Chrome if a page never answers. */
async function measureInChrome(chrome, mode, served) {
  const addresses = pageAddresses(mode);
  const results = [];
  const failures = [];
  let at = 0;
  const base = `http://127.0.0.1:${served.port}/`;
  while (at < addresses.length) {
    const profileDir = mkdtempSync(join(os.tmpdir(), "traffic-perf-chrome-"));
    const child = spawn(chrome, [...chromeFlags(mode, profileDir), base + addresses[at]], { stdio: "ignore" });
    await new Promise((finished) => {
      let watchdog;
      const arm = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          failures.push({ address: addresses[at], reason: "the page did not answer within 90 seconds" });
          log(`${mode}: no answer for ${addresses[at]}`);
          at++;
          finished();
        }, 90_000);
      };
      served.state.onResult = (message) => {
        results.push(message);
        log(`${mode}: ${at + 1}/${addresses.length} ${message.address}`);
        at++;
        if (at < addresses.length) {
          arm();
          return base + addresses[at];
        }
        clearTimeout(watchdog);
        setTimeout(finished, 200);
        return undefined;
      };
      arm();
    });
    served.state.onResult = () => undefined;
    child.kill("SIGTERM");
    await new Promise((exited) => (child.exitCode !== null ? exited() : child.once("exit", exited)));
    // Chrome's helper processes can still be writing to the profile for a moment after it exits;
    // a temporary profile left behind is not worth losing the measurements for.
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      log(`could not remove the temporary Chrome profile ${profileDir}: ${error.message}`);
    }
  }
  return { mode, flags: chromeFlags(mode, "<temporary profile>"), environment: results[0]?.environment, results, failures };
}

// ---------------------------------------------------------------- tables

function engineTable(rows) {
  const lines = [
    "| Scenario | Vehicles asked for | Vehicles on the network (min, mean, max) | What is timed | Simulated s per real s: median (min to max) | ms per step: median | Repetitions |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.scenario} | ${row.targetVehicles} | ${row.vehiclesOnNetwork.min}, ${round(row.vehiclesOnNetwork.mean)}, ${row.vehiclesOnNetwork.max} | ${row.snapshotEveryStep ? "step + build a snapshot" : "step only"} | ${spread(row.simSecondsPerRealSecond)} | ${round(row.msPerStep.median, 3)} | ${row.repetitions} |`,
    );
  }
  return lines.join("\n");
}

function protocolTable(browser) {
  const lines = [
    "| Scenario | Vehicles asked for | Vehicles on the network | Engine alone in the worker, simulated s per real s | step, ms | build snapshot, ms | post as objects (worker), ms | read objects (page), ms | pack + transfer typed array (worker), ms | read typed array (page), ms | Whole pipeline with objects, steps per real s | Whole pipeline with typed array, steps per real s | Repetitions |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const scenario of browserScenarios) for (const n of counts) {
    const runs = browser.results.filter((entry) => entry.result.mode === "protocol" && entry.result.scenario === scenario && entry.result.targetVehicles === n).map((entry) => entry.result);
    if (runs.length === 0) continue;
    const per = (variant, field) => runs.map((run) => {
      const found = run.variants.find((candidate) => candidate.variant === variant);
      return found[field] / found.steps;
    });
    const minus = (a, b) => a.map((value, i) => value - b[i]);
    const step = per("step", "workerMs");
    const snapshot = per("snapshot", "workerMs");
    const postObject = per("post-object", "workerMs");
    const postTyped = per("post-typed", "workerMs");
    const pipeline = (variant) => summary(per(variant, "pageMs").map((ms) => 1000 / ms));
    lines.push(
      `| ${scenario} | ${n} | ${round(summary(runs.map((run) => run.variants[2].vehiclesOnNetwork)).median)} | ${spread(summary(runs.map((run) => run.engineInWorker.simSecondsPerRealSecond)))} | ${round(summary(step).median, 3)} | ${round(summary(minus(snapshot, step)).median, 3)} | ${round(summary(minus(postObject, snapshot)).median, 3)} | ${round(summary(per("post-object", "pageReadMs")).median, 3)} | ${round(summary(minus(postTyped, snapshot)).median, 3)} | ${round(summary(per("post-typed", "pageReadMs")).median, 4)} | ${spread(pipeline("post-object"))} | ${spread(pipeline("post-typed"))} | ${runs.length} |`,
    );
  }
  return lines.join("\n");
}

function viewsTable(browser) {
  const lines = [
    "| Scenario | Vehicles asked for | Speed asked for | Runs | Drawn | Seeds running unseen | Speed achieved | Frames per second | Frame interval, ms: median / 95th / max | Drawing work per frame, ms | Messages received per s | Reading and storing one message, ms | Vehicles on the network, each run |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const { result } of browser.results) {
    if (result.mode !== "views") continue;
    lines.push(
      `| ${result.scenario} | ${result.targetVehicles} | ${result.requestedSpeed}× | ${result.runs} | ${result.draw ? "yes" : "no"} | ${result.unseenSeeds ? "yes" : "no"} | ${round(result.achievedSpeed, 2)}× | ${round(result.framesPerSecond, 1)} | ${round(result.frameIntervalMs.median, 1)} / ${round(result.frameIntervalMs.p95, 1)} / ${round(result.frameIntervalMs.max, 1)} | ${result.draw ? round(result.drawCallbackMsPerFrame, 2) : "–"} | ${round(result.messagesPerSecond, 1)} | ${round(result.receiveMsPerMessage, 2)} | ${result.vehiclesOnNetwork.join(", ")} |`,
    );
  }
  return lines.join("\n");
}

function markdown(data) {
  const m = data.machine;
  const out = [
    `# Performance measurement, ${data.machine.date}`,
    "",
    "Written by `pnpm perf` (`apps/web/perf/measure.mjs`). Every figure below was observed in that run; nothing is typed by hand.",
    "What the figures mean, and what follows from them, is in `docs/performance.md`.",
    "",
    "## Machine",
    "",
    `- Machine: ${m.model}, ${m.cpu}, ${m.logicalCpus} logical processors, ${m.memoryGB} GB memory`,
    `- Operating system: ${m.osProduct ?? m.os} (${m.os})`,
    `- Node ${m.node} (V8 ${m.v8})`,
    `- Chrome: ${data.chromeVersion ?? "not used"}`,
    `- Power: ${m.power ?? "unknown"}`,
    `- Display: ${m.display || "unknown"}`,
    `- Load average when the measurement started (1, 5, 15 minutes): ${m.loadAverageAtStart.join(", ")}`,
    `- Options: counts ${counts.join(", ")}; speeds asked for ${speeds.join(", ")}; ${reps} repetitions of the engine measurement; ${protocolReps} of the snapshot measurement; views warmed up for ${warmS} s and measured for ${measureS} s${quick ? "; QUICK MODE, not for quoting" : ""}`,
    "",
    "## Scenarios",
    "",
    "Built in `apps/web/perf/scenario.ts` from the engine's public input.",
    "",
    ...Object.entries(data.scenarios).map(([name, scenario]) => `- **${name}.** ${scenario.description}`),
    "",
  ];
  if (data.engine) {
    out.push(
      "## Engine alone, in Node",
      "",
      `Each repetition is a new Node process with its own seed: ${data.engine[0].warmUpSteps} steps of warm-up thrown away, then ${data.engine[0].timedSteps} timed steps of ${data.engine[0].stepSeconds} simulated seconds.`,
      "",
      engineTable(data.engine),
      "",
    );
  }
  for (const browser of data.browsers ?? []) {
    const e = browser.environment;
    out.push(`## Chrome, ${browser.mode}`, "");
    if (!e) {
      out.push("No page answered in this mode, so there are no figures.", "");
      continue;
    }
    const software = /swiftshader|llvmpipe|software/i.test(e.webglRenderer);
    out.push(
      `- Drawn with: ${e.webglRenderer}${software ? " — **software drawing; these frame rates are not the product's**" : ""}`,
      `- Browser: ${e.userAgent}`,
      `- Window ${e.windowWidth} × ${e.windowHeight} CSS pixels, device pixel ratio ${e.devicePixelRatio}; page ${e.visibilityState}; ${e.hardwareConcurrency} logical processors`,
      `- Flags: \`${browser.flags.join(" ")}\``,
      "",
      "### Cost of moving snapshots from the worker to the page",
      "",
      "The engine runs flat out in a worker and posts after every step. Times are real milliseconds per step, the median of the repetitions. Each column after \"step\" is the extra cost of that part. \"Whole pipeline\" is steps per real second from the page seeing the first message to seeing the last.",
      "",
      protocolTable(browser),
      "",
      "### The app's worker and 3D view",
      "",
      "The runs are advanced together by the app's own worker (`apps/web/src/run.worker.ts`), which posts one message holding a snapshot of every run, and each run is drawn, where drawn, by the app's own 3D view (`apps/web/src/RoadScene.tsx`), all unchanged. Two runs stand for a baseline and a proposal: one worker, two views side by side, each half the window. Where \"seeds running unseen\" says yes, the app's second worker (`apps/web/src/seeds.worker.ts`) was also running every seed of the same inputs flat out, as it does in the app while the planner watches. The view draws at most 4,000 vehicles. \"Drawing work per frame\" is time on the page's thread inside the animation-frame callbacks of all views together; it leaves out what the graphics card does afterwards.",
      "",
      viewsTable(browser),
      "",
    );
    if (browser.failures.length) {
      out.push("Pages that did not answer:", "", ...browser.failures.map((failure) => `- \`${failure.address}\`: ${failure.reason}`), "");
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- main

const data = { machine: machine(), options: { counts, reps, protocolReps, speeds, warmS, measureS, quick, window: WINDOW, engineScenarios, browserScenarios } };

const bundle = await buildNodeBundle();
data.scenarios = (await import(pathToFileURL(bundle).href)).SCENARIOS;
if (only !== "browser") data.engine = measureEngineInNode(bundle);

if (only !== "engine") {
  const chrome = findChrome();
  if (!chrome) {
    log("Chrome was not found (set CHROME_PATH); the browser parts are skipped.");
  } else {
    data.chromeVersion = tryCommand(chrome, ["--version"]);
    const served = await startServer(await buildPage());
    data.browsers = [];
    for (const mode of browserModes) {
      log(`starting Chrome: ${mode}`);
      data.browsers.push(await measureInChrome(chrome, mode, served));
    }
    served.server.close();
  }
}

data.machine.loadAverageAtEnd = os.loadavg().map((value) => Number(value.toFixed(2)));
mkdirSync(outDir, { recursive: true });
const name = `measurement-${date}${quick ? "-quick" : ""}`;
writeFileSync(join(outDir, `${name}.json`), JSON.stringify(data, null, 1) + "\n");
writeFileSync(join(outDir, `${name}.md`), markdown(data));
log(`written: ${join(outDir, name)}.md and .json`);
console.log(markdown(data));
