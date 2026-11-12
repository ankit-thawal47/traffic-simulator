/**
 * The most vehicles one 3D view draws. All vehicles of a view are drawn in one
 * batch whose size is fixed when the view is made, so there has to be a limit.
 * It is set well above the performance target (3,000 vehicles in each view;
 * spec, "Runs and results"), so that a proposal that jams and fills its roads,
 * or one with all demand scaled up, is still drawn in full.
 *
 * A run with more vehicles than this is still run and measured in full; the
 * view says how many it is not drawing (notDrawnNotice), so the limit is never silent.
 */
export const MAX_VEHICLES_DRAWN = 10_000;

/** What the view says when it is not drawing some vehicles; nothing when it draws them all. */
export function notDrawnNotice(notDrawn: number): string | undefined {
  if (notDrawn <= 0) return undefined;
  const most = MAX_VEHICLES_DRAWN.toLocaleString("en-IN");
  return `${notDrawn.toLocaleString("en-IN")} ${notDrawn === 1 ? "vehicle is" : "vehicles are"} not drawn: this view draws at most ${most}. The results count every vehicle.`;
}
