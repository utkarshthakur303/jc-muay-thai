import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClassAction } from "@/components/booking/ClassAction";
import { MemberShell } from "@/components/booking/MemberShell";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import { signOut } from "@/lib/auth/actions";
import { memberDisplayFrom } from "@/lib/auth/memberCookie";
import {
  countPastBookings,
  listPastBookings,
  listUpcomingBookings,
  type BookedClass,
} from "@/lib/booking/queries";
import {
  formatClassDateLong,
  formatClassTimeRange,
  relativeDayLabel,
} from "@/lib/format/classTime";
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

  const [upcoming, past, pastTotal] = await Promise.all([
    listUpcomingBookings(),
    listPastBookings(),
    countPastBookings(),
  ]);

  return (
    <MemberShell current="/account" heading="Your classes">
      <section aria-labelledby="upcoming-heading" className="mt-10">
        <h2
          id="upcoming-heading"
          className="border-b border-border pb-3 font-mono text-[12px] tracking-widest text-text uppercase"
        >
          Coming up
        </h2>

        {upcoming.length === 0 ? (
          <p className="mt-5 text-sm leading-relaxed text-text-2">
            Nothing booked yet.{" "}
            <Link
              href="/book"
              className="text-accent-strong underline underline-offset-4"
            >
              Find a class
            </Link>
            .
          </p>
        ) : (
          <ul role="list" className="mt-1 flex flex-col">
            {upcoming.map((entry) => (
              <ClassLine
                key={entry.occurrenceId}
                entry={entry}
                action={
                  /*
                    No cancel control on a class the gym has already
                    cancelled. There is nothing left to cancel, and the
                    update policy would refuse it — leaving the member
                    pressing a button that returns an error explaining
                    something that is not what happened.
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
