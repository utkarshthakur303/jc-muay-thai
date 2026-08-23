import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { CancelClassForm } from "@/components/admin/CancelClassForm";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import { getClassRoster, type RosterEntry } from "@/lib/admin/classes";
import { requireAdmin } from "@/lib/admin/guard";
import {
  formatClassDateLong,
  formatClassTimeRange,
} from "@/lib/format/classTime";

/**
 * Who is coming to one class.
 *
 * The screen the gym reads standing at the door, so the names are the
 * page — no cards around each one, nothing to scroll past first.
 */

export const metadata = { title: "Roster" };

function NameRow({ entry, muted }: { entry: RosterEntry; muted?: boolean }) {
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-divider py-1 last:border-b-0 ${
        muted ? "opacity-60" : ""
      }`}
    >
      {/*
        `min-h-11` on the link, not padding on the row. The row was already
        44px tall from its own padding, but the *tap target* was only the
        ~20px of text inside it — which is what a thumb has to hit, and
        under the 24px WCAG 2.5.8 floor. Measured at 320/360/390, not
        eyeballed.
      */}
      <Link
        href={`/admin/members/${entry.userId}`}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-text underline-offset-4 transition-colors hover:text-accent-strong hover:underline"
      >
        {/*
          Falls back to the email rather than rendering an empty row.
          Dashboard-created accounts carry no name, and a blank line in a
          register is worse than an ugly one.
        */}
        {entry.fullName ?? entry.email}
      </Link>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/*
          ── WHERE THE BOOKING CAME FROM ──────────────────────────────

          From 2026-08-23, choosing a plan books that member into the
          week ahead at their level. So some of these names are people
          who picked this evening, and some are people whose plan picked
          it for them — and they are not the same thing to whoever is
          deciding whether to open a second mat.

          Marked rather than separated into its own list: they are all
          coming, they all hold a spot, and splitting the register in two
          would make the door harder to work, not easier.
        */}
        {entry.fromPlan ? (
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-text-3 uppercase">
            From plan
          </span>
        ) : null}
        {entry.fullName ? (
          <span className="font-mono text-[12px] text-text-3">
            {entry.email}
          </span>
        ) : null}
      </span>
    </li>
  );
}

export default async function ClassRosterPage({
  params,
}: {
  params: Promise<{ occurrenceId: string }>;
}) {
  await requireAdmin();

  const { occurrenceId } = await params;
  const roster = await getClassRoster(occurrenceId);
  if (!roster) notFound();

  const { klass, attending, cancelled } = roster;

  /**
   * Decided here rather than in the browser. A page rendered at 6:58 and
   * left open says "cancel" at 7:05 whichever clock it asks, so the button
   * is never the guarantee — the RLS policy's `starts_at > now()` is, and
   * this only decides whether to offer a control that would be refused.
   */
  const past = new Date(klass.startsAt).getTime() <= Date.now();

  /**
   * One mail addressed to everyone still on the class, with the addresses
   * in BCC so no member is shown another member's email.
   *
   * This is the fallback that makes the whole cancellation flow honest.
   * Automatic email needs a Resend key and a verified sender, neither of
   * which the gym has yet — so today the reliable path is the owner's own
   * mail client, and it should be one tap rather than sixteen addresses
   * copied out of a table by hand.
   */
  const bccAll = attending.map((entry) => entry.email).filter(Boolean).join(",");
  const mailAllHref = `mailto:?bcc=${encodeURIComponent(bccAll)}&subject=${encodeURIComponent(
    `${LEVEL_LABELS[klass.level]} — ${formatClassDateLong(klass.startsAt, site.timeZone)}`,
  )}`;

  return (
    <AdminShell
      current="/admin/classes"
      heading={LEVEL_LABELS[klass.level]}
      lead={`${formatClassDateLong(klass.startsAt, site.timeZone)} · ${formatClassTimeRange(klass.startsAt, klass.endsAt, site.timeZone)}`}
    >
      <Link
        href="/admin/classes"
        className="mt-6 inline-flex min-h-11 items-center font-mono text-[11px] tracking-widest text-text-2 uppercase transition-colors hover:text-accent-strong"
      >
        ← All classes
      </Link>

      {klass.cancelled ? (
        <p className="mt-6 rounded-card border border-danger px-5 py-4 text-sm leading-relaxed text-text">
          <strong className="font-semibold">This class is cancelled.</strong>
          {klass.cancellationNote ? ` ${klass.cancellationNote}` : ""}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <span className="rounded-full border border-border px-4 py-2 font-mono text-[12px] tabular-nums text-text-2">
          {klass.bookedCount}/{klass.capacity} booked
        </span>
        <span className="rounded-full border border-border px-4 py-2 font-mono text-[12px] tabular-nums text-text-2">
          {klass.spotsLeft} {klass.spotsLeft === 1 ? "place" : "places"} left
        </span>
      </div>

      <CancelClassForm
        occurrenceId={klass.id}
        cancelled={klass.cancelled}
        past={past}
        attendees={attending.length}
      />

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
            Coming ({attending.length})
          </h2>
          {attending.length > 0 ? (
            <a
              href={mailAllHref}
              className="inline-flex min-h-11 items-center font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase underline-offset-4 transition-colors hover:text-accent-strong hover:underline"
            >
              Email everyone
            </a>
          ) : null}
        </div>
        {attending.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-text-2">
            Nobody has booked this class yet.
          </p>
        ) : (
          <ul role="list" className="mt-2">
            {attending.map((entry) => (
              <NameRow key={entry.userId} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      {cancelled.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
            Cancelled their place ({cancelled.length})
          </h2>
          {/*
            Shown rather than hidden. "Three people dropped out of
            Thursday" is a fact about the class, and the bookings table
            never deletes a row precisely so it stays answerable.
          */}
          <ul role="list" className="mt-2">
            {cancelled.map((entry) => (
              <NameRow key={entry.userId} entry={entry} muted />
            ))}
          </ul>
        </section>
      ) : null}
    </AdminShell>
  );
}
