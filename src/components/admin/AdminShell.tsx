import Link from "next/link";

import { AdminWelcome } from "@/components/admin/AdminWelcome";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { site } from "@/content/site";

/**
 * Frame for every page under /admin.
 *
 * Deliberately not `MemberShell`. That shell is a member's view of their
 * own membership — two tabs, a booking count, a way back to the marketing
 * site — and none of it means anything to the person running the gym.
 * Sharing it would have meant a growing pile of "hide this when admin"
 * branches inside a component two other pages depend on.
 *
 * Wider than the member pages (`max-w-6xl` against `max-w-3xl`) because
 * this one shows tables. Desktop-first was the client's call, and the
 * reason it still has to work on a phone is that cancelling a class and
 * checking tonight's roster are things done standing in the gym.
 */

/**
 * Grows one entry per phase. Only routes that exist are listed — a nav
 * advertising a page that 404s is worse than a short nav, and every item
 * here is reachable today.
 */
const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/timetable", label: "Timetable" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/enquiries", label: "Enquiries" },
] as const;

export function AdminShell({
  current,
  heading,
  lead,
  children,
}: {
  current: string;
  heading: string;
  /** One line under the heading. Optional — the overview does not need one. */
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    /*
      `admin-surface` re-points the ground for this subtree only —
      cool where the members' side is warm, in both themes. See the
      scoped override in globals.css for the measurements; nothing
      here names a colour.
    */
    <div className="admin-surface min-h-dvh bg-bg">
      <AdminWelcome />

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-mono text-[11px] tracking-widest text-text-2 uppercase transition-colors hover:text-accent-strong"
          >
            ← {site.name}
          </Link>

          {/*
            Marks the account as an admin surface at a glance. The panel
            and the member site share a login, so the only thing telling
            the owner which one he is looking at is the chrome.
          */}
          <span className="rounded-full bg-ink px-3 py-1 font-mono text-[10px] tracking-[0.12em] text-chalk uppercase">
            Admin
          </span>

          {/*
            Beside the badge rather than at the end of the nav, and the
            placement was measured rather than chosen. After the nav it
            cannot share a row with the pills — a <nav> is one flex item
            whose list wraps inside itself — so it started a fourth row
            and took the header from 185px to 237px at 320/360/390, on a
            screen 780px tall. Here it costs nothing at any width.

            The members' side has had this control in the top bar since
            the themes shipped; the panel is where the owner spends the
            longest and was the one surface that could not be switched.
            Same component, so there is one theme control in the codebase
            and one storage key behind it.
          */}
          <ThemeToggle />

          {NAV.length > 1 ? (
            <nav aria-label="Admin" className="ml-auto">
              <ul role="list" className="flex flex-wrap gap-2">
                {NAV.map((item) => {
                  const active = item.href === current;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center rounded-full border px-4 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors ${
                          active
                            ? "border-accent bg-accent text-ink"
                            : "border-border text-text-2 hover:border-accent hover:text-accent-strong"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
        <h1 className="font-display text-4xl tracking-wide text-text sm:text-5xl">
          {heading.toUpperCase()}
        </h1>
        {lead ? (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-2">
            {lead}
          </p>
        ) : null}

        {children}
      </main>
    </div>
  );
}
