import { STEP_SECONDS, type Snapshot } from "@traffic-simulator/engine";

/** The two most recent snapshots of a run, and when the later one arrived. */
export interface FrameStore {
  earlier?: Snapshot;
  later?: Snapshot;
  laterArrivedAtMs: number;
  /** Real milliseconds between snapshots, used to pace the movement between them. */
  intervalMs: number;
}

export function newFrameStore(): FrameStore {
  return { laterArrivedAtMs: 0, intervalMs: STEP_SECONDS * 1000 };
}

/**
 * Take in the next snapshot of a run. `speed` is the simulated seconds per
 * real second the planner is watching at; with the run time between the two
 * snapshots it gives how long the movement between them should take.
 */
export function receiveSnapshot(frames: FrameStore, snapshot: Snapshot, nowMs: number, speed: number): void {
  // A snapshot from an earlier run time means the runs started again: nothing to move from.
  const startedAgain = frames.later !== undefined && snapshot.timeS < frames.later.timeS;
  frames.earlier = startedAgain ? undefined : frames.later;
  frames.later = snapshot;
  frames.laterArrivedAtMs = nowMs;
  if (frames.earlier) frames.intervalMs = ((snapshot.timeS - frames.earlier.timeS) * 1000) / speed;
}

export function clearSnapshots(frames: FrameStore): void {
  frames.earlier = undefined;
  frames.later = undefined;
}
