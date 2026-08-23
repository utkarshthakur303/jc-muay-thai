import { DAY_CELL } from "@/components/attendance/dayLook";
import type { HeatRow } from "@/lib/attendance/history";
import type { DayState } from "@/lib/attendance/types";

/**
 * Twelve weeks as a grid: one row per weekday, one column per week.
 *
 * WHY THIS EXISTS ALONGSIDE THE BAR CHART
 *
 * Because it answers a question no number on this page does. "I never
 * make it on Fridays" is invisible in a streak, invisible in a weekly
 * total, and one glance down a row here. It is also the only place a
 * broken streak shows the gap that broke it rather than only its
 * consequence.
 *
 * THE CELLS ARE HIDDEN FROM SCREEN READERS ON PURPOSE
 *
 * Eighty-four cells, each announcing a date and a state, is four minutes
 * of speech to find out that Fridays are thin. Each row carries one
 * sentence instead — "Fridays: trained 3 of 12" — which is the insight
 * the grid exists to deliver, and the fraction is on screen for
 * everybody else too.
 */

const LEGEND: readonly { state: DayState; label: string }[] = [
  { state: "attended", label: "Trained" },
  { state: "missed", label: "Missed" },
  { state: "today", label: "Today" },
  { state: "closed", label: "Gym shut" },
];

export function TrainingGrid({ rows }: { readonly rows: readonly HeatRow[] }) {
  /**
   * Only rows the gym actually opens on. A row with no chances is a
   * weekday the gym is shut all twelve weeks — Sunday — and a member who
   * trained on two of them would otherwise land in the numerator without
   * ever reaching the denominator. "38 of 37 open days" is the kind of
   * number that makes a reader stop trusting the rest of the page.
   */
  const open = rows.filter((row) => row.chances > 0);
  const trained = open.reduce((sum, row) => sum + row.trained, 0);
  const chances = open.reduce((sum, row) => sum + row.chances, 0);

  return (
    <section
      aria-labelledby="grid-heading"
      className="rounded-card border border-border bg-card p-6 sm:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="grid-heading"
          className="font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase"
        >
          Which days you train
        </h2>

        {/*
          The twelve-week total, said once in plain words.

          A fraction rather than a percentage on purpose. "61%" invites a
          member to read a score they are being marked against; "38 of 62
          open days" is the same fact and is plainly a count of what
          happened. Days the gym was shut are not in the denominator, so
          nobody is measured against a day they could not have trained.
        */}
        <p className="font-mono text-sm text-text-2">
          {trained} of {chances} open days
        </p>
      </div>

      <ul role="list" className="mt-5 max-w-md space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="w-4 shrink-0 font-mono text-[11px] text-text-3"
            >
              {row.initial}
            </span>

            <span className="flex flex-1 gap-1">
              {row.cells.map((cell) => (
                <span
                  key={cell.key}
                  aria-hidden
                  className={`aspect-square flex-1 rounded-[3px] ${
                    DAY_CELL[cell.state]
                  }`}
                />
              ))}
            </span>

            <span
              aria-hidden
              className="w-11 shrink-0 text-right font-mono text-[11px] text-text-2 tabular-nums"
            >
              {/*
                Nothing to be counted out of on a day the gym never
                opens, so the fraction would read 1/0. An em dash says
                "not applicable" without inventing a denominator.
              */}
              {row.chances === 0 ? "—" : `${row.trained}/${row.chances}`}
            </span>

            <span className="sr-only">
              {row.chances === 0
                ? `${row.label}s: the gym is closed${
                    row.trained > 0
                      ? `, and you trained on ${row.trained} of them anyway`
                      : ""
                  }`
                : `${row.label}s: trained ${row.trained} of ${row.chances}`}
            </span>
          </li>
        ))}
      </ul>

      {/*
        A legend, because four fills and no key is a puzzle. Closed draws
        nothing at all — an empty row says "the gym is shut on Sundays"
        better than a fifth shade with its own entry — so its swatch is
        an outline, which is what an absence looks like.
      */}
      <ul
        role="list"
        aria-label="Key"
        className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider pt-4"
      >
        {LEGEND.map((item) => (
          <li key={item.state} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`size-3 rounded-[3px] ${DAY_CELL[item.state]} ${
                item.state === "closed" ? "border border-divider" : ""
              }`}
            />
            <span className="font-mono text-[10px] tracking-[0.08em] text-text-2 uppercase">
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
