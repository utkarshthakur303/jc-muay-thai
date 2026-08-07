/**
 * Where a visitor goes after authenticating, and the one rule that decides
 * whether a `next` value is allowed to send them there.
 *
 * This lives on its own because four places need it — the sign-in action,
 * the login page, the sign-up page and the auth callback — and a rule
 * against open redirects that is written four times is a rule that will
 * eventually be written three times correctly.
 */

/**
 * The default destination: the site, not the account page.
 *
 * Almost everyone signing in came from the home page and wants to carry on
 * where they were. The account page is a settings screen, and dropping
 * someone on it makes them navigate back out of somewhere they never asked
 * to go. The top bar's chip is the confirmation that it worked.
 *
 * Anyone who *was* headed somewhere protected still gets there: the proxy
 * puts the original path in `?next=`, every auth surface forwards it, and
 * it overrides this.
 */
export const DEFAULT_AFTER_AUTH = "/";

/**
 * Accepts only same-origin absolute paths.
 *
 * Without this check, `?next=https://evil.example` turns every auth screen
 * on the site into an open redirect — a phishing primitive that borrows
 * this domain's credibility to land someone on a lookalike login form.
 *
 * The `//` case is the one that gets missed: `//evil.example` is a
 * protocol-relative URL. It starts with a slash, so a naive
 * `startsWith("/")` waves it through, and the browser treats it as an
 * absolute address on another host.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_AFTER_AUTH;
  if (!value.startsWith("/")) return DEFAULT_AFTER_AUTH;
  if (value.startsWith("//")) return DEFAULT_AFTER_AUTH;
  // Backslashes are normalised to forward slashes by some browsers, so
  // "/\evil.example" can escape the same way "//" does.
  if (value.startsWith("/\\")) return DEFAULT_AFTER_AUTH;
  return value;
}

/** Appends `?next=` only when it is worth carrying. */
export function withNext(path: string, next: string): string {
  if (next === DEFAULT_AFTER_AUTH) return path;
  return `${path}?next=${encodeURIComponent(next)}`;
}
