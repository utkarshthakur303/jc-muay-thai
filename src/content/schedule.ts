import { openingHours } from "@/content/site";
import { durationMinutes, toMinutes } from "@/lib/format/time";

/**
 * THE class schedule. Single source of truth.
 *
 * The mockup carried this data three times over — once as display strings
 * in the schedule table, once as a per-day slot list for the booking
 * drawer, and once as a hardcoded `BAR_DATA` array for the weekly chart,
 * with a hand-typed "37 classes/wk" headline on top. Four copies of one
 * fact, none of which the code could tell apart. Editing the timetable
 * would have silently desynced the chart.
 *
 * Here the timetable is declared once and everything else is derived, so
 * adding a session updates the chart, the weekly total, the per-level
 * counts and the class cards in the same edit.
 *
 * ── PROVENANCE (2026-08-18) ─────────────────────────────────────────
 * Every time below now comes from the gym's own live site,
 * `jcmuaythai201.com/classes`, kept in the repo root as `old.html`. It is
 * no longer a plausible reconstruction, which is what it had been.
 *
 * The mockup's version was close but wrong in four places, and each error
 * was the kind that only shows up when somebody turns up to a locked door:
 *
 *   - Friday evening classes, which do not run. The old site's class page
 *     says "PM: Monday through Friday" while its own footer says the gym
 *     shuts at 1:30 PM on a Friday. Put to the client 2026-08-18; they
 *     confirmed Friday is mornings only. The class page is stale.
 *   - Kids on Monday. That same page contradicts itself — a blurb saying
 *     "Mondays, Wednesdays, Thursdays and Saturdays" over a schedule
 *     saying "Tuesdays, Wednesdays, and Thursdays" plus Saturday. Client
 *     confirmed the schedule, not the blurb.
 *   - Saturday evening classes, which do not exist. The old site says
 *     "no Saturdays" against every PM row.
 *   - Friday "Open Gym" 4–6PM, which appears nowhere in the real business
 *     and was invented whole. The `open-gym` level is gone with it.
 *
 * Advanced runs 90 minutes, every session, morning and evening. Four rows
 * here previously ran 60, which would have sent a fighter home half an
 * hour early.
 * ────────────────────────────────────────────────────────────────────
 *
 * When booking ships, this becomes the seed for the `class_sessions`
 * table; the shape is already row-like for that reason.
 */

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayId = (typeof DAYS)[number];

const DAY_ID_SET: ReadonlySet<string> = new Set(DAYS);

/** Narrows an arbitrary weekday string — e.g. "sun" — to a class day. */
export function isDayId(value: string): value is DayId {
  return DAY_ID_SET.has(value);
}

export const DAY_LABELS: Record<DayId, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

/** Spelled out, for running prose. The short forms above are for grids. */
export const DAY_FULL_LABELS: Record<DayId, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

/**
 * The four classes the gym actually runs.
 *
 * `open-gym` used to be a fifth. It was invented for the mockup and
 * removed on 2026-08-18 once the real site showed no such session — see
 * the provenance note above. Removing it from this union is deliberate:
 * it makes every stale reference a type error rather than an empty
 * section, and there is one occurrence-cleanup migration whose whole job
 * is to delete the rows it left behind.
 */
export const LEVELS = ["beginner", "intermediate", "advanced", "kids"] as const;
export type LevelId = (typeof LEVELS)[number];

/**
 * Display names, in the gym's own words.
 *
 * "Beginners" is plural because that is how their site writes it, and
 * "Advanced & Fighter" because that is the class's real name — it is not
 * simply the top of a ladder, it is where people preparing to compete
 * train. Getting that name right is what stops a nervous beginner
 * booking into 30 minutes of sparring.
 */
export const LEVEL_LABELS: Record<LevelId, string> = {
  beginner: "Beginners",
  intermediate: "Intermediate",
  advanced: "Advanced & Fighter",
  kids: "Kids",
};

/**
 * The short form, for places too narrow for "Advanced & Fighter" — the
 * calendar's day cells and the weekly chart's axis, both of which have
 * roughly six characters to play with on a 320px phone.
 */
export const LEVEL_SHORT_LABELS: Record<LevelId, string> = {
  beginner: "Beginners",
  intermediate: "Intermediate",
  advanced: "Advanced",
  kids: "Kids",
};

/*
 * SCHEDULE_NOTE is gone.
 *
 * It read "Schedule may vary during summer months due to lower student
 * attendance", and it came from the mockup — not from the gym. The real
 * site makes no such claim anywhere, so it was a caveat we invented on the
 * business's behalf, hedging a timetable that is now accurate. Removed at
 * the client's instruction, 2026-08-18.
 */

export type Session = {
  readonly day: DayId;
  readonly level: LevelId;
  /** 24-hour "HH:MM", gym-local time. */
  readonly start: string;
  readonly end: string;
};

/**
 * How many people fit on the mat.
 *
 * NEEDS-CLIENT — this is the one invented number in the codebase, and it
 * is invented because booking cannot exist without it. Everything else the
 * client has not confirmed is withheld from the page (see contactChannels);
 * a capacity cannot be withheld, because a class with no limit is a list
 * and not a booking.
 *
 * 16 is a plausible mat count for a Muay Thai class and nothing more. The
 * consequence of it being wrong is real in both directions: too high and
 * the gym oversells its own floor, too low and it turns away members who
 * would have fitted. One number, one place, one edit when the answer
 * arrives — and it moves to the database the day the admin dashboard
 * lands.
 */
export const DEFAULT_CLASS_CAPACITY = 16;

/**
 * Per-level overrides. Deliberately empty: a kids' class plausibly holds
 * a different number from an adult one, but "plausibly" is not a fact,
 * and inventing a second number is worse than inventing one.
 */
export const CAPACITY_BY_LEVEL: Partial<Record<LevelId, number>> = {};

export function capacityFor(session: Session): number {
  return CAPACITY_BY_LEVEL[session.level] ?? DEFAULT_CLASS_CAPACITY;
}

/**
 * Stable identifier for a slot in the weekly pattern, e.g.
 * "mon-1900-advanced".
 *
 * This is what booking rows point back at, so its stability matters more
 * than its prettiness. Derived from the three things that define a slot
 * rather than stored, so it cannot drift from the timetable it names.
 *
 * If a class permanently moves from 18:00 to 19:00 the slug changes, and
 * that is correct: it is a different slot, and the occurrences already
 * generated under the old slug stay as the historical record of what
 * actually ran.
 */
export function sessionSlug(session: Session): string {
  return `${session.day}-${session.start.replace(":", "")}-${session.level}`;
}

/** Terse constructor so the timetable below stays readable and editable. */
const at = (day: DayId, level: LevelId, start: string, end: string): Session => ({
  day,
  level,
  start,
  end,
});

/**
 * The gym's week, exactly as its own site publishes it.
 *
 * The shape is regular and worth seeing: the same three graded classes
 * run back-to-back every morning Monday to Saturday, and again every
 * evening Monday to Thursday. Kids sit in the after-school gap. Nothing
 * here is a one-off except Saturday's early kids' class.
 */
export const sessions: readonly Session[] = [
  // Monday — mornings, then evenings.
  at("mon", "beginner", "09:00", "10:00"),
  at("mon", "intermediate", "10:00", "11:00"),
  at("mon", "advanced", "11:00", "12:30"),
  at("mon", "beginner", "17:00", "18:00"),
  at("mon", "intermediate", "18:00", "19:00"),
  at("mon", "advanced", "19:00", "20:30"),

  // Tuesday — kids start here, not Monday.
  at("tue", "beginner", "09:00", "10:00"),
  at("tue", "intermediate", "10:00", "11:00"),
  at("tue", "advanced", "11:00", "12:30"),
  at("tue", "kids", "16:00", "16:45"),
  at("tue", "beginner", "17:00", "18:00"),
  at("tue", "intermediate", "18:00", "19:00"),
  at("tue", "advanced", "19:00", "20:30"),

  // Wednesday
  at("wed", "beginner", "09:00", "10:00"),
  at("wed", "intermediate", "10:00", "11:00"),
  at("wed", "advanced", "11:00", "12:30"),
  at("wed", "kids", "16:00", "16:45"),
  at("wed", "beginner", "17:00", "18:00"),
  at("wed", "intermediate", "18:00", "19:00"),
  at("wed", "advanced", "19:00", "20:30"),

  // Thursday — the last evening of the week.
  at("thu", "beginner", "09:00", "10:00"),
  at("thu", "intermediate", "10:00", "11:00"),
  at("thu", "advanced", "11:00", "12:30"),
  at("thu", "kids", "16:00", "16:45"),
  at("thu", "beginner", "17:00", "18:00"),
  at("thu", "intermediate", "18:00", "19:00"),
  at("thu", "advanced", "19:00", "20:30"),

  // Friday — mornings only. The gym closes at 1:30 PM.
  at("fri", "beginner", "09:00", "10:00"),
  at("fri", "intermediate", "10:00", "11:00"),
  at("fri", "advanced", "11:00", "12:30"),

  // Saturday — mornings, plus kids straight after.
  at("sat", "beginner", "09:00", "10:00"),
  at("sat", "intermediate", "10:00", "11:00"),
  at("sat", "advanced", "11:00", "12:30"),
  at("sat", "kids", "13:00", "13:45"),
];

/**
 * Content errors should fail the build, not reach the client. This runs at
 * module load, which for a statically rendered page means during `next
 * build` — a typo like "9:00" or an end before its start stops the deploy
 * instead of rendering a nonsensical timetable.
 */
function assertScheduleIsSane(): void {
  for (const session of sessions) {
    const length = durationMinutes(session.start, session.end);
    if (length <= 0) {
      throw new Error(
        `Schedule: ${session.day} ${session.level} ends at or before it starts (${session.start}–${session.end}).`,
      );
    }
  }

  // A room can only run one class at a time. Overlapping sessions on the
  // same day would double-book the mat once capacity tracking exists.
  const byDay = new Map<DayId, Session[]>();
  for (const session of sessions) {
    const list = byDay.get(session.day) ?? [];
    list.push(session);
    byDay.set(session.day, list);
  }

  for (const [day, daySessions] of byDay) {
    const ordered = [...daySessions].sort(
      (a, b) => toMinutes(a.start) - toMinutes(b.start),
    );
    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1];
      const current = ordered[i];
      if (!previous || !current) continue;
      if (toMinutes(current.start) < toMinutes(previous.end)) {
        throw new Error(
          `Schedule: ${day} has overlapping sessions — ` +
            `${previous.level} ${previous.start}–${previous.end} and ` +
            `${current.level} ${current.start}–${current.end}.`,
        );
      }
    }
  }

  /**
   * Slugs identify booking rows, so a collision would silently merge two
   * different classes into one bookable slot — members booking the 5pm
   * beginner class and finding themselves in the 5pm advanced one.
   *
   * The overlap check above already makes this impossible, since two
   * sessions cannot share a day and a start time without overlapping. This
   * asserts it anyway: the two rules are independent, and if the overlap
   * rule is ever relaxed for a gym that runs two mats, this is the one that
   * has to fail the build.
   */
  const slugs = new Set<string>();
  for (const session of sessions) {
    const slug = sessionSlug(session);
    if (slugs.has(slug)) {
      throw new Error(
        `Schedule: duplicate session slug "${slug}". Two sessions share a ` +
          `day, start time and level, which booking cannot tell apart.`,
      );
    }
    slugs.add(slug);
  }

  /**
   * No class may run when the gym is shut.
   *
   * This is the rule that the four invented sessions broke, and it is why
   * it is written down rather than trusted. The mockup had beginner,
   * intermediate and advanced classes on a Friday evening and an "open
   * gym" until 6 PM, on a day the business closes at 1:30 — a member could
   * have booked any of them and driven to a locked door. Nobody noticed
   * for weeks, because nothing compared the two lists.
   *
   * Now they cannot disagree: adding a class outside opening hours, or
   * shortening a day's hours under an existing class, fails `next build`.
   */
  const hoursByDay = new Map(openingHours.map((entry) => [entry.day, entry]));
  for (const session of sessions) {
    const hours = hoursByDay.get(session.day);

    if (!hours || hours.opens === null || hours.closes === null) {
      throw new Error(
        `Schedule: ${session.level} runs on ${session.day} ` +
          `(${session.start}–${session.end}) but the gym is closed that day.`,
      );
    }

    if (
      toMinutes(session.start) < toMinutes(hours.opens) ||
      toMinutes(session.end) > toMinutes(hours.closes)
    ) {
      throw new Error(
        `Schedule: ${session.day} ${session.level} runs ` +
          `${session.start}–${session.end}, outside opening hours ` +
          `${hours.opens}–${hours.closes}. A member could book a class ` +
          `and arrive to a locked door.`,
      );
    }
  }
}

assertScheduleIsSane();

/* ---------------------------------------------------------------
   Derived views, as PURE FUNCTIONS OF A TIMETABLE.

   Every one of these used to close over the module-level `sessions`
   constant, which was correct while the timetable was a hardcoded array
   and wrong the moment it moved into the database (2026-08-22): a module
   constant is computed once per process, so an owner editing the
   timetable would have seen the schedule update and the weekly chart,
   the class counts and the "today" summary keep the numbers they had at
   boot — for as long as that server instance lived.

   Taking the timetable as an argument makes that impossible. It also
   keeps this file pure and testable, which is why the seed array below
   is still here: it is the fallback when the table cannot be read, and
   the fixture the tests run against.
   --------------------------------------------------------------- */

export function sessionsOnDay(
  timetable: readonly Session[],
  day: DayId,
): Session[] {
  return timetable
    .filter((session) => session.day === day)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function sessionsForLevel(
  timetable: readonly Session[],
  level: LevelId,
): Session[] {
  return timetable.filter((session) => session.level === level);
}

/** Sessions per day, in week order — the weekly class-load chart. */
export function weeklyLoad(
  timetable: readonly Session[],
): readonly { day: DayId; count: number }[] {
  return DAYS.map((day) => ({
    day,
    count: timetable.filter((s) => s.day === day).length,
  }));
}

export function totalWeeklySessions(timetable: readonly Session[]): number {
  return timetable.length;
}

export function busiestDays(timetable: readonly Session[]): readonly DayId[] {
  const load = weeklyLoad(timetable);
  const peak = Math.max(0, ...load.map((entry) => entry.count));
  // A timetable with no sessions has no busiest day. Without this the
  // chart would name every day at once, all tied on zero.
  if (peak === 0) return [];
  return load.filter((entry) => entry.count === peak).map((e) => e.day);
}

/** Shortest and longest run time for a level, e.g. Advanced is 60–90 min. */
export function durationRangeForLevel(
  timetable: readonly Session[],
  level: LevelId,
): { min: number; max: number } {
  const lengths = sessionsForLevel(timetable, level).map((session) =>
    durationMinutes(session.start, session.end),
  );
  if (lengths.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...lengths), max: Math.max(...lengths) };
}

/**
 * First and last mat time on a given day. Used for the "today" summary —
 * "7 classes, 9:00 AM to 8:30 PM" — which is a genuinely different question
 * from the timetable itself, so it is derived rather than restated.
 *
 * The last session by start time is also the last to finish, because
 * assertScheduleIsSane has already ruled out same-day overlaps — but that
 * assertion only guards the seed below. A timetable read from the database
 * has been through the same checks in the editor, and `last` is chosen by
 * end time here rather than assumed, because a hand-written SQL edit could
 * always slip past both.
 */
export function dayWindow(
  timetable: readonly Session[],
  day: DayId,
): { first: Session; last: Session; count: number } | null {
  const ordered = sessionsOnDay(timetable, day);
  const first = ordered[0];
  if (!first) return null;

  let last = first;
  for (const session of ordered) {
    if (toMinutes(session.end) > toMinutes(last.end)) last = session;
  }

  return { first, last, count: ordered.length };
}
