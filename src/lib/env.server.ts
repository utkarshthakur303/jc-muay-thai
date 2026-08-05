import { z } from "zod";

/**
 * Server-only environment variables.
 *
 * Separate from lib/env.ts because that module is imported by the browser
 * Supabase client, and anything it touches is reachable from the client
 * bundle. Nothing here may ever be imported from a Client Component.
 *
 * Validation is lazy rather than at module load, unlike the public schema.
 * Every value below is optional and only some code paths need them, so
 * failing the build over an unset RESEND_API_KEY would block a deploy that
 * is otherwise entirely correct — the contact form stores the message
 * either way and only the notification email waits on the key.
 */

/**
 * Vercel and .env files both surface an unset variable as an empty string
 * rather than undefined, and `z.string().min(1).optional()` rejects "".
 * Normalising first is what makes "declared but blank" mean "not set",
 * which is what it means to everyone reading the file.
 */
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().email().optional(),
);

const serverSchema = z.object({
  /**
   * The `sb_secret_*` key. Bypasses row-level security completely, which
   * is precisely why the contact table needs no policies at all: nothing
   * but this key can read or write it.
   */
  SUPABASE_SECRET_KEY: optionalString,

  /** Resend API key. Absent → enquiries are stored but not emailed on. */
  RESEND_API_KEY: optionalString,
  /** Verified sender, e.g. noreply@jcmuaythai.com. Questionnaire Q1.9. */
  CONTACT_FROM_EMAIL: optionalEmail,
  /** Where enquiry notifications land. Questionnaire Q1.10. */
  CONTACT_NOTIFICATION_EMAIL: optionalEmail,
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  // Referenced explicitly, not via a loop: bundlers only substitute
  // statically analysable `process.env.X` member expressions.
  const parsed = serverSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL,
    CONTACT_NOTIFICATION_EMAIL: process.env.CONTACT_NOTIFICATION_EMAIL,
  });

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment variables:\n${detail}`);
  }

  cached = parsed.data;
  return cached;
}
