import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HISTORY_WEEKS, heatmapRows, weeklyBars } from "./history.ts";

/**
 * The two graphs, pinned to real dates.
 *
 * Every date below is genuine. In 2026, 19 August is a Wednesday, so the
 * week it belongs to opened on Monday 17 August and the twelve-week
 * window reaches back to Monday 1 June. The tests are written against
 * those actual days because the cases most likely to be wrong — the edge
 * of the window, the Sunday the gym is shut, the day that has not
 * finished yet — are invisible in fixtures built from "week 1, week 2".
 */

/** Wednesday. */
const TODAY = { year: 2026, month: 8, day: 19 };

/** The Monday its week opened on. */
const THIS_MONDAY = "2026-08-17";

/** The Monday twelve weeks earlier — the oldest day the window holds. */
const FIRST_MONDAY = "2026-06-01";

describe("weeklyBars", () => {
  it("returns one bar per week, oldest first", () => {
    const bars = weeklyBars([], TODAY);
    assert.equal(bars.length, HISTORY_WEEKS);
    assert.equal(bars[0]?.key, FIRST_MONDAY);
    assert.equal(bars[HISTORY_WEEKS - 1]?.key, THIS_MONDAY);
  });

  it("marks only the last bar as the week in progress", () => {
    const bars = weeklyBars([], TODAY);
    assert.equal(bars.filter((bar) => bar.isCurrent).length, 1);
    assert.equal(bars[HISTORY_WEEKS - 1]?.isCurrent, true);
  });

  it("counts the days marked inside each week", () => {
    const bars = weeklyBars(
      ["2026-08-17", "2026-08-18", "2026-08-19"],
      TODAY,
    );
    assert.equal(bars[HISTORY_WEEKS - 1]?.count, 3);
    assert.equal(bars[HISTORY_WEEKS - 2]?.count, 0);
  });

  it("counts Sundays, because a Sunday session is still training", () => {
    // It cannot extend a streak — see streak.ts — but this chart answers
    // "how much did I train", and the page says which number is which.
    const bars = weeklyBars(["2026-08-16"], TODAY);
    assert.equal(bars[HISTORY_WEEKS - 2]?.count, 1);
  });

  it("includes the first day of the window and excludes the day before it", () => {
    assert.equal(weeklyBars([FIRST_MONDAY], TODAY)[0]?.count, 1);

    const older = weeklyBars(["2026-05-31"], TODAY);
    assert.equal(
      older.reduce((sum, bar) => sum + bar.count, 0),
      0,
    );
  });

  it("labels each bar with its Monday, across a month boundary", () => {
    const bars = weeklyBars([], TODAY);
    assert.equal(bars[0]?.label, "1 Jun");
    assert.equal(bars[HISTORY_WEEKS - 1]?.label, "17 Aug");
  });

  it("never counts a day twice, however the dates arrive", () => {
    // The query orders newest first and the caller may hand them over in
    // any order; duplicates would be a schema surprise rather than a bug
    // here, and either way a week of 8 days is nonsense.
    const bars = weeklyBars(
      ["2026-08-18", "2026-08-18", "2026-08-17"],
      TODAY,
    );
    assert.equal(bars[HISTORY_WEEKS - 1]?.count, 2);
  });
});

describe("heatmapRows", () => {
  it("has one row per weekday, Monday first", () => {
    const rows = heatmapRows([], TODAY);
    assert.equal(rows.length, 7);
    assert.equal(rows[0]?.label, "Monday");
    assert.equal(rows[6]?.label, "Sunday");
    assert.equal(rows[0]?.cells.length, HISTORY_WEEKS);
  });

  it("draws the Sunday row as closed, not as twelve missed days", () => {
    const rows = heatmapRows([], TODAY);
    assert.ok(rows[6]?.cells.every((cell) => cell.state === "closed"));
    // Zero chances is what stops the row reading "trained 0 of 12".
    assert.equal(rows[6]?.chances, 0);
  });

  it("still shows a marked Sunday, because it happened", () => {
    const rows = heatmapRows(["2026-08-16"], TODAY);
    const sunday = rows[6];
    assert.equal(sunday?.cells[HISTORY_WEEKS - 2]?.state, "attended");
    assert.equal(sunday?.trained, 1);
    // And it is still not a chance taken or missed: the gym was shut.
    assert.equal(sunday?.chances, 0);
  });

  it("leaves today unmarked rather than counting it as a miss", () => {
    const rows = heatmapRows([], TODAY);
    const wednesday = rows[2];
    assert.equal(wednesday?.cells[HISTORY_WEEKS - 1]?.state, "today");
    // Eleven Wednesdays have been and gone. This one has not.
    assert.equal(wednesday?.chances, HISTORY_WEEKS - 1);
  });

  it("counts today once it is marked", () => {
    const rows = heatmapRows(["2026-08-19"], TODAY);
    const wednesday = rows[2];
    assert.equal(wednesday?.cells[HISTORY_WEEKS - 1]?.state, "attended");
    assert.equal(wednesday?.trained, 1);
    assert.equal(wednesday?.chances, HISTORY_WEEKS);
  });

  it("marks the rest of this week as still to come", () => {
    const rows = heatmapRows([], TODAY);
    assert.equal(rows[3]?.cells[HISTORY_WEEKS - 1]?.state, "future");
    assert.equal(rows[5]?.cells[HISTORY_WEEKS - 1]?.state, "future");
    // A day that has not arrived is not a chance missed.
    assert.equal(rows[3]?.chances, HISTORY_WEEKS - 1);
  });

  it("shows an open day that went by as missed", () => {
    const rows = heatmapRows([], TODAY);
    assert.equal(rows[0]?.cells[HISTORY_WEEKS - 1]?.state, "missed");
    assert.equal(rows[0]?.chances, HISTORY_WEEKS);
    assert.equal(rows[0]?.trained, 0);
  });

  it("lines the grid up with the bars, day for day", () => {
    // Both windows open on the same Monday, so a column in one chart is
    // the same week as a bar in the other. If these ever disagree the
    // two graphs are quietly measuring different periods.
    const rows = heatmapRows([], TODAY);
    assert.equal(rows[0]?.cells[0]?.key, FIRST_MONDAY);
    assert.equal(rows[0]?.cells[HISTORY_WEEKS - 1]?.key, THIS_MONDAY);
    assert.equal(rows[6]?.cells[HISTORY_WEEKS - 1]?.key, "2026-08-23");
  });
});
