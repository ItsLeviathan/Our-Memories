/**
 * Editorial "justified rows" layout. Photos keep their true aspect ratio (no
 * distortion, no cropping); each row is scaled so it exactly fills the width.
 * Favorites can break out into a larger, featured row to create rhythm.
 */

export interface LayoutInput {
  aspect: number; // width / height
  featured?: boolean;
}

export interface LayoutBox {
  index: number;
  width: number;
  height: number;
}

export interface LayoutRow {
  height: number;
  boxes: LayoutBox[];
  featured: boolean;
}

export interface LayoutOptions {
  containerWidth: number;
  targetRowHeight: number;
  gap: number;
  /** Rows may stretch to at most this multiple of the target height. */
  maxStretch?: number;
  /** Minimum number of photos between two featured rows. */
  featuredSpacing?: number;
}

const clampAspect = (a: number) => (Number.isFinite(a) && a > 0 ? Math.min(Math.max(a, 0.25), 4) : 1);

function buildRow(items: { index: number; aspect: number }[], width: number, gap: number, height: number, featured: boolean): LayoutRow {
  // Widths are rounded; the last box absorbs rounding so rows align exactly.
  const boxes: LayoutBox[] = [];
  const available = width - gap * (items.length - 1);
  const totalAspect = items.reduce((s, i) => s + i.aspect, 0);
  const exact = available / totalAspect >= height; // row is not full-width (last row)
  let used = 0;
  items.forEach((item, n) => {
    const isLast = n === items.length - 1;
    const w = isLast && !exact ? available - used : Math.round(item.aspect * height);
    boxes.push({ index: item.index, width: Math.max(1, w), height: Math.round(height) });
    used += w;
  });
  return { height: Math.round(height), boxes, featured };
}

export function computeJustifiedLayout(inputs: LayoutInput[], opts: LayoutOptions): LayoutRow[] {
  const { containerWidth: W, targetRowHeight: target, gap } = opts;
  const maxStretch = opts.maxStretch ?? 1.45;
  const spacing = opts.featuredSpacing ?? 6;
  if (W <= 0 || inputs.length === 0) return [];

  const rows: LayoutRow[] = [];
  let current: { index: number; aspect: number }[] = [];
  let sinceFeatured = spacing;

  const rowHeightFor = (items: { aspect: number }[]) =>
    (W - gap * (items.length - 1)) / items.reduce((s, i) => s + i.aspect, 0);

  const flush = (allowShortRow: boolean) => {
    if (!current.length) return;
    const h = rowHeightFor(current);
    if (h <= target * maxStretch) {
      rows.push(buildRow(current, W, gap, h, false));
    } else if (allowShortRow) {
      // Too few photos to fill the width: keep target height, left-aligned.
      rows.push(buildRow(current, W, gap, target, false));
    } else {
      return;
    }
    current = [];
  };

  inputs.forEach((input, index) => {
    const aspect = clampAspect(input.aspect);

    if (input.featured && sinceFeatured >= spacing) {
      // Close the current row if it can be stretched acceptably, then feature.
      if (current.length) {
        const h = rowHeightFor(current);
        if (h <= target * maxStretch) flush(false);
      }
      if (!current.length) {
        const featuredHeight = Math.min(W / aspect, target * (W < 640 ? 1.9 : 2.1));
        const width = Math.min(W, Math.round(featuredHeight * aspect));
        rows.push({ height: Math.round(featuredHeight), boxes: [{ index, width, height: Math.round(featuredHeight) }], featured: true });
        sinceFeatured = 0;
        return;
      }
    }

    current.push({ index, aspect });
    sinceFeatured += 1;
    if (rowHeightFor(current) <= target) flush(false);
  });

  flush(true);
  return rows;
}

/** Target row height per container width — about 2 photos per row on phones. */
export function targetRowHeightFor(width: number): number {
  if (width < 420) return 150;
  if (width < 640) return 190;
  if (width < 1024) return 240;
  return 300;
}

export function gapFor(width: number): number {
  return width < 640 ? 4 : 8;
}
