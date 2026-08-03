import { z } from "zod";

/**
 * Every environment variable the app reads must be declared here.
 * Validation runs once at module load so a missing key fails the build
 * loudly instead of surfacing as a confusing runtime error in production.
 */

const PLACEHOLDER_HOST = "placeholder.supabase.co";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  /**
   * The `sb_publishable_*` key (formerly "anon"). Safe to ship to the
   * browser — every table is protected by row-level security.
   */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

/**
 * Referenced explicitly rather than via a loop: Next.js inlines
 * `process.env.NEXT_PUBLIC_*` at build time only for statically
 * analysable member expressions.
 */
const parsedPublic = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsedPublic.success) {
  const missing = parsedPublic.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid or missing environment variables:\n${missing}\n\n` +
      `Copy .env.local.example to .env.local and fill it in. ` +
      `See SETUP-AUTH.md for where each value comes from.`,
  );
}

export const env = parsedPublic.data;

/**
 * True while the app is running against placeholder credentials. Used to
 * surface an unmistakable warning in the UI rather than letting sign-in
 * fail with an opaque network error.
 */
export const isSupabaseConfigured = !env.NEXT_PUBLIC_SUPABASE_URL.includes(
  PLACEHOLDER_HOST,
);
