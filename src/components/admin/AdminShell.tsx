import Link from "next/link";

import { AdminNav, type AdminNavItem } from "@/components/admin/AdminNav";
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
 *
 * THREE GROUPS, divided by rules rather than headings.
 *
 *   What is happening   Overview · Classes · Members · Enquiries
 *   What the site says  Timetable · Pricing · Photos
 *   This account        Security
 *
 * The first four are opened daily or weekly and answer questions about
 * people; the next three are the website's own content and get touched
 * when something about the gym changes. Before 2026-08-23 they were
 * interleaved — Timetable and Photos sat between Classes and Members —
 * which made a seven-item strip read as one undifferentiated list.
 *
 * Security is last and alone because it is the one item that changes
 * nothing anybody else can see. It is opened perhaps twice a year, so it
 * pays the scroll on a narrow screen rather than pushing a daily item
 * further right to save itself the trip.
 *
 * Order inside each group is by how often it is opened, so the leftmost
 * pills are the ones reached for most and the strip rarely has to be
 * scrolled to do the common thing.
 */
const NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/timetable", label: "Timetable", startsGroup: true },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/security", label: "Security", startsGroup: true },
];

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

      {/*
        TWO ROWS, DELIBERATELY, and the split is what fixed the header.

        Everything used to sit in one `flex-wrap` container: the back
        link, the badge, the theme control and the seven nav pills. At
        320px that wrapped to five rows and stood **289px tall** — over a
        third of a phone screen spent on navigation.

        Measured, before → after:

            320px   289px → 129px
            360px   237px → 129px
            390px   237px → 129px
            768px   133px → 129px
           1024px   133px → 121px
           1280px    77px →  69px

        The desktop number is why the split is conditional rather than
        universal. Below `lg` the nav takes its own scrolling row; at
        `lg` and above all seven pills fit beside the badge and it goes
        back to one row, so the width where there was nothing wrong pays
        nothing for the width where there was.
      */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-5 py-3 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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
              The members' side has had this control in the top bar since
              the themes shipped; the panel is where the owner spends the
              longest and was the one surface that could not be switched.
              Same component, so there is one theme control in the
              codebase and one storage key behind it.

              `ml-auto` now that it shares a row with two short items
              rather than competing with the nav for space.
            */}
            <div className="ml-auto lg:ml-0">
              <ThemeToggle />
            </div>

            {/*
              `w-full` is what puts the strip on its own row: inside a
              wrapping flex container a full-width child cannot share a
              line. At `lg` it becomes `w-auto` and `ml-auto`, joins the
              first row, and the header goes back to being one row —
              which is where the 77px measurement below comes from.
            */}
            {NAV.length > 1 ? (
              <div className="mt-1 w-full lg:mt-0 lg:ml-auto lg:w-auto">
                <AdminNav items={NAV} current={current} />
              </div>
            ) : null}
          </div>
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
