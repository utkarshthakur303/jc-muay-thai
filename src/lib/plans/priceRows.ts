import { plans, type Plan, type PlanSlug } from "@/content/plans";

/**
 * The pure half of plan pricing: what a price row means, and how the
 * plans look once one is applied.
 *
 * A separate module from `prices.ts` for the same reason `state.ts` is
 * separate from `actions.ts` — `prices.ts` imports `@/lib/env`, which
 * validates the environment at module load and throws without it. That
 * is right for the app and fatal for a test runner, so everything
 * testable lives here and imports nothing but content.
 */

export type PlanPrice = {
  readonly slug: PlanSlug;
  readonly priceCents: number;
  /** Null means this plan has one price only. That is Kids today. */
  readonly contractPriceCents: number | null;
  /** ISO timestamp of the last edit, or null for a figure off the build. */
  readonly updatedAt: string | null;
};

/**
 * Where the figures came from.
 *
 * `fallback` means the migration has not been applied, or Supabase could
 * not be reached — the site draws the prices compiled into the build.
 * The public pages are identical either way, because the seed and the
 * built-ins are the same four numbers.
 *
 * The PANEL is what cares. A price the owner cannot save is a form that
 * lies about what pressing Save will do, so the pricing page reads this
 * and refuses to pretend.
 */
export type PricesSource = "database" | "fallback";

export type PlanPrices = {
  readonly prices: Readonly<Record<PlanSlug, PlanPrice>>;
  readonly source: PricesSource;
};

/** Matches `plan_prices_price_sane`. A rail against a slipped decimal. */
export const PRICE_MAX_CENTS = 1_000_000;

/**
 * The figures compiled into the build.
 *
 * Not placeholders — this is literally what the site showed before the
 * prices moved into the database, so a failed read degrades to the
 * previous version of the site rather than to a card with no price on
 * it.
 */
export function builtInPrices(): Record<PlanSlug, PlanPrice> {
  const out = {} as Record<PlanSlug, PlanPrice>;
  for (const plan of plans) {
    out[plan.slug] = {
      slug: plan.slug,
      priceCents: plan.priceCents,
      contractPriceCents: plan.contractPriceCents,
      updatedAt: null,
    };
  }
  return out;
}

export function fallbackPrices(): PlanPrices {
  return { prices: builtInPrices(), source: "fallback" };
}

export type PriceRow = {
  readonly slug: string;
  readonly price_cents: number;
  readonly contract_price_cents: number | null;
  readonly updated_at: string | null;
};

const KNOWN_SLUGS: ReadonlySet<string> = new Set(plans.map((plan) => plan.slug));

/**
 * A row is validated, not trusted, and an unusable one is DROPPED rather
 * than defaulted — so that plan alone falls back to its built-in figure
 * and every other plan keeps the owner's edit.
 *
 * The contract-above-standard check is the same rule the database
 * enforces and `src/content/plans.ts` asserts at build time. It is
 * repeated here because this is the only one of the three that runs
 * against a number which arrived over a network, and rendering a
 * "discount" that costs more is the exact failure the rule exists to
 * stop.
 */
export function toPrice(row: PriceRow): PlanPrice | null {
  if (typeof row.slug !== "string" || !KNOWN_SLUGS.has(row.slug)) return null;
  if (!isMoney(row.price_cents)) return null;
  if (row.price_cents <= 0 || row.price_cents > PRICE_MAX_CENTS) return null;

  const contract = row.contract_price_cents;
  const hasContract = contract !== null && contract !== undefined;

  if (hasContract) {
    if (!isMoney(contract)) return null;
    if (contract <= 0 || contract > PRICE_MAX_CENTS) return null;
    if (contract > row.price_cents) return null;
  }

  return {
    slug: row.slug as PlanSlug,
    priceCents: row.price_cents,
    contractPriceCents: hasContract ? contract : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Rows off the wire, resolved against the built-in figures.
 *
 * Every plan always gets a price. A row that is missing, or that failed
 * validation, leaves that plan on the number compiled into the build —
 * so one bad row costs one price, not the page.
 */
export function resolvePrices(rows: readonly PriceRow[]): Record<PlanSlug, PlanPrice> {
  const resolved = builtInPrices();
  for (const row of rows) {
    const price = toPrice(row);
    if (price !== null) resolved[price.slug] = price;
  }
  return resolved;
}

/**
 * The plans, carrying the prices that are actually in force.
 *
 * Returns the same `Plan` shape with two numbers swapped, which is the
 * whole point: `priceFor`, `priceDisplayFor`, the plan picker, the class
 * cards and the quote box all keep working untouched, and there is still
 * exactly one function on this site that decides what a plan costs on a
 * term.
 *
 * Everything else about a plan — its slug, its name, its tagline, what
 * it includes — comes from `src/content/plans.ts` and is unchanged. Only
 * money moved into the database.
 */
export function pricedPlans(prices: PlanPrices): readonly Plan[] {
  return plans.map((plan) => {
    const price = prices.prices[plan.slug];
    if (
      price.priceCents === plan.priceCents &&
      price.contractPriceCents === plan.contractPriceCents
    ) {
      // Same numbers: hand back the identical object, so an unchanged
      // price does not produce a new reference on every render.
      return plan;
    }
    return {
      ...plan,
      priceCents: price.priceCents,
      contractPriceCents: price.contractPriceCents,
    };
  });
}

/** One priced plan by slug, or undefined. Mirrors `planBySlug`. */
export function pricedPlanBySlug(
  priced: readonly Plan[],
  slug: PlanSlug,
): Plan | undefined {
  return priced.find((plan) => plan.slug === slug);
}
