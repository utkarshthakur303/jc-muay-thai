"use client";

import Link from "next/link";

import { CalendarShell } from "@/components/calendar/CalendarShell";
import type { CalendarDay, CalendarModel } from "@/lib/booking/calendar";

/**
 * The class calendar, for the gym rather than the member.
 *
 * Same picker as /book — literally the same component — because the
 * question "what is on next Thursday" does not change depending on who is
 * asking. Only the answer does: a member gets a Book button, the gym gets
 * a link to the roster.
 *
 * Replaces a flat list of every class in the next fortnight, which ran to
 * around eighty rows. The gym's actual question is "who is coming to the
 * seven o'clock", and a list made them scroll to find the class before
 * they could even ask it.
 */

/**
 * The numbers a roster needs that the calendar model does not carry.
 *
 * `CalendarClass` is shaped for booking — spots left, and whether *you*
 * booked it — so occupancy and cancellation come alongside, keyed by
 * occurrence id. Passed as a plain object rather than a Map because it
 * crosses the server/client boundary and has to serialise.
 */
export type ClassMeta = {
  readonly capacity: number;
  readonly bookedCount: number;
  readonly cancelled: boolean;
  readonly note: string | null;
};

function DayClasses({
  day,
  meta,
}: {
  day: CalendarDay;
  meta: Record<string, ClassMeta>;
}) {
  if (day.classes.length === 0) {
    /**
     * Which kind of empty, not merely "no classes". The gym is shut on
     * Sundays; a past day has run; a day beyond the horizon has not been
     * generated yet. Reading "no classes" on a Tuesday and concluding the
     * timetable has broken is a misinformed panic this can prevent.
     */
    const reason = day.closed
      ? "The gym is closed on Sundays."
      : day.availability === "past"
        ? "This day has already passed."
        : day.availability === "upcoming"
          ? "Classes this far ahead have not been generated yet."
          : "Every class on this day has already started.";

    return <p className="mt-4 text-sm leading-relaxed text-text-2">{reason}</p>;
  }

  return (
    <ul role="list" className="mt-4 flex flex-col gap-2">
      {day.classes.map((entry) => {
        const detail = meta[entry.id];
        const cancelled = detail?.cancelled ?? false;
        const full = !cancelled && (detail?.bookedCount ?? 0) >= (detail?.capacity ?? 0);

        return (
          <li key={entry.id}>
            <Link
              href={`/admin/classes/${entry.id}`}
              className="card-surface flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-border px-5 py-4 transition-colors hover:border-accent"
            >
              <span className="min-w-32 font-mono text-[13px] tabular-nums text-text">
                {entry.time}
              </span>

              <span className="min-w-28 text-sm font-semibold text-text">
                {entry.level}
              </span>

              {cancelled ? (
                <span className="rounded-full bg-danger px-3 py-1 font-mono text-[10px] tracking-[0.08em] text-chalk uppercase">
                  Cancelled
                </span>
              ) : (
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-1.5 w-16 overflow-hidden rounded-full bg-divider"
                  >
                    <span
                      className={`block h-full rounded-full ${full ? "bg-danger" : "bg-accent"}`}
                      style={{
                        width: `${
                          detail && detail.capacity > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (detail.bookedCount / detail.capacity) * 100,
                                ),
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-text-2">
                    {detail?.bookedCount ?? 0}/{detail?.capacity ?? 0} booked
                  </span>
                </span>
              )}

              {cancelled && detail?.note ? (
                <span className="text-[13px] text-text-2">{detail.note}</span>
              ) : null}

              <span aria-hidden className="ml-auto font-mono text-[11px] text-text-3">
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ClassCalendar({
  model,
  meta,
}: {
  model: CalendarModel;
  meta: Record<string, ClassMeta>;
}) {
  return (
    <CalendarShell
      model={model}
      /* No "to book" suffix — the gym is not booking anything from here. */
      emptyMessage="No classes are scheduled in this window."
      renderDay={(day) => <DayClasses day={day} meta={meta} />}
    />
  );
}
