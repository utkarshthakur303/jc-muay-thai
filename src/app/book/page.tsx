import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { MemberShell } from "@/components/booking/MemberShell";
import { site } from "@/content/site";
import { buildCalendar } from "@/lib/booking/calendar";
import { BOOKING_WINDOW_DAYS, ensureHorizon } from "@/lib/booking/horizon";
import {
  countUpcomingBookings,
  listBookableClasses,
} from "@/lib/booking/queries";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Book a class",
  // A booking page has nothing to offer a search engine and everything to
  // lose from being indexed with a member's session in the crawl.
  robots: { index: false, follow: false },
};

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

  const [classes, upcomingCount] = await Promise.all([
    listBookableClasses(),
    countUpcomingBookings(),
  ]);

  /**
   * Every date on this page is formatted here, on the server, in the gym's
   * zone — the day labels, the week and month headings, the weekday each
   * square sits under. The calendar component receives strings and does no
   * date work at all; if it did, a member opening this abroad would be
   * shown their own local times for classes they have to physically
   * attend.
   */
  const model = buildCalendar(classes, {
    now: new Date(),
    timeZone: site.timeZone,
    windowDays: BOOKING_WINDOW_DAYS,
  });

  return (
    <MemberShell
      current="/book"
      heading="Book a class"
      upcomingCount={upcomingCount}
    >
      <p className="mt-8 max-w-prose text-sm leading-relaxed text-text-2">
        {model.totalClasses === 0
          ? "No classes are open for booking right now — that usually means the timetable is being updated."
          : `${model.totalClasses} ${model.totalClasses === 1 ? "class" : "classes"} over the next ${BOOKING_WINDOW_DAYS} days, up to ${model.lastOpenLabel}. Browse by day, week or month, then pick a class. Cancel any time before it starts and your spot goes straight back to whoever wants it.`}
      </p>

      <BookingCalendar model={model} />
    </MemberShell>
  );
}
