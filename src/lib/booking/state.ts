/**
 * The shape booking actions return, and its initial value.
 *
 * Separate from actions.ts for a hard reason, not a stylistic one: a
 * `"use server"` module may export *only* async functions. Every export in
 * such a file becomes a callable RPC endpoint, so a plain object has no
 * meaning there — and Next does not merely ignore it, it refuses to
 * evaluate the module at all. That takes down every action in the app,
 * including ones in other files, and it does so at request time: `tsc` and
 * `next build` both pass, and the first sign that anything is wrong is a
 * button that does nothing.
 *
 * The auth actions have always followed this rule by keeping
 * `initialAuthState` in lib/validation. This is the same rule, written
 * down where the next person will look.
 */

export type BookingState = {
  status: "idle" | "success" | "error";
  message?: string;
  /**
   * Which action produced this, so the client can celebrate a booking and
   * merely acknowledge a cancellation.
   *
   * Carried explicitly rather than inferred from `message`. The alternative
   * — matching on the copy — makes the toast silently pick the wrong tone
   * the first time someone rewords a sentence, and nothing about editing a
   * string suggests you are editing behaviour.
   */
  intent?: "book" | "cancel";
};

export const initialBookingState: BookingState = { status: "idle" };
