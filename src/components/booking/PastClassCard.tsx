import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import type { BookedClass } from "@/lib/booking/queries";
import {
  formatClassDateLong,
  formatClassTimeRange,
  relativeDayLabel,
} from "@/lib/format/classTime";

/**
 * The last class a member had booked, given the same treatment as the next
 * one.
 *
 * "Been to" used to be an undifferentiated run of rows under a small grey
 * heading, directly beneath a "Coming up" section that opened with a card.
 * The two halves of the same page answered the same shape of question in
 * two different visual languages, and the older half read as an appendix.
 * Asked for on 2026-08-23: make it look like Coming up.
 *
 * ── WHY THE BORDER IS NOT THE ACCENT ONE ────────────────────────────
 *
 * NextClassCard has an accent frame, and it keeps it. On this page the
 * accent means one thing — *this is the one you have to turn up to* — and
 * spending it on a class that has already happened, and again on the
 * membership card below, leaves three highlighted cards and no highlight.
 * Prominence here comes from the card, the display face and the hierarchy;
 * the colour stays reserved.
 *
 * ── AND WHY IT DOES NOT SAY "ATTENDED" ──────────────────────────────
 *
 * Nothing in this system knows who walked through the door. This is the
 * most recent class they BOOKED, and the page must keep saying so — a
 * card headed "attended" would be wrong the first time somebody did not
 * turn up, and drifts further every week after that.
 */
export function LastClassCard({ entry }: { entry: BookedClass }) {
  const time = formatClassTimeRange(entry.startsAt, entry.endsAt, site.timeZone);
  const day = formatClassDateLong(entry.startsAt, site.timeZone);
  const relative = relativeDayLabel(entry.startsAt, site.timeZone);
  const level = LEVEL_LABELS[entry.level];

  return (
    <div className="mt-5 rounded-card border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[11px] tracking-[0.14em] text-text-2 uppercase">
          Most recent
        </p>
        {/*
          "Yesterday" and "Today" both reach here — a member checking in
          after a morning class is looking at something that happened
          hours ago, and the date alone makes them work that out.
        */}
        {relative ? (
          <p className="font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase">
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

      {entry.fromPlan ? (
        <p className="mt-1 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase">
          Booked by your plan
        </p>
      ) : null}

      {/*
        Kept on a class that has already been and gone, because "why was
        I not there" is a question a member asks weeks later — and the
        answer is that the gym called it off, not that they forgot.
      */}
      {entry.cancelledByGym ? (
        <p className="mt-4 text-[13px] leading-snug text-danger">
          Cancelled by the gym
          {entry.cancellationNote ? ` — ${entry.cancellationNote}` : "."}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What sits in the same slot before a member has trained.
 *
 * No "Find a class" button, unlike NoUpcomingCard. When this state is on
 * screen that one is too, immediately above it, and two identical calls to
 * action stacked on one page make both of them furniture.
 */
export function NoPastCard() {
  return (
    <div className="mt-5 rounded-card border border-border bg-card p-5 sm:p-6">
      <p className="font-display text-2xl tracking-wide text-text sm:text-3xl">
        NOTHING YET
      </p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-2">
        Your training history will build up here — every class you book joins
        the list once it has happened.
      </p>
    </div>
  );
}
