/** Where a camera is and what it looks at, in the scene's coordinates. */
export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * One camera shared by several views (ADR 0007): when the planner moves it in
 * one view, every other view follows, so baseline and proposal always show
 * the same place from the same angle.
 */
export interface SharedCamera {
  /**
   * Join as a view. `follow` is called whenever another view moves the camera,
   * and at once if the camera has already been moved. Returns how to leave.
   */
  join(view: unknown, follow: (pose: CameraPose) => void): () => void;
  /** Report that this view has moved the camera. */
  move(view: unknown, pose: CameraPose): void;
}

export function createSharedCamera(): SharedCamera {
  const views = new Map<unknown, (pose: CameraPose) => void>();
  let current: CameraPose | undefined;
  return {
    join(view, follow) {
      views.set(view, follow);
      if (current) follow(current);
      return () => {
        if (views.get(view) === follow) views.delete(view);
      };
    },
    move(view, pose) {
      current = pose;
      for (const [other, follow] of views) {
        if (other !== view) follow(pose);
      }
    },
  };
}
