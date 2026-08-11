import Link from "next/link";

import { ClassAction } from "@/components/booking/ClassAction";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import type { BookedClass } from "@/lib/booking/queries";
import {
  formatClassDateLong,
  formatClassTimeRange,
  relativeDayLabel,
} from "@/lib/format/classTime";

/**
 * The next class a member is booked into, given the weight it deserves.
 *
 * The account page used to open with six identical rows under a small grey
 * heading — the class you are going to tonight set in the same type as the
 * one three weeks out. That is a list of records, not an answer to the
 * question people open this page with, which is "when am I next training".
 *
 * So the first row is lifted out and stated in display type with its own
 * accent frame, and the rest stay as rows underneath. Prominence comes
 * from hierarchy — a card, a bigger face, a border — and not from
 * inflating the type on everything, which would leave the page exactly as
 * flat as it was, only louder.
 *
 * Nothing here says "attended". Nothing in this system knows who walked
 * through the door.
 */

export function NextClassCard({ entry }: { entry: BookedClass }) {
  const time = formatClassTimeRange(entry.startsAt, entry.endsAt, site.timeZone);
  const day = formatClassDateLong(entry.startsAt, site.timeZone);
  const relative = relativeDayLabel(entry.startsAt, site.timeZone);
  const level = LEVEL_LABELS[entry.level];

  return (
    /*
      An accent border on the standard card surface, rather than an
      accent-tinted fill. Every text tone on this site is measured against
      --card and --bg; a new tinted surface would be a fourth background
      that nothing has been measured against, to buy an effect a 1px
      border already delivers.
    */
    <div className="mt-5 rounded-card border border-accent bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[11px] tracking-[0.14em] text-text-2 uppercase">
          Next class
        </p>
        {relative ? (
          <p className="font-mono text-[11px] tracking-[0.14em] text-accent-strong uppercase">
            {relative}
          </p>
        ) : null}
      </div>

      <p className="mt-3 font-display text-3xl leading-tight tracking-wide text-text sm:text-4xl">
        {day.toUpperCase()}
      </p>

      <p className="mt-2 font-mono text-sm text-text-2">
        {time}
        <span aria-hidden className="px-2 text-text-3">
          ·
        </span>
        {level}
      </p>

      {/*
        The gym cancelled this one. Shown rather than hidden: a member
        whose class disappears without explanation assumes the site lost it
        and turns up anyway. No cancel control either — there is nothing
        left to cancel, and the update policy would refuse it, leaving them
        pressing a button that errors about something that did not happen.
      */}
      {entry.cancelledByGym ? (
        <p className="mt-4 text-[13px] leading-snug text-danger">
          Cancelled by the gym
          {entry.cancellationNote ? ` — ${entry.cancellationNote}` : "."}
        </p>
      ) : (
        <div className="mt-5 flex justify-end">
          <ClassAction
            occurrenceId={entry.occurrenceId}
            booked
            label={`${level}, ${day}, ${time}`}
          />
        </div>
      )}
    </div>
  );
}

/**
 * What sits in the same slot when nothing is booked.
 *
 * A card rather than a sentence, because the empty state is where a member
 * is most likely to need the booking page and least likely to be looking
 * for a link buried in a line of grey text.
 */
export function NoUpcomingCard() {
  return (
    <div className="mt-5 rounded-card border border-border bg-card p-5 sm:p-6">
      <p className="font-display text-2xl tracking-wide text-text sm:text-3xl">
        NOTHING BOOKED YET
      </p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-2">
        Pick a class and it will show up here, with the next one at the top.
      </p>
      <Link
        href="/book"
        className="mt-5 inline-flex min-h-11 items-center rounded-full bg-accent px-6 font-mono text-[12px] font-semibold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-accent-hover"
      >
        Find a class
      </Link>
    </div>
  );
}
