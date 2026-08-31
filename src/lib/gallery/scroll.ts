/**
 * Where the strip should scroll to next.
 *
 * ── WHY THIS IS ARITHMETIC AND NOT A STORED INDEX ───────────────────
 * The obvious way to run a carousel is to keep "which slide am I on" in
 * state and compute the target from it. That breaks the moment anything
 * else moves the strip — and here everything else does: a finger swipe,
 * a trackpad, a scrollbar drag, shift-wheel, a focus ring pulling a
 * photograph into view when someone tabs into it, a font finishing
 * loading and reflowing every column.
 *
 * So nothing is remembered. Every decision is taken from the strip's own
 * `scrollLeft` at the moment it is asked, which makes the timer, the
 * arrows and the user's finger all agree by construction. Swipe halfway
 * into a column and the next tick advances from where you actually are,
 * not from where a counter thought you were.
 *
 * Pulling it out here rather than reading the DOM inline is what lets the
 * awkward cases — a column wider than the window, iOS rubber-banding
 * `scrollLeft` negative, a strip with nothing to scroll — be tested
 * instead of hoped for.
 */

/**
 * What the scroller can tell you without walking its children. Split
 * out because the scroll handler runs on every animation frame of a
 * swipe, and measuring thirteen columns to move a progress bar would
 * force a full layout sixty times a second.
 */
export type ScrollSpan = {
  readonly scrollLeft: number;
  readonly clientWidth: number;
  readonly scrollWidth: number;
};

export type StripMetrics = ScrollSpan & {
  /**
   * Each column's left edge in the scroller's content coordinates —
   * the value `scrollLeft` would have to take for that column to sit
   * flush against the left of the window.
   */
  readonly columnStarts: readonly number[];
};

/**
 * Sub-pixel slack. Column edges land on fractional pixels once a
 * percentage width meets a device pixel ratio, and `scrollLeft` is
 * itself fractional in every current browser. Without this, "is the
 * column already at the left edge" answers no when it visibly is, and
 * the strip advances twice in one tick.
 */
const EPSILON = 1;

function maxScroll(metrics: ScrollSpan): number {
  return Math.max(0, metrics.scrollWidth - metrics.clientWidth);
}

/** Somewhere sane, whatever the browser reported. */
function clampedScrollLeft(metrics: ScrollSpan): number {
  const value = Number.isFinite(metrics.scrollLeft) ? metrics.scrollLeft : 0;
  return Math.min(Math.max(0, value), maxScroll(metrics));
}

export function canScroll(metrics: ScrollSpan): boolean {
  return maxScroll(metrics) > EPSILON;
}

export function atStart(metrics: ScrollSpan): boolean {
  return !canScroll(metrics) || clampedScrollLeft(metrics) <= EPSILON;
}

export function atEnd(metrics: ScrollSpan): boolean {
  return (
    !canScroll(metrics) ||
    clampedScrollLeft(metrics) >= maxScroll(metrics) - EPSILON
  );
}

/**
 * The next resting place, or null when there is nothing to do.
 *
 * Wraps to the beginning at the end, because the timer has to keep
 * going somewhere and stopping dead on the last photograph looks like a
 * bug rather than a decision.
 *
 * A column wider than the window is the case worth naming: its start is
 * the only position that shows the left of it, and the position after it
 * is past the end of the scroller. Clamping to `maxScroll` means the
 * strip lands as far along as it can go and the NEXT tick wraps — so a
 * panorama gets its own beat instead of being skipped past.
 */
export function nextScroll(metrics: StripMetrics): number | null {
  if (!canScroll(metrics)) return null;

  const from = clampedScrollLeft(metrics);
  if (atEnd(metrics)) return from === 0 ? null : 0;

  const upcoming = metrics.columnStarts.find((start) => start > from + EPSILON);
  if (upcoming === undefined) return maxScroll(metrics);

  return Math.min(upcoming, maxScroll(metrics));
}

/**
 * The previous resting place, wrapping to the end — the same rule the
 * lightbox arrows already follow, so the two sets of arrows on this
 * section do not disagree about what the edges mean.
 */
export function previousScroll(metrics: StripMetrics): number | null {
  if (!canScroll(metrics)) return null;

  const from = clampedScrollLeft(metrics);
  if (atStart(metrics)) return maxScroll(metrics);

  const earlier = [...metrics.columnStarts]
    .reverse()
    .find((start) => start < from - EPSILON);

  return Math.max(0, earlier ?? 0);
}

/**
 * How far along the strip is, 0 to 1, for the progress bar.
 *
 * Returns 1 when there is nothing to scroll: everything there is to see
 * is already on screen, and a bar sitting empty under a strip that is
 * complete would be reporting the opposite of the truth.
 */
export function scrollProgress(metrics: ScrollSpan): number {
  const span = maxScroll(metrics);
  if (span <= EPSILON) return 1;
  return Math.min(1, Math.max(0, clampedScrollLeft(metrics) / span));
}
