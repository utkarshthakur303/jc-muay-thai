/**
 * Membership plans.
 *
 * ⚠ NEEDS-CLIENT — EVERY WORD BELOW IS INVENTED.
 *
 * The gym has not confirmed that it sells memberships in one, three and
 * six month blocks, has not confirmed what each includes, and has not
 * confirmed what any of them costs. This file exists because the client
 * asked for a plan-selection step with placeholder copy in it, and it is
 * marked the way `contactChannels` in site.ts is marked, for the same
 * reason: a plausible invention is more dangerous than an obvious gap,
 * because nobody goes back to check it.
 *
 * Two guards on that:
 *
 *   1. `confirmed: false` on every plan, and the page renders a visible
 *      note saying so for as long as any plan is unconfirmed. Flip the
 *      flags when the gym confirms and the note disappears on its own —
 *      see `plansAreConfirmed` at the bottom.
 *
 *   2. NO PRICES. Not even placeholder ones. A duration that turns out to
 *      be wrong is an embarrassment; a price that turns out to be wrong is
 *      a number a member can hold the gym to, and this site has four real
 *      members on it. Payments were left out of v1 deliberately and the
 *      gym takes money in person, so the page says exactly that.
 *
 * What a plan is NOT: an entitlement. Choosing one grants nothing and
 * restricts nothing — a member who picks none can book precisely what a
 * member on the six-month plan can book. It records an interest for the
 * gym to follow up on. If that ever stops being true, the copy here and
 * the migration's header comment both have to change with it.
 *
 * The class names referenced below (Beginner, Intermediate, Advanced, Open
 * Gym) are real — they come from the timetable in schedule.ts — so the
 * invented part is which of them each plan covers, not that they exist.
 */

export type PlanSlug = "basic" | "intermediate" | "advanced";

export type Plan = {
  readonly slug: PlanSlug;
  readonly name: string;
  /** Length of the block, in months. */
  readonly months: number;
  /** One line, shown under the name. */
  readonly tagline: string;
  /** What the plan covers. Bullet points on the card. */
  readonly includes: readonly string[];
  /** Has the gym confirmed this plan exists as described? */
  readonly confirmed: boolean;
};

export const plans: readonly Plan[] = [
  {
    slug: "basic",
    name: "Basic",
    months: 1,
    tagline: "One month to find out whether this is for you.",
    includes: [
      "Beginner classes, morning and evening",
      "Train at your own pace, no minimum",
      "Gloves and wraps to borrow while you decide",
    ],
    confirmed: false,
  },
  {
    slug: "intermediate",
    name: "Intermediate",
    months: 3,
    tagline: "Three months to turn it into a habit.",
    includes: [
      "Every graded class — Beginner through Advanced",
      "Friday open gym",
      "Technique check-ins with a coach",
    ],
    confirmed: false,
  },
  {
    slug: "advanced",
    name: "Advanced",
    months: 6,
    tagline: "Six months, the whole timetable, nothing held back.",
    includes: [
      "Everything in Intermediate",
      "Saturday sparring and pad rounds",
      "Priority booking on the evening classes",
    ],
    confirmed: false,
  },
];

const SLUGS: ReadonlySet<string> = new Set(plans.map((plan) => plan.slug));

/** Narrows a value off the wire. Anything unrecognised is "no plan". */
export function isPlanSlug(value: unknown): value is PlanSlug {
  return typeof value === "string" && SLUGS.has(value);
}

export function planBySlug(slug: PlanSlug): Plan | undefined {
  return plans.find((plan) => plan.slug === slug);
}

/**
 * Drives the draft notice on the plans page. Computed rather than a
 * constant so that confirming the plans is one edit per plan and nobody
 * has to remember there is a second switch somewhere.
 */
export const plansAreConfirmed = plans.every((plan) => plan.confirmed);

/** "1 month" / "3 months" — one place, so the cards and /account agree. */
export function planDuration(plan: Plan): string {
  return `${plan.months} ${plan.months === 1 ? "month" : "months"}`;
}
