import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminOverview } from "@/lib/admin/queries";

/**
 * The panel's front door.
 *
 * Six numbers, no controls. It answers "is anything happening that needs
 * me" and then gets out of the way — a dashboard that tries to be every
 * screen at once is one nobody reads.
 */

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

  const overview = await getAdminOverview();

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
