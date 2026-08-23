import { dateKey, isOpenDay } from "@/lib/attendance/streak";
import type { DayState } from "@/lib/attendance/types";
import {
  addCivilDays,
  civilWeekdayIndex,
  type CivilDate,
} from "@/lib/format/gymClock";

/**
 * The shapes behind the two graphs on the streak page.
 *
 * Pure, like streak.ts and for the same reason: every awkward case here —
 * the week that straddles a month, the Sunday the gym is shut, the day
 * that has not finished yet — is a test rather than something discovered
 * in production by a member whose chart looks wrong.
 *
 * NO Intl, NO Date, NO TIMEZONE
 *
 * Everything works on `CivilDate`, which has already been resolved into
 * the gym's zone by the caller. Formatting a label through
 * `toLocaleDateString` here would re-introduce the visitor's clock at the
 * last step: a member in Los Angeles would see a bar labelled with
 * yesterday's date. The month names are a twelve-entry array for exactly
 * that reason, and it is not a lack of ambition.
 *
 * ONE WINDOW FOR BOTH GRAPHS
 *
 * Twelve weeks, shared. The bars and the grid answer different questions —
 * "how often" and "which days" — and answering them over different
 * periods would put two charts side by side that cannot be read against
 * each other.
 */

export const HISTORY_WEEKS = 12;

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Monday-first, matching the week strip, the timetable and the calendar. */
const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** `11 Aug`. Short because twelve of these share one axis. */
function shortLabel(date: CivilDate): string {
  return `${date.day} ${MONTH_ABBR[date.month - 1] ?? "?"}`;
}

/** The Monday of the week containing `date`. */
function mondayOf(date: CivilDate): CivilDate {
  // civilWeekdayIndex is Sunday-first; +6 %7 turns it Monday-first, so
  // Sunday resolves back to the Monday six days earlier rather than
  // forward into a week that has not started.
  return addCivilDays(date, -((civilWeekdayIndex(date) + 6) % 7));
}

export type WeekBar = {
  /** ISO date of the Monday. Also the React key. */
  readonly key: string;
  /** `11 Aug`, the week's Monday. */
  readonly label: string;
  /** Days marked in that week, 0–7. Includes Sundays. */
  readonly count: number;
  /** The week in progress. Drawn differently: it is not finished yet. */
  readonly isCurrent: boolean;
};

/**
 * Days trained per week, oldest first.
 *
 * Sundays are counted here even though they cannot extend a streak. This
 * chart answers "how much did I train", and a Sunday session is training.
 * The streak number above it answers the other question, and the page
 * says which is which.
 *
 * The final bar is the current week and is deliberately marked as such:
 * on a Tuesday it holds two days against six full weeks, and an unmarked
 * short bar at the right-hand end reads as a collapse rather than as a
 * week that is three days old.
 */
export function weeklyBars(
  dates: readonly string[],
  today: CivilDate,
  weeks: number = HISTORY_WEEKS,
): readonly WeekBar[] {
  const marked = new Set(dates);
  const thisMonday = mondayOf(today);

  return Array.from({ length: weeks }, (_, index) => {
    const start = addCivilDays(thisMonday, (index - (weeks - 1)) * 7);

    let count = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      if (marked.has(dateKey(addCivilDays(start, offset)))) count += 1;
    }

    return {
      key: dateKey(start),
      label: shortLabel(start),
      count,
      isCurrent: index === weeks - 1,
    } satisfies WeekBar;
  });
}

export type HeatCell = {
  readonly key: string;
  readonly state: DayState;
};

export type HeatRow = {
  /** `M`, `T`, … Repeats across the week, so never a React key. */
  readonly initial: string;
  readonly label: string;
  readonly cells: readonly HeatCell[];
  /** Marked on this weekday inside the window. */
  readonly trained: number;
  /**
   * Open days on this weekday that have already been and gone.
   *
   * Today is excluded while it is unmarked, for the same reason the
   * streak excludes it: the day is not over, and counting it as a chance
   * already missed tells somebody at nine in the morning that they have
   * failed. Zero here means the gym does not open on this weekday at all.
   */
  readonly chances: number;
};

/**
 * The same twelve weeks as a grid: one row per weekday, one column per
 * week, oldest column first.
 *
 * WHY WEEKDAYS ARE THE ROWS
 *
 * Because it is the only layout that answers a question the numbers do
 * not. "I never make it on Fridays" is invisible in a streak, invisible
 * in a weekly total, and one glance down a row here. A run of marked days
 * also reads as a diagonal, so a broken streak shows the gap that broke
 * it rather than only its consequence.
 */
export function heatmapRows(
  dates: readonly string[],
  today: CivilDate,
  weeks: number = HISTORY_WEEKS,
): readonly HeatRow[] {
  const marked = new Set(dates);
  const todayKey = dateKey(today);
  const firstMonday = addCivilDays(mondayOf(today), -(weeks - 1) * 7);

  return WEEKDAY_INITIALS.map((initial, row) => {
    const cells: HeatCell[] = [];
    let trained = 0;
    let chances = 0;

    for (let week = 0; week < weeks; week += 1) {
      const date = addCivilDays(firstMonday, week * 7 + row);
      const key = dateKey(date);

      /**
       * Closed is tested before future, exactly as the week strip does
       * it. A Sunday later this week is both — but "the gym is shut" is
       * permanent and "it hasn't arrived yet" expires by Monday, so
       * showing the permanent one keeps the grid stable as the week
       * passes instead of a cell quietly changing character.
       */
      const state: DayState = marked.has(key)
        ? "attended"
        : !isOpenDay(date)
          ? "closed"
          : key > todayKey
            ? "future"
            : key === todayKey
              ? "today"
              : "missed";

      if (state === "attended") trained += 1;

      /**
       * Derived from the timetable and the calendar, NOT from the cell's
       * state — and that is the whole of the bug this replaced. Counting
       * `attended || missed` made a marked Sunday a chance taken, so a
       * member who trained one Sunday read "trained 1 of 1 Sundays" on a
       * row where the gym is shut every week. A closed day is never a
       * chance, whether or not somebody trained anyway.
       *
       * Today counts only once it is marked, for the same reason the
       * streak skips it: at nine in the morning it is not a chance
       * missed, it is a chance still open.
       */
      if (isOpenDay(date) && (key < todayKey || state === "attended")) {
        chances += 1;
      }

      cells.push({ key, state });
    }

    return {
      initial,
      label: WEEKDAY_NAMES[row] ?? "",
      cells,
      trained,
      chances,
    } satisfies HeatRow;
  });
}
