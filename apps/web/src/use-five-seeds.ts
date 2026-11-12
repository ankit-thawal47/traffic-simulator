import type { RunInput } from "@traffic-simulator/engine";
import { useCallback, useEffect, useState } from "react";
import { newFiveSeeds, withUnseenSeedEvent, withWatchedFrame, type FiveSeeds, type UnseenSeedEvent } from "./five-seeds";
import type { TogetherFrame } from "./run-together";
import type { StartUnseenSeeds } from "./seeds.worker";

/**
 * The five seeds of a baseline and a proposal. Runs them all unseen in their
 * own worker and collects their results. The watched run's frames, which the
 * caller passes to `takeWatchedFrame`, only say where that run is. When either
 * input changes, everything collected is dropped and the seeds start again.
 */
export function useFiveSeeds(
  baselineInput: RunInput,
  proposalInput: RunInput,
): { collected: FiveSeeds; takeWatchedFrame: (frame: TogetherFrame) => void } {
  const [collected, setCollected] = useState(() => newFiveSeeds());

  useEffect(() => {
    setCollected(newFiveSeeds());
    const worker = new Worker(new URL("./seeds.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<UnseenSeedEvent>) => {
      setCollected((before) => withUnseenSeedEvent(before, event.data));
    };
    worker.postMessage({ inputs: [baselineInput, proposalInput] } satisfies StartUnseenSeeds);
    return () => worker.terminate();
  }, [baselineInput, proposalInput]);

  const takeWatchedFrame = useCallback((frame: TogetherFrame) => {
    setCollected((before) => withWatchedFrame(before, frame));
  }, []);

  return { collected, takeWatchedFrame };
}
