import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import { secureCookieOptions } from "@/lib/supabase/cookieOptions";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Must be created per-request — never hoisted to module scope, or one
 * visitor's session would leak into another's response.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, secureCookieOptions(options));
            }
          } catch {
            // Server Components cannot set cookies. This is expected and
            // harmless: the proxy refreshes the session on every request,
            // so the cookie is already current by the time we get here.
          }
        },
      },
    },
  );
}

/**
 * Returns the signed-in user, or null.
 *
 * Always uses getUser() rather than getSession(): getSession() reads the
 * cookie without verifying it against the auth server, so a forged cookie
 * would pass. Never make an authorisation decision from getSession().
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
