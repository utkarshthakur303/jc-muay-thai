import { TiltCard } from "@/components/ui/TiltCard";
import {
  DAY_LABELS,
  busiestDays,
  totalWeeklySessions,
  weeklyLoad,
} from "@/content/schedule";
import type { TimetableEntry } from "@/lib/schedule/queries";

/**
 * Sessions per day across the week.
 *
 * Every number here is counted from the timetable it is handed — the bar
 * heights, the weekly total, and which days are busiest. The mockup
 * carried all three separately: a literal `BAR_DATA` array, a hand-typed
 * "37 classes/wk", and a hardcoded "Busiest: Mon / Wed / Thu". Adding a
 * Tuesday evening class would have left three statements on one card
 * disagreeing with each other and with the schedule below.
 *
 * A server component with no interactivity, so it ships no JavaScript. The
 * bars animate through CSS alone.
 */
export function ClassLoadChart({
  timetable,
}: {
  timetable: readonly TimetableEntry[];
}) {
  const load = weeklyLoad(timetable);
  const total = totalWeeklySessions(timetable);
  const busiest = busiestDays(timetable);
  // A timetable with no sessions would divide every bar by zero and
  // render NaN% heights. Guarded rather than assumed non-empty, because
  // the owner can now delete his way to an empty week.
  const peak = Math.max(1, ...load.map((entry) => entry.count));

  return (
    <TiltCard className="card-surface card-gradient card-hover flex flex-col justify-center p-5 sm:p-6 lg:col-start-2 lg:col-span-2 lg:row-start-3 lg:p-[clamp(16px,2vw,28px)]">
      {/*
        `flex-wrap` earns its place with this typeface. Michroma sets the
        weekly total roughly twice as wide as Anton did, which took the
        title's share of a 320px card from 183px to 110px and stacked
        WEEKLY / CLASS / LOAD three deep. Wrapping drops the total onto
        its own line on a phone instead, and changes nothing above 414px.
      */}
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="label-mono">Sessions</p>
          {/* 30px → 18px: this shares its line with the weekly total, and
              Michroma set it 470px wide against 423px of card at 1280. */}
          <p className="font-hero text-lg leading-tight text-text">
            WEEKLY CLASS LOAD
          </p>
        </div>
        <p className="shrink-0 text-right font-hero text-[1.75rem] leading-tight text-accent-strong">
          {total}
          <span className="ml-1 font-mono text-sm text-text-2">classes/wk</span>
        </p>
      </div>

      {/*
        A list, not a <table>: this is one measure across six labelled
        categories, and every value is stated in text beside its bar. A
        screen reader gets the same numbers a sighted reader does, in the
        same order, without navigating a grid.
      */}
      <ul role="list" className="flex h-[min(20vh,120px)] items-end gap-3.5">
        {load.map((entry, index) => (
          <li key={entry.day} className="flex h-full flex-1 flex-col items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-text-2">
              {entry.count}
            </span>

            <div className="flex w-full flex-1 items-end justify-center">
              <div
                aria-hidden
                className="bar-grow w-full max-w-8 rounded-t-lg bg-accent"
                style={{
                  height: `${(entry.count / peak) * 100}%`,
                  // Staggered left to right so the week reads as a
                  // sequence. Zeroed under prefers-reduced-motion by the
                  // base layer, along with the animation itself.
                  animationDelay: `${index * 60}ms`,
                }}
              />
            </div>

            <span className="font-mono text-[11px] text-text-2">
              {DAY_LABELS[entry.day]}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 font-mono text-xs text-text-2">
        Busiest: {busiest.map((day) => DAY_LABELS[day]).join(" / ")}
      </p>
    </TiltCard>
  );
}
