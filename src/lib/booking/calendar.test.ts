import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCalendar, type BookableClassInput } from "./calendar.ts";

const TZ = "America/New_York";

/** Tuesday 11 August 2026, midday in Jersey City. */
const NOW = new Date("2026-08-11T16:00:00Z");

const klass = (
  id: string,
  startsAt: string,
  endsAt: string,
  overrides: Partial<BookableClassInput> = {},
): BookableClassInput => ({
  id,
  startsAt,
  endsAt,
  level: "beginner",
  spotsLeft: 16,
  booked: false,
  ...overrides,
});

const build = (
  classes: readonly BookableClassInput[] = [],
  now: Date = NOW,
  windowDays = 30,
) => buildCalendar(classes, { now, timeZone: TZ, windowDays });

const dayFor = (model: ReturnType<typeof build>, key: string) => {
  const day = model.days.find((entry) => entry.key === key);
  assert.ok(day, `expected the grid to contain ${key}`);
  return day;
};

describe("buildCalendar", () => {
  describe("the grid", () => {
    it("should span whole Monday-to-Sunday weeks so no week view is short", () => {
      const model = build();

      assert.equal(model.days.length % 7, 0);
      assert.equal(model.days[0]?.weekdayColumn, 0);
      assert.equal(model.days[model.days.length - 1]?.weekdayColumn, 6);
    });

    it("should start on the Monday on or before the 1st of the current month", () => {
      // 1 August 2026 is a Saturday, so the grid opens on Monday 27 July.
      assert.equal(build().days[0]?.key, "2026-07-27");
    });

    it("should reach the end of the last month the window touches", () => {
      // Window runs to Wednesday 9 September; September ends on a
      // Wednesday, so the grid closes on Sunday 4 October.
      const model = build();
      assert.equal(model.days[model.days.length - 1]?.key, "2026-10-04");
      assert.equal(model.lastOpenLabel, "Wednesday 9 September");
    });

    it("should number every day of a 31-day month exactly once", () => {
      const august = build().days.filter((day) => day.monthKey === "2026-08");
      assert.equal(august.length, 31);
      assert.equal(august[0]?.dayNumber, "1");
      assert.equal(august[30]?.dayNumber, "31");
    });
  });

  describe("availability", () => {
    it("should mark days before today as past", () => {
      assert.equal(dayFor(build(), "2026-08-10").availability, "past");
    });

    it("should mark today and the last day of the window as open", () => {
      const model = build();
      assert.equal(dayFor(model, "2026-08-11").availability, "open");
      assert.equal(dayFor(model, "2026-09-09").availability, "open");
      assert.equal(dayFor(model, "2026-08-11").isToday, true);
    });

    it("should mark the day after the window closes as upcoming", () => {
      assert.equal(dayFor(build(), "2026-09-10").availability, "upcoming");
    });

    it("should count today as day one of the window", () => {
      // A seven-day window opening on the 11th reaches the 17th, not the 18th.
      const model = build([], NOW, 7);
      assert.equal(dayFor(model, "2026-08-17").availability, "open");
      assert.equal(dayFor(model, "2026-08-18").availability, "upcoming");
    });

    it("should distinguish a closed Sunday from an open day with nothing left", () => {
      // The gym does not open on Sunday; Wednesday it does, and this one
      // simply has no classes supplied — the state today is in once the
      // last class has started.
      const model = build();
      assert.equal(dayFor(model, "2026-08-16").closed, true);
      assert.equal(dayFor(model, "2026-08-16").availability, "open");

      const wednesday = dayFor(model, "2026-08-12");
      assert.equal(wednesday.closed, false);
      assert.equal(wednesday.classes.length, 0);
    });

    it("should not attach classes to a day outside the window", () => {
      // Defence in depth: the query is already bounded, so a class landing
      // here means the bound moved. It must not render as bookable.
      const model = build([
        klass("beyond", "2026-09-20T13:00:00Z", "2026-09-20T14:00:00Z"),
      ]);
      assert.equal(dayFor(model, "2026-09-20").classes.length, 0);
    });
  });

  describe("grouping classes", () => {
    it("should file an evening class under the gym's day, not UTC's", () => {
      // 9pm on the 11th in Jersey City is 01:00 on the 12th in UTC.
      // Slicing the ISO string would move every late class to tomorrow.
      const model = build([
        klass("late", "2026-08-12T01:00:00Z", "2026-08-12T02:00:00Z"),
      ]);

      assert.equal(dayFor(model, "2026-08-11").classes.length, 1);
      assert.equal(dayFor(model, "2026-08-12").classes.length, 0);
    });

    it("should format times in the gym's zone", () => {
      const model = build([
        klass("evening", "2026-08-11T23:00:00Z", "2026-08-12T00:30:00Z"),
      ]);
      assert.equal(dayFor(model, "2026-08-11").classes[0]?.time, "7–8:30 PM");
    });

    it("should mark a class with no spots left as full", () => {
      const model = build([
        klass("packed", "2026-08-11T23:00:00Z", "2026-08-12T00:30:00Z", {
          spotsLeft: 0,
        }),
      ]);
      assert.equal(dayFor(model, "2026-08-11").classes[0]?.full, true);
    });

    it("should carry the whole class into the action's accessible name", () => {
      const model = build([
        klass("named", "2026-08-11T23:00:00Z", "2026-08-12T00:30:00Z", {
          level: "advanced",
        }),
      ]);
      assert.equal(
        dayFor(model, "2026-08-11").classes[0]?.label,
        "Advanced, Tuesday 11 August, 7–8:30 PM",
      );
    });
  });

  describe("periods", () => {
    it("should offer only the months that hold a bookable day", () => {
      // The grid runs July to October; only August and September have
      // days inside the window, and paging to the other two would be
      // navigation to a dead end.
      assert.deepEqual(
        build().months.map((month) => month.label),
        ["August 2026", "September 2026"],
      );
    });

    it("should give each month period only its own days", () => {
      const august = build().months.find((month) => month.key === "2026-08");
      assert.equal(august?.dayKeys.length, 31);
      assert.equal(august?.dayKeys[0], "2026-08-01");
    });

    it("should offer the weeks from today's to the window's last", () => {
      const weeks = build().weeks;
      assert.equal(weeks.length, 5);
      assert.equal(weeks[0]?.key, "2026-08-10");
      assert.equal(weeks[4]?.key, "2026-09-07");
      for (const week of weeks) assert.equal(week.dayKeys.length, 7);
    });

    it("should state the month once within a month and twice across one", () => {
      const weeks = build().weeks;
      assert.equal(weeks[0]?.label, "10 – 16 August");
      assert.equal(weeks[3]?.label, "31 August – 6 September");
    });

    it("should state both years on a week that straddles new year", () => {
      // Monday 28 December 2026 through Sunday 3 January 2027.
      const model = build([], new Date("2026-12-28T17:00:00Z"));
      const straddling = model.weeks.find((week) => week.key === "2026-12-28");

      assert.equal(straddling?.label, "28 December 2026 – 3 January 2027");
      assert.deepEqual(
        model.months.map((month) => month.label),
        ["December 2026", "January 2027"],
      );
    });

    it("should list bookable days in order and only bookable days", () => {
      const model = build();
      assert.equal(model.openDayKeys.length, 30);
      assert.equal(model.openDayKeys[0], "2026-08-11");
      assert.equal(model.openDayKeys[29], "2026-09-09");
    });
  });

  describe("the opening cursor", () => {
    it("should open on the first day that has something to book", () => {
      // Today's classes have all started; landing on today would show an
      // empty page that reads as a broken site.
      const model = build([
        klass("thu", "2026-08-13T13:00:00Z", "2026-08-13T14:00:00Z"),
      ]);
      assert.equal(model.initialKey, "2026-08-13");
    });

    it("should fall back to today when nothing at all is bookable", () => {
      assert.equal(build().initialKey, "2026-08-11");
    });
  });
});
