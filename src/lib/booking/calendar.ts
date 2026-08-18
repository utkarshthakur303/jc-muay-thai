import {
  isDayId,
  LEVEL_SHORT_LABELS,
  type LevelId,
} from "@/content/schedule";
import {
  addCivilDays,
  civilWeekdayIndex,
  gymCivilDate,
  WEEK,
  type CivilDate,
} from "@/lib/format/gymClock";
import { formatClassTimeRange } from "@/lib/format/classTime";

/**
 * The view model behind /book — every day, week and month the booking
 * calendar can show, fully formatted.
 *
 * WHY THIS IS BUILT ON THE SERVER AND NOT IN THE COMPONENT
 *
 * Because the alternative renders the wrong times. These are gym-local
 * dates: a member checking their schedule from a work trip in London must
 * see the day they have to physically turn up at the gym, not the day it is
 * where they are standing. Formatting in the client uses the *visitor's*
 * zone, and the failure is invisible to anyone testing from New Jersey.
 *
 * So the client component receives strings and integers and does no date
 * work at all — not even "which column is this day in", which arrives as
 * `weekdayColumn`. There is deliberately no `Intl` and no `Date` on the
 * other side of this file.
 *
 * WHY THE GRID REACHES BEYOND THE BOOKING WINDOW
 *
 * A month view has to show a month. Rendering only the bookable slice would
 * mean an August that starts on the 11th, which is not a calendar. Every
 * day of every month the window touches is present, and each one carries
 * its own `availability` so the component can draw a day that has passed
 * differently from one that has not opened yet — and neither of them like a
 * day the gym is shut.
 *
 * Those three states used to be one. The old grid rendered any day with no
 * classes as "—", so a Sunday, a fully-cancelled Tuesday and today at 9pm
 * after the last class had started all looked identical: closed. They are
 * different facts and members read them differently.
 */

/** The shape this needs from a bookable class. `BookableClass` satisfies it. */
export type BookableClassInput = {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly level: LevelId;
  readonly spotsLeft: number;
  readonly booked: boolean;
};

export type CalendarClass = {
  readonly id: string;
  readonly time: string;
  readonly level: string;
  readonly spotsLeft: number;
  readonly booked: boolean;
  readonly full: boolean;
  /** Full description, for the action button's accessible name. */
  readonly label: string;
};

/**
 * Where a day sits relative to the booking window.
 *
 * `open` does not promise there is anything to book on it — a day whose
 * classes have all started is open and empty, and says so.
 */
export type DayAvailability = "past" | "open" | "upcoming";

export type CalendarDay = {
  /** "2026-08-11". Stable identity for selection and grouping. */
  readonly key: string;
  /** "2026-08" — which month grid this day belongs to. */
  readonly monthKey: string;
  /** The key of this day's Monday. */
  readonly weekKey: string;
  readonly dayNumber: string;
  /** "Tuesday 11 August" */
  readonly fullLabel: string;
  readonly relative: "Today" | "Tomorrow" | null;
  /** 0 = Monday, matching the grid's header row. */
  readonly weekdayColumn: number;
  readonly isToday: boolean;
  readonly availability: DayAvailability;
  /** The gym runs no classes on this weekday at all — Sunday. */
  readonly closed: boolean;
  readonly classes: readonly CalendarClass[];
};

/** A navigable span: one day, one week or one month. */
export type CalendarPeriod = {
  readonly key: string;
  readonly label: string;
  readonly dayKeys: readonly string[];
};

export type CalendarModel = {
  readonly days: readonly CalendarDay[];
  readonly weeks: readonly CalendarPeriod[];
  readonly months: readonly CalendarPeriod[];
  /** Bookable days, in order. These are the day view's periods. */
  readonly openDayKeys: readonly string[];
  /** Where the cursor starts. */
  readonly initialKey: string;
  /** "Wednesday 9 September" — the last day the window reaches. */
  readonly lastOpenLabel: string;
  readonly totalClasses: number;
};

export type BuildCalendarOptions = {
  readonly now: Date;
  readonly timeZone: string;
  readonly windowDays: number;
};

/* ---------------------------------------------------------------
   CIVIL DATE ARITHMETIC

   All of it on the calendar, never by adding 86,400,000ms — a local
   day is 23 or 25 hours long twice a year, and adding a day of
   milliseconds is exactly the bug that slides a schedule by an hour
   for a week every spring.
   --------------------------------------------------------------- */

const pad = (value: number) => String(value).padStart(2, "0");

export function dayKeyOf(date: CivilDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function monthKeyOf(date: CivilDate): string {
  return `${date.year}-${pad(date.month)}`;
}

/** 0 = Monday. `civilWeekdayIndex` is Sunday-first; the grid is not. */
function mondayColumn(date: CivilDate): number {
  return (civilWeekdayIndex(date) + 6) % 7;
}

function startOfWeek(date: CivilDate): CivilDate {
  return addCivilDays(date, -mondayColumn(date));
}

function startOfMonth(date: CivilDate): CivilDate {
  return { year: date.year, month: date.month, day: 1 };
}

/** `addCivilDays` normalises a month of 13, so December needs no special case. */
function endOfMonth(date: CivilDate): CivilDate {
  return addCivilDays({ year: date.year, month: date.month + 1, day: 1 }, -1);
}

function compare(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * The gym is shut on this weekday.
 *
 * Read from the timetable's own weekday set rather than from whether any
 * occurrences came back, and that distinction is the point: no rows on a
 * Tuesday means the gym cancelled the day or the classes have already run,
 * while no rows on a Sunday means the gym does not open. `isDayId` is the
 * same predicate that decides which days get occurrences generated in the
 * first place, so the two cannot disagree.
 */
function isClosed(date: CivilDate): boolean {
  const weekday = WEEK[civilWeekdayIndex(date)];
  return !weekday || !isDayId(weekday);
}

/* ---------------------------------------------------------------
   LABELS

   A CivilDate is already the gym's calendar date — the conversion out
   of UTC happened in `gymCivilDate`. Rendering it needs no second
   conversion, so these anchor on midday UTC and format in UTC: a
   vehicle for Intl, not a timezone decision. Anchoring at midday
   rather than midnight keeps it clear of any edge either way.

   Real instants — the class times themselves — still go through
   `formatClassTimeRange` with the gym's zone, because those genuinely
   are instants that have to be converted.
   --------------------------------------------------------------- */

const labelFormatters = new Map<string, Intl.DateTimeFormat>();

function labelFormatter(
  key: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cached = labelFormatters.get(key);
  if (cached) return cached;
  const made = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options });
  labelFormatters.set(key, made);
  return made;
}

function anchor(date: CivilDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
}

/** "Tuesday 11 August" */
function formatDayLong(date: CivilDate): string {
  return labelFormatter("dayLong", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(anchor(date));
}

/** "August 2026" */
function formatMonth(date: CivilDate): string {
  return labelFormatter("month", { month: "long", year: "numeric" }).format(
    anchor(date),
  );
}

/**
 * "11 – 17 August", "28 July – 3 August", "29 December 2026 – 4 January 2027".
 *
 * The month is stated once when both ends share it and twice when they do
 * not, because "11 – 17" alone stops being a date as soon as you have
 * paged away from the month you started in. The year appears only when the
 * week straddles one, where leaving it out would be genuinely ambiguous.
 */
function formatWeek(start: CivilDate, end: CivilDate): string {
  const dayOnly = labelFormatter("day", { day: "numeric" });
  const dayMonth = labelFormatter("dayMonth", { day: "numeric", month: "long" });
  const dayMonthYear = labelFormatter("dayMonthYear", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (start.year !== end.year) {
    return `${dayMonthYear.format(anchor(start))} – ${dayMonthYear.format(anchor(end))}`;
  }
  if (start.month !== end.month) {
    return `${dayMonth.format(anchor(start))} – ${dayMonth.format(anchor(end))}`;
  }
  return `${dayOnly.format(anchor(start))} – ${dayMonth.format(anchor(end))}`;
}

/* ---------------------------------------------------------------
   THE BUILDER
   --------------------------------------------------------------- */

export function buildCalendar(
  classes: readonly BookableClassInput[],
  options: BuildCalendarOptions,
): CalendarModel {
  const { now, timeZone, windowDays } = options;

  const today = gymCivilDate(now, timeZone);
  const tomorrow = addCivilDays(today, 1);
  /** Inclusive. `windowDays` counts today as day one. */
  const lastOpen = addCivilDays(today, windowDays - 1);

  const todayKey = dayKeyOf(today);
  const tomorrowKey = dayKeyOf(tomorrow);

  /**
   * Group the classes by the gym's calendar day. `gymCivilDate` rather
   * than slicing the ISO string: the UTC date of a 7pm Jersey City class
   * is the *next* day for five months of the year, which would file every
   * evening class under tomorrow.
   */
  const byDay = new Map<string, CalendarClass[]>();
  for (const entry of classes) {
    const date = gymCivilDate(new Date(entry.startsAt), timeZone);
    const key = dayKeyOf(date);
    const time = formatClassTimeRange(entry.startsAt, entry.endsAt, timeZone);
    /*
      The short name here, not the full "Advanced & Fighter". This is the
      booking grid: on a 320px phone a day cell gives a level roughly ten
      characters beside a time range, and the four levels are already
      unambiguous from each other. The full name lives on the classes
      section, where there is room to say what it means.

      The accessible name below is built from the same string on purpose.
      A screen reader announcing a different class name from the one on
      screen is worse than a shortened one.
    */
    const level = LEVEL_SHORT_LABELS[entry.level];

    const mapped: CalendarClass = {
      id: entry.id,
      time,
      level,
      spotsLeft: entry.spotsLeft,
      booked: entry.booked,
      full: entry.spotsLeft === 0,
      label: `${level}, ${formatDayLong(date)}, ${time}`,
    };

    const bucket = byDay.get(key);
    if (bucket) bucket.push(mapped);
    else byDay.set(key, [mapped]);
  }

  /**
   * The grid runs from the Monday on or before the 1st of this month to
   * the Sunday on or after the last day of the final month the window
   * reaches.
   *
   * Snapping to whole weeks at both ends is what makes the week view
   * complete: without it, the week containing today can start before the
   * range and render as four days rather than seven — which happens
   * whenever the 1st falls late in a week, so roughly one month in three.
   */
  const gridStart = startOfWeek(startOfMonth(today));
  const gridEnd = addCivilDays(
    startOfWeek(endOfMonth(lastOpen)),
    6,
  );

  const days: CalendarDay[] = [];
  for (
    let date = gridStart;
    compare(date, gridEnd) <= 0;
    date = addCivilDays(date, 1)
  ) {
    const key = dayKeyOf(date);

    const availability: DayAvailability =
      compare(date, today) < 0
        ? "past"
        : compare(date, lastOpen) > 0
          ? "upcoming"
          : "open";

    days.push({
      key,
      monthKey: monthKeyOf(date),
      weekKey: dayKeyOf(startOfWeek(date)),
      dayNumber: String(date.day),
      fullLabel: formatDayLong(date),
      relative:
        key === todayKey ? "Today" : key === tomorrowKey ? "Tomorrow" : null,
      weekdayColumn: mondayColumn(date),
      isToday: key === todayKey,
      availability,
      closed: isClosed(date),
      // Only open days carry classes. A past day's classes are on
      // /account, and an upcoming day's are deliberately not offered —
      // showing counts for days that cannot be booked reads as
      // availability.
      classes: availability === "open" ? (byDay.get(key) ?? []) : [],
    });
  }

  /**
   * Periods are limited to those holding at least one bookable day.
   *
   * The grid reaches into the past so that August looks like August, but
   * paging *to* a month that is entirely behind the window would be
   * navigation to a dead end. The earliest reachable period is always the
   * one containing today.
   */
  const openKeys = new Set(
    days.filter((day) => day.availability === "open").map((day) => day.key),
  );

  const weeks: CalendarPeriod[] = [];
  const months: CalendarPeriod[] = [];
  const weekBuckets = new Map<string, CalendarDay[]>();
  const monthBuckets = new Map<string, CalendarDay[]>();

  for (const day of days) {
    const week = weekBuckets.get(day.weekKey);
    if (week) week.push(day);
    else weekBuckets.set(day.weekKey, [day]);

    const month = monthBuckets.get(day.monthKey);
    if (month) month.push(day);
    else monthBuckets.set(day.monthKey, [day]);
  }

  for (const [key, bucket] of weekBuckets) {
    if (!bucket.some((day) => openKeys.has(day.key))) continue;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    if (!first || !last) continue;
    weeks.push({
      key,
      label: formatWeek(
        parseKey(first.key),
        parseKey(last.key),
      ),
      dayKeys: bucket.map((day) => day.key),
    });
  }

  for (const [key, bucket] of monthBuckets) {
    if (!bucket.some((day) => openKeys.has(day.key))) continue;
    const first = bucket[0];
    if (!first) continue;
    months.push({
      key,
      label: formatMonth(parseKey(first.key)),
      dayKeys: bucket.map((day) => day.key),
    });
  }

  const openDays = days.filter((day) => day.availability === "open");
  const openDayKeys = openDays.map((day) => day.key);

  /**
   * The cursor opens on the first day that has something to book rather
   * than on today, because today after the last class has started is an
   * empty page that makes the site look broken. Falls back to today when
   * nothing at all is bookable, so the heading still names a real day.
   */
  const initialKey =
    openDays.find((day) => day.classes.length > 0)?.key ??
    openDayKeys[0] ??
    todayKey;

  return {
    days,
    weeks,
    months,
    openDayKeys,
    initialKey,
    lastOpenLabel: formatDayLong(lastOpen),
    totalClasses: classes.length,
  };
}

/** "2026-08-11" back to a CivilDate. Only ever fed keys this file produced. */
function parseKey(key: string): CivilDate {
  const [year, month, day] = key.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}
