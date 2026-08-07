import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  BookingCalendar,
  type CalendarClass,
  type CalendarDay,
} from "@/components/booking/BookingCalendar";
import { MemberShell } from "@/components/booking/MemberShell";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import { BOOKING_WINDOW_DAYS, ensureHorizon } from "@/lib/booking/horizon";
import { listBookableClasses } from "@/lib/booking/queries";
import {
  classDayKey,
  formatClassDateLong,
  formatClassTimeRange,
  relativeDayLabel,
} from "@/lib/format/classTime";
import {
  addCivilDays,
  civilWeekdayIndex,
  gymCivilDate,
  gymTimeToInstant,
  type CivilDate,
} from "@/lib/format/gymClock";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Book a class",
  // A booking page has nothing to offer a search engine and everything to
  // lose from being indexed with a member's session in the crawl.
  robots: { index: false, follow: false },
};

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: CivilDate) =>
  `${date.year}-${pad(date.month)}-${pad(date.day)}`;

/**
 * Builds one entry per calendar day in the window, including the days with
 * nothing on.
 *
 * Empty days are deliberately kept. Dropping them would leave a grid whose
 * columns no longer line up with weekdays, which is the one thing a
 * calendar has to get right — and a visibly closed Sunday tells a member
 * more than a Sunday that simply is not there.
 *
 * Everything is formatted here, on the server, in the gym's zone. The
 * client component does no date work at all; if it did, a member opening
 * this abroad would be shown their own local times for classes they have to
 * physically attend.
 */
function buildDays(
  classes: Awaited<ReturnType<typeof listBookableClasses>>,
): CalendarDay[] {
  const zone = site.timeZone;

  const byDay = new Map<string, CalendarClass[]>();
  for (const entry of classes) {
    const key = classDayKey(entry.startsAt, zone);
    const time = formatClassTimeRange(entry.startsAt, entry.endsAt, zone);
    const level = LEVEL_LABELS[entry.level];

    const mapped: CalendarClass = {
      id: entry.id,
      time,
      level,
      spotsLeft: entry.spotsLeft,
      booked: entry.booked,
      full: entry.spotsLeft === 0,
      label: `${level}, ${formatClassDateLong(entry.startsAt, zone)}, ${time}`,
    };

    const bucket = byDay.get(key);
    if (bucket) bucket.push(mapped);
    else byDay.set(key, [mapped]);
  }

  const today = gymCivilDate(new Date(), zone);
  const days: CalendarDay[] = [];

  for (let offset = 0; offset < BOOKING_WINDOW_DAYS; offset += 1) {
    const date = addCivilDays(today, offset);
    const key = dateKey(date);

    // Midday, purely as a formatting anchor — every day has one, including
    // the days with no classes to borrow an instant from, and noon is far
    // enough from either edge to be immune to a daylight saving shift.
    const anchor = gymTimeToInstant(date, 12 * 60, zone).toISOString();

    days.push({
      key,
      dayNumber: String(date.day),
      fullLabel: formatClassDateLong(anchor, zone),
      relative: relativeDayLabel(anchor, zone),
      // civilWeekdayIndex is Sunday-first; the grid is Monday-first.
      weekdayColumn: (civilWeekdayIndex(date) + 6) % 7,
      isToday: offset === 0,
      classes: byDay.get(key) ?? [],
    });
  }

  return days;
}

export default async function BookPage() {
  const user = await getUser();
  /**
   * The proxy guards this route, but a Server Component must not rely on
   * that alone — a misconfigured matcher would expose the page silently.
   * Authorisation is checked where the data is read.
   */
  if (!user) redirect("/login?next=/book");

  /**
   * Creates any classes that do not exist yet. Idempotent, and cheap in the
   * common case — one indexed row read that finds the horizon already long
   * enough. Its failure is deliberately not fatal: fewer classes to book is
   * a bad page, an exception is no page.
   */
  await ensureHorizon();

  const classes = await listBookableClasses();
  const days = buildDays(classes);
  const total = classes.length;

  return (
    <MemberShell current="/book" heading="Book a class">
      <p className="mt-8 max-w-prose text-sm leading-relaxed text-text-2">
        {total === 0
          ? "No classes are open for booking right now — that usually means the timetable is being updated."
          : `${total} ${total === 1 ? "class" : "classes"} over the next ${BOOKING_WINDOW_DAYS} days. Pick a day, then a class. Cancel any time before it starts and your spot goes straight back to whoever wants it.`}
      </p>

      <BookingCalendar days={days} />
    </MemberShell>
  );
}
