import type { CookieOptions } from "@supabase/ssr";

/**
 * Hardens the cookie attributes Supabase asks us to write.
 *
 * `@supabase/ssr` hands `setAll` a set of options and leaves transport
 * security to the host application, which meant the session cookie was
 * going out without `Secure` — verified on the deployed site, where
 * `sb-<ref>-auth-token` read `secure=false` while our own `jc-member`
 * cookie read `secure=true`. Without the flag a browser will send the
 * session token over plain HTTP, and a session token is the whole account.
 *
 * In practice the deployment is also protected by HSTS
 * (`max-age=63072000; includeSubDomains; preload`), which tells the
 * browser never to speak HTTP to this host at all. That is the stronger
 * control and it is already in place. This is the belt to its braces, and
 * it is worth having because HSTS is a response header on one host: move
 * to a custom domain, or lose the header in a config change, and the flag
 * is what is still standing.
 *
 * `httpOnly` is deliberately NOT forced. Supabase's browser client reads
 * this cookie through `document.cookie` to restore a session on load, so
 * making it httpOnly signs everybody out on the client. That is the
 * library's design, not an oversight here — and it means script on this
 * origin can read the session, which is one more reason the sanitisation
 * rules on user content are not optional.
 *
 * Keyed on NODE_ENV rather than the request protocol, matching
 * lib/auth/memberCookie.ts so the two cannot disagree about what
 * "production" means. The cost is that `next start` over plain
 * http://localhost cannot hold a session — correct behaviour, and a thing
 * to remember before debugging a local production build for an hour.
 */
export function secureCookieOptions(
  options: CookieOptions = {},
): CookieOptions {
  if (process.env.NODE_ENV !== "production") return options;
  return { ...options, secure: true };
}
