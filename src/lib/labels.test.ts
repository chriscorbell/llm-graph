import { describe, expect, it } from "vitest";
import { stackLabels } from "./labels.ts";

describe("stackLabels", () => {
  it("leaves labels that don't collide where they want to be", () => {
    expect(stackLabels([50, 10, 90], 20, 0, 200)).toEqual([50, 10, 90]);
  });

  it("spreads colliding labels evenly around the heights they want", () => {
    expect(stackLabels([100, 104], 20, 0, 200)).toEqual([92, 112]);
  });

  it("keeps the input order of the results", () => {
    expect(stackLabels([104, 100], 20, 0, 200)).toEqual([112, 92]);
  });

  it("merges a chain of collisions into one evenly spaced run", () => {
    expect(stackLabels([100, 100, 100], 20, 0, 200)).toEqual([80, 100, 120]);
  });

  it("pushes a run back inside the bounds", () => {
    expect(stackLabels([5, 5], 20, 0, 200)).toEqual([0, 20]);
    expect(stackLabels([198, 199], 20, 0, 200)).toEqual([180, 200]);
  });

  it("never leaves two labels closer than the gap", () => {
    const desired = [40, 42, 45, 120, 125, 60, 61, 190, 195, 3];
    const placed = stackLabels(desired, 18, 0, 200).sort((a, b) => a - b);
    for (let i = 1; i < placed.length; i++) expect(placed[i] - placed[i - 1]).toBeGreaterThanOrEqual(18 - 1e-9);
    expect(placed[0]).toBeGreaterThanOrEqual(0);
    expect(placed[placed.length - 1]).toBeLessThanOrEqual(200);
  });
});
