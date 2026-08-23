import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClassAction } from "@/components/booking/ClassAction";
import { MemberShell } from "@/components/booking/MemberShell";
import {
  NextClassCard,
  NoUpcomingCard,
} from "@/components/booking/NextClassCard";
import {
  commitmentBySlug,
  MONTHS_PER_YEAR,
  planBySlug,
  priceDisplayFor,
} from "@/content/plans";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import { signOut } from "@/lib/auth/actions";
import { refreshPlanBookings } from "@/lib/plans/actions";
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
import { formatPrice } from "@/lib/format/money";
import { planBookingAvailable } from "@/lib/plans/autoBook";
import { PLAN_BOOKING_DAYS } from "@/lib/plans/planBookings";
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

  const [upcoming, upcomingTotal, past, pastTotal, planState, booksClasses] =
    await Promise.all([
      listUpcomingBookings(),
      countUpcomingBookings(),
      listPastBookings(),
      countPastBookings(),
      getPlanState(),
      planBookingAvailable(),
    ]);

  const chosenPlan = planState.slug ? planBySlug(planState.slug) : undefined;
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

        {past.length === 0 ? (
          <p className="mt-5 text-sm leading-relaxed text-text-2">
            Your training history will build up here.
          </p>
        ) : (
          <>
            <ul role="list" className="mt-1 flex flex-col">
              {past.map((entry) => (
                <ClassLine key={entry.occurrenceId} entry={entry} />
              ))}
            </ul>
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

          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-divider py-4">
            <div className="min-w-0">
              <p className="text-sm text-text">
                {chosenPlan && shownPrice
                  ? `${chosenPlan.name} · ${formatPrice(shownPrice.cents)} a ${shownPrice.basis}`
                  : "No plan chosen yet"}
              </p>
              {/*
                The term, when they picked one. Second line rather than
                appended, because the first line now carries a price and
                "Advanced · $190 a month · 12-week contract" is a sentence
                nobody parses at a glance.
              */}
              {chosenPlan && chosenTerm ? (
                <p className="mt-0.5 text-[13px] leading-snug text-text-2">
                  {chosenTerm.name}
                  {/*
                    The year, shown as what it is. A bare "$1,800 a year"
                    on a member's own account page is a figure they will
                    reasonably believe somebody agreed to; the gym has no
                    annual rate and bills monthly, so the arithmetic
                    travels with the number everywhere it appears.
                  */}
                  {shownPrice?.basis === "year"
                    ? ` — ${MONTHS_PER_YEAR} × ${formatPrice(shownPrice.perMonthCents)} a month, billed monthly`
                    : ""}
                </p>
              ) : null}

              {/*
                Said plainly, every time it is shown, and it matters more
                now than it did. A member who reads "Advanced · $190 a
                month" on their own account page and is never told
                otherwise will reasonably believe they are being billed.
                Nobody has been charged and nothing has been agreed; this
                is a note of what they said they wanted, at the gym's
                standard rate.
              */}
              <p className="mt-0.5 text-[13px] leading-snug text-text-3">
                An interest, not a subscription — nothing here charges you,
                and the gym settles the price with you in person.
              </p>

              {/*
                What the plan does to this page, stated where the plan is.

                Only when it is actually doing it: `booksClasses` is false
                until the migration adding `bookings.source` has been run,
                and false for anyone on the two-week trial, which books
                nothing by design. The sentence also has to name the way
                out — a feature that fills your calendar and does not say
                how to stop is one people work around rather than use.
              */}
              {booksClasses && chosenPlan && chosenTerm?.slug !== "trial" ? (
                <p className="mt-0.5 text-[13px] leading-snug text-text-3">
                  Your plan books you into {chosenPlan.name} classes{" "}
                  {PLAN_BOOKING_DAYS} days ahead. Cancel any of them above,
                  ask for the next week whenever you like, or change your plan
                  to hand the rest back.
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {/*
                Tops the week back up. Only offered when it can do
                something: the migration has landed, they have a plan, and
                the plan is not the trial — which books nothing by design.
                A button that is guaranteed to report "nothing to add" is
                a button that teaches people to ignore it.
              */}
              {booksClasses && chosenPlan && chosenTerm?.slug !== "trial" ? (
                <form action={refreshPlanBookings}>
                  <button
                    type="submit"
                    className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
                  >
                    Book my next week
                  </button>
                </form>
              ) : null}

              <Link
                href="/plans?next=%2Faccount"
                className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
              >
                {chosenPlan ? "Change" : "Choose"}
              </Link>
            </div>
          </div>
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
