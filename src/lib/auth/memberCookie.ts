import type { User } from "@supabase/supabase-js";

/**
 * The display cookie: who this browser is signed in as, written in a form
 * the page can read before it paints.
 *
 * It exists to solve one problem. The home page is statically generated
 * and served from the CDN, which is the property the whole architecture is
 * built around. A top bar that asked the server who the visitor was would
 * make that page render per request and lose its cache — on the one page
 * that carries all the traffic. A top bar that waited for React to hydrate
 * would show every returning member "Sign in" for a frame or two on every
 * single load.
 *
 * So the proxy — which already resolves the user on every request in order
 * to refresh the session — writes the answer down here, and a pre-paint
 * script reads it. One cached HTML document for everyone, and the correct
 * control on the first frame.
 *
 * Three deliberate properties:
 *
 * 1. **Not httpOnly.** It has to be readable by a script that runs before
 *    paint. That is the entire point of it.
 *
 * 2. **Display only.** Nothing is authorised by this cookie. Every
 *    protected route still re-checks the session against the auth server
 *    with getUser(). Someone who forges it shows themselves a name in
 *    their own browser and gains nothing — which is why it being readable
 *    and writable is not a weakness.
 *
 * 3. **Not a second source of truth.** The proxy rewrites it from the real
 *    session on every request, so it cannot drift; if it is ever wrong it
 *    is wrong for exactly one request.
 *
 * It carries the member's own name and email, in the member's own browser,
 * over SameSite=Lax. The Supabase session cookie sitting beside it already
 * contains the same email inside the JWT.
 */

export const MEMBER_COOKIE = "jc-member";

/**
 * Shared by everything that writes this cookie — the proxy and the sign-in
 * action — so the two can never disagree on scope. A cookie set at one path
 * and cleared at another is not cleared at all.
 *
 * Not httpOnly, deliberately: a script has to read it before first paint.
 * That is safe because nothing is authorised by it; see the note above.
 */
export function memberCookieOptions(maxAge: number) {
  return {
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  } as const;
}

/**
 * A week. The value is refreshed on every request, so this only governs
 * how long a closed tab may sit before the chip falls back to the
 * signed-out state — which the next request corrects either way.
 */
export const MEMBER_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** Bounds, so a hostile display name cannot inflate every request header. */
const MAX_NAME = 64;
const MAX_EMAIL = 128;

export type MemberDisplay = {
  name: string | null;
  email: string;
};

/**
 * Plain JSON, deliberately *not* percent-encoded.
 *
 * Next's cookie serializer runs encodeURIComponent over every value on the
 * way out and decodes it again on `request.cookies.get()`. Encoding here as
 * well produced a doubly-encoded cookie that survived exactly one decode
 * and then failed to parse — so the browser held a perfectly good cookie
 * that the page read as "signed out", and the change-guard, comparing two
 * singly-decoded strings, saw no difference and never corrected it.
 *
 * Transport encoding belongs to the transport. The only caller that has to
 * think about it is the browser-side reader below, because `document.cookie`
 * hands back the raw wire value without decoding anything.
 *
 * Keys are single letters because this rides on every same-origin request.
 */
export function encodeMember(member: MemberDisplay): string {
  return JSON.stringify({
    n: member.name ? member.name.slice(0, MAX_NAME) : null,
    e: member.email.slice(0, MAX_EMAIL),
  });
}

/**
 * Takes an already-decoded cookie value — what `request.cookies.get()`
 * returns on the server, and what {@link readMemberCookie} produces in the
 * browser.
 *
 * Returns null for anything it did not write. A malformed value is treated
 * as signed out rather than trusted or repaired.
 */
export function decodeMember(
  raw: string | undefined | null,
): MemberDisplay | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { n, e } = parsed as { n?: unknown; e?: unknown };
    if (typeof e !== "string") return null;

    return {
      name: typeof n === "string" && n.trim().length > 0 ? n.trim() : null,
      email: e,
    };
  } catch {
    return null;
  }
}

/**
 * The one place that decides what a member is called. Supabase puts the
 * name under `full_name` for email signups and `name` for Google, so both
 * are checked — and both are user-supplied strings arriving through
 * `user_metadata`, which is typed as an index signature and must be
 * narrowed rather than asserted.
 */
export function memberDisplayFrom(user: User): MemberDisplay {
  const meta: Record<string, unknown> = user.user_metadata ?? {};
  const raw = meta.full_name ?? meta.name;

  return {
    name: typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null,
    email: user.email ?? "",
  };
}

/** Browser-side read. Returns null on the server, where there is no
 *  document — callers must therefore treat it as an effect, not as
 *  render-time data, or the markup will not match. */
export function readMemberCookie(): MemberDisplay | null {
  if (typeof document === "undefined") return null;

  // Prefixing with "; " lets one indexOf handle the first cookie and the
  // rest identically, and stops `xjc-member=` from matching `jc-member=`.
  const haystack = `; ${document.cookie}`;
  const marker = `; ${MEMBER_COOKIE}=`;
  const start = haystack.indexOf(marker);
  if (start === -1) return null;

  const from = start + marker.length;
  const end = haystack.indexOf(";", from);
  const wire = end === -1 ? haystack.slice(from) : haystack.slice(from, end);

  /**
   * `document.cookie` returns the wire value verbatim — unlike the server,
   * where Next decodes it for us. This is the one place the percent
   * encoding has to be undone by hand, and it is why encodeMember must not
   * do any of its own.
   */
  try {
    return decodeMember(decodeURIComponent(wire));
  } catch {
    // Malformed percent escapes throw rather than returning garbage.
    return null;
  }
}
