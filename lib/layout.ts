/**
 * Lays the featured plates out on the home page's 12-column grid.
 *
 * Rows cycle through [7, 5], [5, 7] and [4, 4, 4]. When the projects run out partway through a row, a single
 * leftover plate spans all 12 columns at a wide ratio and two leftovers share the row as [6, 6].
 *
 * Each plate gets an aspect ratio chosen so every plate in a row ends at the same height. The grid sets its
 * column gap as a percentage of its own width (COLUMN_GAP), so the ratios hold at every viewport width.
 */

/** Column gap as a fraction of the grid's width. site.css sets `column-gap: 2.2%` to match. */
export const COLUMN_GAP = 0.022;

const COLUMNS = 12;
const CYCLE: readonly (readonly number[])[] = [
  [7, 5],
  [5, 7],
  [4, 4, 4],
];

/** Aspect ratio (width / height) of the widest plate in each row shape; the others follow from the shared height. */
const LEAD_RATIO: Record<string, number> = {
  '7,5': 1.52,
  '5,7': 1.52,
  '4,4,4': 1.23,
  '6,6': 1.4,
  '12': 2.25,
};

export interface Placement<T> {
  item: T;
  /** Columns spanned out of 12. */
  span: number;
  /** Width / height for the plate's CSS aspect-ratio. */
  ratio: number;
  /** 0-based row index, handy for choosing which images load eagerly. */
  row: number;
}

/** Width of a plate spanning `span` columns, as a fraction of the grid's width, gaps included. */
function plateWidth(span: number): number {
  const column = (1 - (COLUMNS - 1) * COLUMN_GAP) / COLUMNS;
  return span * column + (span - 1) * COLUMN_GAP;
}

function rowShape(cycleIndex: number, remaining: number): readonly number[] {
  const shape = CYCLE[cycleIndex % CYCLE.length];
  if (remaining >= shape.length) return shape;
  return remaining === 1 ? [12] : [6, 6];
}

export function layoutPlates<T>(items: readonly T[]): Placement<T>[] {
  const placements: Placement<T>[] = [];
  let next = 0;
  let row = 0;

  while (next < items.length) {
    const shape = rowShape(row, items.length - next);
    const lead = Math.max(...shape);
    const rowHeight = plateWidth(lead) / LEAD_RATIO[shape.join(',')];

    for (const span of shape) {
      placements.push({
        item: items[next],
        span,
        ratio: Math.round((plateWidth(span) / rowHeight) * 1000) / 1000,
        row,
      });
      next += 1;
    }
    row += 1;
  }

  return placements;
}
