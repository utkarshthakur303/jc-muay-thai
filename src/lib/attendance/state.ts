/**
 * The shape the goal action returns, and its initial value.
 *
 * Separate from actions.ts for the hard reason, not a stylistic one: a
 * `"use server"` module may export *only* async functions. A plain object
 * there takes down every action in the app at request time, and both
 * `tsc` and `next build` pass it. Same rule as lib/booking/state.ts and
 * lib/plans/state.ts; written down here so the next person finds it.
 */

export type GoalActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialGoalState: GoalActionState = { status: "idle" };
