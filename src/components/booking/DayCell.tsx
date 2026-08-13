"use client";

import type { CalendarDay } from "@/lib/booking/calendar";

/**
 * One selectable day, shared by the month grid and the week strip.
 *
 * Declared once because the two are the same control at two scales, and
 * two copies of a square that has five states — selected, bookable,
 * closed, passed, not yet open — is two places for the disabled logic to
 * drift apart. The week strip adds a weekday name above the number; that
 * is the only difference between them.
 */

function classCountLabel(count: number): string {
  return `${count} ${count === 1 ? "class" : "classes"}`;
}

export function DayCell({
  day,
  selected,
  weekdayLabel,
  onSelect,
}: {
  day: CalendarDay;
  selected: boolean;
  /** "Mon". Shown in the week strip, where there is no column header. */
  weekdayLabel?: string;
  onSelect: (key: string) => void;
}) {
  // A Sunday cannot be chosen because there is nothing on it. A past or
  // not-yet-open day cannot be chosen because it cannot be booked.
  // Everything else can, including a day with nothing left — the list
  // below then says why.
  const selectable = day.availability === "open" && !day.closed;
  const count = day.classes.length;

  /*
    Why the accessible name is spelled out: "12" read on its own is not a
    date, and a disabled square announces nothing about why it is
    disabled. The three unavailable states are visually identical by
    design — position tells a sighted member which is which — so the name
    is the only place the distinction survives.
  */
  const reason = day.closed
    ? "gym closed"
    : day.availability === "past"
      ? "already passed"
      : day.availability === "upcoming"
        ? "not open for booking yet"
        : count === 0
          ? "nothing left to book"
          : classCountLabel(count);

  return (
    <button
      type="button"
      disabled={!selectable}
      aria-pressed={selected}
      aria-controls="selected-day"
      aria-label={`${day.fullLabel}${
        day.relative ? ` (${day.relative})` : ""
      } — ${reason}`}
      onClick={() => onSelect(day.key)}
      /*
        Mutually exclusive branches. Tailwind orders utilities by variant
        rather than by position in the class string, so appending a
        selected state to an idle one is a coin toss that is lost
        silently — the exact bug that once made the open streak trigger
        invisible.
      */
      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border transition-colors sm:min-h-16 ${
        selected
          ? // Ink fill, white content. White on the ACCENT fill this used
            // to be measured 3.55:1 and failed AA on a 14px number; on ink
            // it is 19.67:1, and it now matches the active nav pill so the
            // whole site says "this one" in one voice.
            "border-ink bg-ink text-on-ink"
          : selectable
            ? "border-border text-text hover:border-accent hover:text-accent-strong"
            : "cursor-not-allowed border-transparent text-text-3"
      } ${day.isToday && !selected ? "ring-1 ring-accent/45" : ""}`}
    >
      {weekdayLabel ? (
        <span
          aria-hidden
          className={`font-mono text-[10px] leading-none tracking-widest uppercase ${
            selected ? "text-on-ink/75" : "text-text-3"
          }`}
        >
          {weekdayLabel}
        </span>
      ) : null}

      <span className="font-mono text-sm leading-none">{day.dayNumber}</span>

      {/* A count, not dots. "6" tells a member the evening is busy; six
          identical dots make them count. A day that cannot be booked
          shows nothing rather than a zero, which would read as "the gym
          is shut". */}
      <span
        aria-hidden
        className={`font-mono text-[10px] leading-none ${
          selected
            ? "text-on-ink/75"
            : selectable
              ? "text-text-2"
              : "text-text-3"
        }`}
      >
        {!selectable ? (day.closed ? "—" : "") : count}
      </span>
    </button>
  );
}
