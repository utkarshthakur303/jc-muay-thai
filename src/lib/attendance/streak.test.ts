import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isOpenDay, summarise } from "./streak.ts";

/**
 * The streak rule, pinned to real dates.
 *
 * Every date below is genuine: in 2026, 10 August is a Monday, so 9 August
 * is the Sunday the gym is shut and 8 August the Saturday before it. That
 * matters because the two cases most likely to be got wrong — the weekend
 * gap and the day that has not finished yet — are both invisible in a test
 * written against abstract "day 1, day 2" fixtures.
 *
 * These are the assertions a member would notice being wrong. A streak
 * that silently resets is worse than no streak at all: it punishes someone
 * for turning up.
 */

const MON = { year: 2026, month: 8, day: 10 };
const SUN = { year: 2026, month: 8, day: 9 };
const SAT = { year: 2026, month: 8, day: 8 };
const FRI = { year: 2026, month: 8, day: 7 };
const THU = { year: 2026, month: 8, day: 6 };
const WED = { year: 2026, month: 8, day: 5 };

describe("isOpenDay", () => {
  it("follows the timetable, which runs Monday to Saturday", () => {
    assert.equal(isOpenDay(MON), true);
    assert.equal(isOpenDay(SAT), true);
    assert.equal(isOpenDay(SUN), false);
  });
});

describe("summarise", () => {
  describe("the Sunday closure", () => {
    it("steps over Sunday, so Saturday into Monday is unbroken", () => {
      const s = summarise(
        ["2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-10"],
        MON,
      );
      // Wed Thu Fri Sat Mon — five open days, no gap the rule can see.
      assert.equal(s.current, 5);
    });

    it("holds a streak through Sunday itself", () => {
      const s = summarise(["2026-08-07", "2026-08-08"], SUN);
      // Standing on Sunday with Saturday marked: nothing is lost yet.
      assert.equal(s.current, 2);
    });

    it("counts a marked Sunday as training but not as streak", () => {
      const s = summarise(["2026-08-08", "2026-08-09"], SUN);
      assert.equal(s.total, 2);
      // Saturday is the only open day in the run; Sunday cannot extend it.
      assert.equal(s.current, 1);
    });
  });

  describe("today is not a miss until it is over", () => {
    it("keeps yesterday's streak when today is unmarked", () => {
      const s = summarise(["2026-08-06", "2026-08-07", "2026-08-08"], MON);
      assert.equal(s.current, 3);
      assert.equal(s.markedToday, false);
    });

    it("extends it the moment today is marked", () => {
      const s = summarise(
        ["2026-08-06", "2026-08-07", "2026-08-08", "2026-08-10"],
        MON,
      );
      assert.equal(s.current, 4);
      assert.equal(s.markedToday, true);
    });
  });

  describe("breaking", () => {
    it("resets when an open day in the past was missed", () => {
      // Thursday missed. Only Friday and Saturday survive.
      const s = summarise(["2026-08-05", "2026-08-07", "2026-08-08"], MON);
      assert.equal(s.current, 2);
    });

    it("is zero when the last open day was missed and today is unmarked", () => {
      const s = summarise(["2026-08-05", "2026-08-06"], MON);
      // Friday and Saturday both missed — nothing reaches back to today.
      assert.equal(s.current, 0);
    });
  });

  describe("best", () => {
    it("survives a reset, which is the reason it exists", () => {
      const s = summarise(
        [
          // A four-day run in July, then a gap, then two days.
          "2026-07-20",
          "2026-07-21",
          "2026-07-22",
          "2026-07-23",
          "2026-08-07",
          "2026-08-08",
        ],
        MON,
      );
      assert.equal(s.current, 2);
      assert.equal(s.best, 4);
    });

    it("is never below the current streak", () => {
      const s = summarise(["2026-08-07", "2026-08-08", "2026-08-10"], MON);
      assert.equal(s.best, s.current);
    });
  });

  describe("milestones", () => {
    const threeInARow = ["2026-08-07", "2026-08-08", "2026-08-10"];

    it("fires only when the check-in just happened", () => {
      assert.equal(summarise(threeInARow, MON, true).milestone, 3);
    });

    it("stays null on a plain load, so a refresh cannot replay it", () => {
      assert.equal(summarise(threeInARow, MON).milestone, null);
    });

    it("stays null when the check-in could not have moved the streak", () => {
      // Standing on Sunday with a 3-day run behind it. Marking today is
      // real training and raises the total, but a closed day cannot extend
      // a run of open days — so there is nothing new to celebrate, and
      // without this the same fanfare would fire every single Sunday.
      // Thu, Fri, Sat — the three open days leading into Sunday — plus
      // Sunday itself. Leaving Saturday out would break the run before it
      // reaches today and test nothing.
      const s = summarise(
        ["2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"],
        SUN,
        true,
      );
      assert.equal(s.current, 3);
      assert.equal(s.milestone, null);
    });

    it("stays null on a streak that is not a milestone", () => {
      assert.equal(
        summarise(["2026-08-08", "2026-08-10"], MON, true).milestone,
        null,
      );
    });
  });

  describe("the week strip", () => {
    it("runs Monday to Sunday", () => {
      const s = summarise([], MON);
      assert.deepEqual(
        s.week.map((d) => d.initial),
        ["M", "T", "W", "T", "F", "S", "S"],
      );
    });

    it("labels each day by what a member can still do about it", () => {
      // Standing on Friday: Wed marked, Thu missed, Fri open and unmarked.
      const s = summarise(["2026-08-05"], FRI);
      const byInitial = Object.fromEntries(
        s.week.map((d, i) => [`${i}`, d.state]),
      );
      assert.equal(byInitial["2"], "attended"); // Wednesday
      assert.equal(byInitial["3"], "missed"); // Thursday
      assert.equal(byInitial["4"], "today"); // Friday
      assert.equal(byInitial["5"], "future"); // Saturday
      assert.equal(byInitial["6"], "closed"); // Sunday — never a miss
    });

    it("reads a Sunday as closed even before it arrives", () => {
      // Standing on Wednesday. Sunday is both future and shut; shut is the
      // fact that will still be true when it gets here.
      const s = summarise([], WED);
      assert.equal(s.week[6]?.state, "closed");
    });
  });

  describe("empty history", () => {
    it("reports zeroes rather than throwing", () => {
      const s = summarise([], THU);
      assert.equal(s.current, 0);
      assert.equal(s.best, 0);
      assert.equal(s.total, 0);
      assert.equal(s.markedToday, false);
      assert.equal(s.openToday, true);
    });
  });
});
