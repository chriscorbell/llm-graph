import { describe, expect, it } from "vitest";
import { placeLabels } from "./labels.ts";

const bounds = { x0: 0, y0: 0, x1: 400, y1: 300 };

describe("placeLabels", () => {
  it("never overlaps two labels", () => {
    const requests = [
      { id: "a", anchor: { x: 200, y: 150 }, width: 80, height: 16 },
      { id: "b", anchor: { x: 205, y: 152 }, width: 80, height: 16 },
      { id: "c", anchor: { x: 210, y: 148 }, width: 80, height: 16 },
    ];
    const placed = placeLabels(requests, [], [], bounds);
    const boxes = placed.map((p) => {
      const a = requests.find((r) => r.id === p.id)!.anchor;
      return { x0: a.x + p.dx, y0: a.y + p.dy, x1: a.x + p.dx + p.width, y1: a.y + p.dy + p.height };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [p, q] = [boxes[i], boxes[j]];
        expect(p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0).toBe(false);
      }
    }
  });

  it("flips a label inward at the right edge", () => {
    const [label] = placeLabels([{ id: "a", anchor: { x: 395, y: 150 }, width: 80, height: 16 }], [], [], bounds);
    expect(label.dx).toBeLessThan(0);
  });

  it("avoids a line running through the preferred spot", () => {
    const anchor = { x: 200, y: 150 };
    const p = { x: 190, y: 135 };
    const q = { x: 320, y: 140 };
    const [label] = placeLabels([{ id: "a", anchor, width: 80, height: 16 }], [], [[p, q]], bounds);
    const box = { x0: anchor.x + label.dx, y0: anchor.y + label.dy, x1: anchor.x + label.dx + 80, y1: anchor.y + label.dy + 16 };
    for (let t = 0; t <= 1; t += 0.01) {
      const x = p.x + (q.x - p.x) * t;
      const y = p.y + (q.y - p.y) * t;
      expect(x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1).toBe(false);
    }
  });
});
