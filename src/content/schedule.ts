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

export const LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "kids",
  "open-gym",
] as const;
export type LevelId = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<LevelId, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  kids: "Kids",
  "open-gym": "Open Gym",
};

/**
 * The standing caveat that runs above the timetable.
 *
 * In the mockup this was an infinitely scrolling marquee, duplicated twice
 * in the DOM so the loop looked seamless — which meant a screen reader read
 * the sentence twice, and no one could read it at their own pace. WCAG
 * 2.2.2 requires a pause control for any automatic motion running longer
 * than five seconds; adding pause/play chrome to a single sentence is
 * absurd, so the sentence stays and the motion goes.
 */
export const SCHEDULE_NOTE =
  "Schedule may vary during summer months due to lower student attendance.";

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
 * Per-level overrides. Deliberately empty: kids' classes and open gym
 * plausibly hold different numbers from a regular class, but "plausibly"
 * is not a fact, and inventing three numbers is worse than inventing one.
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

export const sessions: readonly Session[] = [
  // Monday
  at("mon", "beginner", "09:00", "10:00"),
  at("mon", "intermediate", "10:00", "11:00"),
  at("mon", "advanced", "11:00", "12:30"),
  at("mon", "kids", "16:00", "16:45"),
  at("mon", "beginner", "17:00", "18:00"),
  at("mon", "intermediate", "18:00", "19:00"),
  at("mon", "advanced", "19:00", "20:30"),

  // Tuesday
  at("tue", "beginner", "09:00", "10:00"),
  at("tue", "intermediate", "10:00", "11:00"),
  at("tue", "advanced", "11:00", "12:30"),
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

  // Thursday
  at("thu", "beginner", "09:00", "10:00"),
  at("thu", "intermediate", "10:00", "11:00"),
  at("thu", "advanced", "11:00", "12:00"),
  at("thu", "kids", "16:00", "16:45"),
  at("thu", "beginner", "17:00", "18:00"),
  at("thu", "intermediate", "18:00", "19:00"),
  at("thu", "advanced", "19:00", "20:00"),

  // Friday
  at("fri", "beginner", "09:00", "10:00"),
  at("fri", "intermediate", "10:00", "11:00"),
  at("fri", "advanced", "11:00", "12:00"),
  at("fri", "open-gym", "16:00", "18:00"),

  // Saturday
  at("sat", "beginner", "09:00", "10:00"),
  at("sat", "intermediate", "10:00", "11:00"),
  at("sat", "advanced", "11:00", "12:00"),
  at("sat", "kids", "13:00", "13:45"),
  at("sat", "intermediate", "18:00", "19:00"),
  at("sat", "advanced", "19:00", "20:00"),
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
}

assertScheduleIsSane();

/* ---------------------------------------------------------------
   Derived views. Nothing below is hand-maintained.
   --------------------------------------------------------------- */

export function sessionsOnDay(day: DayId): Session[] {
  return sessions
    .filter((session) => session.day === day)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function sessionsForLevel(level: LevelId): Session[] {
  return sessions.filter((session) => session.level === level);
}

/** Sessions per day, in week order — the weekly class-load chart. */
export const weeklyLoad: readonly { day: DayId; count: number }[] = DAYS.map(
  (day) => ({ day, count: sessions.filter((s) => s.day === day).length }),
);

export const totalWeeklySessions = sessions.length;

export const busiestDays: readonly DayId[] = (() => {
  const peak = Math.max(...weeklyLoad.map((entry) => entry.count));
  return weeklyLoad.filter((entry) => entry.count === peak).map((e) => e.day);
})();

/** Shortest and longest run time for a level, e.g. Advanced is 60–90 min. */
export function durationRangeForLevel(level: LevelId): {
  min: number;
  max: number;
} {
  const lengths = sessionsForLevel(level).map((session) =>
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
 * assertScheduleIsSane has already ruled out same-day overlaps.
 */
export function dayWindow(
  day: DayId,
): { first: Session; last: Session; count: number } | null {
  const ordered = sessionsOnDay(day);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) return null;
  return { first, last, count: ordered.length };
}
