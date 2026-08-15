/**
 * What the admin actions hand back, and its initial value.
 *
 * A separate module from actions.ts for the same hard reason as
 * `lib/booking/state.ts`: a `"use server"` file may export only async
 * functions. A `const` in there is not ignored — Next refuses to evaluate
 * the module, every server action in the app stops responding, and both
 * `tsc` and `next build` pass while it happens.
 */

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  /**
   * How many people were told, when a cancellation went out.
   *
   * Carried so the panel can say "12 members emailed" or, just as
   * importantly, "nobody could be emailed" — the gym needs to know which
   * of those happened before it decides whether to text anyone.
   */
  notified?: number;
  /**
   * True when the class was cancelled but the emails did not go. The
   * cancellation itself still succeeded; this is what stops the panel
   * reporting an unqualified success it cannot vouch for.
   */
  notifyFailed?: boolean;
};

export const initialAdminState: AdminActionState = { status: "idle" };
