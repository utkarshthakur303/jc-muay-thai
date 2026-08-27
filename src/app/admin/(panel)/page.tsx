import Link from "next/link";

import { AdminShell } from "@/components/admin/AdminShell";
import { NextClasses, type NextClass } from "@/components/admin/NextClasses";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import { listClasses } from "@/lib/admin/classes";
import { countWaitingEnquiries } from "@/lib/admin/enquiries";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminOverview } from "@/lib/admin/queries";
import {
  formatClassDate,
  formatClassTimeRange,
  relativeDayLabel,
} from "@/lib/format/classTime";

/**
 * The panel's front door.
 *
 * Four numbers, then the thing you actually came for.
 *
 * Until 2026-08-23 this page was the numbers alone, on the principle
 * that a dashboard trying to be every screen at once is one nobody
 * reads. That principle stands and this page still is not a
 * control panel — but the counts answered a question the owner does not
 * have. "What is on tonight, and is anybody coming" is the question, and
 * getting to it meant two more taps through the Classes calendar every
 * single time.
 *
 * So: the counts, then the next few classes as links to their rosters,
 * then the two things that are instructions rather than statistics —
 * unanswered enquiries and members with no plan recorded. Nothing here
 * is a control; everything is a door.
 */

/** Two days. Long enough to cover tonight and tomorrow, short enough to stay a summary. */
const NEXT_UP_DAYS = 2;
const NEXT_UP_SHOWN = 6;

function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  /** One line of context under the number. */
  note: string;
}) {
  return (
    <div className="card-surface card-gradient rounded-card border border-border p-6">
      <p className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
        {label}
      </p>
      {/*
        JetBrains Mono at a size that reads as data rather than decoration.
        Tabular figures so a column of tiles does not jitter as numbers
        change width.
      */}
      <p className="mt-3 font-mono text-4xl tabular-nums text-text">{value}</p>
      <p className="mt-2 text-[13px] leading-snug text-text-2">{note}</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [overview, waiting, soon] = await Promise.all([
    getAdminOverview(),
    countWaitingEnquiries(),
    listClasses(NEXT_UP_DAYS),
  ]);

  /**
   * One `now` for every label on this render.
   *
   * `relativeDayLabel` defaults to a fresh `Date` per call, so six calls
   * across a midnight boundary could label two classes on the same civil
   * day differently. One instant, passed in, makes that unrepresentable.
   */
  const now = new Date();

  const nextUp: NextClass[] = soon.slice(0, NEXT_UP_SHOWN).map((klass) => ({
    id: klass.id,
    // Every date formatted here, on the server, in the gym's zone — the
    // same rule as the class calendar. See NextClasses for why.
    day:
      relativeDayLabel(klass.startsAt, site.timeZone, now) ??
      formatClassDate(klass.startsAt, site.timeZone),
    time: formatClassTimeRange(klass.startsAt, klass.endsAt, site.timeZone),
    level: LEVEL_LABELS[klass.level],
    bookedCount: klass.bookedCount,
    capacity: klass.capacity,
    cancelled: klass.cancelled,
  }));

  /**
   * Members who have never been asked which plan they want. Worth calling
   * out rather than burying in a tile, because it is the one number here
   * the gym can actually act on today — the plan step only appears once,
   * so anyone who signed up before it shipped has never seen it.
   */
  const unanswered = overview.plansUnasked + overview.plansDeclined;

  return (
    <AdminShell current="/admin" heading="Overview">
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Members"
          value={overview.memberCount}
          note="Accounts on the site. Admins are not counted."
        />
        <StatTile
          label="Upcoming bookings"
          value={overview.upcomingBookings}
          note="Places taken in classes that have not started."
        />
        <StatTile
          label="Classes ahead"
          value={overview.upcomingClasses}
          note="Scheduled and still to run."
        />
        <StatTile
          label="Plans chosen"
          value={overview.plansChosen}
          note="Members who picked a plan. An interest, not a payment."
        />
      </div>

      <NextClasses classes={nextUp} />

      {/*
        A link, not a tile, and only when there is something to do.
        Somebody waiting on a reply is the one thing on this page that is
        an instruction rather than a statistic, and a number in a grid of
        four other numbers reads as neither.
      */}
      {waiting > 0 ? (
        <Link
          href="/admin/enquiries"
          className="card-surface mt-10 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-accent px-5 py-4 text-sm leading-relaxed transition-colors hover:border-accent-strong"
        >
          <strong className="font-semibold text-text">
            {waiting} {waiting === 1 ? "message is" : "messages are"} waiting
            for a reply
          </strong>
          <span className="text-text-2">
            from the contact form on the website.
          </span>
          <span aria-hidden className="ml-auto font-mono text-[11px] text-text-3">
            →
          </span>
        </Link>
      ) : null}

      {unanswered > 0 ? (
        <p className="mt-8 max-w-prose text-sm leading-relaxed text-text-2">
          <strong className="font-semibold text-text">
            {unanswered} {unanswered === 1 ? "member has" : "members have"} no
            plan recorded
          </strong>{" "}
          — {overview.plansUnasked} never asked, {overview.plansDeclined} asked
          and chose to decide later. Nobody is blocked by this: a member with no
          plan can book exactly what any other member can.
        </p>
      ) : null}
    </AdminShell>
  );
}
