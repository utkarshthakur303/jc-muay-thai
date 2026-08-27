import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { QuoteForm } from "@/components/admin/QuoteForm";
import {
  commitmentBySlug,
  MONTHS_PER_YEAR,
  priceFor,
} from "@/content/plans";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import { requireAdmin } from "@/lib/admin/guard";
import { getMemberDetail } from "@/lib/admin/members";
import { getQuote } from "@/lib/admin/quotes";
import { getPlanPrices, pricedPlanBySlug, pricedPlans } from "@/lib/plans/prices";
import {
  formatClassDate,
  formatClassTimeRange,
} from "@/lib/format/classTime";
import { formatMoney } from "@/lib/format/money";

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
  const term = member.commitment
    ? (commitmentBySlug(member.commitment) ?? null)
    : null;
  const nowIso = new Date().toISOString();

  const [quote, prices] = await Promise.all([getQuote(userId), getPlanPrices()]);

  /**
   * A quote snapshots the plan it was agreed for, so a member who has
   * since changed their mind leaves a figure attached to the wrong thing.
   * Surfaced rather than silently re-labelled: "$300 for Advanced" when it
   * was agreed for Basic is the kind of wrong number that gets read aloud.
   */
  /**
   * The plans, carrying the rates the owner has set in the panel — so
   * the figure that prefills the quote box is the one the website is
   * advertising today, not the one it shipped with.
   *
   * Resolved after the fetch rather than before, so both lookups below
   * come from the same read.
   */
  const priced = pricedPlans(prices);

  // `?? null` so there is one absent value rather than two.
  // `pricedPlanBySlug` returns undefined for a slug the content file no
  // longer knows, which means the same thing here as "they never chose
  // one".
  const plan =
    member.plan.state === "chosen"
      ? (pricedPlanBySlug(priced, member.plan.slug) ?? null)
      : null;

  const quotedPlan = quote ? pricedPlanBySlug(priced, quote.planSlug) : null;
  const quoteIsStale =
    quote !== null && plan !== null && quote.planSlug !== plan.slug;

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
              ? plan.name
              : member.plan.state === "declined"
                ? "Chose to decide later"
                : "Never asked"}
          </p>

          {/*
            The advertised rate for what they picked, and the term they
            picked it on. This is the number the quote box starts from, so
            showing it here is what makes a changed figure below read as a
            deliberate decision rather than a typo.
          */}
          {plan ? (
            <p className="mt-1 font-mono text-[13px] tabular-nums text-text-2">
              {/*
                "a month" is not padding. Since 2026-08-23 a member can
                pick a Yearly view, and this line would otherwise read
                "$150.00 standard · Yearly" — a figure and a unit that
                contradict each other, on the one screen where the owner
                is about to type a price.
              */}
              {formatMoney(priceFor(plan, term))} a month standard
              {term ? ` · ${term.name}` : " · term not chosen"}
            </p>
          ) : null}

          {/*
            WHAT "YEARLY" MEANS, said where the owner reads it.

            The gym does not sell an annual plan. This member used the
            monthly/yearly toggle on the plans page, which shows their
            standard monthly rate multiplied by twelve and says so. They
            have not agreed to pay a year up front and nothing here is a
            discount — the quote box below still works in months, as it
            always has.
          */}
          {plan && term?.basis === "year" ? (
            <p className="mt-1.5 text-[13px] leading-snug text-text-3">
              They viewed the price by the year —{" "}
              {formatMoney(priceFor(plan, term) * MONTHS_PER_YEAR)} for twelve
              months. The gym has no annual rate; billing is unchanged.
            </p>
          ) : null}
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

      {quoteIsStale && quotedPlan ? (
        <p className="mt-8 max-w-prose rounded-card border border-danger px-5 py-4 text-sm leading-relaxed text-text">
          <strong className="font-semibold">This quote is for a plan they no longer want.</strong>{" "}
          It was agreed for {quotedPlan.name} at {formatMoney(quote.finalCents)}, and
          they have since switched to {plan?.name}. Re-quote it below, or clear it.
        </p>
      ) : null}

      {plan ? (
        <QuoteForm
          userId={member.userId}
          planSlug={plan.slug}
          planName={plan.name}
          /*
            The gym's own advertised rate for this plan on this term, used
            to prefill an empty box. Typing $190 from memory on every
            Advanced member is how one of them quietly becomes $19.
          */
          standardPriceCents={priceFor(plan, term)}
          quote={quote}
        />
      ) : (
        <section className="mt-12">
          <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
            Quote
          </h2>
          {/*
            No plan, no quote box. A price is quoted *for* something, and a
            figure with no plan attached is the beginning of exactly the
            confusion this whole feature is arranged to avoid.
          */}
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-2">
            {member.plan.state === "declined"
              ? "This member has been asked and chose to decide later, so there is no plan to price yet."
              : "This member has never been asked which plan they want, so there is no plan to price yet."}{" "}
            They can pick one from their own account page at any time.
          </p>
        </section>
      )}

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
