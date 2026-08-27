import { z } from "zod";

import { passwordSchema } from "@/lib/validation/auth";
import type { FormState } from "@/lib/validation/fields";

/**
 * Input rules for the two admin credential forms.
 *
 * Pure schemas, no environment and no network, so they are unit-testable
 * and so the same rule cannot be written twice and drift — the change form
 * and its confirmation step share `newPassword`, and if they disagreed
 * about the minimum length one step would accept what the other refuses.
 */

export const adminSignInSchema = z.object({
  loginId: z.string().trim().min(1, "Enter the admin ID"),
  /**
   * No length rule. This is a comparison against an existing password, not
   * the setting of a new one, and telling an attacker "too short" about a
   * guess is a free bit of information about the real one. Supabase makes
   * the only judgement that matters: right or wrong.
   */
  password: z.string().min(1, "Enter the password"),
});

/**
 * Supabase mails a 6-digit numeric token under the default template, but
 * the template is editable in the dashboard and a stricter rule here would
 * reject a valid code the moment someone customises it. Bounded rather
 * than exact, whitespace trimmed because codes get pasted with a trailing
 * space out of an email client. Supabase decides whether it is correct.
 */
const verificationCodeSchema = z
  .string()
  .trim()
  .min(6, "Enter the code from your email")
  .max(12, "That code is longer than any we send");

const passwordPair = {
  /**
   * Required even though the session already proves admin. A session is
   * something a borrowed laptop also has; the current password is not.
   * It is also what makes the email code a genuine second factor rather
   * than the only one.
   */
  currentPassword: z.string().min(1, "Enter the current password"),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, "Repeat the new password"),
};

/**
 * The cross-field rules, written once and attached to both steps.
 *
 * Declared as a plain function over the three password fields rather than
 * as a generic wrapper around a schema. The wrapper version could not
 * name its own input — a generic constrained only to "some Zod type" has
 * an `unknown` output, so the callbacks had nothing to read — and the
 * step-two schema carries an extra `code` field the step-one schema does
 * not, so there is no single object type to make it generic over. A
 * callback that accepts the three fields both schemas share is checked
 * against each of them and stays honest about what it looks at.
 *
 * `currentPassword` here is only the value submitted, not proof of
 * anything. The real check is a sign-in attempt in the action; this
 * catches the obvious case early, before an email goes out.
 */
function checkPasswordRules(
  value: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
  ctx: z.RefinementCtx,
): void {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: "custom",
      message: "Those two passwords do not match",
      path: ["confirmPassword"],
    });
  }

  if (value.newPassword === value.currentPassword) {
    ctx.addIssue({
      code: "custom",
      message: "That is the password you are already using",
      path: ["newPassword"],
    });
  }
}

/** Step one: choose a new password and ask for a code. */
export const adminPasswordRequestSchema = z
  .object(passwordPair)
  .superRefine(checkPasswordRules);

/** Step two: the same fields, plus the code that arrived by email. */
export const adminPasswordConfirmSchema = z
  .object({ ...passwordPair, code: verificationCodeSchema })
  .superRefine(checkPasswordRules);

export type AdminAuthFormState = FormState;

export const initialAdminAuthState: AdminAuthFormState = { status: "idle" };

/**
 * Which half of the password change is on screen.
 *
 * Carried inside the form state rather than held as separate `useState`
 * beside it. Two sources of truth for "which step" is how a form ends up
 * showing the code field with the error from the password field still
 * under it — the action decides, and the step travels with the decision.
 */
export type AdminPasswordStep = "choose" | "verify";

export type AdminPasswordState = FormState & { step: AdminPasswordStep };

export const initialAdminPasswordState: AdminPasswordState = {
  status: "idle",
  step: "choose",
};
