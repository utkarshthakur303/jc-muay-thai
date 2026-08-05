import { z } from "zod";

/**
 * Field rules and the form-state contract shared by every server action.
 *
 * Both live here rather than beside the first form that needed them: the
 * contact form validates an email address to exactly the same rules the
 * sign-up form does, and if they were declared twice they would eventually
 * disagree — one accepting an address the other rejects, on the same site.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .email("That doesn't look like a valid email address")
  .max(254, "That email address is too long");

/**
 * The shape every server action returns and every form consumes through
 * useActionState.
 *
 * `values` matters more than it looks: without echoing the submitted input
 * back, a failed submit clears the form, and someone who has just typed a
 * paragraph into the contact box loses it over a mistyped email address.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** Field-level errors keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Values echoed back so the form does not clear on a failed submit. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

/** First error per field, in the shape the form components expect. */
export function fieldErrorsFrom(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in result)) {
      result[key] = issue.message;
    }
  }
  return result;
}
