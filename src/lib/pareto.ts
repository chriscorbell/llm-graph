interface Scored {
  costPerTask: number;
  intelligence: number;
}

/** Points that no other point beats on both cost and score, cheapest first. */
export function paretoFrontier<T extends Scored>(points: T[]): T[] {
  const sorted = [...points].sort((a, b) => a.costPerTask - b.costPerTask || b.intelligence - a.intelligence);
  const frontier: T[] = [];
  for (const p of sorted) {
    if (frontier.length === 0 || p.intelligence > frontier[frontier.length - 1].intelligence) frontier.push(p);
  }
  return frontier;
}
