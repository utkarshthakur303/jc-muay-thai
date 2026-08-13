"use client";

import { useMemo, useState } from "react";

import { DayCell } from "@/components/booking/DayCell";
import { DayClasses } from "@/components/booking/DayClasses";
import type { CalendarModel, CalendarPeriod } from "@/lib/booking/calendar";

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
 * Week and month are the same interaction at two scales: a row of days
 * with their counts, and the chosen day's classes underneath. Only the
 * picker differs, so all three views end in one shared panel.
 *
 * MONTH IS THE DEFAULT
 *
 * Because it is the closest thing to what this page already did: a grid to
 * read the window off, a tap to choose a day, the classes underneath. A
 * returning member finds the page they know, with a month in the grid
 * instead of a rolling fortnight. Changing the landing view of a page that
 * live members already use is a cost with no benefit attached.
 *
 * ONE CURSOR, THREE VIEWS
 *
 * The selected *day* is the only piece of state; the active week and month
 * are derived from it. Switching view therefore keeps your place — pick
 * Thursday in the grid, switch to Day, and you are on Thursday. Storing a
 * separate cursor per view was the first attempt and it desynchronised
 * immediately: the month said August, the day said the 3rd of September.
 *
 * NO DATES ARE COMPUTED HERE
 *
 * Every label, every weekday column and every relative day arrives
 * pre-formatted from the server in the gym's zone. Formatting here would
 * use the *visitor's* zone, so a member checking their schedule from
 * abroad would be shown times they cannot turn up for — and the bug is
 * invisible to anyone testing from New Jersey. There is deliberately no
 * `Date` and no `Intl` below this line.
 *
 * Selection stays client state rather than a URL parameter: the classes
 * are already on the page, so paging is instant and free, where a query
 * string would mean a server round trip that re-runs the horizon check to
 * display data the browser is already holding.
 */

const VIEWS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
] as const;

type View = (typeof VIEWS)[number]["id"];

/** What prev/next moves by, spoken. "Previous month", not "Previous". */
const STEP_NOUN: Record<View, string> = {
  day: "day",
  week: "week",
  month: "month",
};

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function classCountLabel(count: number): string {
  return `${count} ${count === 1 ? "class" : "classes"}`;
}

export function BookingCalendar({ model }: { model: CalendarModel }) {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(model.initialKey);

  const dayByKey = useMemo(
    () => new Map(model.days.map((day) => [day.key, day])),
    [model.days],
  );

  /**
   * The cursor is re-validated on every render rather than trusted.
   *
   * This component keeps its state across the server re-render that
   * follows a booking, and it survives the page being left open — so a
   * member who opens /book at 11pm and books something at half past
   * midnight has a cursor pointing at a day that is now in the past. Held
   * as state that would silently desync the grid from the list; derived,
   * it snaps back to a day that can still be booked.
   */
  const selectedKey =
    dayByKey.get(cursor)?.availability === "open" ? cursor : model.initialKey;
  const selected = dayByKey.get(selectedKey);

  const dayPeriods = useMemo<CalendarPeriod[]>(
    () =>
      model.openDayKeys.map((key) => ({
        key,
        label: dayByKey.get(key)?.fullLabel ?? key,
        dayKeys: [key],
      })),
    [model.openDayKeys, dayByKey],
  );

  const periods =
    view === "day" ? dayPeriods : view === "week" ? model.weeks : model.months;

  const foundIndex = periods.findIndex((period) =>
    period.dayKeys.includes(selectedKey),
  );
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;
  const active = periods[activeIndex];

  const periodDays = (active?.dayKeys ?? [])
    .map((key) => dayByKey.get(key))
    .filter((day) => day !== undefined);

  const periodCount = periodDays.reduce(
    (total, day) => total + day.classes.length,
    0,
  );

  /**
   * Paging lands on the first day of the new period that can actually be
   * booked, not simply its first day — otherwise stepping into next month
   * opens on the 1st, which for most of a 30-day window is a day that has
   * already passed.
   */
  function go(delta: number) {
    const next = periods[activeIndex + delta];
    if (!next) return;
    const target =
      next.dayKeys.find(
        (key) => dayByKey.get(key)?.availability === "open",
      ) ?? next.dayKeys[0];
    if (target) setCursor(target);
  }

  const atStart = activeIndex === 0;
  const atEnd = activeIndex >= periods.length - 1;

  return (
    <>
      {/*
        Two rows on a phone, one on anything wider.

        This was a single wrapping flex row, and it did not wrap: the
        switcher holds its intrinsic ~230px and the pager's arrows are
        `shrink-0`, so at 320px the pager was handed 34px and simply drew
        itself on top of the switcher — the "previous" arrow ended up
        underneath the MONTH pill, unreachable. Nothing caught it because
        the overflow went leftward into the parent's padding, so the
        document's scrollWidth never moved and a horizontal-overflow check
        passed a control that was invisible.
      */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/*
          A group of toggles, not tabs. `aria-pressed` rather than
          `aria-selected` because there is no tabpanel here — the views
          reshape one region rather than switching between three.
        */}
        <div
          role="group"
          aria-label="Calendar view"
          className="flex gap-1 rounded-full border border-border bg-card p-1 sm:shrink-0"
        >
          {VIEWS.map((option) => {
            const isActive = view === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setView(option.id)}
                /* `flex-1` on a phone so the three share the width evenly
                   rather than leaving a ragged tail; natural width above. */
                className={`flex min-h-11 flex-1 items-center justify-center rounded-full px-4 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors sm:flex-none ${
                  isActive
                    ? "bg-accent text-ink"
                    : "text-text-2 hover:text-accent-strong"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 items-center justify-between gap-1 sm:flex-1 sm:justify-end">
          <div className="min-w-0 pr-1 text-left sm:text-right">
            <p className="truncate font-mono text-[12px] tracking-widest text-text uppercase">
              {active?.label ?? "No classes"}
            </p>
            <p className="font-mono text-[11px] text-text-3">
              {classCountLabel(periodCount)} to book
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">

          <button
            type="button"
            onClick={() => go(-1)}
            disabled={atStart}
            aria-label={`Previous ${STEP_NOUN[view]}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-text-2 transition-colors hover:border-accent hover:text-accent-strong disabled:cursor-not-allowed disabled:border-divider disabled:text-text-3 disabled:hover:border-divider disabled:hover:text-text-3"
          >
            <span aria-hidden>‹</span>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={atEnd}
            aria-label={`Next ${STEP_NOUN[view]}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-text-2 transition-colors hover:border-accent hover:text-accent-strong disabled:cursor-not-allowed disabled:border-divider disabled:text-text-3 disabled:hover:border-divider disabled:hover:text-text-3"
          >
            <span aria-hidden>›</span>
          </button>
          </div>
        </div>
      </div>

      {/*
        One short spoken announcement instead of a live region wrapped
        round the content. Marking the whole class list `aria-live` reads
        an entire week — thirty-odd rows — every time somebody presses
        next, which is not information, it is an obstacle.
      */}
      <p role="status" className="sr-only">
        {active?.label}, {classCountLabel(periodCount)} to book
      </p>

      {view === "month" && active ? (
        <div
          role="group"
          aria-label="Choose a day"
          className="mt-6 rounded-card border border-border bg-card p-3 sm:p-4"
        >
          <div aria-hidden className="grid grid-cols-7 gap-1 pb-2 sm:gap-1.5">
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
            {/* Blanks so the 1st lands under the right weekday. */}
            {Array.from(
              { length: periodDays[0]?.weekdayColumn ?? 0 },
              (_, index) => (
                <span key={`blank-${index}`} aria-hidden />
              ),
            )}

            {periodDays.map((day) => (
              <DayCell
                key={day.key}
                day={day}
                selected={day.key === selectedKey}
                onSelect={setCursor}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/*
        The week as seven cells you pick from, rather than seven days of
        classes stacked on top of each other.

        The stacked version showed every class in the week at once, which
        sounds like more information and read as a wall — six open days at
        six or seven classes each is around forty rows, and the day you
        actually wanted was somewhere in the middle of it. Seven cells put
        the whole week on one line, with the busy days legible at a glance
        from their counts, and the classes for the one day you chose
        underneath. Same interaction as the month grid, at week scale, so
        switching between the two views teaches nothing new.

        No column headers here: with only seven cells each carries its own
        weekday name, which also survives the cells wrapping on a narrow
        phone where a fixed header row would not line up.
      */}
      {view === "week" && active ? (
        <div
          role="group"
          aria-label="Choose a day"
          className="mt-6 rounded-card border border-border bg-card p-3 sm:p-4"
        >
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {periodDays.map((day) => (
              <DayCell
                key={day.key}
                day={day}
                selected={day.key === selectedKey}
                weekdayLabel={WEEKDAY_HEADERS[day.weekdayColumn]}
                onSelect={setCursor}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/*
        One panel for all three views. Day, week and month differ only in
        the picker above; what they are picking is always a single day,
        so there is one place its classes are rendered and one heading
        format to keep right.
      */}
      <section id="selected-day" className="mt-8">
        {selected ? (
          <>
            <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-3 font-mono text-[12px] tracking-widest text-text uppercase">
              {selected.fullLabel}
              {selected.relative ? (
                <span className="text-accent-strong">{selected.relative}</span>
              ) : null}
            </h2>
            <DayClasses day={selected} lastOpenLabel={model.lastOpenLabel} />
          </>
        ) : (
          <p className="text-sm leading-relaxed text-text-2">
            No days are open for booking.
          </p>
        )}
      </section>
    </>
  );
}
