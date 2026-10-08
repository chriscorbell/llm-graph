import { describe, expect, it } from "vitest";
import { paretoFrontier } from "./pareto.ts";

const p = (id: string, costPerTask: number, intelligence: number) => ({ id, costPerTask, intelligence });
const ids = (points: { id: string }[]) => points.map((x) => x.id);

describe("paretoFrontier", () => {
  it("keeps points nothing else is both cheaper and smarter than, cheapest first", () => {
    const points = [p("big", 4, 70), p("mid", 1, 60), p("worse", 2, 55), p("small", 0.2, 40), p("pricey", 6, 65)];
    expect(ids(paretoFrontier(points))).toEqual(["small", "mid", "big"]);
  });

  it("drops a point that only ties a cheaper one on score", () => {
    expect(ids(paretoFrontier([p("a", 1, 50), p("b", 2, 50)]))).toEqual(["a"]);
  });

  it("keeps only the smarter of two points at the same cost", () => {
    expect(ids(paretoFrontier([p("low", 1, 40), p("high", 1, 45)]))).toEqual(["high"]);
  });

  it("handles no points", () => {
    expect(paretoFrontier([])).toEqual([]);
  });
});
