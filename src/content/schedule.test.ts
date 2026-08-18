import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { openingHours } from "./site.ts";
import {
  DAYS,
  sessions,
  sessionsOnDay,
  sessionSlug,
  totalWeeklySessions,
  type DayId,
} from "./schedule.ts";
import { toMinutes } from "../lib/format/time.ts";

/**
 * The timetable was wrong for three months and nothing noticed, because
 * nothing compared it to anything. It matched a mockup, and the mockup
 * had invented a Friday open gym, moved the kids' class to Monday, added
 * two Saturday evening classes and shortened four Advanced sessions by
 * half an hour.
 *
 * These are the assertions that would have caught each of those, written
 * against the gym's published schedule at jcmuaythai201.com/classes.
 */

const slugs = new Set(sessions.map(sessionSlug));

describe("the gym's published timetable", () => {
  it("runs the three graded classes back to back every morning", () => {
    // "AM: Monday through Saturday 9:00-10:00 / 10:00-11:00 / 11:00-12:30"
    for (const day of DAYS) {
      assert.ok(slugs.has(`${day}-0900-beginner`), `${day} 9am beginner`);
      assert.ok(slugs.has(`${day}-1000-intermediate`), `${day} 10am inter`);
      assert.ok(slugs.has(`${day}-1100-advanced`), `${day} 11am advanced`);
    }
  });

  it("runs evening classes Monday to Thursday only", () => {
    // The old site says "PM: Monday through Friday", its own opening
    // hours say the gym shuts at 1:30 on a Friday, and the client
    // resolved it on 2026-08-18: Friday is mornings only.
    for (const day of ["mon", "tue", "wed", "thu"] as const) {
      assert.ok(slugs.has(`${day}-1700-beginner`), `${day} 5pm`);
      assert.ok(slugs.has(`${day}-1800-intermediate`), `${day} 6pm`);
      assert.ok(slugs.has(`${day}-1900-advanced`), `${day} 7pm`);
    }

    for (const day of ["fri", "sat"] as const) {
      const evening = sessionsOnDay(day).filter(
        (session) => toMinutes(session.start) >= toMinutes("14:00"),
      );
      assert.deepEqual(evening, [], `${day} should have no evening classes`);
    }
  });

  it("runs kids Tuesday to Thursday, plus Saturday — never Monday", () => {
    // The one contradiction the old site could not settle on its own: a
    // blurb saying Mon/Wed/Thu/Sat over a schedule saying Tue/Wed/Thu +
    // Sat. The client confirmed the schedule.
    assert.ok(slugs.has("tue-1600-kids"));
    assert.ok(slugs.has("wed-1600-kids"));
    assert.ok(slugs.has("thu-1600-kids"));
    assert.ok(slugs.has("sat-1300-kids"));
    assert.equal(slugs.has("mon-1600-kids"), false);

    assert.equal(sessions.filter((s) => s.level === "kids").length, 4);
  });

  it("runs no open gym", () => {
    // `open-gym` is no longer in LevelId at all, so this is really a
    // check that nothing reintroduced it by another name on a Friday
    // afternoon the gym is closed for.
    const fridayAfternoon = sessionsOnDay("fri").filter(
      (session) => toMinutes(session.start) >= toMinutes("13:30"),
    );
    assert.deepEqual(fridayAfternoon, []);
  });

  it("runs Advanced for ninety minutes, every time", () => {
    // Four sessions ran 60. The old site is unambiguous: 11:00-12:30 and
    // 7:00-8:30, morning and evening alike.
    for (const session of sessions) {
      if (session.level !== "advanced") continue;
      assert.equal(
        toMinutes(session.end) - toMinutes(session.start),
        90,
        `${sessionSlug(session)} is not 90 minutes`,
      );
    }
  });

  it("adds up to 34 classes a week", () => {
    // 18 mornings + 12 evenings + 4 kids. Stated so that adding or losing
    // a session is a visible decision rather than a number that quietly
    // moves on the home page's chart.
    assert.equal(totalWeeklySessions, 34);
    assert.equal(sessions.length, slugs.size, "duplicate session slug");
  });
});

describe("classes against opening hours", () => {
  it("never schedules a class when the gym is shut", () => {
    /*
      The invariant that would have caught the invented Friday evening
      classes on its own — they sat between 5 and 8:30 PM on a day the
      business closes at 1:30. schedule.ts asserts this at module load, so
      a violation fails `next build`; this is the test that records what
      the rule is for.
    */
    const hours = new Map(openingHours.map((entry) => [entry.day, entry]));

    for (const session of sessions) {
      const day = hours.get(session.day);
      assert.ok(day, `no opening hours for ${session.day}`);
      assert.ok(
        day.opens !== null && day.closes !== null,
        `${session.day} is closed but has classes`,
      );
      assert.ok(
        toMinutes(session.start) >= toMinutes(day.opens),
        `${sessionSlug(session)} starts before opening`,
      );
      assert.ok(
        toMinutes(session.end) <= toMinutes(day.closes),
        `${sessionSlug(session)} ends after closing`,
      );
    }
  });

  it("opens on exactly the days that have classes", () => {
    const open = new Set(
      openingHours.filter((e) => e.opens !== null).map((e) => e.day),
    );
    const teaching = new Set<DayId>(sessions.map((s) => s.day));

    assert.deepEqual([...open].sort(), [...teaching].sort());
    // Sunday: closed on the old site's footer, and no classes here.
    assert.equal(open.has("sun"), false);
  });
});
