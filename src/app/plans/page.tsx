import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MemberShell } from "@/components/booking/MemberShell";
import { PlanPicker } from "@/components/plans/PlanPicker";
import { safeNextPath } from "@/lib/auth/redirects";
import { countUpcomingBookings } from "@/lib/booking/queries";
import { planBookingAvailable } from "@/lib/plans/autoBook";
import { PLAN_BOOKING_DAYS } from "@/lib/plans/planBookings";
import { getPlanState } from "@/lib/plans/queries";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Membership plans",
  robots: { index: false, follow: false },
};

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getUser();
  /**
   * The proxy guards this route, but a Server Component must not rely on
   * that alone — a misconfigured matcher would expose the page silently.
   * Authorisation is checked where the data is read.
   */
  if (!user) redirect("/login?next=/plans");

  const [{ available, slug, commitment }, upcomingCount, booksClasses, params] =
    await Promise.all([
      getPlanState(),
      countUpcomingBookings(),
      planBookingAvailable(),
      searchParams,
    ]);

  /**
   * The table does not exist yet — the migration is applied by hand by the
   * client, so this page can be live before the feature is. Sending a
   * member to a chooser whose every button returns an error is worse than
   * not having the page, so it steps out of the way entirely.
   */
  if (!available) redirect("/book");

  /**
   * THE DEFAULT DESTINATION IS NOW THE HOME PAGE, not /book — the
   * client's instruction on 2026-08-23. An explicit `next` still wins,
   * which is how the "Change" link on /account gets a member back to the
   * page they were reading and how the trial panel reaches /book.
   */
  const next = params.next ? safeNextPath(params.next) : "/";

  /*
    `width="wide"` — the one member page that is not a reading column.
    Four plan cards set two-up inside a 768px column left the right half
    of every desktop screen empty while the cards themselves were cramped.
    At the site's own full width they run four across and each one gets
    its price at a size worth reading. Asked for on 2026-08-23.
  */
  return (
    <MemberShell
      current="/plans"
      heading="Choose your plan"
      upcomingCount={upcomingCount}
      width="wide"
    >
      <p className="mt-8 max-w-prose text-sm leading-relaxed text-text-2">
        Tell us which class you&apos;re interested in and the gym will pick it
        up with you in person — nothing is charged here and nothing is locked
        in. You can change it any time from your account, and you can book
        classes either way.
      </p>

      {/*
        ── SAID BEFORE THE PRESS, NOT AFTER IT ─────────────────────────

        From 2026-08-23 choosing a plan books real classes. A member who
        finds six bookings they do not remember making has been done
        something to, however useful it turns out to be — so the page
        says what the button does, above the button.

        AND ONLY WHEN IT IS TRUE. `booksClasses` is false until the
        client has run the migration that adds `bookings.source`, and in
        that window choosing a plan books nothing at all. A promise the
        feature cannot keep yet is worse than no promise: the member
        would go looking for classes that are not there and conclude the
        site lost them.
      */}
      {booksClasses ? (
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-2">
          Choosing a class also books you into it for the next{" "}
          {PLAN_BOOKING_DAYS} days, wherever the gym has room, so your
          classes are ready and waiting. Cancel any of them whenever you
          like, and changing your plan later hands those spots back.
        </p>
      ) : null}

      {/*
        THE PLANS ON THIS PAGE WERE INVENTED UNTIL 2026-08-18.

        Worth recording rather than quietly fixing, because of what it cost:
        this page showed one, three and six month blocks that the gym does
        not sell, behind a draft notice that was added on Aug 11 and removed
        on Aug 13 at the client's request. Between then and Aug 18, real
        members read fiction as finished copy, and two of them answered it.
        Those two rows were cleared by 20260818130000_real_plans.sql, because
        an answer to a question that never existed is not data.

        Everything here is now the gym's own — the four classes it runs, the
        three commitment terms it offers, and the prices it publishes on
        jcmuaythai201.com. The guard that used to be "quote no prices" is now
        "quote only theirs".
      */}

      <PlanPicker next={next} current={slug} currentCommitment={commitment} />

      {/*
        No "skip to booking" link here, and that is not an omission. /book
        sends a member who has never answered straight back to this page,
        so a plain link to it would look like a button that does nothing.
        The way past is the picker's own "I'll decide later", which records
        an answer first and therefore actually arrives.
      */}
      {/*
        THE YEARLY FIGURE IS ARITHMETIC, NOT A PRICE THE GYM QUOTES, and
        this paragraph is the page-level place that says so.

        The gym publishes three terms and no annual rate. The client asked
        for a monthly/yearly toggle on 2026-08-23 with that absence stated
        in front of them and chose to show twelve monthly payments as a
        year. Every card repeats the "12 × $X a month" line for the same
        reason — a yearly total that appears as a bare number is one a
        member can hold the gym to.
      */}
      <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-text-3">
        These are the gym&apos;s standard rates. A yearly figure is simply
        twelve monthly payments — the gym has no separate annual price and
        bills monthly either way. Nothing on this site takes payment: the
        gym settles it with you in person, and that is also where anything
        you&apos;ve agreed differently gets applied.
      </p>
    </MemberShell>
  );
}
