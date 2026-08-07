"use client";

import { useState } from "react";

import { ClassAction } from "@/components/booking/ClassAction";

/**
 * The booking calendar.
 *
 * It replaced a single flat list of every bookable class, which at six
 * classes a day over a fortnight was around eighty rows — technically
 * complete and unusable, because the question a member actually arrives
 * with is "what is on next Tuesday", and a list makes them scroll to find
 * out rather than look.
 *
 * A month grid was the obvious alternative and is wrong here: bookings open
 * fourteen days out, so a month view would be more than half greyed-out
 * cells advertising days that cannot be booked. This shows exactly the
 * window that exists, laid out in real weekday columns so it still reads as
 * a calendar — Tuesdays line up under Tuesdays.
 *
 * Selection is client state rather than a URL parameter. The classes are
 * already on the page, so switching days is instant and free; putting the
 * day in the query string would mean a server round trip, and would re-run
 * the horizon check, to display data the browser is already holding.
 *
 * Everything here arrives pre-formatted from the server. No Intl in the
 * client: the dates are gym-local, and formatting them here would render
 * them in the *visitor's* zone, so a member checking their schedule from
 * abroad would see times they cannot turn up for.
 */

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

export type CalendarDay = {
  readonly key: string;
  readonly dayNumber: string;
  readonly fullLabel: string;
  readonly relative: string | null;
  /** 0 = Monday, matching the header row. */
  readonly weekdayColumn: number;
  readonly isToday: boolean;
  readonly classes: readonly CalendarClass[];
};

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function spotsLabel(entry: CalendarClass): string {
  if (entry.full) return "Full";
  if (entry.spotsLeft === 1) return "1 spot left";
  return `${entry.spotsLeft} spots left`;
}

export function BookingCalendar({ days }: { days: readonly CalendarDay[] }) {
  const firstBookable = days.find((day) => day.classes.length > 0);
  const [selectedKey, setSelectedKey] = useState(
    firstBookable?.key ?? days[0]?.key ?? "",
  );

  const selected = days.find((day) => day.key === selectedKey) ?? firstBookable;

  // Empty cells so the first day lands under the right weekday.
  const leading = days[0] ? days[0].weekdayColumn : 0;

  return (
    <>
      <div
        role="group"
        aria-label="Choose a day"
        className="mt-8 rounded-card border border-border bg-card p-3 sm:p-4"
      >
        <div
          aria-hidden
          className="grid grid-cols-7 gap-1 pb-2 sm:gap-1.5"
        >
          {WEEKDAY_HEADERS.map((label) => (
            <span
              key={label}
              className="text-center font-mono text-[10px] tracking-widest text-text-3 uppercase"
            >
              {label.slice(0, 1)}
              <span className="hidden sm:inline">{label.slice(1)}</span>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {Array.from({ length: leading }, (_, index) => (
            <span key={`blank-${index}`} aria-hidden />
          ))}

          {days.map((day) => {
            const isSelected = day.key === selected?.key;
            const count = day.classes.length;
            const closed = count === 0;

            return (
              <button
                key={day.key}
                type="button"
                disabled={closed}
                aria-pressed={isSelected}
                aria-controls="selected-day"
                /* "12" read on its own is not a date. The accessible name
                   carries the whole thing, including whether anything is
                   on. */
                aria-label={`${day.fullLabel}${
                  day.relative ? ` (${day.relative})` : ""
                } — ${closed ? "no classes" : `${count} ${count === 1 ? "class" : "classes"}`}`}
                onClick={() => setSelectedKey(day.key)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border transition-colors sm:min-h-16 ${
                  isSelected
                    ? "border-accent bg-accent text-ink"
                    : closed
                      ? "cursor-not-allowed border-transparent text-text-3"
                      : "border-border text-text hover:border-accent hover:text-accent-strong"
                } ${day.isToday && !isSelected ? "ring-1 ring-accent/45" : ""}`}
              >
                <span className="font-mono text-sm leading-none">
                  {day.dayNumber}
                </span>

                {/* A count, not dots. "6" tells a member the evening is
                    busy; six identical dots make them count. */}
                <span
                  aria-hidden
                  className={`font-mono text-[10px] leading-none ${
                    isSelected
                      ? "text-ink/70"
                      : closed
                        ? "text-text-3"
                        : "text-text-2"
                  }`}
                >
                  {closed ? "—" : count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section
        id="selected-day"
        aria-live="polite"
        aria-labelledby="selected-day-heading"
        className="mt-8"
      >
        <h2
          id="selected-day-heading"
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-3 font-mono text-[12px] tracking-widest text-text uppercase"
        >
          {selected?.fullLabel ?? "No days available"}
          {selected?.relative ? (
            <span className="text-accent-strong">{selected.relative}</span>
          ) : null}
        </h2>

        {!selected || selected.classes.length === 0 ? (
          <p className="mt-5 text-sm leading-relaxed text-text-2">
            No classes on this day.
          </p>
        ) : (
          <ul role="list" className="mt-1 flex flex-col">
            {selected.classes.map((entry) => (
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
        )}
      </section>
    </>
  );
}
