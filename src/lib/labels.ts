// Series labels sit in a column beside the plot. Each lines up with its line's
// end dot where it can; labels that would collide spread apart evenly around
// the heights they want, so each one moves as little as possible.

export interface Point {
  x: number;
  y: number;
}

/**
 * Spaces label centers at least `gap` apart within [min, max], keeping their order.
 * Returns centers in the same order as `desired`. Callers keep the count within what fits.
 */
export function stackLabels(desired: number[], gap: number, min: number, max: number): number[] {
  const order = desired.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  // Runs of labels packed edge to edge. A run sits where its members' total distance
  // from where they want to be is smallest, then is nudged back inside the bounds.
  const runs: { start: number; count: number; sum: number; top: number }[] = [];
  const place = (r: (typeof runs)[number]) => {
    const span = (r.count - 1) * gap;
    r.top = Math.max(min, Math.min(r.sum / r.count - span / 2, max - span));
  };

  for (const [k, { y }] of order.entries()) {
    const run = { start: k, count: 1, sum: y, top: y };
    place(run);
    runs.push(run);
    // Merge backwards while the newest run overlaps the one before it.
    while (runs.length > 1) {
      const b = runs[runs.length - 1];
      const a = runs[runs.length - 2];
      if (a.top + a.count * gap <= b.top) break;
      a.count += b.count;
      a.sum += b.sum;
      runs.pop();
      place(a);
    }
  }

  const out = new Array<number>(desired.length);
  for (const r of runs) {
    for (let j = 0; j < r.count; j++) out[order[r.start + j].i] = r.top + j * gap;
  }
  return out;
}
