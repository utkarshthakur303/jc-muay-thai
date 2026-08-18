import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MemberShell } from "@/components/booking/MemberShell";
import { PlanPicker } from "@/components/plans/PlanPicker";
import { safeNextPath } from "@/lib/auth/redirects";
import { countUpcomingBookings } from "@/lib/booking/queries";
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

  const [{ available, slug, commitment }, upcomingCount, params] =
    await Promise.all([
      getPlanState(),
      countUpcomingBookings(),
      searchParams,
    ]);

  /**
   * The table does not exist yet — the migration is applied by hand by the
   * client, so this page can be live before the feature is. Sending a
   * member to a chooser whose every button returns an error is worse than
   * not having the page, so it steps out of the way entirely.
   */
  if (!available) redirect("/book");

  const next = params.next ? safeNextPath(params.next) : "/book";

  return (
    <MemberShell
      current="/plans"
      heading="Choose your plan"
      upcomingCount={upcomingCount}
    >
      <p className="mt-8 max-w-prose text-sm leading-relaxed text-text-2">
        Tell us which class you&apos;re interested in and the gym will pick it
        up with you in person — nothing is charged here and nothing is locked
        in. You can change it any time from your account, and you can book
        classes either way.
      </p>

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
      <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-text-3">
        These are the gym&apos;s standard rates. Nothing on this site takes
        payment — the gym settles it with you in person, and that is also
        where anything you&apos;ve agreed differently gets applied.
      </p>
    </MemberShell>
  );
}
