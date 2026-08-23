import { MILESTONES } from "@/lib/attendance/types";

/**
 * The rules around a member's streak goal, and nothing else.
 *
 * Pure — a number in, a decision out, no clock and no database. Type-only
 * imports, so this is safe in a client bundle: the form needs the bounds
 * to write `min` and `max` on its input, and duplicating 2 and 365 into
 * the markup is how the field and the constraint drift apart.
 *
 * WHAT A GOAL MEANS HERE
 *
 * Consecutive OPEN days. The gym runs Monday to Saturday and the streak
 * steps over Sunday, so a goal of 30 is thirty training days — about five
 * calendar weeks, not four. The page says so where the goal is set,
 * because "30 days" read as calendar days is a promise the streak rule
 * does not keep.
 *
 * WHY OUT OF RANGE IS REFUSED RATHER THAN CLAMPED
 *
 * Clamping 500 to 365 stores a goal the member did not choose and shows
 * it back to them as though they had. Refusing costs them one correction
 * and never puts words in their mouth.
 */

/**
 * Two, not one. A goal of a single day is met by the act of setting it,
 * which makes the whole card congratulate somebody for pressing a button.
 */
export const GOAL_MIN = 2;

/**
 * The largest milestone the app celebrates, and already a year without
 * missing an open day. Past this a goal stops being a target and becomes
 * a number nobody will ever see move.
 *
 * Both bounds are repeated in the `member_goals_range` CHECK constraint —
 * see 20260823160000_streak_goals.sql. There are exactly two places, and
 * each comments the other.
 */
export const GOAL_MAX = 365;

export type GoalParse =
  | { readonly ok: true; readonly value: number }
  | {
      readonly ok: false;
      readonly reason: "missing" | "not-a-number" | "out-of-range";
    };

/**
 * A goal out of a form field.
 *
 * The three failures are kept apart because they need three different
 * sentences. "Enter a number" is unhelpful to somebody who entered 500,
 * and "between 2 and 365" is baffling to somebody who entered nothing.
 */
export function parseGoal(raw: unknown): GoalParse {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, reason: "missing" };
  }

  const trimmed = raw.trim();

  // Number() alone accepts "3.5", "1e3", "0x10" and " 12 ", each of which
  // would then be stored as something the member did not type. A goal is
  // a count of days: digits only.
  if (!/^\d+$/.test(trimmed)) return { ok: false, reason: "not-a-number" };

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) return { ok: false, reason: "not-a-number" };
  if (value < GOAL_MIN || value > GOAL_MAX) {
    return { ok: false, reason: "out-of-range" };
  }

  return { ok: true, value };
}

/** The first milestone above `current`, or null once they are all behind. */
export function nextMilestone(current: number): number | null {
  return MILESTONES.find((milestone) => milestone > current) ?? null;
}

export type StreakTarget = {
  readonly value: number;
  /** True when the member set it; false when it is the app's milestone. */
  readonly custom: boolean;
};

/**
 * What the page measures progress against.
 *
 * A member who has set a goal is measured against it. A member who has
 * not is measured against the next milestone, so the card is never empty
 * and never has to invent a target and attribute it to them.
 *
 * Null is a real answer: somebody on a 400-day streak with no goal set
 * has nothing left to aim at, and drawing a full progress bar against a
 * target they passed months ago would be worse than saying so.
 */
export function streakTarget(
  goal: number | null,
  current: number,
): StreakTarget | null {
  if (goal !== null) return { value: goal, custom: true };

  const milestone = nextMilestone(current);
  return milestone === null ? null : { value: milestone, custom: false };
}

/** What to put in the field when it opens. Never blank, never a repeat. */
export function suggestedGoal(current: number, goal: number | null): number {
  if (goal !== null) return goal;
  return nextMilestone(current) ?? GOAL_MAX;
}

/** 0 to 1. Clamped, so a passed goal draws a full bar and never a wider one. */
export function goalProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, current / target));
}

/** How many more open days. Zero once the target is reached or passed. */
export function daysToGo(current: number, target: number): number {
  return Math.max(0, target - current);
}
