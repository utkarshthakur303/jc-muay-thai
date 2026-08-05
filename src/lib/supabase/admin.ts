import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Supabase client authenticated with the secret key.
 *
 * This bypasses row-level security entirely. It exists so the
 * contact_messages table can have RLS enabled and *no policies at all* —
 * the tightest configuration available. Nothing holding the publishable
 * key, which every visitor has, can read an enquiry, insert one directly,
 * or count them; the only route in is the server action, which is also
 * where the rate limit lives. Had the table instead allowed anonymous
 * inserts, that rate limit would be trivially bypassable by posting to
 * PostgREST directly.
 *
 * Two consequences worth stating plainly:
 *   - Never import this from a Client Component. It is server-only, and
 *     the key must never reach a bundle.
 *   - Never use it for anything a signed-in member does. Authorisation for
 *     member actions comes from their own session via lib/supabase/server,
 *     which RLS then enforces. Reaching for this client there would
 *     silently disable every policy protecting their data.
 *
 * Returns null rather than throwing when the key is unset, so a
 * misconfigured deploy produces one honest error message on one form
 * instead of a crashed page.
 */
export function createAdminClient(): SupabaseClient | null {
  const { SUPABASE_SECRET_KEY } = serverEnv();
  if (!SUPABASE_SECRET_KEY) return null;

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
      auth: {
        // No user session is involved, so there is nothing to persist or
        // refresh. Leaving these on would have the client writing token
        // state on a server that handles every visitor.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
