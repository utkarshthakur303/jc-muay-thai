import Link from "next/link";

import { BookingMarquee } from "@/components/layout/BookingMarquee";
import { PrimaryCta } from "@/components/layout/PrimaryCta";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LogoMark } from "@/components/ui/Icon";
import { site } from "@/content/site";

/**
 * The utility bar: theme, sign-in, and the primary action.
 *
 * The mockup put a duplicate set of section tabs here, alongside the rail
 * that already showed them, plus a search field. Both are gone.
 *
 * The tabs were removed because two navigations for the same two sections,
 * visible at once, is not redundancy that helps — it is a second thing to
 * keep in sync and a second place for the active state to be wrong.
 *
 * The search field was removed because it searched nothing. A search box
 * on a page with two sections invites people to type a question and
 * receive silence, which costs more trust than the affordance buys. It
 * belongs here when there is an index behind it.
 *
 * What remains is what the rail cannot carry: the theme control, and the
 * route for a member who already has an account.
 */
export function TopBar() {
  return (
    <header className="fixed inset-x-4 top-4 z-30 flex h-16 items-center justify-between gap-3 rounded-4xl border border-border bg-surface-nav px-3 backdrop-blur-[14px] lg:top-6 lg:right-6 lg:left-(--layout-rail-offset) lg:px-4">
      {/* The rail carries the wordmark on desktop; below lg the rail is
          gone, so the brand needs somewhere to live. */}
      <Link
        href="/"
        className="flex items-center gap-2.5 lg:hidden"
        aria-label={`${site.name} — home`}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-ink">
          <LogoMark size={18} />
        </span>
        <span className="font-display text-lg tracking-wide text-text">
          {site.name.toUpperCase()}
        </span>
      </Link>

      {/*
        Fills the space the rail created. Above lg the wordmark moves into
        the rail, which left the whole left half of a 1200px bar empty
        with three controls huddled at the right edge.
      */}
      <BookingMarquee />

      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        <ThemeToggle />

        {/* Signed-in members are redirected from /login to /account by the
            proxy, so this one destination is right for every visitor and
            the page never has to look up a session to render.

            Shown at every width. It used to be hidden below sm, which left
            a returning member on a phone with no way into their account
            from the home page at all — the bottom bar's only account link
            goes to /signup. The narrower padding keeps it inside the bar
            at 320px alongside the wordmark and the theme toggle. */}
        <Link
          href="/login"
          className="flex min-h-11 items-center rounded-full px-2.5 font-mono text-[12px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:text-accent-strong sm:px-4"
        >
          Sign in
        </Link>

        <PrimaryCta className="hidden lg:flex" />
      </div>
    </header>
  );
}
