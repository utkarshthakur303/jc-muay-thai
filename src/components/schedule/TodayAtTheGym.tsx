"use client";

import { useEffect, useState } from "react";

import {
  DAY_FULL_LABELS,
  dayWindow,
  isDayId,
  type DayId,
} from "@/content/schedule";
import { gymNow } from "@/lib/format/gymClock";
import { formatTime } from "@/lib/format/time";
import { site } from "@/content/site";

/**
 * "Today, Thursday — 7 classes, 9:00 AM to 8:00 PM."
 *
 * The one question the timetable itself answers badly: which of the six
 * columns is the one you are standing in. It is a client component for the
 * reasons set out in lib/format/gymClock — the server's clock is UTC, and
 * asking for the real one during render would cost the page its static
 * prerender.
 *
 * Renders a reserved-height placeholder until mounted, so filling it in
 * cannot push the schedule grid down, and so a visitor without JavaScript
 * sees nothing rather than something false.
 */

type Today =
  | { kind: "open"; day: DayId; count: number; first: string; last: string }
  | { kind: "closed" };

function resolveToday(): Today {
  const { weekday } = gymNow(site.timeZone);
  if (!isDayId(weekday)) return { kind: "closed" };

  // Deliberately not named `window`: shadowing the global inside a module
  // that also calls window.setInterval is a trap waiting to be sprung.
  const bounds = dayWindow(weekday);
  if (!bounds) return { kind: "closed" };

  return {
    kind: "open",
    day: weekday,
    count: bounds.count,
    first: bounds.first.start,
    last: bounds.last.end,
  };
}

export function TodayAtTheGym() {
  const [today, setToday] = useState<Today | null>(null);

  useEffect(() => {
    setToday(resolveToday());

    // The only moment this line can go stale is midnight in Jersey City,
    // so a minute's granularity is far finer than it needs to be — and it
    // costs one Intl format per tick, which is nothing next to the
    // alternative of being wrong on a page someone left open overnight.
    const timer = window.setInterval(() => setToday(resolveToday()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p
      aria-live="polite"
      className="mt-5 flex min-h-6 items-center gap-2 font-mono text-xs text-text-2"
    >
      {today === null ? null : today.kind === "closed" ? (
        "No classes scheduled today."
      ) : (
        <>
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-accent"
          />
          <span>
            Today is {DAY_FULL_LABELS[today.day]} —{" "}
            <span className="text-text">
              {today.count} {today.count === 1 ? "class" : "classes"},{" "}
              {formatTime(today.first)} to {formatTime(today.last)}
            </span>
          </span>
        </>
      )}
    </p>
  );
}
