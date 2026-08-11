"use client";

import { ClassAction } from "@/components/booking/ClassAction";
import type { CalendarClass, CalendarDay } from "@/lib/booking/calendar";

/**
 * One day's bookable classes.
 *
 * Shared by all three views so a class row looks and behaves identically
 * whether it was reached by paging to a day, scrolling a week or tapping a
 * square in the month grid. Declared once because three copies of a row
 * carrying a Book button is three places for the disabled state to drift.
 *
 * WHY AN EMPTY DAY GETS A SENTENCE AND NOT A DASH
 *
 * The grid can only afford a glyph, so an empty day there is a "—". Here
 * there is room to say which kind of empty it is, and the four kinds are
 * genuinely different: the gym is shut on Sundays; a day in the past cannot
 * be booked; a day past the window is not open yet; and a day whose classes
 * have all started has nothing left. A member who reads "no classes" on a
 * Tuesday evening and concludes the gym has stopped running Tuesdays has
 * been misinformed by a UI that could not be bothered to distinguish them.
 */

function spotsLabel(entry: CalendarClass): string {
  if (entry.full) return "Full";
  if (entry.spotsLeft === 1) return "1 spot left";
  return `${entry.spotsLeft} spots left`;
}

function emptyNote(day: CalendarDay, lastOpenLabel: string): string {
  if (day.closed) return "The gym is closed on this day.";
  if (day.availability === "past") return "This day has already passed.";
  if (day.availability === "upcoming") {
    return `Not open for booking yet — you can book up to ${lastOpenLabel}.`;
  }
  return "Nothing left to book on this day.";
}

export function DayClasses({
  day,
  lastOpenLabel,
}: {
  day: CalendarDay;
  lastOpenLabel: string;
}) {
  if (day.classes.length === 0) {
    return (
      <p className="mt-4 text-sm leading-relaxed text-text-2">
        {emptyNote(day, lastOpenLabel)}
      </p>
    );
  }

  return (
    <ul role="list" className="mt-1 flex flex-col">
      {day.classes.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-divider py-4"
        >
          <div className="min-w-0">
            <p className="font-mono text-sm text-text">{entry.time}</p>
            <p className="mt-0.5 text-sm text-text-2">
              {entry.level}
              <span aria-hidden className="px-2 text-text-3">
                ·
              </span>
              {/*
                Mutually exclusive branches, never concatenated. Tailwind
                orders utilities by variant rather than by position in the
                string, so two classes setting the same property is a coin
                toss that is lost silently.
              */}
              <span
                className={
                  entry.full
                    ? "text-text-3"
                    : entry.spotsLeft <= 3
                      ? "text-accent-strong"
                      : "text-text-2"
                }
              >
                {spotsLabel(entry)}
              </span>
            </p>
          </div>

          <ClassAction
            occurrenceId={entry.id}
            booked={entry.booked}
            full={entry.full}
            label={entry.label}
          />
        </li>
      ))}
    </ul>
  );
}
