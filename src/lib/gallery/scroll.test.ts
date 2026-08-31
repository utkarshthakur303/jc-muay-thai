import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  atEnd,
  atStart,
  canScroll,
  nextScroll,
  previousScroll,
  scrollProgress,
  type StripMetrics,
} from "./scroll.ts";

/**
 * Every case here is a real state the strip reaches on its own: mid-swipe
 * between two columns, rubber-banded past the edge on iOS, holding a
 * column wider than the window, or holding so few photographs that there
 * is nothing to scroll at all.
 */

/** Six 200px columns with 20px gaps inside a 500px window. */
const strip = (scrollLeft: number): StripMetrics => ({
  scrollLeft,
  clientWidth: 500,
  scrollWidth: 1300, // 6×200 + 5×20
  columnStarts: [0, 220, 440, 660, 880, 1100],
});

/** The furthest `strip` can scroll: 1300 − 500. */
const END = 800;

const nothingToScroll: StripMetrics = {
  scrollLeft: 0,
  clientWidth: 500,
  scrollWidth: 480,
  columnStarts: [0],
};

describe("canScroll", () => {
  it("is false when everything already fits", () => {
    assert.equal(canScroll(nothingToScroll), false);
    // Equal widths, which is what a strip of exactly one screen reports.
    assert.equal(
      canScroll({ ...nothingToScroll, scrollWidth: 500 }),
      false,
    );
  });

  it("is true once there is more strip than window", () => {
    assert.equal(canScroll(strip(0)), true);
  });
});

describe("nextScroll", () => {
  it("moves to the next column", () => {
    assert.equal(nextScroll(strip(0)), 220);
    assert.equal(nextScroll(strip(220)), 440);
  });

  it("advances from where the finger left it, not from a column edge", () => {
    // Swiped 90px into the first column: the next stop is still the
    // second column, not the one after it.
    assert.equal(nextScroll(strip(90)), 220);
  });

  it("never scrolls past the end of the strip", () => {
    // The last column starts at 1100 but the strip stops at 800, so
    // landing on its start is impossible. Going as far as it can is
    // right; asking the browser for 1100 lands at 800 anyway and then
    // `atEnd` disagrees with what we thought we asked for.
    assert.equal(nextScroll(strip(700)), END);
  });

  it("wraps to the beginning at the end", () => {
    assert.equal(nextScroll(strip(END)), 0);
    // Within the sub-pixel slack of the end counts as the end.
    assert.equal(nextScroll(strip(END - 0.4)), 0);
  });

  it("does nothing when there is nothing to scroll", () => {
    assert.equal(nextScroll(nothingToScroll), null);
  });

  it("holds a column wider than the window for its own beat", () => {
    // One 900px column in a 500px window: the only stop after 0 is the
    // end at 400, which shows the right-hand side of it. The tick after
    // that wraps. A panorama gets seen rather than skipped.
    const wide: StripMetrics = {
      scrollLeft: 0,
      clientWidth: 500,
      scrollWidth: 900,
      columnStarts: [0],
    };
    assert.equal(nextScroll(wide), 400);
    assert.equal(nextScroll({ ...wide, scrollLeft: 400 }), 0);
  });

  it("recovers from a scrollLeft the browser should not have given it", () => {
    // iOS rubber-banding reports negative during an overscroll, and
    // past-the-end during the other one.
    assert.equal(nextScroll(strip(-80)), 220);
    assert.equal(nextScroll(strip(9999)), 0);
    assert.equal(nextScroll(strip(Number.NaN)), 220);
  });
});

describe("previousScroll", () => {
  it("moves to the previous column", () => {
    assert.equal(previousScroll(strip(440)), 220);
    assert.equal(previousScroll(strip(220)), 0);
  });

  it("goes back from mid-column to the column's own start", () => {
    // Swiped 90px past the second column's edge: back means the start of
    // the column you are in, which is what the finger expects.
    assert.equal(previousScroll(strip(310)), 220);
  });

  it("wraps to the end at the beginning, like the lightbox arrows", () => {
    assert.equal(previousScroll(strip(0)), END);
    assert.equal(previousScroll(strip(0.4)), END);
  });

  it("does nothing when there is nothing to scroll", () => {
    assert.equal(previousScroll(nothingToScroll), null);
  });
});

describe("atStart / atEnd", () => {
  it("reads both edges", () => {
    assert.equal(atStart(strip(0)), true);
    assert.equal(atStart(strip(220)), false);
    assert.equal(atEnd(strip(END)), true);
    assert.equal(atEnd(strip(220)), false);
  });

  it("treats a strip with nothing to scroll as being at both", () => {
    // Which is what stops the edge fades appearing over a strip that has
    // no more to show — a fade there reads as a photograph cut off.
    assert.equal(atStart(nothingToScroll), true);
    assert.equal(atEnd(nothingToScroll), true);
  });

  it("forgives a fractional pixel at either edge", () => {
    assert.equal(atStart(strip(0.7)), true);
    assert.equal(atEnd(strip(END - 0.7)), true);
  });
});

describe("scrollProgress", () => {
  it("runs 0 to 1 across the scrollable span", () => {
    assert.equal(scrollProgress(strip(0)), 0);
    assert.equal(scrollProgress(strip(END / 2)), 0.5);
    assert.equal(scrollProgress(strip(END)), 1);
  });

  it("is full when there is nothing to scroll", () => {
    // Everything there is to see is on screen. An empty bar under a
    // complete strip would report the opposite of the truth.
    assert.equal(scrollProgress(nothingToScroll), 1);
  });

  it("stays inside 0 and 1 while the strip is rubber-banding", () => {
    assert.equal(scrollProgress(strip(-120)), 0);
    assert.equal(scrollProgress(strip(9999)), 1);
  });
});
