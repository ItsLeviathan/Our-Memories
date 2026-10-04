import { describe, expect, it } from "vitest";
import { computeJustifiedLayout, type LayoutInput } from "./gallery-layout";

const opts = { containerWidth: 1000, targetRowHeight: 250, gap: 8 };

function rowWidth(row: ReturnType<typeof computeJustifiedLayout>[number], gap: number) {
  return row.boxes.reduce((s, b) => s + b.width, 0) + gap * (row.boxes.length - 1);
}

describe("computeJustifiedLayout", () => {
  it("returns nothing for empty input or zero width", () => {
    expect(computeJustifiedLayout([], opts)).toEqual([]);
    expect(computeJustifiedLayout([{ aspect: 1 }], { ...opts, containerWidth: 0 })).toEqual([]);
  });

  it("places every photo exactly once, in order", () => {
    const inputs: LayoutInput[] = Array.from({ length: 37 }, (_, i) => ({ aspect: [0.75, 1.5, 1, 1.33, 0.66][i % 5] }));
    const rows = computeJustifiedLayout(inputs, opts);
    const order = rows.flatMap((r) => r.boxes.map((b) => b.index));
    expect(order).toEqual(inputs.map((_, i) => i));
  });

  it("fills full rows exactly to the container width", () => {
    const inputs = Array.from({ length: 20 }, (_, i) => ({ aspect: i % 2 ? 1.5 : 0.75 }));
    const rows = computeJustifiedLayout(inputs, opts);
    for (const row of rows.slice(0, -1)) expect(rowWidth(row, opts.gap)).toBe(opts.containerWidth);
  });

  it("preserves aspect ratios within rounding", () => {
    const inputs = [{ aspect: 0.75 }, { aspect: 1.5 }, { aspect: 1 }, { aspect: 1.78 }, { aspect: 0.8 }, { aspect: 1.2 }];
    for (const row of computeJustifiedLayout(inputs, opts)) {
      for (const box of row.boxes.slice(0, -1)) {
        expect(Math.abs(box.width / box.height - inputs[box.index].aspect)).toBeLessThan(0.02);
      }
    }
  });

  it("does not stretch a lonely last photo to full width", () => {
    const rows = computeJustifiedLayout([{ aspect: 0.75 }], opts);
    expect(rows).toHaveLength(1);
    expect(rows[0].boxes[0].height).toBe(250);
    expect(rows[0].boxes[0].width).toBeLessThan(opts.containerWidth);
  });

  it("features favorites in their own larger row, with spacing", () => {
    const inputs: LayoutInput[] = Array.from({ length: 30 }, (_, i) => ({ aspect: 1.5, featured: i === 0 || i === 1 || i === 15 }));
    const rows = computeJustifiedLayout(inputs, opts);
    const featured = rows.filter((r) => r.featured);
    expect(featured.map((r) => r.boxes[0].index)).toEqual([0, 15]);
    expect(featured[0].height).toBeGreaterThan(opts.targetRowHeight);
    expect(featured[0].boxes[0].width).toBeLessThanOrEqual(opts.containerWidth);
  });

  it("clamps absurd aspect ratios", () => {
    const rows = computeJustifiedLayout([{ aspect: 0 }, { aspect: Infinity }, { aspect: 50 }], opts);
    expect(rows.flatMap((r) => r.boxes).every((b) => b.width > 0 && b.height > 0)).toBe(true);
  });
});
