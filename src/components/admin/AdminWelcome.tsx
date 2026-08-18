import { cookies } from "next/headers";

import { site } from "@/content/site";
import { ADMIN_WELCOME_COOKIE, ADMIN_WELCOME_SEEN } from "@/lib/admin/welcome";

/**
 * The panel's arrival: a full-bleed veil carrying the gym's name, a
 * greeting and an accent rule, which clears itself after 1.6s.
 *
 * It exists because the owner's half of this site had no arrival of its
 * own — signing in dropped him onto a page of numbers that looked like
 * every other page, on a panel he reaches by typing a URL nothing links
 * to.
 *
 * How it looks and how it leaves is in globals.css under ADMIN WELCOME,
 * including why it never takes a pointer event, why it is aria-hidden,
 * and why a reduced-motion preference removes it outright rather than
 * freezing it. What lives here is the once-a-session decision, and it is
 * made on the server: the cookie the proxy steps forward on each admin
 * request is the whole mechanism. Anything but `seen` — including no
 * cookie at all — greets. See lib/admin/welcome.ts for why it is a
 * cookie rather than sessionStorage, and why it holds two values.
 *
 * Rendering nothing is the point — a greeting that is not in the HTML
 * cannot flash, cannot be hidden late, and costs the second page view
 * nothing.
 *
 * THE GREETING IS GENERIC ON PURPOSE. The owner's account was created
 * from the Supabase dashboard and carries no `full_name`, so a
 * personalised line would read "Welcome back," followed by an email
 * address — or by nothing at all.
 */
export async function AdminWelcome() {
  const store = await cookies();
  if (store.get(ADMIN_WELCOME_COOKIE)?.value === ADMIN_WELCOME_SEEN)
    return null;

  return (
    <div aria-hidden className="admin-welcome">
      <p className="admin-welcome-rise font-mono text-[11px] tracking-[0.32em] text-text-3 uppercase">
        {site.name}
      </p>

      {/*
        The stagger is an animationDelay on the element rather than three
        near-identical utilities, as on the class-load chart's bars. The
        reduced-motion block in globals.css zeroes every delay with
        !important, which beats an inline style.
      */}
      <p
        className="admin-welcome-rise font-display text-5xl tracking-wide text-text sm:text-7xl"
        style={{ animationDelay: "90ms" }}
      >
        WELCOME, ADMIN
      </p>

      <span
        className="admin-welcome-rule"
        style={{ animationDelay: "240ms" }}
      />
    </div>
  );
}
