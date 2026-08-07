import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCivilDays,
  civilWeekdayIndex,
  gymCivilDate,
  gymTimeToInstant,
} from "./gymClock.ts";

/**
 * The timetable says a class starts at 19:00. Turning that into a real
 * instant is the one calculation in this codebase that is wrong in a way
 * nobody notices until March — a fixed −05:00 offset is correct for four
 * months a year and an hour out for the other eight.
 *
 * 2026 US daylight saving runs 8 March to 1 November, so every boundary
 * below is a real date on which this gym runs real classes.
 */

const TZ = "America/New_York";

const at = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): string =>
  gymTimeToInstant({ year, month, day }, hour * 60 + minute, TZ).toISOString();

describe("gymTimeToInstant", () => {
  it("resolves winter wall time against EST (UTC−5)", () => {
    assert.equal(at(2026, 1, 15, 19), "2026-01-16T00:00:00.000Z");
  });

  it("resolves summer wall time against EDT (UTC−4)", () => {
    assert.equal(at(2026, 8, 12, 19), "2026-08-12T23:00:00.000Z");
  });

  it("changes offset across the spring transition", () => {
    assert.equal(at(2026, 3, 7, 9), "2026-03-07T14:00:00.000Z"); // EST
    assert.equal(at(2026, 3, 8, 9), "2026-03-08T13:00:00.000Z"); // EDT
    assert.equal(at(2026, 3, 9, 9), "2026-03-09T13:00:00.000Z");
  });

  it("changes offset across the autumn transition", () => {
    assert.equal(at(2026, 10, 31, 9), "2026-10-31T13:00:00.000Z"); // EDT
    assert.equal(at(2026, 11, 1, 9), "2026-11-01T14:00:00.000Z"); // EST
    assert.equal(at(2026, 11, 2, 9), "2026-11-02T14:00:00.000Z");
  });

  it("shifts a nonexistent wall time forward, not backward", () => {
    // 02:30 on 8 March does not happen. Shifting backward would name an
    // instant earlier than asked for — a class an hour early.
    assert.equal(at(2026, 3, 8, 2, 30), "2026-03-08T07:30:00.000Z"); // 03:30 EDT
  });

  it("takes the earlier of an ambiguous wall time", () => {
    // 01:30 on 1 November happens twice; this is the first, still EDT.
    assert.equal(at(2026, 11, 1, 1, 30), "2026-11-01T05:30:00.000Z");
  });

  it("round-trips every instant back to the wall time asked for", () => {
    const reader = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hourCycle: "h23",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    for (const [month, day, hour] of [
      [1, 15, 19],
      [3, 8, 9],
      [7, 4, 20],
      [11, 1, 9],
      [12, 25, 16],
    ] as const) {
      const read = reader.format(new Date(at(2026, month, day, hour)));
      assert.equal(
        read,
        `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}, ` +
          `${String(hour).padStart(2, "0")}:00`,
      );
    }
  });
});

describe("addCivilDays", () => {
  // Calendar arithmetic, not millisecond arithmetic: a local day is 23 or
  // 25 hours long twice a year, and adding 86,400,000ms slips the whole
  // schedule by an hour for a week every spring.
  it("crosses a month boundary", () => {
    assert.deepEqual(addCivilDays({ year: 2026, month: 1, day: 31 }, 1), {
      year: 2026,
      month: 2,
      day: 1,
    });
  });

  it("crosses a year boundary", () => {
    assert.deepEqual(addCivilDays({ year: 2026, month: 12, day: 31 }, 1), {
      year: 2027,
      month: 1,
      day: 1,
    });
  });

  it("crosses a leap day", () => {
    assert.deepEqual(addCivilDays({ year: 2028, month: 2, day: 28 }, 1), {
      year: 2028,
      month: 2,
      day: 29,
    });
  });

  it("crosses the 23-hour day without slipping", () => {
    assert.deepEqual(addCivilDays({ year: 2026, month: 3, day: 7 }, 1), {
      year: 2026,
      month: 3,
      day: 8,
    });
  });
});

describe("civilWeekdayIndex", () => {
  it("indexes from Sunday, matching WEEK", () => {
    assert.equal(civilWeekdayIndex({ year: 2026, month: 8, day: 7 }), 5); // Fri
    assert.equal(civilWeekdayIndex({ year: 2026, month: 8, day: 9 }), 0); // Sun
  });
});

describe("gymCivilDate", () => {
  it("reads the gym's date, not the server's", () => {
    // 01:00 UTC on the 8th is still the evening of the 7th in Jersey City.
    assert.deepEqual(gymCivilDate(new Date("2026-08-08T01:00:00Z"), TZ), {
      year: 2026,
      month: 8,
      day: 7,
    });
  });
});
