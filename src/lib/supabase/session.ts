import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { secureCookieOptions } from "@/lib/supabase/cookieOptions";
import {
  MEMBER_COOKIE,
  MEMBER_COOKIE_MAX_AGE,
  encodeMember,
  memberCookieOptions,
  memberDisplayFrom,
} from "@/lib/auth/memberCookie";

/** Routes that require a signed-in user. Prefix match. */
const PROTECTED_PREFIXES = ["/account", "/admin", "/book"] as const;

/** Auth routes a signed-in user should be bounced away from. */
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"] as const;

/**
 * Reconciles the display cookie against the real session on every request.
 *
 * This is the *safety net*, not the primary writer. The sign-in and
 * sign-out actions set and clear the cookie themselves, because the
 * navigation that follows a server action's redirect is performed by
 * Next's client router and does not reliably reach this code — which is
 * exactly how a member ended up signed in and still being shown "Sign in".
 *
 * What this catches is everything else: the OAuth callback, an email
 * confirmation link, a session that expired in a background tab, and a
 * cookie someone forged by hand.
 *
 * Writes only on change. In the steady state — every request after the
 * first — this adds no Set-Cookie header at all.
 */
function syncMemberCookie(
  request: NextRequest,
  response: NextResponse,
  user: User | null,
): void {
  const desired = user ? encodeMember(memberDisplayFrom(user)) : null;
  const current = request.cookies.get(MEMBER_COOKIE)?.value ?? null;

  if (desired === current) return;

  response.cookies.set({
    name: MEMBER_COOKIE,
    // An immediate expiry rather than .delete(), so clearing and setting go
    // through one code path with one set of attributes. A delete whose path
    // does not match the original silently leaves the cookie behind.
    value: desired ?? "",
    ...memberCookieOptions(desired === null ? 0 : MEMBER_COOKIE_MAX_AGE),
  });
}

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
            response.cookies.set(name, value, secureCookieOptions(options));
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
  let user: User | null = null;
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
    const redirectResponse = NextResponse.redirect(url);
    syncMemberCookie(request, redirectResponse, user);
    return redirectResponse;
  }

  /**
   * Already signed in and asking for a sign-in page. This lands on
   * /account, not on the home page, and the difference from the
   * post-sign-in redirect is intentional: completing a sign-in means
   * "carry on browsing", so it returns to the site, while arriving at
   * /login with a live session means "you are already in" — and the useful
   * answer to that is the account itself. It is also what the mobile bar's
   * Book button relies on; sending it home would bounce a member back to
   * the page they pressed it from.
   */
  if (user && AUTH_ROUTES.includes(pathname as (typeof AUTH_ROUTES)[number])) {
    const url = request.nextUrl.clone();
    url.pathname = "/account";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    syncMemberCookie(request, redirectResponse, user);
    return redirectResponse;
  }

  syncMemberCookie(request, response, user);
  return response;
}
