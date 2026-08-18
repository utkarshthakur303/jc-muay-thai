/**
 * The cookie that has already seen the panel's welcome.
 *
 * The greeting plays on the first admin page of a browser session and not
 * again, and this is what remembers that. It carries no value worth
 * reading — its presence is the whole message — and nothing is authorised
 * by it: forging it skips an animation.
 *
 * WHY A COOKIE RATHER THAN sessionStorage. The obvious version keeps the
 * flag in the browser and checks it in a pre-paint script, the way the
 * theme and the member chip do. Both of those exist because the page they
 * run on is statically generated and must not ask the server anything.
 * Nothing under /admin is static — every route there is already rendered
 * per request behind an auth check — so the server can simply be told, and
 * the greeting is then either in the HTML or it is not.
 *
 * That difference is not only tidier. React does not execute a <script>
 * tag when it renders a component on the client, so a script sitting next
 * to the markup would run on a full page load and be silently skipped on
 * every client-side navigation between two admin routes — the exact
 * transition the once-per-session rule has to survive.
 *
 * WHY IT HOLDS TWO VALUES RATHER THAN JUST EXISTING. The obvious version
 * was: no cookie means greet, and the response plants one. It cannot
 * work, and the reason was measured rather than reasoned about. A cookie
 * set on the middleware's response is visible to `cookies()` in the SAME
 * render — three requests to a route behind the proxy, with the page
 * printing what it saw:
 *
 *     request sends nothing  → proxy writes "1"  → page saw "1"
 *     request sends "new"    → proxy writes none → page saw "new"
 *     request sends "seen"   → proxy writes none → page saw "seen"
 *
 * So a page gated on absence would never have rendered the greeting at
 * all: the flag meant to be planted for the NEXT request is already
 * there for this one.
 *
 * The two values step the state forward instead. The proxy writes
 * {@link ADMIN_WELCOME_NEW} when there is no cookie and
 * {@link ADMIN_WELCOME_SEEN} when it finds a `new`; the page greets
 * unless it reads `seen`.
 *
 * Written that way round on purpose. If a future Next.js stops
 * surfacing middleware cookies to the same render, the first request
 * reads *nothing*, which this still treats as "greet" — the failure is
 * one extra greeting on the second page view, not a feature that
 * silently stops working.
 */

export const ADMIN_WELCOME_COOKIE = "jc-admin-welcomed";

/** Planted on the first admin request of a session. The page greets. */
export const ADMIN_WELCOME_NEW = "new";

/** Set on the next request. The page is silent from here on. */
export const ADMIN_WELCOME_SEEN = "seen";

/**
 * No `maxAge`, so this is a session cookie: it dies with the browser and
 * the owner is greeted again next time he opens the panel. That is the
 * behaviour being asked for — an arrival, not a one-off.
 *
 * Scoped to /admin because that is the only place it means anything, and
 * httpOnly because unlike the member display cookie nothing in the browser
 * has any reason to read it. Secure keyed on NODE_ENV, matching
 * memberCookie.ts and cookieOptions.ts so the three cannot disagree about
 * what "production" means.
 */
export function adminWelcomeCookieOptions() {
  return {
    path: "/admin",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  } as const;
}
