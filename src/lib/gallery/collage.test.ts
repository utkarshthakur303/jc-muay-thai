import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aspectRatio,
  columnHeight,
  columnWidth,
  DEFAULT_PACK,
  packCollage,
  type PackOptions,
  type Shaped,
} from "./collage.ts";

/**
 * The invariant every case below is really checking: no photograph is
 * ever cropped, and every column except a trailing one is exactly one
 * strip height tall. Those two together are what "an organised collage
 * that keeps every shape" means, and they are easy to break by tuning
 * the packing without re-deriving the arithmetic.
 */

const photo = (width: number, height: number): Shaped => ({ width, height });

/** The gym's real gallery on 2026-08-31, shapes only. */
const REAL: readonly Shaped[] = [
  photo(2532, 1170), // 2.16 — the panorama
  photo(1170, 778), // 1.50
  photo(1600, 1066), // 1.50
  photo(1170, 2532), // 0.46 — a phone portrait
  photo(1170, 2052), // 0.57
  photo(1170, 1462), // 0.80
  photo(1170, 2532), // 0.46
  photo(3024, 4032), // 0.75
  photo(4284, 5712), // 0.75
  photo(1170, 1204), // 0.97
  photo(1170, 2081), // 0.56
  photo(4096, 2730), // 1.50
  photo(5712, 3213), // 1.78
  photo(3024, 4032), // 0.75
  photo(1170, 1078), // 1.09
];

function everyPhotoKeepsItsShape(
  photos: readonly Shaped[],
  options: PackOptions = DEFAULT_PACK,
): void {
  const columns = packCollage(photos, options);
  for (const column of columns) {
    for (const item of column.photos) {
      const drawn = column.width / item.height;
      const real = aspectRatio(item.photo);
      assert.ok(
        Math.abs(drawn - real) < 1e-9,
        `drawn at ${drawn}, real shape is ${real}`,
      );
    }
  }
}

describe("aspectRatio", () => {
  it("is width over height", () => {
    assert.equal(aspectRatio(photo(1000, 500)), 2);
    assert.equal(aspectRatio(photo(500, 1000)), 0.5);
  });

  it("clamps shapes no camera produces", () => {
    // The database CHECK allows 1…20000 on both sides, so a typo can
    // present a ratio of 20000 — one photograph twenty thousand strip
    // heights wide, which is a page that scrolls sideways forever.
    assert.equal(aspectRatio(photo(20000, 1)), 5);
    assert.equal(aspectRatio(photo(1, 20000)), 0.2);
  });

  it("falls back to square on a shape that cannot be used", () => {
    for (const bad of [
      photo(0, 100),
      photo(100, 0),
      photo(-100, 100),
      photo(Number.NaN, 100),
      photo(Number.POSITIVE_INFINITY, 100),
    ]) {
      assert.equal(aspectRatio(bad), 1);
    }
  });
});

describe("columnWidth", () => {
  it("solves the column exactly", () => {
    // Two 2:1 photographs, no gap: each is w tall by w/2, so 2 × w/2 = 1.
    assert.equal(columnWidth([2, 2], 0), 1);
    // One square fills a unit column at width 1.
    assert.equal(columnWidth([1], 0), 1);
  });

  it("takes the gaps out of the height first", () => {
    // Three squares with 0.1 between: 0.8 of height left, so 0.2666… each.
    assert.ok(Math.abs(columnWidth([1, 1, 1], 0.1) - 0.8 / 3) < 1e-12);
  });

  it("never divides by a height the gaps have eaten", () => {
    // Twenty photographs at 0.1 gap would leave −0.9 of height. A
    // negative width would flip every box inside out rather than
    // failing, which is the kind of bug that ships.
    assert.ok(columnWidth(new Array(20).fill(1), 0.1) > 0);
  });

  it("is zero for nothing", () => {
    assert.equal(columnWidth([], 0.03), 0);
  });
});

describe("packCollage", () => {
  it("gives back no columns for no photographs", () => {
    assert.deepEqual(packCollage([]), []);
  });

  it("crops nothing, on the gym's real gallery", () => {
    everyPhotoKeepsItsShape(REAL);
  });

  it("crops nothing, on shapes chosen to be awkward", () => {
    everyPhotoKeepsItsShape([
      photo(5000, 1000), // wider than the clamp
      photo(1000, 5000), // taller than the clamp
      photo(1, 1),
      photo(3, 2),
      photo(2, 3),
    ]);
  });

  it("keeps every photograph, in order, exactly once", () => {
    const columns = packCollage(REAL);
    const flat = columns.flatMap((column) =>
      column.photos.map((item) => item.photo),
    );
    assert.equal(flat.length, REAL.length);
    assert.deepEqual(flat, [...REAL]);
  });

  it("fills every column but the last to exactly one strip height", () => {
    const columns = packCollage(REAL);
    for (const column of columns.slice(0, -1)) {
      assert.ok(column.full, "an inner column closed short");
      assert.ok(
        Math.abs(columnHeight(column) - 1) < 1e-9,
        `column stands ${columnHeight(column)} tall, not 1`,
      );
    }
  });

  it("gives a tall portrait a column to itself", () => {
    // 0.46 is already below the 0.82 target, so it closes on its own.
    const columns = packCollage([photo(1170, 2532), photo(1170, 2532)]);
    assert.equal(columns.length, 2);
    assert.equal(columns[0]?.photos.length, 1);
  });

  it("stacks wide photographs rather than letting them run off screen", () => {
    // A single 2.16 panorama at full height would be 2.16 strip heights
    // wide — wider than a phone screen, so it would never be seen whole.
    // Three of them close one full column at 0.68 instead.
    const panorama = photo(2532, 1170);
    const columns = packCollage([panorama, panorama, panorama]);
    assert.equal(columns.length, 1);
    assert.equal(columns[0]?.photos.length, 3);
    assert.equal(columns[0]?.full, true);
    assert.ok((columns[0]?.width ?? 0) <= DEFAULT_PACK.targetWidth);
  });

  it("keeps a pair of panoramas full even though they never hit the target", () => {
    // Two 2.16s want 1.05 strip heights and there is no third to bring
    // them down. The column still stands exactly one strip tall — it is
    // under the width ceiling, so nothing has to be given up.
    const panorama = photo(2532, 1170);
    const columns = packCollage([panorama, panorama]);
    assert.equal(columns.length, 1);
    assert.equal(columns[0]?.full, true);
    assert.ok(Math.abs(columnHeight(columns[0]!) - 1) < 1e-9);
    everyPhotoKeepsItsShape([panorama, panorama]);
  });

  it("refuses a stack that would leave a photograph too small to read", () => {
    // A 0.97 near-square is just over the target, so it reaches for the
    // next photograph. Paired with a 0.56 portrait the column closes at
    // 0.35 wide — 97px on a phone. The floor makes them stand apart
    // instead, which is the layout this rule exists to produce.
    const columns = packCollage([photo(1170, 1204), photo(1170, 2081)]);
    assert.equal(columns.length, 2);
    for (const column of columns) {
      assert.equal(column.photos.length, 1);
      assert.ok(column.width >= DEFAULT_PACK.minPhotoWidth);
    }
  });

  it("still gives a very tall photograph its own column, floor or not", () => {
    // 0.2 is below minPhotoWidth. A photograph standing alone is never
    // refused — there is nowhere else for it to go, and refusing it
    // would mean dropping it from the page.
    const columns = packCollage([photo(400, 2000)]);
    assert.equal(columns.length, 1);
    assert.equal(columns[0]?.photos.length, 1);
    assert.ok((columns[0]?.width ?? 0) < DEFAULT_PACK.minPhotoWidth);
  });

  it("never stacks more than maxPerColumn, however wide", () => {
    const columns = packCollage(new Array(9).fill(photo(5000, 1000)));
    assert.equal(columns.length, 3);
    for (const column of columns) assert.equal(column.photos.length, 3);
  });

  it("marks a short trailing column and caps how wide it can get", () => {
    // One panorama alone: it never reaches the target, so it closes
    // unfull and is capped rather than running to 2.16 wide.
    const columns = packCollage([photo(2532, 1170)]);
    assert.equal(columns.length, 1);
    assert.equal(columns[0]?.full, false);
    assert.equal(columns[0]?.width, DEFAULT_PACK.maxWidth);
    // Capped, and STILL uncropped — the photograph got shorter, not
    // narrower in the middle.
    everyPhotoKeepsItsShape([photo(2532, 1170)]);
    assert.ok(columnHeight(columns[0]!) < 1);
  });

  it("keeps the collage within a phone's reach at every column", () => {
    // 1.6 strip heights is the ceiling. At the phone's 17.5rem strip
    // that is 448px, which fits a 390px screen once the section's own
    // padding is taken off — and every full column is well under it.
    for (const column of packCollage(REAL)) {
      assert.ok(
        column.width <= DEFAULT_PACK.maxWidth,
        `column is ${column.width} strip heights wide`,
      );
    }
  });

  it("survives a row whose dimensions are nonsense", () => {
    const columns = packCollage([photo(0, 0), photo(1170, 2532)]);
    const flat = columns.flatMap((c) => c.photos);
    assert.equal(flat.length, 2);
    for (const item of flat) assert.ok(item.height > 0 && item.height <= 2);
  });
});
