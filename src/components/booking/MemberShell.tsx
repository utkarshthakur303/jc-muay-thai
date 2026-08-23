import Link from "next/link";

import { BookingToastProvider } from "@/components/booking/BookingToast";
import { site } from "@/content/site";

/**
 * Frame shared by /book and /account.
 *
 * They are two halves of one thing — what you can book, and what you have
 * booked — so they share a header and a pair of tabs rather than each
 * being an island with its own way back to the site. Declared once so the
 * two cannot drift apart visually.
 */

const TABS = [
  { href: "/book", label: "Book a class" },
  { href: "/account", label: "Your classes" },
] as const;

/**
 * The count on the "Your classes" tab.
 *
 * It is here rather than only on /account because a member who has just
 * booked something needs to see that it landed somewhere, from the page
 * they booked it on. A tab that reads "Your classes 3" is the shortest
 * honest statement of that.
 *
 * Hidden at zero. A grey 0 beside a tab is a control advertising its own
 * emptiness, and /account already says "Nothing booked yet" properly.
 *
 * The digit is `aria-hidden` with the sentence beside it, because "3" read
 * out after "Your classes" could be a keyboard shortcut, a position in a
 * list, or a count of anything.
 */
function TabCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={`ml-2 flex min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[10px] leading-4 ${
        // Inverted on the active tab, which is already an accent fill —
        // accent on accent would be an invisible badge.
        active ? "bg-ink text-accent" : "bg-accent text-ink"
      }`}
    >
      <span aria-hidden>{count}</span>
      <span className="sr-only">
        {count} {count === 1 ? "class" : "classes"} booked
      </span>
    </span>
  );
}

/**
 * How wide the column runs.
 *
 * `prose` is the original and stays the default: /book and /account are
 * lists and forms, which are read line by line and get harder to follow
 * the wider they are set.
 *
 * `wide` exists for /plans, where the content is four cards side by side
 * and a 768px column stacked them two-up with the page's whole right half
 * empty. Bounded by the site's own `--layout-max-width` rather than by a
 * new number, so the plans page ends up exactly as wide as the home page
 * and a future change to that token moves both.
 */
const WIDTH: Record<"prose" | "wide", string> = {
  prose: "max-w-3xl",
  wide: "max-w-[var(--layout-max-width)]",
};

export function MemberShell({
  current,
  heading,
  upcomingCount = 0,
  width = "prose",
  children,
}: {
  /**
   * "/plans" is not one of the tabs, and passing it hides them rather than
   * marking none.
   *
   * That page stands in front of /book for a member who has not answered
   * yet, and /book sends them straight back to it. A "Book a class" tab
   * showing there would be a control that visibly does nothing when
   * pressed — which is precisely the kind of thing the mockup's fake
   * booking drawer was deleted for.
   */
  current: "/book" | "/account" | "/plans";
  heading: string;
  /** Classes the member has coming up. Shown on the "Your classes" tab. */
  upcomingCount?: number;
  /** See WIDTH above. Defaults to the reading column. */
  width?: "prose" | "wide";
  children: React.ReactNode;
}) {
  /**
   * The toast provider sits here rather than on either page, because both
   * pages can book and cancel — /book from the calendar, /account from the
   * Coming up list — and a confirmation that appears on one and not the
   * other is the kind of inconsistency nobody reports and everybody feels.
   */
  return (
    <BookingToastProvider>
      <main
        className={`mx-auto w-full px-5 py-14 sm:px-8 lg:py-20 ${WIDTH[width]}`}
      >
        <Link
          href="/"
          className="font-mono text-[11px] tracking-widest text-text-2 uppercase transition-colors hover:text-accent-strong"
        >
          ← {site.name}
        </Link>

        <h1 className="mt-6 font-display text-4xl tracking-wide text-text sm:text-5xl">
          {heading.toUpperCase()}
        </h1>

        <nav
          aria-label="Member area"
          className={`mt-8 ${current === "/plans" ? "hidden" : ""}`}
        >
          <ul role="list" className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const active = tab.href === current;
              const showCount =
                tab.href === "/account" && upcomingCount > 0;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-full border px-5 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors ${
                      active
                        ? "border-accent bg-accent text-ink"
                        : "border-border text-text-2 hover:border-accent hover:text-accent-strong"
                    }`}
                  >
                    {tab.label}
                    {showCount ? (
                      <TabCount count={upcomingCount} active={active} />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {children}
      </main>
    </BookingToastProvider>
  );
}
