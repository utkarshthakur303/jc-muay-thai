/**
 * Membership plans.
 *
 * ── EVERY WORD IN THIS FILE WAS ONCE INVENTED. NONE OF IT IS NOW. ────
 *
 * Until 2026-08-18 this file described one, three and six month blocks
 * called Basic, Intermediate and Advanced, with made-up inclusions and no
 * prices. The gym sells nothing of the sort and never did. Four real
 * members read that as finished copy for five days.
 *
 * The real model is on the gym's own site (`old.html` in the repo root),
 * and it is a different shape entirely: what you buy is a **class**, at a
 * monthly price, and separately you choose **how long you commit for**.
 * The commitment is what moves the price, not the length of a block.
 *
 * So a plan here is now two answers, both real:
 *
 *   tier        which class — Beginners, Intermediate, Advanced, Kids
 *   commitment  two-week trial · 12-week contract · month to month
 *
 * The old slugs went with the old model. `basic` is now `beginner`,
 * matching `LevelId` in schedule.ts so a plan and a class finally name the
 * same thing, and `kids` is new. Both were free to change: the migration
 * that renames them also clears the two rows that existed, because those
 * two people answered a question that no longer exists — see
 * `20260818130000_real_plans.sql`.
 *
 * ── ON THE PRICES ───────────────────────────────────────────────────
 * They are real, they are the gym's own published figures, and showing
 * them reverses the Aug 13 "prices are never shown" decision. That
 * decision was only ever made because we had no real numbers and a wrong
 * price is one a member can hold the gym to. We have the numbers now, the
 * gym publishes them itself, and the client's instruction on 2026-08-18
 * was to publish them here and use them to seed the admin quote box.
 *
 * Still true, and still the guard that matters: **nothing on this site
 * charges anybody.** A price here is what the gym advertises. What a given
 * member actually pays is a per-member quote the owner sets in the admin
 * panel, which is where a discount, a family rate or a hardship case
 * lives. These are the starting point of that conversation, not its
 * outcome.
 *
 * What a plan is NOT: an entitlement. Choosing one grants nothing and
 * restricts nothing — a member who picks none can book precisely what a
 * member on Advanced can book. It records an interest for the gym to
 * follow up on in person. If that ever stops being true, the copy here and
 * the migration's header comment both have to change with it.
 * ────────────────────────────────────────────────────────────────────
 */

import type { LevelId } from "@/content/schedule";

/**
 * Deliberately the same strings as `LevelId`. A plan names a class, so
 * the two vocabularies are one vocabulary, and the type below is what
 * stops them drifting apart again.
 */
export type PlanSlug = LevelId;

export type Plan = {
  readonly slug: PlanSlug;
  readonly name: string;
  /** One line, shown under the name. */
  readonly tagline: string;
  /**
   * The gym's advertised monthly rate, in cents.
   *
   * Cents, not dollars, and integers, not floats — the same representation
   * the quote box and the database use, so a price never round-trips
   * through `parseFloat` on its way to a total.
   */
  readonly priceCents: number;
  /**
   * The rate on a 12-week contract, in cents. Null for Kids, whose class
   * the gym advertises at one price only — an absence in their pricing,
   * not an omission in ours.
   */
  readonly contractPriceCents: number | null;
  /** What the class is. Bullet points on the card. */
  readonly includes: readonly string[];
};

/**
 * Ordered as the gym orders them: the progression first, kids last.
 * Prices and copy from jcmuaythai201.com/classes, 2026-08-18.
 */
export const plans: readonly Plan[] = [
  {
    slug: "beginner",
    name: "Beginners",
    tagline: "Bags and pads with a coach. Start here.",
    priceCents: 12_500,
    contractPriceCents: 9_900,
    includes: [
      "Work with a coach on the bags and on pads",
      "Stance, strikes and defence from the ground up",
      "For anyone with little to no fighting experience",
    ],
  },
  {
    slug: "intermediate",
    name: "Intermediate",
    tagline: "Partner work, combinations, conditioning.",
    priceCents: 15_000,
    contractPriceCents: 12_500,
    includes: [
      "Train with a partner on striking and conditioning",
      "Build and sharpen combinations",
      "For people with some fighting knowledge",
    ],
  },
  {
    slug: "advanced",
    name: "Advanced & Fighter",
    tagline: "Longer rounds, real sparring, fight preparation.",
    priceCents: 19_000,
    contractPriceCents: 16_500,
    includes: [
      "Longer combinations and more defined technique",
      "30 minutes of sparring at the end of every class",
      "For aspiring fighters and experienced students",
    ],
  },
  {
    slug: "kids",
    name: "Kids",
    tagline: "45 minutes, after school, learning the art.",
    priceCents: 9_900,
    contractPriceCents: null,
    includes: [
      "45-minute classes built for younger students",
      "Tuesday, Wednesday and Thursday afternoons",
      "Saturday early afternoon",
    ],
  },
];

/**
 * How long you commit for — the axis that actually moves the price.
 *
 * All three are the gym's own, from the "Class Format" section of their
 * classes page. The trial's price is deliberately absent: their site does
 * not state one, and the client's instruction was to say nothing about it
 * rather than guess at "free". An unstated price is a conversation at the
 * desk; a wrong one is a promise.
 */
export type CommitmentSlug = "trial" | "contract" | "monthly" | "annual";

/**
 * Which unit a term's headline figure is quoted in.
 *
 * A field on the term rather than a check for `slug === "annual"`
 * scattered across three components. Adding a term that is quoted per
 * week later is then a line in this file, not a hunt for every place that
 * hard-coded the comparison.
 */
export type PriceBasis = "month" | "year";

export type Commitment = {
  readonly slug: CommitmentSlug;
  readonly name: string;
  readonly blurb: string;
  /** Does this term get the lower `contractPriceCents` rate? */
  readonly discounted: boolean;
  /** Which unit the headline figure is quoted in. */
  readonly basis: PriceBasis;
};

export const commitments: readonly Commitment[] = [
  {
    slug: "trial",
    name: "Two-week trial",
    blurb:
      "Perfect for newcomers. Experience training without a long-term commitment.",
    discounted: false,
    basis: "month",
  },
  {
    slug: "contract",
    name: "12-week contract",
    blurb:
      "For those ready to commit. A structured plan with monthly billing, at the lower rate.",
    discounted: true,
    basis: "month",
  },
  {
    slug: "monthly",
    name: "Month to month",
    blurb:
      "Ongoing access with the freedom to stop, without being tied to a long-term contract.",
    discounted: false,
    basis: "month",
  },
  /**
   * ── READ THIS BEFORE TOUCHING `annual`. ──────────────────────────
   *
   * THE GYM DOES NOT SELL A YEARLY PLAN. Their own site publishes three
   * terms and only three — two-week trial, 12-week contract, month to
   * month — and no annual rate exists at any price. Verified against
   * `old.html` in the repo root on 2026-08-23.
   *
   * This term is a BILLING VIEW, not a product. Its figure is the
   * standard monthly rate multiplied by twelve and nothing else:
   * `discounted: false` is what guarantees it never borrows the
   * contract rate, so nobody is ever shown a cheaper year than the gym
   * would actually charge.
   *
   * It exists because the client asked for a monthly/yearly toggle on
   * 2026-08-23 with the absence of a real annual price stated in front
   * of them, and chose the ×12 option knowingly over waiting for real
   * numbers. That is their call and it stands.
   *
   * WHAT KEEPS IT HONEST, and none of it is decorative:
   *
   *   1. The figure is DERIVED, never stored. There is no
   *      `annualPriceCents` field to drift out of step with the monthly
   *      one — change a monthly price and the year follows in the same
   *      edit. See `priceDisplayFor`.
   *   2. Every surface that shows it also says "12 × $X a month" and
   *      that the gym bills monthly. A total nobody has agreed to must
   *      never appear as a bare number.
   *   3. It is not sold as a saving, because it is not one. A year here
   *      costs exactly twelve months.
   *
   * If the gym ever quotes a real annual rate, this stops being a view
   * and becomes a product: give it its own price field, and delete this
   * comment along with the arithmetic.
   * ─────────────────────────────────────────────────────────────────
   */
  {
    slug: "annual",
    name: "Yearly",
    blurb:
      "The same month-to-month rate, shown as a year. The gym still bills monthly — there is no separate annual price.",
    discounted: false,
    basis: "year",
  },
];

const SLUGS: ReadonlySet<string> = new Set(plans.map((plan) => plan.slug));
const COMMITMENT_SLUGS: ReadonlySet<string> = new Set(
  commitments.map((commitment) => commitment.slug),
);

/** Narrows a value off the wire. Anything unrecognised is "no plan". */
export function isPlanSlug(value: unknown): value is PlanSlug {
  return typeof value === "string" && SLUGS.has(value);
}

export function isCommitmentSlug(value: unknown): value is CommitmentSlug {
  return typeof value === "string" && COMMITMENT_SLUGS.has(value);
}

export function planBySlug(slug: PlanSlug): Plan | undefined {
  return plans.find((plan) => plan.slug === slug);
}

export function commitmentBySlug(
  slug: CommitmentSlug,
): Commitment | undefined {
  return commitments.find((commitment) => commitment.slug === slug);
}

/**
 * What a member on this plan and this term is advertised at, in cents.
 *
 * One function so the plan card, the account page and the admin quote box
 * cannot each work it out slightly differently — which is precisely how a
 * member ends up quoted one number on screen and another at the desk.
 *
 * A plan with no contract rate keeps its standard price on every term.
 * That is Kids, and it is the gym's pricing, not a fallback.
 */
export function priceFor(plan: Plan, commitment: Commitment | null): number {
  if (commitment?.discounted && plan.contractPriceCents !== null) {
    return plan.contractPriceCents;
  }
  return plan.priceCents;
}

/** Twelve. Named so the ×12 in `priceDisplayFor` reads as a year. */
export const MONTHS_PER_YEAR = 12;

/**
 * The headline figure for a plan on a term, and the unit it is in.
 *
 * The one function every price on the site goes through, so a card, the
 * account page and the owner's panel cannot each work the year out
 * slightly differently — which is exactly how a member ends up reading
 * one number on screen and hearing another at the desk.
 *
 * The yearly figure is COMPUTED from the monthly one at the moment it is
 * shown. It is deliberately not a field: a stored annual price is a
 * second number to keep in step, and the day it falls out of step is the
 * day the site advertises a year at last month's rate.
 */
export type PriceDisplay = {
  readonly cents: number;
  readonly basis: PriceBasis;
  /** The monthly rate the figure was built from. Always real, always the gym's. */
  readonly perMonthCents: number;
};

export function priceDisplayFor(
  plan: Plan,
  commitment: Commitment | null,
): PriceDisplay {
  const perMonthCents = priceFor(plan, commitment);

  return commitment?.basis === "year"
    ? {
        cents: perMonthCents * MONTHS_PER_YEAR,
        basis: "year",
        perMonthCents,
      }
    : { cents: perMonthCents, basis: "month", perMonthCents };
}

/**
 * Content errors should fail the build rather than reach a member.
 *
 * A contract rate above the standard rate would render as a "discount"
 * that costs more — the kind of mistake that survives review because both
 * numbers look plausible on their own.
 */
for (const plan of plans) {
  if (plan.priceCents <= 0) {
    throw new Error(`Plans: ${plan.slug} has a non-positive price.`);
  }
  /**
   * A yearly figure that is not exactly twelve monthly ones would be a
   * discount, or a surcharge, that nobody at the gym agreed to. Checked
   * here rather than trusted, because `priceDisplayFor` is one edit away
   * from someone "improving" it into a rounded number.
   */
  const annual = commitments.find((term) => term.slug === "annual") ?? null;
  const shown = priceDisplayFor(plan, annual);
  if (shown.cents !== plan.priceCents * MONTHS_PER_YEAR) {
    throw new Error(
      `Plans: ${plan.slug}'s yearly figure is not twelve monthly ones.`,
    );
  }
  if (
    plan.contractPriceCents !== null &&
    plan.contractPriceCents > plan.priceCents
  ) {
    throw new Error(
      `Plans: ${plan.slug} costs more on contract ` +
        `(${plan.contractPriceCents}) than month to month (${plan.priceCents}).`,
    );
  }
}
