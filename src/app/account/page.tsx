import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ClassAction } from "@/components/booking/ClassAction";
import { MemberShell } from "@/components/booking/MemberShell";
import {
  NextClassCard,
  NoUpcomingCard,
} from "@/components/booking/NextClassCard";
import {
  LastClassCard,
  NoPastCard,
} from "@/components/booking/PastClassCard";
import { MembershipCard } from "@/components/plans/MembershipCard";
import { commitmentBySlug, priceDisplayFor } from "@/content/plans";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import { signOut } from "@/lib/auth/actions";
import { memberDisplayFrom } from "@/lib/auth/memberCookie";
import {
  countPastBookings,
  countUpcomingBookings,
  listPastBookings,
  listUpcomingBookings,
  type BookedClass,
} from "@/lib/booking/queries";
import {
  formatClassDateLong,
  formatClassTimeRange,
  relativeDayLabel,
} from "@/lib/format/classTime";
import { planBookingAvailable } from "@/lib/plans/autoBook";
import { getPlanPrices, pricedPlanBySlug, pricedPlans } from "@/lib/plans/prices";
import { getPlanState } from "@/lib/plans/queries";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your Account",
  robots: { index: false, follow: false },
};

function ClassLine({
  entry,
  action,
}: {
  entry: BookedClass;
  action?: React.ReactNode;
}) {
  const time = formatClassTimeRange(
    entry.startsAt,
    entry.endsAt,
    site.timeZone,
  );
  const day = formatClassDateLong(entry.startsAt, site.timeZone);
  const relative = relativeDayLabel(entry.startsAt, site.timeZone);
  const level = LEVEL_LABELS[entry.level];

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-divider py-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-sm text-text">
          {day}
          {relative ? (
            <span className="text-accent-strong">{relative}</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-sm text-text-2">
          {time}
          <span aria-hidden className="px-2 text-text-3">
            ·
          </span>
          {level}
          {/*
            Marked, not hidden. These rows appear without the member
            pressing anything — see the note in NextClassCard — and an
            unexplained booking is one somebody either turns up to by
            accident or stops trusting the whole list over.
          */}
          {entry.fromPlan ? (
            <>
              <span aria-hidden className="px-2 text-text-3">
                ·
              </span>
              <span className="font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase">
                From your plan
              </span>
            </>
          ) : null}
        </p>

        {/*
          The gym cancelled this one. Shown rather than hidden: a member
          whose class disappears from their list without explanation
          assumes the site lost it and turns up anyway.
        */}
        {entry.cancelledByGym ? (
          <p className="mt-1.5 text-[13px] leading-snug text-danger">
            Cancelled by the gym
            {entry.cancellationNote ? ` — ${entry.cancellationNote}` : "."}
          </p>
        ) : null}
      </div>

      {action}
    </li>
  );
}

export default async function AccountPage() {
  const user = await getUser();

  /**
   * The proxy already guards this route, but a Server Component must not
   * rely on that alone — a misconfigured matcher would silently expose the
   * page. Authorisation is checked where the data is read.
   */
  if (!user) redirect("/login?next=/account");

  /**
   * Shared with the top bar's account chip rather than re-derived here.
   * Supabase stores the name under two different keys depending on the
   * provider, and two copies of that rule would eventually disagree — the
   * chip saying one thing and this page another.
   */
  const { name: fullName } = memberDisplayFrom(user);

  const [
    upcoming,
    upcomingTotal,
    past,
    pastTotal,
    planState,
    booksClasses,
    prices,
  ] = await Promise.all([
    listUpcomingBookings(),
    countUpcomingBookings(),
    listPastBookings(),
    countPastBookings(),
    getPlanState(),
    planBookingAvailable(),
    /*
      The rates the owner has set. Read here rather than taken from
      `content/plans.ts` since 2026-08-23, so a member's own page and
      the plans page they chose from cannot show different figures.
    */
    getPlanPrices(),
  ]);

  const chosenPlan = planState.slug
    ? pricedPlanBySlug(pricedPlans(prices), planState.slug)
    : undefined;
  const chosenTerm = planState.commitment
    ? (commitmentBySlug(planState.commitment) ?? null)
    : null;

  /**
   * The figure and its unit, from the same function the plans page uses.
   *
   * Shared rather than re-derived, because this page and that one are the
   * two places a member reads their own price and the pair disagreeing is
   * how somebody arrives at the desk quoting a number nobody recognises.
   *
   * A member on the yearly view sees a year here. That figure is twelve
   * monthly payments and nothing else — the gym publishes no annual rate
   * — so the line under it says so, exactly as the plan card did when
   * they chose it.
   */
  const shownPrice = chosenPlan
    ? priceDisplayFor(chosenPlan, chosenTerm)
    : null;

  /**
   * The next class is lifted out of the list and given the top of the
   * page; the rest follow as rows. `listUpcomingBookings` orders by
   * `starts_at` ascending in Postgres, so the first row is the soonest —
   * this does not re-sort, and must not, because sorting a page of fifty
   * in JavaScript would sort the wrong fifty.
   */
  const [nextUp, ...later] = upcoming;

  /**
   * The same lift for the history, in the other direction. `past` arrives
   * newest-first from Postgres, so `mostRecent` is the last class they had
   * booked.
   */
  const [mostRecent, ...earlier] = past;

  return (
    <MemberShell
      current="/account"
      heading="Your classes"
      upcomingCount={upcomingTotal}
    >
      <section aria-labelledby="upcoming-heading" className="mt-10">
        <h2
          id="upcoming-heading"
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-3 font-mono text-[12px] tracking-widest text-text uppercase"
        >
          <span>Coming up</span>
          {upcomingTotal > 0 ? (
            <span className="text-text-2">
              {upcomingTotal} {upcomingTotal === 1 ? "class" : "classes"} booked
            </span>
          ) : null}
        </h2>

        {!nextUp ? (
          <NoUpcomingCard />
        ) : (
          <>
            <NextClassCard entry={nextUp} />

            {later.length > 0 ? (
              <>
                <p className="mt-8 font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase">
                  Then
                </p>
                <ul role="list" className="mt-1 flex flex-col">
                  {later.map((entry) => (
                    <ClassLine
                      key={entry.occurrenceId}
                      entry={entry}
                      action={
                        /*
                          No cancel control on a class the gym has already
                          cancelled. There is nothing left to cancel, and
                          the update policy would refuse it — leaving the
                          member pressing a button that returns an error
                          explaining something that is not what happened.
                        */
                        entry.cancelledByGym ? null : (
                          <ClassAction
                            occurrenceId={entry.occurrenceId}
                            booked
                            label={`${LEVEL_LABELS[entry.level]}, ${formatClassDateLong(
                              entry.startsAt,
                              site.timeZone,
                            )}, ${formatClassTimeRange(entry.startsAt, entry.endsAt, site.timeZone)}`}
                          />
                        )
                      }
                    />
                  ))}
                </ul>
              </>
            ) : null}

            {upcomingTotal > upcoming.length ? (
              <p className="mt-4 font-mono text-[11px] text-text-3">
                Showing the next {upcoming.length}.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="past-heading" className="mt-14">
        <h2
          id="past-heading"
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-3 font-mono text-[12px] tracking-widest text-text uppercase"
        >
          <span>Been to</span>
          {/*
            "Classes booked", not "classes attended" — and the distinction
            is not pedantry. Nothing in this system knows who walked through
            the door; that needs a coach marking a register, which was
            deliberately left out of scope. A number labelled "attended"
            that counts bookings is wrong the first time someone does not
            turn up, and drifts further every week until it is a number the
            member knows is a lie.
          */}
          <span className="text-text-2">
            {pastTotal} {pastTotal === 1 ? "class" : "classes"} booked
          </span>
        </h2>

        {/*
          THE SAME SHAPE AS COMING UP, and deliberately so — asked for on
          2026-08-23. One card for the class that matters most, then rows.
          The two sections answer the same question in opposite directions,
          and reading them in two different visual languages made the older
          half look like an appendix to the newer one.

          `listPastBookings` orders by `starts_at` DESCENDING in Postgres,
          so the first row is the most recent. Nothing re-sorts here, and
          nothing may: sorting a page of twenty in JavaScript sorts the
          wrong twenty.
        */}
        {!mostRecent ? (
          <NoPastCard />
        ) : (
          <>
            <LastClassCard entry={mostRecent} />

            {earlier.length > 0 ? (
              <>
                <p className="mt-8 font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase">
                  Before that
                </p>
                <ul role="list" className="mt-1 flex flex-col">
                  {earlier.map((entry) => (
                    <ClassLine key={entry.occurrenceId} entry={entry} />
                  ))}
                </ul>
              </>
            ) : null}

            {pastTotal > past.length ? (
              <p className="mt-4 font-mono text-[11px] text-text-3">
                Showing the most recent {past.length}.
              </p>
            ) : null}
          </>
        )}
      </section>

      {/*
        Hidden entirely until the migration lands — see lib/plans/queries.ts.
        A "Membership" heading over an error is worse than no heading.
      */}
      {planState.available ? (
        <section aria-labelledby="plan-heading" className="mt-14">
          <h2
            id="plan-heading"
            className="border-b border-border pb-3 font-mono text-[12px] tracking-widest text-text uppercase"
          >
            Membership
          </h2>

          <MembershipCard
            plan={chosenPlan}
            term={chosenTerm}
            price={shownPrice}
            booksClasses={booksClasses}
          />
        </section>
      ) : null}

      <section aria-labelledby="account-heading" className="mt-14">
        <h2
          id="account-heading"
          className="border-b border-border pb-3 font-mono text-[12px] tracking-widest text-text uppercase"
        >
          Account
        </h2>

        <dl className="mt-1 flex flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-divider py-4">
            <dt className="text-sm text-text-2">Name</dt>
            <dd className="text-sm text-text">{fullName ?? "Not set"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-divider py-4">
            <dt className="text-sm text-text-2">Email</dt>
            <dd className="text-sm break-all text-text">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-divider py-4">
            <dt className="text-sm text-text-2">Signed in with</dt>
            <dd className="text-sm text-text capitalize">
              {user.app_metadata?.provider ?? "email"}
            </dd>
          </div>
          {/*
            The only route to /account/password that does not involve
            losing your password first. It had one entry point — a reset
            email — which meant the way to change a password you still
            knew was to declare that you had forgotten it.
          */}
          <div className="flex items-center justify-between gap-4 border-b border-divider py-4">
            <dt className="text-sm text-text-2">Password</dt>
            <dd className="text-sm">
              <Link
                href="/account/password"
                className="font-medium text-accent-strong underline-offset-4 hover:underline"
              >
                Change
              </Link>
            </dd>
          </div>
        </dl>

        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="min-h-11 rounded-full border border-border px-6 font-mono text-[12px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-danger hover:text-danger"
          >
            Sign out
          </button>
        </form>
      </section>
    </MemberShell>
  );
}
