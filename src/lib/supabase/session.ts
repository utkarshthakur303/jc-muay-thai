import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/** Routes that require a signed-in user. Prefix match. */
const PROTECTED_PREFIXES = ["/account", "/admin"] as const;

/** Auth routes a signed-in user should be bounced away from. */
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"] as const;

/**
 * Refreshes the Supabase auth token on every request and enforces route
 * protection.
 *
 * Supabase access tokens are short-lived. Without a refresh on each
 * request the cookie goes stale and Server Components start seeing a
 * logged-out user even though the member never signed out.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  /**
   * getUser() revalidates the token against the auth server. This call is
   * what actually triggers the refresh — do not replace it with getSession().
   *
   * Wrapped because this runs on every request: an auth-server outage or a
   * DNS failure must not take the public marketing pages down with it. On
   * failure we treat the visitor as signed out, which fails closed —
   * protected routes redirect to login rather than leaking through.
   */
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the destination so we can return the member there after login.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.includes(pathname as (typeof AUTH_ROUTES)[number])) {
    const url = request.nextUrl.clone();
    url.pathname = "/account";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
