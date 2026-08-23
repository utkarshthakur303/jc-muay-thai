import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plans, priceDisplayFor, priceFor } from "../../content/plans.ts";
import {
  builtInPrices,
  fallbackPrices,
  PRICE_MAX_CENTS,
  pricedPlanBySlug,
  pricedPlans,
  resolvePrices,
  toPrice,
  type PriceRow,
} from "./priceRows.ts";

/**
 * These figures are the ones a member reads off a card and can hold the
 * gym to. The cases below are about the ways a number arriving over a
 * network could end up on that card saying something the gym never
 * agreed to.
 */

function row(over: Partial<PriceRow> = {}): PriceRow {
  return {
    slug: "beginner",
    price_cents: 13_500,
    contract_price_cents: 10_500,
    updated_at: "2026-08-23T10:00:00.000Z",
    ...over,
  };
}

describe("reading a price row", () => {
  it("takes a well-formed row exactly as it stands", () => {
    assert.deepEqual(toPrice(row()), {
      slug: "beginner",
      priceCents: 13_500,
      contractPriceCents: 10_500,
      updatedAt: "2026-08-23T10:00:00.000Z",
    });
  });

  it("accepts a plan with no contract rate — that is Kids, not a gap", () => {
    const parsed = toPrice(row({ slug: "kids", contract_price_cents: null }));
    assert.equal(parsed?.contractPriceCents, null);
  });

  it("accepts a contract rate equal to the standard one", () => {
    // Not a discount, but not a lie either — the card simply shows the
    // same figure twice, which is what the gym would be advertising.
    const parsed = toPrice(row({ price_cents: 12_000, contract_price_cents: 12_000 }));
    assert.equal(parsed?.contractPriceCents, 12_000);
  });

  /**
   * THE ONE THAT MATTERS. Every surface presents the contract figure as
   * the cheaper one, so a higher contract rate renders as a discount
   * that costs more.
   */
  it("refuses a contract rate above the standard rate", () => {
    assert.equal(toPrice(row({ price_cents: 10_000, contract_price_cents: 12_000 })), null);
  });

  it("refuses a free or negative price", () => {
    assert.equal(toPrice(row({ price_cents: 0 })), null);
    assert.equal(toPrice(row({ price_cents: -100 })), null);
  });

  it("refuses a free or negative contract rate", () => {
    assert.equal(toPrice(row({ contract_price_cents: 0 })), null);
    assert.equal(toPrice(row({ contract_price_cents: -1 })), null);
  });

  it("refuses a slipped decimal point", () => {
    assert.equal(toPrice(row({ price_cents: PRICE_MAX_CENTS + 1 })), null);
    assert.equal(
      toPrice(row({ price_cents: PRICE_MAX_CENTS, contract_price_cents: PRICE_MAX_CENTS + 1 })),
      null,
    );
  });

  it("accepts the rail itself", () => {
    assert.equal(toPrice(row({ price_cents: PRICE_MAX_CENTS, contract_price_cents: null }))?.priceCents, PRICE_MAX_CENTS);
  });

  it("refuses a price that is not a whole number of cents", () => {
    assert.equal(toPrice(row({ price_cents: 1250.5 })), null);
  });

  it("refuses anything that is not a number at all", () => {
    assert.equal(toPrice(row({ price_cents: "12500" as unknown as number })), null);
    assert.equal(toPrice(row({ price_cents: Number.NaN })), null);
    assert.equal(toPrice(row({ contract_price_cents: "99" as unknown as number })), null);
  });

  it("refuses a slug this site does not have a plan for", () => {
    assert.equal(toPrice(row({ slug: "gold" })), null);
    assert.equal(toPrice(row({ slug: "" })), null);
  });

  it("treats a missing timestamp as no timestamp rather than failing", () => {
    // The row is still perfectly usable; only "last changed" is unknown.
    assert.equal(toPrice(row({ updated_at: null }))?.priceCents, 13_500);
  });
});

describe("resolving a set of rows", () => {
  it("keeps every plan priced even when the table has one row", () => {
    const resolved = resolvePrices([row({ slug: "advanced", price_cents: 21_000, contract_price_cents: 18_000 })]);

    assert.equal(resolved.advanced.priceCents, 21_000);
    // The other three stay on the figures compiled into the build.
    for (const plan of plans) {
      if (plan.slug === "advanced") continue;
      assert.equal(resolved[plan.slug].priceCents, plan.priceCents, plan.slug);
    }
  });

  /**
   * One bad row must cost one price, never the page. This is the whole
   * reason a row is dropped rather than defaulted.
   */
  it("drops only the unusable row and keeps the rest of the owner's edits", () => {
    const resolved = resolvePrices([
      row({ slug: "beginner", price_cents: 13_000, contract_price_cents: 11_000 }),
      row({ slug: "intermediate", price_cents: 10_000, contract_price_cents: 99_000 }),
    ]);

    assert.equal(resolved.beginner.priceCents, 13_000);
    const intermediate = plans.find((plan) => plan.slug === "intermediate");
    assert.equal(resolved.intermediate.priceCents, intermediate?.priceCents);
  });

  it("ignores a row for a plan that no longer exists", () => {
    const resolved = resolvePrices([row({ slug: "basic", price_cents: 100 })]);
    assert.deepEqual(resolved, builtInPrices());
  });

  it("returns the built-in figures for no rows at all", () => {
    assert.deepEqual(resolvePrices([]), builtInPrices());
  });
});

describe("the fallback", () => {
  it("is the figures compiled into the build, said out loud", () => {
    const { prices, source } = fallbackPrices();
    assert.equal(source, "fallback");
    for (const plan of plans) {
      assert.equal(prices[plan.slug].priceCents, plan.priceCents, plan.slug);
      assert.equal(prices[plan.slug].contractPriceCents, plan.contractPriceCents, plan.slug);
      assert.equal(prices[plan.slug].updatedAt, null, plan.slug);
    }
  });
});

describe("applying prices to the plans", () => {
  it("changes the money and nothing else", () => {
    const priced = pricedPlans({
      source: "database",
      prices: { ...builtInPrices(), beginner: { slug: "beginner", priceCents: 14_000, contractPriceCents: 11_000, updatedAt: null } },
    });

    const before = plans.find((plan) => plan.slug === "beginner");
    const after = pricedPlanBySlug(priced, "beginner");

    assert.equal(after?.priceCents, 14_000);
    assert.equal(after?.contractPriceCents, 11_000);
    // Copy is code and did not move.
    assert.equal(after?.name, before?.name);
    assert.equal(after?.tagline, before?.tagline);
    assert.deepEqual(after?.includes, before?.includes);
  });

  it("keeps the order the gym orders them in", () => {
    const priced = pricedPlans(fallbackPrices());
    assert.deepEqual(
      priced.map((plan) => plan.slug),
      plans.map((plan) => plan.slug),
    );
  });

  it("hands back the identical object when nothing changed", () => {
    const priced = pricedPlans(fallbackPrices());
    priced.forEach((plan, index) => {
      assert.equal(plan, plans[index], plan.slug);
    });
  });

  /**
   * The point of returning a `Plan`: the one function that decides what
   * a plan costs on a term keeps working, and the yearly figure keeps
   * following the monthly one instead of being stored beside it.
   */
  it("feeds priceFor and priceDisplayFor without either knowing", () => {
    const priced = pricedPlans({
      source: "database",
      prices: { ...builtInPrices(), advanced: { slug: "advanced", priceCents: 20_000, contractPriceCents: 17_000, updatedAt: null } },
    });
    const advanced = pricedPlanBySlug(priced, "advanced");
    assert.ok(advanced);

    const contract = { slug: "contract", name: "", blurb: "", discounted: true, basis: "month" } as const;
    const annual = { slug: "annual", name: "", blurb: "", discounted: false, basis: "year" } as const;

    assert.equal(priceFor(advanced, contract), 17_000);
    assert.equal(priceFor(advanced, null), 20_000);

    const shown = priceDisplayFor(advanced, annual);
    assert.equal(shown.cents, 240_000);
    assert.equal(shown.perMonthCents, 20_000);
    assert.equal(shown.basis, "year");
  });

  it("shows a year that is exactly twelve of the new monthly figure", () => {
    const annual = { slug: "annual", name: "", blurb: "", discounted: false, basis: "year" } as const;
    const priced = pricedPlans({
      source: "database",
      prices: { ...builtInPrices(), kids: { slug: "kids", priceCents: 10_550, contractPriceCents: null, updatedAt: null } },
    });
    const kids = pricedPlanBySlug(priced, "kids");
    assert.ok(kids);
    assert.equal(priceDisplayFor(kids, annual).cents, 10_550 * 12);
  });
});
