import type { Snapshot } from "@traffic-simulator/engine";
import { describe, expect, it } from "vitest";
import { clearSnapshots, newFrameStore, receiveSnapshot } from "./frame-store";

const at = (timeS: number): Snapshot => ({ timeS, vehicles: [] });

describe("the two most recent snapshots of a run, kept for drawing", () => {
  it("keeps the latest snapshot and the one before it", () => {
    const frames = newFrameStore();

    receiveSnapshot(frames, at(0), 1000, 1);
    expect(frames.earlier).toBeUndefined();
    expect(frames.later).toEqual(at(0));

    receiveSnapshot(frames, at(0.2), 1200, 1);
    receiveSnapshot(frames, at(0.4), 1400, 1);

    expect(frames.earlier).toEqual(at(0.2));
    expect(frames.later).toEqual(at(0.4));
    expect(frames.laterArrivedAtMs).toBe(1400);
  });

  it("paces the movement between snapshots by the run time between them and the speed watched at", () => {
    const frames = newFrameStore();
    receiveSnapshot(frames, at(10), 0, 1);

    receiveSnapshot(frames, at(10.2), 200, 1);
    expect(frames.intervalMs).toBeCloseTo(200, 6);

    // At 4 times, 0.4 simulated seconds pass in a tenth of a real second.
    receiveSnapshot(frames, at(10.6), 300, 4);
    expect(frames.intervalMs).toBeCloseTo(100, 6);

    // At a quarter speed, one step takes 0.8 real seconds.
    receiveSnapshot(frames, at(10.8), 1100, 0.25);
    expect(frames.intervalMs).toBeCloseTo(800, 6);
  });

  it("a long pause does not slow the movement to the next snapshot", () => {
    const frames = newFrameStore();
    receiveSnapshot(frames, at(5), 0, 1);
    receiveSnapshot(frames, at(5.2), 200, 1);

    // Paused for a minute, then resumed.
    receiveSnapshot(frames, at(5.4), 60_400, 1);

    expect(frames.intervalMs).toBeCloseTo(200, 6);
  });

  it("when the runs start again, the snapshot from before is forgotten", () => {
    const frames = newFrameStore();
    receiveSnapshot(frames, at(300), 0, 1);
    receiveSnapshot(frames, at(300.2), 200, 1);

    receiveSnapshot(frames, at(0), 400, 1);

    expect(frames.earlier).toBeUndefined();
    expect(frames.later).toEqual(at(0));
  });

  it("can be emptied", () => {
    const frames = newFrameStore();
    receiveSnapshot(frames, at(1), 0, 1);
    receiveSnapshot(frames, at(1.2), 200, 1);

    clearSnapshots(frames);

    expect(frames.earlier).toBeUndefined();
    expect(frames.later).toBeUndefined();
  });
});
