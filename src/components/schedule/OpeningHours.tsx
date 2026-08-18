import {
  OPENING_DAY_LABELS,
  openingHours,
  type OpeningDay,
} from "@/content/site";
import { formatRangeCompact, formatTime } from "@/lib/format/time";

/**
 * When the doors are open — which is a different question from when
 * classes run, and the one a visitor asks before turning up to ask about
 * joining.
 *
 * Runs of identical days are collapsed, because "Mon–Thu 9 AM – 8:30 PM"
 * is how the gym writes it and how anyone reads it. Collapsing is derived
 * rather than typed: the source of truth is seven independent rows, so a
 * day whose hours change breaks out of its run on its own instead of
 * needing someone to notice that "Mon–Thu" has quietly become a lie.
 */

/** `to` is extended as the run grows, so it is deliberately not readonly. */
type Run = {
  readonly from: OpeningDay;
  to: OpeningDay;
};

function sameHours(a: OpeningDay, b: OpeningDay): boolean {
  return a.opens === b.opens && a.closes === b.closes;
}

/** Consecutive days sharing hours, in week order. */
function collapse(days: readonly OpeningDay[]): Run[] {
  const runs: Run[] = [];

  for (const day of days) {
    const last = runs[runs.length - 1];
    if (last && sameHours(last.to, day)) last.to = day;
    else runs.push({ from: day, to: day });
  }

  return runs;
}

/** "Mon" for a single day, "Mon–Thu" for a run. */
function labelFor(day: OpeningDay["day"], long: boolean): string {
  const label = OPENING_DAY_LABELS[day];
  return long ? label.long : label.short;
}

function runLabel(run: Run, long: boolean): string {
  const from = labelFor(run.from.day, long);
  if (run.from.day === run.to.day) return from;
  return `${from}–${labelFor(run.to.day, long)}`;
}

export function OpeningHours() {
  const runs = collapse(openingHours);

  return (
    <div className="mt-4 rounded-card border border-border px-5 py-4 sm:px-6">
      <p className="label-mono">Opening hours</p>

      <dl className="mt-2.5 flex flex-col gap-1.5 font-mono text-xs sm:flex-row sm:flex-wrap sm:gap-x-7 sm:gap-y-2">
        {runs.map((run) => {
          // Narrowed into locals rather than asserted with `!`. The two
          // fields are null together or set together, but only the
          // compiler needs telling.
          const { opens, closes } = run.from;

          return (
            <div
              key={run.from.day}
              className="flex items-baseline justify-between gap-3 sm:justify-start sm:gap-2.5"
            >
              {/*
                The visible label is abbreviated to fit a phone; the
                screen-reader label is not. "Mon–Thu" is announced by
                VoiceOver as "mon dash thu", which is not a day range.
              */}
              <dt className="shrink-0 text-text-2">
                <span aria-hidden>{runLabel(run, false)}</span>
                <span className="sr-only">{runLabel(run, true)}</span>
              </dt>
              {opens !== null && closes !== null ? (
                <dd className="whitespace-nowrap text-text">
                  <span aria-hidden>{formatRangeCompact(opens, closes)}</span>
                  {/*
                    "9 AM–8:30 PM" reads aloud as a subtraction. Spelled
                    out for anyone listening rather than looking.
                  */}
                  <span className="sr-only">
                    {formatTime(opens)} to {formatTime(closes)}
                  </span>
                </dd>
              ) : (
                <dd className="whitespace-nowrap text-text-3">Closed</dd>
              )}
            </div>
          );
        })}
      </dl>
    </div>
  );
}
