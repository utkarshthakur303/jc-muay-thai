"use client";

import { useEffect, useState } from "react";

import {
  DAY_LABELS,
  LEVEL_LABELS,
  isDayId,
  sessionsOnDay,
  type DayId,
  type Session,
} from "@/content/schedule";
import type { TimetableEntry } from "@/lib/schedule/queries";
import { WEEK, gymNow } from "@/lib/format/gymClock";
import { formatTime, toMinutes } from "@/lib/format/time";
import { site } from "@/content/site";

/**
 * "Class on now" / "Next class at …", resolved against the gym's clock.
 *
 * Why this is a client component rather than server-rendered:
 *
 *   - `new Date()` on the server is the server's clock. On Vercel that is
 *     UTC, so the mockup's identical check would have told a visitor a
 *     class was running at four in the morning, Jersey City time.
 *   - Reading the clock at all would make the page dynamic, forcing a
 *     render per request on what is otherwise a static, CDN-served page.
 *   - The answer changes while the page is open. Rendering it once, at
 *     any point, would be wrong within the hour.
 *
 * The timezone is pinned to the gym, not taken from the visitor. Someone
 * checking the timetable from another state wants to know whether a class
 * is running in Jersey City, not whether one would be running if the gym
 * were where they are.
 *
 * Renders nothing until mounted, so the server and the first client render
 * agree, and it degrades to absent — never wrong — without JavaScript.
 */

type Status =
  | { kind: "in-session"; session: Session }
  | { kind: "next"; session: Session; day: DayId; isToday: boolean };

function resolveStatus(timetable: readonly TimetableEntry[]): Status | null {
  const { weekdayIndex, minutes } = gymNow(site.timeZone);

  // Scan today, then forward a full week, so a Saturday evening lands on
  // Monday morning rather than falling off the end of the array.
  for (let offset = 0; offset < 8; offset += 1) {
    const dayName = WEEK[(weekdayIndex + offset) % 7];
    if (!dayName || !isDayId(dayName)) continue;

    for (const session of sessionsOnDay(timetable, dayName)) {
      if (offset > 0) {
        return { kind: "next", session, day: dayName, isToday: false };
      }
      if (minutes >= toMinutes(session.start) && minutes < toMinutes(session.end)) {
        return { kind: "in-session", session };
      }
      if (toMinutes(session.start) > minutes) {
        return { kind: "next", session, day: dayName, isToday: true };
      }
    }
  }

  return null;
}

export function LiveClassStatus({
  timetable,
}: {
  timetable: readonly TimetableEntry[];
}) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    setStatus(resolveStatus(timetable));
    // A minute is the coarsest interval that still flips the label within
    // a minute of a class starting, and it costs one tiny synchronous
    // computation per tick.
    const timer = window.setInterval(
      () => setStatus(resolveStatus(timetable)),
      60_000,
    );
    return () => window.clearInterval(timer);
    // Re-runs if the timetable itself changes underneath — which happens
    // when the owner edits it and the page is revalidated.
  }, [timetable]);

  // Reserve the line's height so filling it in after mount cannot shift
  // the card's contents downward.
  if (!status) return <p className="min-h-5" />;

  if (status.kind === "in-session") {
    return (
      <p
        // polite: useful, but never worth interrupting whatever a screen
        // reader is already saying.
        aria-live="polite"
        className="flex items-center gap-2 font-mono text-xs text-text-2"
      >
        <span
          aria-hidden
          className="live-pulse size-2 shrink-0 rounded-full bg-danger"
        />
        <span className="text-danger">
          {LEVEL_LABELS[status.session.level]} on now
        </span>
      </p>
    );
  }

  return (
    <p aria-live="polite" className="min-h-5 font-mono text-xs text-text-2">
      Next: {LEVEL_LABELS[status.session.level]},{" "}
      <span className="text-text">
        {status.isToday ? "today" : DAY_LABELS[status.day]}{" "}
        {formatTime(status.session.start)}
      </span>
    </p>
  );
}
