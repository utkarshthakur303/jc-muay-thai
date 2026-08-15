import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { planBySlug, planDuration } from "@/content/plans";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import { requireAdmin } from "@/lib/admin/guard";
import { getMemberDetail } from "@/lib/admin/members";
import {
  formatClassDate,
  formatClassTimeRange,
} from "@/lib/format/classTime";

/**
 * One member: who they are, what they said they wanted, what they booked.
 *
 * The screen for "somebody is asking me a question about their
 * membership", which is a different job from the roster and is why it is
 * a different page.
 */

export const metadata = { title: "Member" };

export default async function AdminMemberPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();

  const { userId } = await params;
  const detail = await getMemberDetail(userId);
  if (!detail) notFound();

  const { member, bookings } = detail;
  const plan = member.plan.state === "chosen" ? planBySlug(member.plan.slug) : null;
  const nowIso = new Date().toISOString();

  return (
    <AdminShell
      current="/admin/members"
      heading={member.fullName ?? "Member"}
      lead={member.email}
    >
      <Link
        href="/admin/members"
        className="mt-6 inline-flex min-h-11 items-center font-mono text-[11px] tracking-widest text-text-2 uppercase transition-colors hover:text-accent-strong"
      >
        ← All members
      </Link>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card-surface card-gradient rounded-card border border-border p-5">
          <p className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
            Plan
          </p>
          <p className="mt-2 text-sm font-semibold text-text">
            {plan
              ? `${plan.name} · ${planDuration(plan)}`
              : member.plan.state === "declined"
                ? "Chose to decide later"
                : "Never asked"}
          </p>
          {/*
            Said on the screen, not just in the migration. A plan here is
            an interest the gym follows up in person — it authorises
            nothing, and this page is exactly where somebody would
            otherwise assume it did.
          */}
          <p className="mt-2 text-[13px] leading-snug text-text-2">
            An interest only. No payment has been taken and no class is
            gated by it.
          </p>
        </div>

        <div className="card-surface card-gradient rounded-card border border-border p-5">
          <p className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
            Upcoming
          </p>
          <p className="mt-2 font-mono text-3xl tabular-nums text-text">
            {member.upcomingBookings}
          </p>
        </div>

        <div className="card-surface card-gradient rounded-card border border-border p-5">
          <p className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
            Booked, already run
          </p>
          <p className="mt-2 font-mono text-3xl tabular-nums text-text">
            {member.pastBookings}
          </p>
          <p className="mt-2 text-[13px] leading-snug text-text-2">
            Booked, not attended — nothing here records who turned up.
          </p>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
          Booking history
        </h2>

        {bookings.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-text-2">
            This member has never booked a class.
          </p>
        ) : (
          <ul role="list" className="mt-2">
            {bookings.map((booking) => (
              <li
                key={`${booking.occurrenceId}-${booking.startsAt}`}
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-divider py-1 last:border-b-0 ${
                  booking.cancelledByMember ? "opacity-60" : ""
                }`}
              >
                <span className="min-w-28 font-mono text-[13px] tabular-nums text-text">
                  {formatClassDate(booking.startsAt, site.timeZone)}
                </span>
                <span className="min-w-32 font-mono text-[12px] tabular-nums text-text-2">
                  {formatClassTimeRange(
                    booking.startsAt,
                    booking.endsAt,
                    site.timeZone,
                  )}
                </span>
                <span className="min-w-24 text-sm text-text">
                  {LEVEL_LABELS[booking.level]}
                </span>

                {/*
                  Three different facts, deliberately not collapsed into
                  one "cancelled" label: the member pulling out and the gym
                  calling the class off mean opposite things when somebody
                  asks why they were not there.
                */}
                {booking.cancelledByMember ? (
                  <span className="font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase">
                    Cancelled by member
                  </span>
                ) : booking.cancelledByGym ? (
                  <span className="font-mono text-[11px] tracking-[0.08em] text-danger uppercase">
                    Class cancelled
                  </span>
                ) : booking.startsAt > nowIso ? (
                  <span className="font-mono text-[11px] tracking-[0.08em] text-accent-strong uppercase">
                    Upcoming
                  </span>
                ) : null}

                <Link
                  href={`/admin/classes/${booking.occurrenceId}`}
                  className="ml-auto inline-flex min-h-11 items-center font-mono text-[11px] text-text-3 underline-offset-4 transition-colors hover:text-accent-strong hover:underline"
                >
                  Roster →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
