import type { WeekBar } from "@/lib/attendance/history";

/**
 * Days trained per week, over the same twelve weeks as the grid below it.
 *
 * A server component with no interactivity, so it ships no JavaScript.
 * The bars animate through CSS alone — the same `bar-grow` the home
 * page's class-load chart uses, so the two read as the same kind of
 * object.
 *
 * WHY THE LAST BAR IS DRAWN DIFFERENTLY
 *
 * It is the week in progress. On a Tuesday it holds two days against
 * eleven finished weeks, and an ordinary short bar at the right-hand end
 * reads as a collapse — the exact opposite of what is happening. Half
 * opacity plus the label underneath says "not finished" without needing
 * a legend.
 *
 * WHY SUNDAYS ARE IN HERE
 *
 * This chart answers "how much did I train"; the streak answers "how many
 * open days in a row". A Sunday session is training, so it is counted
 * here, and it cannot extend a streak, so it is not counted there. The
 * page states the difference rather than leaving a member to notice two
 * numbers that will not reconcile.
 */
export function WeeklyBars({ bars }: { readonly bars: readonly WeekBar[] }) {
  // A member with no history at all would divide every bar by zero and
  // render NaN% heights. The page does not draw this chart until they
  // have marked something, and this is the belt to that.
  const peak = Math.max(1, ...bars.map((bar) => bar.count));

  return (
    <section
      aria-labelledby="weekly-heading"
      className="rounded-card border border-border bg-card p-6 sm:p-7"
    >
      <h2
        id="weekly-heading"
        className="font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase"
      >
        Days trained each week
      </h2>

      {/*
        A list, not a <table>: one measure across twelve labelled
        periods. Every value is stated in the accessible name beside its
        bar, so a screen reader gets the same twelve numbers in the same
        order without navigating a grid.
      */}
      <ul
        role="list"
        className="mt-5 flex h-32 items-end gap-1.5 sm:gap-2"
      >
        {bars.map((bar, index) => (
          <li
            key={bar.key}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            {/*
              text-2, not text-3. Measured off rendered pixels these
              digits came in at 4.53:1 in the light theme — over the 4.5
              floor by six hundredths, at 10px, on the numbers the chart
              exists to convey. Passing by a rounding error is not passing.
            */}
            <span
              aria-hidden
              className="font-mono text-[10px] leading-none text-text-2 tabular-nums"
            >
              {bar.count}
            </span>

            <div className="flex w-full flex-1 items-end justify-center">
              <div
                aria-hidden
                className={`bar-grow w-full max-w-7 rounded-t-md ${
                  bar.isCurrent ? "bg-accent/45" : "bg-accent"
                }`}
                style={{
                  // A zero week still draws a sliver, so the axis reads as
                  // twelve weeks with nothing in one rather than as eleven
                  // weeks and a gap where a bar failed to render.
                  height: `${Math.max(2, (bar.count / peak) * 100)}%`,
                  // Staggered left to right so the run reads as a
                  // sequence. Zeroed under prefers-reduced-motion by the
                  // base layer, along with the animation itself.
                  animationDelay: `${index * 40}ms`,
                }}
              />
            </div>

            <span className="sr-only">
              Week of {bar.label}: {bar.count}{" "}
              {bar.count === 1 ? "day" : "days"}
              {bar.isCurrent ? ", this week, still going" : ""}
            </span>
          </li>
        ))}
      </ul>

      {/*
        Two labels, not twelve. Twelve dates across a 280px phone is a
        smear; the ends are what tell a reader which way time runs, and
        every individual week is named in its own accessible label.
      */}
      <div
        aria-hidden
        className="mt-2 flex items-baseline justify-between font-mono text-[10px] tracking-[0.08em] text-text-3 uppercase"
      >
        <span>{bars[0]?.label}</span>
        <span>This week</span>
      </div>
    </section>
  );
}
