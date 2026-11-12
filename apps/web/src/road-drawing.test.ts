import { junctionOutline, type Network, type Road } from "@traffic-simulator/engine";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";
import { junctionSurface, laneMarkings, roadSurface, stripTriangles } from "./road-drawing";

const eastward = (lanes: number | undefined, widthM: number, lengthM = 100): Road => ({
  id: "main",
  points: [
    { x: 0, y: 0 },
    { x: lengthM, y: 0 },
  ],
  widthM,
  lanes,
  speedLimitMps: 13.9,
});

/** Each corner's three numbers, as [x, y, z]. */
function corners(positions: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < positions.length; i += 3) out.push([positions[i]!, positions[i + 1]!, positions[i + 2]!]);
  return out;
}

describe("the lines painted on a road", () => {
  it("are none at all where traffic is mixed: no lane discipline", () => {
    expect(laneMarkings(eastward(3, 10.5), false)).toEqual([]);
  });

  it("are a solid edge line along each side and a broken line between lanes, with lane discipline", () => {
    const marks = laneMarkings(eastward(3, 10.5, 30), true);
    const edges = marks.filter((mark) => mark.kind === "edge");
    expect(edges.map((edge) => edge.acrossM).sort((a, b) => a - b)).toEqual([-4.9, 4.9]);
    expect(edges.every((edge) => edge.fromM === 0 && edge.toM === 30)).toBe(true);
    const lanes = marks.filter((mark) => mark.kind === "lane");
    // Between three lanes of 3.5 m: 1.75 m either side of the middle.
    expect([...new Set(lanes.map((lane) => lane.acrossM))].sort((a, b) => a - b)).toEqual([-1.75, 1.75]);
    // Broken: 3 m painted, 4.5 m gap (IRC 35), so a 30 m road has dashes starting at 0, 7.5, 15 and 22.5 m.
    const onOneLine = lanes.filter((lane) => lane.acrossM === 1.75);
    expect(onOneLine.map((dash) => [dash.fromM, dash.toM])).toEqual([
      [0, 3],
      [7.5, 10.5],
      [15, 18],
      [22.5, 25.5],
    ]);
  });

  it("has no line between lanes on a road of one lane, nor on a road with no marked lanes", () => {
    expect(laneMarkings(eastward(1, 3.5), true).filter((mark) => mark.kind === "lane")).toEqual([]);
    expect(laneMarkings(eastward(undefined, 3.5), true)).toEqual([]);
  });
});

describe("a strip laid along a road", () => {
  it("lies on the road at its distance across: left of an eastward road is north, which is -z in the scene", () => {
    const into: number[] = [];
    stripTriangles(eastward(3, 10.5), { acrossM: 1.75, widthM: 0.2, fromM: 10, toM: 20 }, 0.03, into);
    const all = corners(into);
    expect(all.length).toBeGreaterThan(0);
    for (const [x, y, z] of all) {
      expect(x).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(x).toBeLessThanOrEqual(20 + 1e-9);
      expect(y).toBeCloseTo(0.03, 9);
      expect(Math.abs(z! + 1.75)).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it("follows a bend in the road", () => {
    const bent: Road = { ...eastward(2, 7), points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }] };
    const all = corners(roadSurface(bent));
    // Some of the surface is along the second, northward part: well north of the start, near x = 50.
    expect(all.some(([x, , z]) => z! < -40 && Math.abs(x! - 50) <= 3.5 + 1e-6)).toBe(true);
    // None of it strays more than half the road's width from the centreline.
    for (const [x, , z] of all) {
      // On the ground: the first part runs y = 0 from x = 0 to 50, the second x = 50 from y = 0 to 50.
      const [gx, gy] = [x!, -z!];
      const fromFirst = Math.hypot(gx - Math.min(50, Math.max(0, gx)), gy);
      const fromSecond = Math.hypot(gx - 50, gy - Math.min(50, Math.max(0, gy)));
      expect(Math.min(fromFirst, fromSecond)).toBeLessThanOrEqual(3.5 * Math.SQRT2 + 1e-6);
    }
  });
});

describe("the surface of a junction", () => {
  const network = EXAMPLES.find((example) => example.id === "signal-junction")!.scenario.network as Network;
  const junction = network.junctions![0]!;

  it("stays within the junction's outline: only where vehicles turn, not a patch beyond it", () => {
    const outline = junctionOutline(network, junction);
    const all = corners(junctionSurface(network, junction));
    expect(all.length).toBeGreaterThan(0);
    for (const [x, , z] of all) {
      const point = { x: x!, y: -z! };
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i]!;
        const b = outline[(i + 1) % outline.length]!;
        // Anticlockwise outline: inside is to the left of each edge (a little slack for rounding).
        const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
        expect(cross / Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(-0.01);
      }
    }
  });

  it("meets the end of every road into and out of it", () => {
    const all = corners(junctionSurface(network, junction));
    for (const corner of junctionOutline(network, junction)) {
      const nearest = Math.min(...all.map(([x, , z]) => Math.hypot(x! - corner.x, -z! - corner.y)));
      expect(nearest).toBeLessThan(0.01);
    }
  });
});
