/**
 * Where the turning paths of a junction cross (spec: Engine behaviour, Crossing
 * paths). Found once, when the network loads.
 *
 * Each connection is a band of strips, cut along its length into pieces. For
 * two connections A and B, findCrossings() works out, for every strip of A and
 * every strip of B, which pieces of the one overlap which pieces of the other
 * on the ground. The engine asks one question of the result: with a vehicle on
 * B whose rear bumper is in piece k, how far along A may another vehicle go
 * without touching anything the first may still cover? The answer is the first
 * piece of A that overlaps piece k of B or any piece after it.
 *
 * This is our own construction, not taken from another simulator.
 */
import { convexShapesOverlap, pointOnTurningPath, type TurningPath } from "./junction-geometry";
import type { Point } from "./types";

/** A connection's strips, as distances from the left edge of the road it leaves and of the road it joins. */
export interface StripBand {
  path: TurningPath;
  stripCount: number;
  /** Left edge of strip i across the road it leaves: fromLeftM + i * fromStripWidthM. Likewise across the road it joins. */
  fromLeftM: number;
  fromStripWidthM: number;
  toLeftM: number;
  toStripWidthM: number;
}

/** The value in a crossings table for "no piece": the strips do not cross from here on. */
export const NO_CROSSING = 32767;

/** Strips are narrowed by this much on each side, so that neighbouring strips, which share an edge, do not count as crossing. */
const NARROWED_BY_M = 0.01;

interface Piece {
  corners: Point[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function piece(corners: Point[]): Piece {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of corners) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { corners, minX, minY, maxX, maxY };
}

function overlap(a: Piece, b: Piece): boolean {
  if (a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY) return false;
  return convexShapesOverlap(a.corners, b.corners);
}

/** The pieces of the band between two lines across it, given as distances from the left edges of the two roads. */
function piecesBetween(band: StripBand, fromLeft: number, fromRight: number, toLeft: number, toRight: number): Piece[] {
  const { path } = band;
  const pieces: Piece[] = [];
  let left = pointOnTurningPath(path, fromLeft, toLeft, 0);
  let right = pointOnTurningPath(path, fromRight, toRight, 0);
  for (let k = 1; k <= path.pieces; k++) {
    const nextLeft = pointOnTurningPath(path, fromLeft, toLeft, k / path.pieces);
    const nextRight = pointOnTurningPath(path, fromRight, toRight, k / path.pieces);
    pieces.push(piece([left, nextLeft, nextRight, right]));
    left = nextLeft;
    right = nextRight;
  }
  return pieces;
}

function stripPieces(band: StripBand): Piece[][] {
  const strips: Piece[][] = [];
  for (let i = 0; i < band.stripCount; i++) {
    strips.push(
      piecesBetween(
        band,
        band.fromLeftM + i * band.fromStripWidthM + NARROWED_BY_M,
        band.fromLeftM + (i + 1) * band.fromStripWidthM - NARROWED_BY_M,
        band.toLeftM + i * band.toStripWidthM + NARROWED_BY_M,
        band.toLeftM + (i + 1) * band.toStripWidthM - NARROWED_BY_M,
      ),
    );
  }
  return strips;
}

function wholeBand(band: StripBand): Piece[] {
  return piecesBetween(
    band,
    band.fromLeftM + NARROWED_BY_M,
    band.fromLeftM + band.stripCount * band.fromStripWidthM - NARROWED_BY_M,
    band.toLeftM + NARROWED_BY_M,
    band.toLeftM + band.stripCount * band.toStripWidthM - NARROWED_BY_M,
  );
}

/** The pieces of a band, worked out once and used for every other band it is compared with. */
export interface BandPieces {
  band: StripBand;
  whole: Piece[];
  strips: Piece[][];
}

export function bandPieces(band: StripBand): BandPieces {
  return { band, whole: wholeBand(band), strips: stripPieces(band) };
}

/**
 * The crossings of connection A with connection B, or undefined when they
 * nowhere overlap. In the table, the entry at
 *   (stripOfA * stripCountOfB + stripOfB) * piecesOfB + pieceOfB
 * is the first piece of that strip of A that overlaps that piece of that strip
 * of B or any later piece of it; NO_CROSSING when none does.
 */
export function findCrossings(a: BandPieces, b: BandPieces): Int16Array | undefined {
  const piecesA = a.band.path.pieces;
  const piecesB = b.band.path.pieces;
  const stripsA = a.band.stripCount;
  const stripsB = b.band.stripCount;
  let table: Int16Array | undefined;
  for (let ka = 0; ka < piecesA; ka++) {
    for (let kb = 0; kb < piecesB; kb++) {
      if (!overlap(a.whole[ka]!, b.whole[kb]!)) continue;
      for (let i = 0; i < stripsA; i++) {
        const pieceA = a.strips[i]![ka]!;
        for (let j = 0; j < stripsB; j++) {
          if (!overlap(pieceA, b.strips[j]![kb]!)) continue;
          table ??= new Int16Array(stripsA * stripsB * piecesB).fill(NO_CROSSING);
          const at = (i * stripsB + j) * piecesB + kb;
          if (ka < table[at]!) table[at] = ka;
        }
      }
    }
  }
  if (!table) return undefined;
  // From "overlaps this piece of B" to "overlaps this piece of B or a later one".
  for (let pair = 0; pair < stripsA * stripsB; pair++) {
    const base = pair * piecesB;
    for (let kb = piecesB - 2; kb >= 0; kb--) {
      if (table[base + kb + 1]! < table[base + kb]!) table[base + kb] = table[base + kb + 1]!;
    }
  }
  return table;
}
