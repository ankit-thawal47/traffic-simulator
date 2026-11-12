/**
 * Roads lying side by side where a road divides or roads join (a junction
 * with no signal: where a flyover leaves the main road and comes back to it).
 *
 * The engine connects the roads there by where they lie across each other's
 * width, and it accepts any widths that still line up somewhere. But a road's
 * width changes about its centreline, so a change of width at such a junction
 * can leave a road lying partly over the road beside it, or partly outside
 * the road it divides from: two roads on the same ground, whose vehicles
 * would never see each other. The engine's input cannot say which edge of a
 * road a change of width moves, so such a proposal is refused, with the
 * reason, and never run. A road made narrower stays where it was and is fine.
 */
import { positionAlongRoad, roadLengthM, type Network, type Road } from "@traffic-simulator/engine";

const HAIR_M = 1e-6;

function metres(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Where `narrow` lies across `wide`: the distance of its left edge from the left edge of `wide`. */
function leftEdgeAcross(wide: Road, narrow: Road, wideEnds: boolean): number {
  const onWide = positionAlongRoad(wide, wideEnds ? roadLengthM(wide) : 0);
  const onNarrow = positionAlongRoad(narrow, wideEnds ? 0 : roadLengthM(narrow));
  // To the right of the direction of travel (x east, y north).
  const rightX = onWide.direction.y;
  const rightY = -onWide.direction.x;
  const centreOffsetM = (onNarrow.point.x - onWide.point.x) * rightX + (onNarrow.point.y - onWide.point.y) * rightY;
  return centreOffsetM + wide.widthM / 2 - narrow.widthM / 2;
}

/**
 * Why a network whose road widths were changed no longer has its roads side
 * by side at a junction with no signal; undefined when it does. Only junctions
 * with a road whose width differs from `today` are looked at, so a network is
 * never refused for how it was drawn.
 */
export function whyNotSideBySide(network: Network, today: Network): string | undefined {
  const road = (roadId: string) => network.roads.find((one) => one.id === roadId);
  const widthToday = new Map(today.roads.map((one) => [one.id, one.widthM]));
  const changed = (one: Road) => widthToday.get(one.id) !== one.widthM;
  for (const junction of network.junctions ?? []) {
    if (junction.control !== "none" || junction.connections.length === 0) continue;
    const from = [...new Set(junction.connections.map((connection) => connection.fromRoadId))];
    const to = [...new Set(junction.connections.map((connection) => connection.toRoadId))];
    // One road divides into several, or several join into one; with one road each side, the wider is the one divided from.
    const first = road(from[0]!);
    const last = road(to[0]!);
    if (!first || !last) continue;
    const wideEnds = from.length === 1 && (to.length > 1 || first.widthM >= last.widthM);
    if (!wideEnds && to.length !== 1) continue;
    const wide = wideEnds ? first : last;
    const narrow = (wideEnds ? to : from).map(road).filter((one): one is Road => one !== undefined);
    if (!changed(wide) && !narrow.some(changed)) continue;
    const where = `At junction "${junction.id}", where roads lie side by side,`;
    const across = narrow.map((one) => {
      const leftM = leftEdgeAcross(wide, one, wideEnds);
      return { road: one, leftM, rightM: leftM + one.widthM };
    });
    for (const a of across) {
      for (const b of across) {
        const overM = Math.min(a.rightM, b.rightM) - Math.max(a.leftM, b.leftM);
        if (a === b || !changed(a.road) || overM <= HAIR_M) continue;
        return (
          `${where} road "${a.road.id}" would lie ${metres(overM)} m over road "${b.road.id}". ` +
          "A road that begins or ends there can be made narrower, but not wider"
        );
      }
    }
    for (const a of across) {
      const outsideM = Math.max(-a.leftM, a.rightM - wide.widthM);
      if (outsideM <= HAIR_M) continue;
      return (
        `${where} road "${a.road.id}" would lie ${metres(outsideM)} m outside road "${wide.id}". ` +
        (changed(a.road)
          ? "A road that begins or ends there can be made narrower, but not wider"
          : "Change the width of both, or of neither")
      );
    }
  }
  return undefined;
}
