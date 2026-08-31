import { env } from "@/lib/env";
import {
  fallbackPrices,
  resolvePrices,
  type PlanPrices,
  type PriceRow,
} from "@/lib/plans/priceRows";

/**
 * Reading the gym's advertised prices.
 *
 * ── A BARE fetch, FOR THE SAME REASON AS THE TIMETABLE AND THE PHOTOS ─
 * `/` must stay statically prerendered — the first non-negotiable in
 * the project's engineering rules — and the home page shows prices, on
 * every class card.
 * `lib/supabase/server.ts` calls `cookies()`, and touching `cookies()`
 * during render opts the whole route out of static generation silently:
 * the build output flips from `○ (Static)` to `ƒ (Dynamic)` and nothing
 * else complains.
 *
 * These figures are the same for every visitor and have no per-user
 * component whatsoever, so they are fetched with the publishable key
 * over plain HTTP, no session, no cookies. `plan_prices_read_all` grants
 * SELECT to `anon` deliberately: they are prices printed on a public web
 * page.
 *
 * Next's fetch cache then makes it free — one request at build time,
 * reused until the owner actually changes a price and the action calls
 * `updateTag(PLAN_PRICES_TAG)`.
 * ────────────────────────────────────────────────────────────────────
 */

export const PLAN_PRICES_TAG = "plan-prices";

export async function getPlanPrices(): Promise<PlanPrices> {
  const url =
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/plan_prices` +
    `?select=slug,price_cents,contract_price_cents,updated_at`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
      },
      next: { tags: [PLAN_PRICES_TAG] },
    });

    if (!response.ok) return fallbackPrices();

    const rows: unknown = await response.json();
    // A missing table comes back as a JSON object describing the error,
    // not an array — which is exactly the distinction that matters here.
    if (!Array.isArray(rows)) return fallbackPrices();

    /**
     * ZERO ROWS IS NOT AN ANSWER, and this is where that is decided.
     *
     * Photographs went the other way: an empty `site_images` means the
     * owner deleted them all, and the gallery correctly disappears. A
     * gym with no prices is not a thing this site can render — every
     * class card carries a price line and the plan picker is a price
     * comparison. So an empty table is read as "not seeded" and the
     * built-in figures stand, exactly as the timetable does.
     *
     * The table has no DELETE grant, so an empty read means the
     * migration ran without its seed, or something is wrong. Either way
     * the site should look like yesterday.
     */
    if (rows.length === 0) return fallbackPrices();

    return {
      prices: resolvePrices(rows as readonly PriceRow[]),
      source: "database",
    };
  } catch {
    return fallbackPrices();
  }
}

export {
  builtInPrices,
  fallbackPrices,
  PRICE_MAX_CENTS,
  pricedPlanBySlug,
  pricedPlans,
  resolvePrices,
  toPrice,
} from "@/lib/plans/priceRows";
export type {
  PlanPrice,
  PlanPrices,
  PriceRow,
  PricesSource,
} from "@/lib/plans/priceRows";
