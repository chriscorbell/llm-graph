// Greedy direct-label placement: each series label tries spots around its
// line's end dot and takes the one that overlaps the fewest marks.

export interface Point {
  x: number;
  y: number;
}

export interface LabelRequest {
  id: string;
  anchor: Point;
  width: number;
  height: number;
}

export interface PlacedLabel {
  id: string;
  /** Offset from the anchor to the label box's top-left corner. */
  dx: number;
  dy: number;
  width: number;
  height: number;
  /** Label sits away from its dot and needs a leader line. */
  leader: boolean;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const GAP = 7;
const PAD = 3;

function candidates(w: number, h: number): { dx: number; dy: number; leader: boolean }[] {
  const near = [
    { dx: GAP - 2, dy: -h - GAP + 2 }, // above right
    { dx: -w - GAP + 2, dy: -h - GAP + 2 }, // above left
    { dx: GAP + 3, dy: -h / 2 }, // right
    { dx: -w - GAP - 3, dy: -h / 2 }, // left
    { dx: -w / 2, dy: -h - GAP - 1 }, // above
    { dx: GAP - 2, dy: GAP - 2 }, // below right
    { dx: -w - GAP + 2, dy: GAP - 2 }, // below left
    { dx: -w / 2, dy: GAP + 1 }, // below
  ];
  const far = near.slice(0, 4).map(({ dx, dy }) => ({
    dx: dx + Math.sign(dx + w / 2) * 22,
    dy: dy + Math.sign(dy + h / 2) * 18,
  }));
  return [...near.map((c) => ({ ...c, leader: false })), ...far.map((c) => ({ ...c, leader: true }))];
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function segmentHitsBox(p: Point, q: Point, b: Box): boolean {
  // Liang-Barsky clip
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const checks: [number, number][] = [
    [-dx, p.x - b.x0],
    [dx, b.x1 - p.x],
    [-dy, p.y - b.y0],
    [dy, b.y1 - p.y],
  ];
  for (const [pk, qk] of checks) {
    if (pk === 0) {
      if (qk < 0) return false;
    } else {
      const t = qk / pk;
      if (pk < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

export function placeLabels(
  requests: LabelRequest[],
  dots: Point[],
  segments: [Point, Point][],
  bounds: Box,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const taken: Box[] = [];

  for (const req of requests) {
    let best: { score: number; dx: number; dy: number; leader: boolean; box: Box } | null = null;
    for (const [i, c] of candidates(req.width, req.height).entries()) {
      const box = {
        x0: req.anchor.x + c.dx,
        y0: req.anchor.y + c.dy,
        x1: req.anchor.x + c.dx + req.width,
        y1: req.anchor.y + c.dy + req.height,
      };
      if (box.x0 < bounds.x0 || box.x1 > bounds.x1 || box.y0 < bounds.y0 || box.y1 > bounds.y1) continue;
      const padded = { x0: box.x0 - PAD, y0: box.y0 - PAD, x1: box.x1 + PAD, y1: box.y1 + PAD };
      if (taken.some((t) => overlaps(t, padded))) continue;
      const dotHits = dots.filter((d) => d.x > padded.x0 - 4 && d.x < padded.x1 + 4 && d.y > padded.y0 - 4 && d.y < padded.y1 + 4).length;
      const lineHits = segments.filter(([p, q]) => segmentHitsBox(p, q, box)).length;
      const score = dotHits * 10 + lineHits * 4 + i * 0.6 + (c.leader ? 6 : 0);
      if (!best || score < best.score) best = { score, ...c, box };
    }
    if (!best) continue;
    const { dx, dy, leader, box } = best;
    taken.push(box);
    placed.push({ id: req.id, dx, dy, width: req.width, height: req.height, leader });
  }
  return placed;
}
