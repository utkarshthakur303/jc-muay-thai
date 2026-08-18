import { Fragment } from "react";

import {
  DAY_LABELS,
  LEVEL_SHORT_LABELS,
  sessionsOnDay,
  type DayId,
  type LevelId,
} from "@/content/schedule";
import { formatRangeCompact } from "@/lib/format/time";

/**
 * One day's mat time, grouped by level.
 *
 * The grouping is done here rather than stored, because the timetable is
 * stored as individual sessions — the shape a booking row needs. Two
 * beginner sessions on a Monday are two bookable classes, and only become
 * the single line "9–10 AM · 5–6 PM" at the moment of display.
 *
 * A <dl>, not a table row: within a day this is a set of label/value
 * pairs, and a screen reader announces "Beginner, 9 to 10 AM" without the
 * grid navigation a table would imply.
 */
/**
 * The hover stops at the card. The mockup made every row of this timetable
 * clickable, opening a drawer that could not book anything; that is gone,
 * and a per-row highlight would put the same promise back in a subtler
 * form. The card responds, the rows do not.
 */
export function DayCard({ day }: { day: DayId }) {
  const daySessions = sessionsOnDay(day);

  // Insertion order follows first appearance in the day, so a card reads
  // top to bottom in the order the classes actually run.
  const byLevel = new Map<LevelId, string[]>();
  for (const session of daySessions) {
    const times = byLevel.get(session.level) ?? [];
    times.push(formatRangeCompact(session.start, session.end));
    byLevel.set(session.level, times);
  }

  return (
    <li className="card-surface card-hover flex flex-col p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3 border-b border-divider pb-3">
        <h3 className="font-display text-2xl tracking-[0.02em] text-text">
          {DAY_LABELS[day]}
        </h3>
        <p className="font-mono text-[11px] tracking-[0.06em] text-text-3 uppercase">
          {daySessions.length}{" "}
          {daySessions.length === 1 ? "class" : "classes"}
        </p>
      </div>

      <dl className="mt-1 font-mono text-xs">
        {[...byLevel].map(([level, times]) => (
          <div
            key={level}
            className="flex items-baseline justify-between gap-4 border-b border-divider/60 py-2.5 last:border-b-0"
          >
            {/*
              Short names. This column is `shrink-0` beside a right-aligned
              range that can read "11 AM–12:30 PM · 7–8:30 PM"; "Advanced &
              Fighter" alongside it overflows the card at every width below
              sm.
            */}
            <dt className="shrink-0 text-text-2">
              {LEVEL_SHORT_LABELS[level]}
            </dt>
            {/*
              Each range is its own nowrap span rather than one joined
              string. In the two-column layout the value box narrows to
              about 145px while "11 AM–12:30 PM · 7–8:30 PM" wants 187px,
              and a browser will happily break after the en dash — leaving
              "11 AM–" on one line and "12:30 PM" on the next, which reads
              as a different time entirely. This way the only legal break
              is between two whole ranges.
            */}
            <dd className="text-right text-text">
              {times.map((time, index) => (
                <Fragment key={time}>
                  {index > 0 ? (
                    <span className="text-text-3">{" · "}</span>
                  ) : null}
                  <span className="whitespace-nowrap">{time}</span>
                </Fragment>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
