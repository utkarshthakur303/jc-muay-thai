"use client";

import { DayClasses } from "@/components/booking/DayClasses";
import { CalendarShell } from "@/components/calendar/CalendarShell";
import type { CalendarModel } from "@/lib/booking/calendar";

/**
 * The booking calendar: one day, one week or one month at a time.
 *
 * It began as a flat list of every bookable class, which at six a day over
 * a fortnight was around eighty rows — technically complete and unusable,
 * because the question a member arrives with is "what is on next Tuesday"
 * and a list makes them scroll to find out rather than look.
 *
 * The three views answer three different questions, which is why all three
 * exist rather than one being the "real" one:
 *
 *   Day    — "what can I book right now", the shortest path to a booking.
 *   Week   — "which day this week", seven cells and the one you pick.
 *   Month  — "when shall I train", the shape of the month before the detail.
 *
 * All of that now lives in {@link CalendarShell}, which the admin panel
 * shares. What is left here is the one thing that is genuinely a member's
 * and not the gym's: a chosen day shows Book buttons.
 */
export function BookingCalendar({ model }: { model: CalendarModel }) {
  return (
    <CalendarShell
      model={model}
      countSuffix="to book"
      emptyMessage="No days are open for booking."
      renderDay={(day) => (
        <DayClasses day={day} lastOpenLabel={model.lastOpenLabel} />
      )}
    />
  );
}
