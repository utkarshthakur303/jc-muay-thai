import { z } from "zod";

import { emailSchema, type FormState } from "@/lib/validation/fields";

/** Re-exported so existing auth imports keep working unchanged. */
export { emailSchema };

/**
 * 8 characters minimum. Deliberately no character-class rules: NIST
 * SP 800-63B advises against composition requirements, which push people
 * toward predictable substitutions like "Passw0rd!" without adding real
 * entropy. Length and a breach check do more.
 */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Passwords are limited to 72 characters");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your name")
    .max(80, "That name is too long"),
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

/**
 * Setting a password from a recovery link, or from the account page.
 *
 * No current-password field, and it cannot have one: the person arriving
 * from a reset email is here precisely because they do not know it. What
 * stands in for it is the session, which only exists because they opened a
 * link sent to their own inbox.
 *
 * The confirmation field is not ceremony. This is the one form on the site
 * where a typo is unrecoverable in the ordinary way — you would be locked
 * out by a password you never knowingly chose, and the only way back is
 * another reset email.
 */
export const setPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Repeat the new password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Those two passwords do not match",
    path: ["confirmPassword"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

/** Shape returned by every auth server action, consumed by useActionState. */
export type AuthFormState = FormState;

export const initialAuthState: AuthFormState = { status: "idle" };
