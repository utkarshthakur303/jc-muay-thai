/**
 * Reading the clock *at the gym*, from anywhere in the world.
 *
 * Two components need this — the live "class on now" line on the home page
 * and the "today" summary above the schedule — so it lives here rather
 * than being written twice with a chance of drifting.
 *
 * Everything below is client-side by necessity. `new Date()` on the server
 * is the server's clock, which on Vercel is UTC: the mockup's identical
 * check would have told a visitor a class was running at four in the
 * morning, Jersey City time. Reading the clock during render would also
 * make the page dynamic, costing the static prerender that lets the home
 * page be served straight from the CDN.
 */

/** Sunday-first, matching Date's own weekday indexing. */
export const WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayId = (typeof WEEK)[number];

export type GymClock = {
  weekday: WeekdayId;
  /** 0 = Sunday, matching the WEEK array. */
  weekdayIndex: number;
  /** Minutes since midnight, gym-local. */
  minutes: number;
};

/**
 * Intl is the whole implementation on purpose: it is the only way to get
 * another zone's wall-clock time that stays correct across a daylight
 * saving transition. A fixed UTC-5 offset is right for four months of the
 * year and an hour out for the other eight.
 */
export function gymNow(timeZone: string): GymClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    // h23 rather than hour12:false — the latter renders midnight as "24"
    // in some ICU builds, which would put the gym an entire day off.
    hourCycle: "h23",
  }).formatToParts(new Date());

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const name = read("weekday").toLowerCase().slice(0, 3);
  const index = WEEK.indexOf(name as WeekdayId);

  // Falling back to Sunday rather than throwing: a wrong day would be a
  // visible bug, but an exception here would take down a whole section of
  // the page over a formatting quirk. Sunday has no classes, so the
  // fallback degrades to "no classes today" — visibly conservative.
  const weekdayIndex = index === -1 ? 0 : index;

  return {
    weekday: WEEK[weekdayIndex] ?? "sun",
    weekdayIndex,
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

/* ---------------------------------------------------------------
   THE OTHER DIRECTION

   gymNow answers "what time is it at the gym". Booking needs the
   inverse: "which instant is 7pm on the 12th at the gym". That is the
   harder direction, and the one people get wrong — a fixed −05:00 is
   correct for four months a year and an hour out for the other eight,
   which would put every summer booking in the wrong hour.

   There is no Intl API for it, so it is done by measurement: guess,
   read the zone's offset at the guess, correct, and read again.
   --------------------------------------------------------------- */

export type CivilDate = { year: number; month: number; day: number };

/**
 * Formatter construction is the expensive part of Intl — the formatting
 * itself is cheap. Generating a month of occurrences calls this a few
 * hundred times for one zone, so the instance is built once.
 */
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = offsetFormatters.get(timeZone);
  if (cached) return cached;

  const made = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  offsetFormatters.set(timeZone, made);
  return made;
}

/** The zone's wall-clock reading of an instant, expressed as a UTC instant. */
function wallClockAsUtc(instant: number, timeZone: string): number {
  const parts = offsetFormatter(timeZone).formatToParts(new Date(instant));

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
}

/**
 * How far ahead of UTC the zone is, in milliseconds, at a given instant.
 * Negative for the Americas.
 */
function zoneOffsetMs(instant: number, timeZone: string): number {
  return wallClockAsUtc(instant, timeZone) - instant;
}

/**
 * The instant at which the gym's clock reads the given local date and time.
 *
 * Two passes, and the second is not optional. The first offset is sampled
 * at the wrong instant — off by up to a day either side of a transition —
 * so on the Sunday the clocks change, a single pass lands an hour out for
 * every class after the switch. The second pass samples at the corrected
 * instant, which is on the right side of the boundary.
 *
 * Two local times are not simply convertible, and both are handled
 * explicitly rather than left to whatever two passes happen to produce:
 *
 *   - **The gap.** 02:30 on 8 March 2026 never happens; clocks go straight
 *     from 02:00 EST to 03:00 EDT. Two passes on their own land on 01:30
 *     EST — *earlier* than what was asked for, which for a timetable means
 *     a class quietly appearing an hour early. This shifts forward to
 *     03:30 EDT instead, matching Temporal's `compatible` disambiguation
 *     and java.time.
 *
 *   - **The fold.** 01:30 on 1 November 2026 happens twice. The earlier one
 *     wins, which is also the standard choice.
 *
 * Neither can arise from this timetable — the earliest class is 09:00 and
 * transitions happen at 02:00 — but the function must not be quietly
 * non-standard for whoever reuses it.
 */
export function gymTimeToInstant(
  date: CivilDate,
  minutesFromMidnight: number,
  timeZone: string,
): Date {
  const naive =
    Date.UTC(date.year, date.month - 1, date.day) +
    minutesFromMidnight * 60_000;

  const firstGuess = naive - zoneOffsetMs(naive, timeZone);
  const refined = naive - zoneOffsetMs(firstGuess, timeZone);

  // If the refined instant does not read back as the wall time we were
  // asked for, that wall time does not exist — we are inside the spring
  // gap. The first guess is the forward-shifted reading, which is the one
  // to keep. Outside a transition the two are identical and this costs one
  // cheap format call.
  return new Date(wallClockAsUtc(refined, timeZone) === naive ? refined : firstGuess);
}

/** The gym's calendar date at a given instant — not the server's. */
export function gymCivilDate(instant: Date, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return { year: read("year"), month: read("month"), day: read("day") };
}

/**
 * Civil date arithmetic — "the day after the 31st" — done on the calendar
 * rather than by adding 86,400,000ms to an instant. Adding a day of
 * milliseconds is wrong twice a year, when a local day is 23 or 25 hours
 * long, and it is exactly the bug that makes a schedule slip by an hour
 * for a week every spring.
 */
export function addCivilDays(date: CivilDate, days: number): CivilDate {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + days),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** 0 = Sunday, matching WEEK. */
export function civilWeekdayIndex(date: CivilDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}
