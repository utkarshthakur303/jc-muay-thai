import { gymCivilDate, type CivilDate } from "@/lib/format/gymClock";

/**
 * Rendering a stored instant back into gym time.
 *
 * Booking rows are UTC instants. Every one of these functions exists
 * because `new Date(iso).toLocaleString()` would render them in the
 * *server's* zone, which on Vercel is UTC — showing a Jersey City member
 * that their 7pm class starts at 11pm. The zone is therefore a required
 * argument everywhere, never a default.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(
  key: string,
  make: () => Intl.DateTimeFormat,
): Intl.DateTimeFormat {
  const cached = formatters.get(key);
  if (cached) return cached;
  const made = make();
  formatters.set(key, made);
  return made;
}

/** "Tue 12 Aug" */
export function formatClassDate(iso: string, timeZone: string): string {
  return formatter(`date:${timeZone}`, () =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  ).format(new Date(iso));
}

/** "Tuesday 12 August" — for a group heading, where there is room. */
export function formatClassDateLong(iso: string, timeZone: string): string {
  return formatter(`dateLong:${timeZone}`, () =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  ).format(new Date(iso));
}

function clockParts(
  iso: string,
  timeZone: string,
): { hour: number; minute: number } {
  const parts = formatter(`clock:${timeZone}`, () =>
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    }),
  ).formatToParts(new Date(iso));

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return { hour: read("hour"), minute: read("minute") };
}

function meridiem(hour: number): "AM" | "PM" {
  return hour < 12 ? "AM" : "PM";
}

function clockLabel(hour: number, minute: number): string {
  const hours12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? String(hours12)
    : `${hours12}:${String(minute).padStart(2, "0")}`;
}

/**
 * "7–8:30 PM", "11 AM–12:30 PM"
 *
 * Same dense convention as the public timetable's `formatRangeCompact`,
 * deliberately: a member reading "7–8:30 PM" on the booking page and
 * "7–8:30 PM" on the home page should not have to work out whether they
 * are the same class.
 */
export function formatClassTimeRange(
  startIso: string,
  endIso: string,
  timeZone: string,
): string {
  const from = clockParts(startIso, timeZone);
  const to = clockParts(endIso, timeZone);

  const head =
    meridiem(from.hour) === meridiem(to.hour)
      ? clockLabel(from.hour, from.minute)
      : `${clockLabel(from.hour, from.minute)} ${meridiem(from.hour)}`;

  return `${head}–${clockLabel(to.hour, to.minute)} ${meridiem(to.hour)}`;
}

/**
 * "Tue 12 Aug, 4:30 PM" — one instant, date and time together.
 *
 * For things that happened at a moment rather than over a span: an enquiry
 * arriving, a message being marked as dealt with. Lives here beside the
 * class formatters because it shares their clock helpers, and — more to the
 * point — their zone rule. An enquiry timestamp rendered in the server's
 * zone would read four hours off on Vercel, and the gym would be looking
 * for a message it thought arrived tomorrow.
 */
export function formatInstant(iso: string, timeZone: string): string {
  const { hour, minute } = clockParts(iso, timeZone);
  return `${formatClassDate(iso, timeZone)}, ${clockLabel(hour, minute)} ${meridiem(hour)}`;
}

/** Stable key for grouping classes by gym-local calendar day. */
export function classDayKey(iso: string, timeZone: string): string {
  const { year, month, day } = gymCivilDate(new Date(iso), timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sameCivilDate(a: CivilDate, b: CivilDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * "Yesterday" / "Today" / "Tomorrow", or null for anything further out.
 *
 * Resolved against the gym's calendar, not the reader's. A member checking
 * their schedule from a work trip in London at 2am should see the class
 * labelled by the day it happens *at the gym* — the day they will need to
 * be there.
 *
 * "Yesterday" was added 2026-08-23, when the account page's history got a
 * card of its own. A card headed WEDNESDAY 22 AUGUST makes the reader do
 * the arithmetic; one headed YESTERDAY does not.
 *
 * ── THE DAY ARITHMETIC IS DONE IN CIVIL DATES, NOT MILLISECONDS ─────
 * Adding 24 hours to an instant and reading the result is wrong twice a
 * year: on the US spring-forward Sunday that lands 23 hours later and on
 * the autumn one 25, so "yesterday" would be today, or the day before.
 * The gym is in America/New_York and observes both. The offsets are
 * therefore applied to the civil date the gym is actually on, and
 * `gymCivilDate` is what maps an instant onto that.
 *
 * `now` is injectable so the boundaries can be tested at a fixed instant
 * rather than only on the day somebody runs the suite.
 */
export function relativeDayLabel(
  iso: string,
  timeZone: string,
  now: Date = new Date(),
): "Yesterday" | "Today" | "Tomorrow" | null {
  const target = gymCivilDate(new Date(iso), timeZone);
  const today = gymCivilDate(now, timeZone);

  if (sameCivilDate(target, today)) return "Today";

  const DAY_MS = 24 * 60 * 60 * 1000;

  const tomorrow = gymCivilDate(new Date(now.getTime() + DAY_MS), timeZone);
  if (sameCivilDate(target, tomorrow)) return "Tomorrow";

  const yesterday = gymCivilDate(new Date(now.getTime() - DAY_MS), timeZone);
  if (sameCivilDate(target, yesterday)) return "Yesterday";

  return null;
}
