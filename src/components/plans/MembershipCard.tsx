import Link from "next/link";

import {
  MONTHS_PER_YEAR,
  type Commitment,
  type Plan,
  type PriceDisplay,
} from "@/content/plans";
import { formatPrice } from "@/lib/format/money";
import { refreshPlanBookings } from "@/lib/plans/actions";
import { PLAN_BOOKING_DAYS } from "@/lib/plans/planBookings";

/**
 * What the member told the gym they wanted, as a card.
 *
 * It was a single row of small text between two dividers — the least
 * prominent thing on a page whose other two sections had just been given
 * cards. Asked for on 2026-08-23: make it read like Coming up.
 *
 * ── EVERY DISCLAIMER SURVIVED THE REDESIGN, AND THAT IS THE POINT ───
 *
 * Making a price bigger is exactly the change that quietly turns a note
 * into a bill. Nobody has been charged, nothing has been agreed, and a
 * member reading "INTERMEDIATE / $150 a month" in display type on their
 * own account page will assume otherwise unless told. So the figure got
 * more prominent and so did the sentence under it; the yearly view still
 * shows its arithmetic; and the card says out loud that the gym settles
 * the price in person.
 *
 * The accent border stays with the next class — see PastClassCard for why
 * three highlighted cards is the same as none.
 */
export function MembershipCard({
  plan,
  term,
  price,
  booksClasses,
}: {
  plan: Plan | undefined;
  term: Commitment | null;
  /** From `priceDisplayFor`, so this card and /plans cannot disagree. */
  price: PriceDisplay | null;
  /** Is plan booking switched on? False until the migration has been run. */
  booksClasses: boolean;
}) {
  if (!plan) {
    /*
      The empty state is a card too, and it carries the one control that
      fills it. A member with no plan reading a grey line of text has
      nothing to press; NoUpcomingCard solved the same problem the same
      way, and the two now match.
    */
    return (
      <div className="mt-5 rounded-card border border-border bg-card p-5 sm:p-6">
        <p className="font-display text-2xl tracking-wide text-text sm:text-3xl">
          NO PLAN CHOSEN
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-2">
          Tell the gym which class you are interested in and they will pick it
          up with you in person. Nothing is charged here and nothing is locked
          in — and you can book classes either way.
        </p>
        <Link
          href="/plans?next=%2Faccount"
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-accent px-6 font-mono text-[12px] font-semibold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-accent-hover"
        >
          Choose a plan
        </Link>
      </div>
    );
  }

  /** Only offered when it can do something. See the note below. */
  const canTopUp = booksClasses && term?.slug !== "trial";

  return (
    <div className="mt-5 rounded-card border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[11px] tracking-[0.14em] text-text-2 uppercase">
          Your plan
        </p>
        {/*
          The term, up here with the label rather than buried under the
          price. It is the axis that actually moves the money at this gym,
          so it belongs where the eye lands first.
        */}
        {term ? (
          <p className="font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase">
            {term.name}
          </p>
        ) : null}
      </div>

      <p className="mt-3 font-display text-3xl leading-tight tracking-wide text-text sm:text-4xl">
        {plan.name.toUpperCase()}
      </p>

      {price ? (
        <p className="mt-2 font-mono text-sm text-text-2">
          {formatPrice(price.cents)} a {price.basis}
          {/*
            THE YEAR NEVER TRAVELS AS A BARE NUMBER. The gym publishes no
            annual rate and bills monthly; "$1,800 a year" on a member's
            own account page is a figure they would reasonably believe
            somebody had agreed to. The arithmetic goes wherever the total
            goes — here, on the plan card, and in the owner's panel.
          */}
          {price.basis === "year" ? (
            <span className="text-text-3">
              {" "}
              — {MONTHS_PER_YEAR} × {formatPrice(price.perMonthCents)} a month,
              billed monthly
            </span>
          ) : null}
        </p>
      ) : null}

      {/*
        Said plainly, every time it is shown, and it matters more at this
        size than it did at the old one. A member who reads a price in
        display type and is never told otherwise will believe they are
        being billed.
      */}
      <p className="mt-4 max-w-prose text-[13px] leading-relaxed text-text-3">
        An interest, not a subscription — nothing here charges you, and the
        gym settles the price with you in person.
      </p>

      {/*
        What the plan does to the rest of this page, stated where the plan
        is. Only when it is actually doing it: `booksClasses` is false
        until the migration adding `bookings.source` has been run, and the
        two-week trial books nothing by design.
      */}
      {canTopUp ? (
        <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-text-3">
          Your plan books you into {plan.name} classes {PLAN_BOOKING_DAYS} days
          ahead. Cancel any of them above, ask for the next week whenever you
          like, or change your plan to hand the rest back.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {/*
          A button that is guaranteed to report "nothing to add" is a
          button that teaches people to ignore it — so it appears only
          when there is a week it could actually book.
        */}
        {canTopUp ? (
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
          Change
        </Link>
      </div>
    </div>
  );
}
