import { DAYS, DAY_FULL_LABELS, isDayId, type DayId } from "@/content/schedule";
import {
  addCivilDays,
  civilWeekdayIndex,
  type CivilDate,
} from "@/lib/format/gymClock";
import {
  MILESTONES,
  type StreakSummary,
  type WeekDay,
} from "@/lib/attendance/types";

/**
 * The streak rule, and nothing else.
 *
 * Pure: dates in, summary out, no clock and no database. That is what lets
 * the awkward cases — the Sunday closure, the day that has not finished
 * yet, the member who trains on a rest day — be written down as tests
 * instead of discovered in production by somebody whose streak just
 * vanished.
 *
 * THE RULE
 *
 * A streak is consecutive OPEN days marked. The gym runs Monday to
 * Saturday, so Sunday is stepped over: Saturday to Monday keeps a streak
 * alive, and no member loses one every week to a day the doors are shut.
 *
 * The open days come from src/content/schedule.ts, never from a hardcoded
 * list here. If Sunday sessions are ever added, the streak follows in the
 * same edit that adds them.
 *
 * TODAY IS NOT A MISS UNTIL IT IS OVER
 *
 * The subtle one, and the one that would generate the most support
 * messages if it were wrong. A member who trained yesterday and opens the
 * site at nine this morning has not broken anything — the day has barely
 * started. So an unmarked today is skipped rather than counted as a miss,
 * and the streak is measured from the last open day before it. What they
 * see is yesterday's number, still standing, with today still winnable.
 *
 * SUNDAYS COUNT AS TRAINING, NOT AS STREAK
 *
 * Marking a Sunday is allowed — open gym, a run, a session somewhere else —
 * and it raises the total and shows on the week strip. It cannot extend a
 * streak, because a streak of open days has no slot for it, and it cannot
 * break one either. The panel says so, rather than leaving a member to
 * work out why their Sunday did nothing.
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** `YYYY-MM-DD`. The same key the database stores, so they compare directly. */
export function dateKey(date: CivilDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** Sunday-first, matching civilWeekdayIndex. */
const WEEKDAY_IDS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const WEEKDAY_INITIALS: Record<string, string> = {
  sun: "S",
  mon: "M",
  tue: "T",
  wed: "W",
  thu: "T",
  fri: "F",
  sat: "S",
};

const WEEKDAY_NAMES: Record<string, string> = {
  ...DAY_FULL_LABELS,
  sun: "Sunday",
};

function weekdayId(date: CivilDate): string {
  return WEEKDAY_IDS[civilWeekdayIndex(date)] ?? "sun";
}

/** Does the gym run sessions on this date's weekday? */
export function isOpenDay(date: CivilDate): boolean {
  const id = weekdayId(date);
  return isDayId(id) && (DAYS as readonly DayId[]).includes(id);
}

/**
 * The open day immediately before `date`.
 *
 * Bounded rather than `while (true)`: if the timetable were ever emptied —
 * a plausible state for a gym mid-refit — an unbounded search would spin
 * the request thread forever. Eight steps is more than one closed week, so
 * it cannot cut a real gap short.
 */
function previousOpenDay(date: CivilDate): CivilDate | null {
  let cursor = date;
  for (let step = 0; step < 8; step += 1) {
    cursor = addCivilDays(cursor, -1);
    if (isOpenDay(cursor)) return cursor;
  }
  return null;
}

function currentStreak(marked: ReadonlySet<string>, today: CivilDate): number {
  // An unmarked today is not a miss — the day is not over. Measure from the
  // last open day instead, so the number holds until it is genuinely lost.
  let cursor: CivilDate | null = marked.has(dateKey(today))
    ? today
    : previousOpenDay(today);

  // A marked-but-closed today (a Sunday) has no slot in a run of open days.
  // Step back to the last open one rather than counting it.
  if (cursor && !isOpenDay(cursor)) cursor = previousOpenDay(cursor);

  let streak = 0;
  while (cursor && marked.has(dateKey(cursor))) {
    streak += 1;
    cursor = previousOpenDay(cursor);
  }
  return streak;
}

/**
 * The longest run ever held.
 *
 * Walks the marked open days oldest-first and extends the run whenever the
 * open day preceding one is also marked. Closed days are absent from this
 * list entirely, which is what makes Saturday→Monday adjacent without any
 * special case for the weekend.
 */
function bestStreak(
  marked: ReadonlySet<string>,
  openDays: readonly CivilDate[],
): number {
  let best = 0;
  let run = 0;
  let previousKey: string | null = null;

  for (const day of openDays) {
    const key = dateKey(day);
    if (!marked.has(key)) {
      run = 0;
      previousKey = null;
      continue;
    }

    const prior = previousOpenDay(day);
    run = prior && previousKey === dateKey(prior) ? run + 1 : 1;
    previousKey = key;
    if (run > best) best = run;
  }

  return best;
}

function buildWeek(
  marked: ReadonlySet<string>,
  today: CivilDate,
): readonly WeekDay[] {
  // civilWeekdayIndex is Sunday-first; the strip reads Monday-first, which
  // is how the timetable and the booking calendar are already laid out.
  const monday = addCivilDays(today, -((civilWeekdayIndex(today) + 6) % 7));
  const todayKey = dateKey(today);

  return Array.from({ length: 7 }, (_, offset) => {
    const date = addCivilDays(monday, offset);
    const key = dateKey(date);
    const id = weekdayId(date);

    /**
     * Closed is tested before future, and the order is the whole
     * decision. A Sunday later this week is both — but "the gym is shut"
     * is a permanent fact about that day and "it hasn't arrived yet" is
     * one that expires by Monday. Showing the permanent one means the
     * strip reads the same on Wednesday as it will on Sunday, instead of
     * a day quietly changing character as the week passes.
     */
    const state = marked.has(key)
      ? "attended"
      : !isOpenDay(date)
        ? "closed"
        : key > todayKey
          ? "future"
          : key === todayKey
            ? "today"
            : "missed";

    return {
      key,
      initial: WEEKDAY_INITIALS[id] ?? "?",
      label: WEEKDAY_NAMES[id] ?? id,
      state,
    } satisfies WeekDay;
  });
}

/**
 * @param dates    Every `attended_on` the member holds, in any order.
 * @param today    The gym's current civil date — never the visitor's.
 * @param justMarked Whether this summary follows a check-in the member has
 *                 only just made. Gates the milestone, so that reloading
 *                 the page cannot replay a celebration they already had.
 */
export function summarise(
  dates: readonly string[],
  today: CivilDate,
  justMarked = false,
): StreakSummary {
  const marked = new Set(dates);

  // The window `bestStreak` walks. Long enough to cover any run a member
  // could plausibly hold, and bounded so the work stays constant rather
  // than growing with the gym's age.
  const openDays: CivilDate[] = [];
  for (let offset = 365 * 3; offset >= 0; offset -= 1) {
    const date = addCivilDays(today, -offset);
    if (isOpenDay(date)) openDays.push(date);
  }

  const current = currentStreak(marked, today);
  const best = Math.max(current, bestStreak(marked, openDays));

  return {
    current,
    best,
    total: marked.size,
    markedToday: marked.has(dateKey(today)),
    openToday: isOpenDay(today),
    week: buildWeek(marked, today),
    /**
     * A milestone needs the check-in to have actually MOVED the streak,
     * not merely to have happened while the streak was a round number.
     *
     * `isOpenDay` is the gate that enforces it. Marking a Sunday cannot
     * change `current` — a closed day has no slot in a run of open days —
     * so without this a member sitting on a 3-day streak would get the
     * "that's a habit" celebration every Sunday, for training on a day
     * that by this rule does not count. Congratulating somebody for a
     * thing that did not happen is how a motivator becomes noise.
     */
    milestone:
      justMarked && isOpenDay(today) && MILESTONES.includes(current)
        ? current
        : null,
  };
}
