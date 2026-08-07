import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

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
   * yet, so recovery links currently 404 after a successful verification.
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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
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
