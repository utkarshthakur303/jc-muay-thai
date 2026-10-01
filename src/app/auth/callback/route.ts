import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType, User } from "@supabase/supabase-js";

import {
  MEMBER_COOKIE,
  MEMBER_COOKIE_MAX_AGE,
  encodeMember,
  memberCookieOptions,
  memberDisplayFrom,
} from "@/lib/auth/memberCookie";
import { createClient } from "@/lib/supabase/server";

/**
 * Single landing point for every auth redirect: Google OAuth, email
 * confirmation, and password-reset links.
 *
 * Supabase uses two different mechanisms depending on the flow, so both
 * are handled here:
 *   - `code`                  -> OAuth / PKCE, exchanged for a session
 *   - `token_hash` + `type`   -> email links (signup confirm, recovery)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  /**
   * Guard against an open redirect via the `next` parameter.
   *
   * The fallback is the site, not the account page — a confirmed email or
   * a completed Google sign-in should return someone to what they were
   * looking at, and the top bar's account chip is the confirmation that it
   * worked.
   *
   * Password recovery deliberately overrides this by passing its own
   * `next`, because a reset link that drops someone on the home page has
   * stranded them. That destination — /account/password — is not built
   * yet, so recovery links used to 404 after a successful verification —
   * the page exists now, and this is the only thing that points at it.
   * The fault is the missing page, not this fallback; changing the
   * fallback would hide it rather than fix it.
   */
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  // Google returns its own error params when a user cancels the consent screen.
  const providerError = searchParams.get("error");
  if (providerError) {
    const reason =
      providerError === "access_denied" ? "cancelled" : "oauth";
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }

  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await writeMemberCookie(data.user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      await writeMemberCookie(data.user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  /**
   * Reaching here means the link was malformed, already consumed, or
   * expired. Supabase confirmation links are single-use, so a second click
   * lands here — the message on /login explains that rather than showing a
   * bare failure.
   */
  return NextResponse.redirect(`${origin}/login?error=link`);
}

/**
 * Writes the display cookie on this redirect, the same way signIn does.
 *
 * Leaving it to the proxy on the next request looked sufficient and was
 * not. The next request is almost always for `/`, which is static, and a
 * browser that has seen the site before revalidates it with If-None-Match.
 * Vercel answers that with a 304 and drops the proxy's Set-Cookie, so the
 * page painted "Sign in" and only a later prefetch delivered the cookie —
 * after the pre-paint script and the chip had both already read it.
 * Measured on production 2026-10-01: a 200 carried the cookie, a 304 with
 * the same session did not.
 *
 * This response is a route handler's, never cached, and the session cookie
 * already rides on it — so the display cookie arrives with it.
 */
async function writeMemberCookie(user: User | null): Promise<void> {
  if (!user) return;
  const store = await cookies();
  store.set({
    name: MEMBER_COOKIE,
    value: encodeMember(memberDisplayFrom(user)),
    ...memberCookieOptions(MEMBER_COOKIE_MAX_AGE),
  });
}
