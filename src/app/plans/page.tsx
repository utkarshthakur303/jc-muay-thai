import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MemberShell } from "@/components/booking/MemberShell";
import { PlanPicker } from "@/components/plans/PlanPicker";
import { plansAreConfirmed } from "@/content/plans";
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

  const [{ available, slug }, upcomingCount, params] = await Promise.all([
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
        Tell us which plan you&apos;re interested in and the gym will pick it up
        with you in person — nothing is charged here and nothing is locked in.
        You can change it any time from your account, and you can book classes
        either way.
      </p>

      {/*
        The draft notice. It renders itself out of existence the moment
        every plan in content/plans.ts is marked confirmed, so nobody has
        to remember to come back and delete it.

        It is here because the plans below are invented — the gym has not
        confirmed that it sells one, three and six month blocks or what
        each covers. This site has real members on it, and the house rule
        is that an unconfirmed fact is either withheld or labelled. It
        cannot be withheld on the page whose entire subject it is.
      */}
      {!plansAreConfirmed ? (
        <p className="mt-4 max-w-prose rounded-2xl border border-border bg-card px-4 py-3 text-[13px] leading-relaxed text-text-2">
          <span className="font-mono text-[11px] tracking-widest text-accent-strong uppercase">
            Draft ·{" "}
          </span>
          These plans are examples while the gym confirms its real
          memberships. What each one includes may change, and no pricing has
          been set — ask at the gym.
        </p>
      ) : null}

      <PlanPicker next={next} current={slug} />

      {/*
        No "skip to booking" link here, and that is not an omission. /book
        sends a member who has never answered straight back to this page,
        so a plain link to it would look like a button that does nothing.
        The way past is the picker's own "I'll decide later", which records
        an answer first and therefore actually arrives.
      */}
      <p className="mt-8 text-[13px] leading-relaxed text-text-3">
        Prices aren&apos;t shown here because the gym handles payment in
        person.
      </p>
    </MemberShell>
  );
}
