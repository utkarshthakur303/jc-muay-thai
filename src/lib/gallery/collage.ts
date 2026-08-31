/**
 * Packing photographs of any shape into a strip that scrolls sideways.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────
 * The gym's photographs are phone shots. A 1170×2532 portrait sits next
 * to a 2532×1170 panorama in the same list — a 4.7× spread in aspect
 * ratio, and more arrives every time somebody uploads from a phone.
 *
 * A carousel of identical cards would centre-crop all of it, and what
 * these particular pictures contain is people standing at full height.
 * Cropping a 1170×2532 team photograph into a square card throws away
 * about 70% of it, starting with the heads. The client chose keeping
 * every shape over a tidy row on 2026-08-31, and then asked for it to
 * still look like a properly organised collage. Both, not either.
 *
 * ── THE ANSWER ──────────────────────────────────────────────────────
 * The justified layout every photo library uses, turned on its side.
 *
 * Photographs are grouped into COLUMNS. Every column is exactly as tall
 * as the strip, and inside a column each photograph keeps its own ratio
 * exactly. A tall portrait fills a column by itself; two or three wide
 * shots stack to fill one between them. Nothing is cropped, and the top
 * and bottom of the strip are a flush line all the way along — which is
 * what makes it read as a collage rather than a row of odd-sized prints.
 *
 * ── THE MATHS ───────────────────────────────────────────────────────
 * For a column of height 1 holding n photographs of aspect ratio r₁…rₙ
 * with g of gap between each:
 *
 *     w/r₁ + w/r₂ + … + w/rₙ + g(n−1) = 1
 *     w = (1 − g(n−1)) / Σ(1/rᵢ)
 *
 * Adding a photograph only ever makes w smaller, so walking the list and
 * closing a column the moment w drops to the target is one pass with no
 * backtracking and no search.
 *
 * ── WHY EVERYTHING IS A FRACTION ────────────────────────────────────
 * Not one number here is a pixel. Widths and heights come back as
 * multiples of the strip's height, so the SAME packing serves every
 * breakpoint: CSS changes one custom property and the whole collage
 * scales with it.
 *
 * That is what keeps this on the server. The alternative — measuring the
 * container in the browser and packing to the real width — reflows after
 * hydration, and `/` must stay statically prerendered — the first of the
 * project's engineering rules. This runs once at build time and ships as
 * numbers.
 */

export type Shaped = {
  readonly width: number;
  readonly height: number;
};

export type PackedPhoto<T> = {
  readonly photo: T;
  /** Height as a fraction of the strip's height. */
  readonly height: number;
};

export type PackedColumn<T> = {
  /** Width as a fraction of the strip's HEIGHT — not of the strip's width. */
  readonly width: number;
  readonly photos: readonly PackedPhoto<T>[];
  /**
   * True when the column filled to the strip's full height. Only a
   * trailing column can be short: it ran out of photographs before it
   * reached the target width. Its own height is the sum below.
   */
  readonly full: boolean;
};

export type PackOptions = {
  /** Close a column once it is no wider than this. */
  readonly targetWidth: number;
  /** Space between stacked photographs. */
  readonly gap: number;
  /** Never stack more than this, however wide the photographs are. */
  readonly maxPerColumn: number;
  /**
   * Floors, in strip heights, on how small stacking may leave a
   * photograph. Both are checked before a photograph joins a column that
   * already has one in it; a photograph standing on its own is never
   * refused, because there is nowhere else for it to go.
   *
   * These are the rules that stop the packing being clever at the
   * expense of being useful. Without them a near-square photograph —
   * 0.97, just over the target — pulls the next portrait in after it and
   * the pair closes a column 0.35 wide: 97px on a phone, holding two
   * pictures you cannot make anything out in. Better one wide column
   * than two unreadable ones.
   */
  readonly minPhotoWidth: number;
  readonly minPhotoHeight: number;
  /**
   * Ceiling on a column's width. A column over it is scaled down and
   * aligned to the top instead, so the strip's top edge stays a straight
   * line even where its bottom cannot.
   */
  readonly maxWidth: number;
};

/**
 * Tuned against the gym's real set — 0.46 portraits through a 2.16
 * panorama — then checked in a browser at 320, 390, 768 and 1280.
 *
 * `targetWidth` 0.95 and `minPhotoHeight` 0.3 work as a pair: the first
 * decides when a column is narrow enough to close, the second refuses
 * the stacking that would get it there. Together they give a portrait a
 * column of its own, pair two landscapes, and let a panorama recruit a
 * third only when all three stay big enough to read.
 */
export const DEFAULT_PACK: PackOptions = {
  targetWidth: 0.95,
  gap: 0.028,
  maxPerColumn: 3,
  minPhotoWidth: 0.42,
  minPhotoHeight: 0.3,
  maxWidth: 1.75,
};

/**
 * Aspect ratios from arbitrary rows, clamped rather than trusted.
 *
 * The database CHECK allows 1…20000 on both sides, so a typo can present
 * a ratio of 20000 — one photograph 20000 strip-heights wide, which is a
 * page that never stops scrolling sideways. The clamp is deliberately
 * generous: 0.2 is taller than any phone shoots and 5 is wider than any
 * panorama a phone stitches, so nothing real is touched.
 */
const MIN_RATIO = 0.2;
const MAX_RATIO = 5;

export function aspectRatio(shape: Shaped): number {
  const { width, height } = shape;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    // Neither dimension is usable, so no ratio is more right than any
    // other. Square is the one that distorts a stacked column least.
    return 1;
  }
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height));
}

/**
 * The width a column of these ratios needs to stand exactly one strip
 * height tall.
 *
 * The numerator is what is left of that height after the gaps. With
 * enough photographs the gaps alone would exceed it, which is why
 * `maxPerColumn` exists — but a floor here means this function is total
 * on its own rather than only inside its caller.
 */
export function columnWidth(
  ratios: readonly number[],
  gap: number,
): number {
  if (ratios.length === 0) return 0;
  const usable = Math.max(0.05, 1 - gap * (ratios.length - 1));
  let inverse = 0;
  for (const ratio of ratios) inverse += 1 / ratio;
  return usable / inverse;
}

/**
 * Would a column of these ratios leave every photograph in it big enough
 * to be worth looking at? Every photograph in a column shares its width,
 * so the widest ratio is always the shortest picture.
 */
function bigEnough(
  ratios: readonly number[],
  { gap, minPhotoWidth, minPhotoHeight }: PackOptions,
): boolean {
  const width = columnWidth(ratios, gap);
  return (
    width >= minPhotoWidth && width / Math.max(...ratios) >= minPhotoHeight
  );
}

export function packCollage<T extends Shaped>(
  photos: readonly T[],
  options: PackOptions = DEFAULT_PACK,
): readonly PackedColumn<T>[] {
  const { targetWidth, gap, maxPerColumn, maxWidth } = options;

  const columns: PackedColumn<T>[] = [];
  let pending: T[] = [];
  let ratios: number[] = [];

  const close = (): void => {
    const wanted = columnWidth(ratios, gap);
    const width = Math.min(wanted, maxWidth);
    columns.push({
      width,
      // A capped column no longer reaches the strip's full height. It
      // keeps every shape — the photographs got smaller, not cropped —
      // and the layout tops it out rather than centring it.
      full: width === wanted,
      photos: pending.map((photo, index) => ({
        photo,
        height: width / (ratios[index] ?? 1),
      })),
    });
    pending = [];
    ratios = [];
  };

  const closes = (): boolean =>
    columnWidth(ratios, gap) <= targetWidth || pending.length >= maxPerColumn;

  for (const photo of photos) {
    const ratio = aspectRatio(photo);

    if (pending.length > 0) {
      const trial = [...ratios, ratio];
      const roomFor = trial.length <= maxPerColumn && bigEnough(trial, options);
      // Adding this one would squash something below the floor, so the
      // column stands as it is and this photograph starts the next.
      if (!roomFor) close();
    }

    pending.push(photo);
    ratios.push(ratio);
    if (closes()) close();
  }

  // Whatever is left never got narrow enough to close on its own — the
  // last column, and the only one that reaching the end of the list can
  // leave short.
  if (pending.length > 0) close();

  return columns;
}

/**
 * How tall a column actually stands, in strip heights. Exactly 1 for
 * every full column; less for a capped trailing one.
 */
export function columnHeight<T>(
  column: PackedColumn<T>,
  gap: number = DEFAULT_PACK.gap,
): number {
  if (column.photos.length === 0) return 0;
  const stacked = column.photos.reduce((sum, item) => sum + item.height, 0);
  return stacked + gap * (column.photos.length - 1);
}
