/**
 * The shape of a member's streak.
 *
 * A separate module from actions.ts for the same hard reason as
 * lib/booking/state.ts: a `"use server"` file may export only async
 * functions, and a type or a constant in one takes down every action in
 * the app at request time while passing both `tsc` and `next build`.
 *
 * Everything here is computed on the server and arrives finished. The
 * client does no date arithmetic and no streak arithmetic — if it did, a
 * member opening the site abroad would be shown a streak measured against
 * their own midnight rather than the gym's, and could hold two days in one
 * evening by flying east.
 */

/** How one day of the current week reads on the strip. */
export type DayState =
  /** Marked. Includes Sundays, which count as training but not as streak. */
  | "attended"
  /** Open, in the past, not marked — the days that break a streak. */
  | "missed"
  /** No sessions scheduled. Skipped by the streak rather than breaking it. */
  | "closed"
  /** Open, is today, not yet marked. Still winnable. */
  | "today"
  /** Hasn't happened yet. */
  | "future";

export type WeekDay = {
  /** ISO date, `YYYY-MM-DD`, gym-local. Also the React key. */
  readonly key: string;
  /** Single letter for the strip: M T W T F S S. */
  readonly initial: string;
  /** Full name, for the accessible description. */
  readonly label: string;
  readonly state: DayState;
};

export type StreakSummary = {
  /** Consecutive open days marked, counting back from today. */
  readonly current: number;
  /** The longest run ever held. Survives a reset, which is the point. */
  readonly best: number;
  /** Every day ever marked, including Sundays. */
  readonly total: number;
  readonly markedToday: boolean;
  /** Whether the gym runs sessions today at all. */
  readonly openToday: boolean;
  /** Monday to Sunday of the gym's current week. */
  readonly week: readonly WeekDay[];
  /**
   * Set when `current` has just landed exactly on a milestone. Read by the
   * client to decide whether this check-in deserves more than the usual
   * flourish. Null on a plain load, so refreshing the page cannot re-trigger
   * a celebration the member has already had.
   */
  readonly milestone: number | null;
};

/**
 * The runs worth stopping for. Sparse on purpose — a celebration that
 * fires every day is wallpaper, and the gap between 25 and 50 is where the
 * number itself has to do the work.
 */
export const MILESTONES: readonly number[] = [3, 7, 14, 30, 60, 100, 200, 365];
