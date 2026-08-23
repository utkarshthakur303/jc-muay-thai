import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  commitmentBySlug,
  commitments,
  isCommitmentSlug,
  isPlanSlug,
  MONTHS_PER_YEAR,
  planBySlug,
  plans,
  priceDisplayFor,
  priceFor,
} from "./plans.ts";

/**
 * These are the gym's published prices, and the site now shows them in
 * three places — the class cards, the plan picker, and as the starting
 * figure in the admin quote box. A member can hold the gym to any of
 * them, so the cases below are about the ways two of those three could
 * quietly come to disagree.
 */

describe("the published prices", () => {
  it("match the gym's own site, to the cent", () => {
    // From jcmuaythai201.com/classes, 2026-08-18. If one of these ever
    // fails, the price on the site changed — go and check that it changed
    // deliberately, because this is the number people are quoted.
    const expected: Record<string, [number, number | null]> = {
      beginner: [12_500, 9_900],
      intermediate: [15_000, 12_500],
      advanced: [19_000, 16_500],
      kids: [9_900, null],
    };

    for (const plan of plans) {
      const row = expected[plan.slug];
      assert.ok(row, `unexpected plan "${plan.slug}"`);
      assert.equal(plan.priceCents, row[0], plan.slug);
      assert.equal(plan.contractPriceCents, row[1], `${plan.slug} contract`);
    }

    assert.equal(plans.length, Object.keys(expected).length);
  });

  it("never make a contract cost more than paying monthly", () => {
    // A "discount" that costs more is the kind of mistake that survives
    // review because both figures look plausible on their own. plans.ts
    // asserts this at module load too; this is the test that says why.
    for (const plan of plans) {
      if (plan.contractPriceCents === null) continue;
      assert.ok(
        plan.contractPriceCents < plan.priceCents,
        `${plan.slug}: contract rate is not lower`,
      );
    }
  });
});

describe("priceFor", () => {
  const beginner = planBySlug("beginner");
  const kids = planBySlug("kids");
  const contract = commitmentBySlug("contract");
  const monthly = commitmentBySlug("monthly");
  const trial = commitmentBySlug("trial");

  it("charges the contract rate only on a contract", () => {
    assert.ok(beginner && contract && monthly && trial);
    assert.equal(priceFor(beginner, contract), 9_900);
    assert.equal(priceFor(beginner, monthly), 12_500);
    assert.equal(priceFor(beginner, trial), 12_500);
  });

  it("charges the standard rate when no term has been chosen", () => {
    // The common case: a member picks a class and leaves the term to the
    // desk. Quoting them the discounted rate for a commitment they have
    // not made would be a figure the gym then has to walk back.
    assert.ok(beginner);
    assert.equal(priceFor(beginner, null), 12_500);
  });

  it("keeps one price for Kids on every term", () => {
    // The gym advertises Kids at a single rate. A plan with no contract
    // price must not fall through to a discount that does not exist.
    assert.ok(kids && contract && monthly);
    assert.equal(priceFor(kids, contract), 9_900);
    assert.equal(priceFor(kids, monthly), 9_900);
    assert.equal(priceFor(kids, null), 9_900);
  });
});

describe("narrowing values off the wire", () => {
  it("rejects the plan slugs that were retired on 2026-08-18", () => {
    // 'basic' was a real stored value until the migration cleared it. A
    // row that somehow still holds one must read as "no plan", never as a
    // plan whose price we then quote.
    assert.equal(isPlanSlug("basic"), false);
    assert.equal(isPlanSlug("beginner"), true);
    assert.equal(isPlanSlug(null), false);
    assert.equal(isPlanSlug(undefined), false);
    assert.equal(isPlanSlug(""), false);
    assert.equal(isPlanSlug(3), false);
  });

  it("accepts exactly the four known commitment terms", () => {
    for (const commitment of commitments) {
      assert.equal(isCommitmentSlug(commitment.slug), true);
    }

    // 'annual' was asserted FALSE here until 2026-08-23, and the reversal
    // is deliberate rather than a loosened test: the client asked for a
    // monthly/yearly toggle, so the value now exists. What must stay true
    // is that the set is closed — a database CHECK allows exactly these
    // four, and anything else read off the wire is "no term chosen".
    assert.equal(isCommitmentSlug("annual"), true);
    assert.equal(commitments.length, 4);

    assert.equal(isCommitmentSlug("yearly"), false);
    assert.equal(isCommitmentSlug("basic"), false);
    assert.equal(isCommitmentSlug(null), false);
    assert.equal(isCommitmentSlug(""), false);
  });
});

/**
 * The yearly view is arithmetic on a real price, not a price of its own.
 * These are the tests that stop it quietly becoming something else — a
 * rounded "nicer" number, or a year that borrows the contract discount
 * the gym only gives on a 12-week contract.
 */
describe("the yearly view", () => {
  const annual = commitmentBySlug("annual");
  const monthly = commitmentBySlug("monthly");
  const contract = commitmentBySlug("contract");

  it("is exactly twelve months, for every plan", () => {
    assert.ok(annual);
    for (const plan of plans) {
      const shown = priceDisplayFor(plan, annual);
      assert.equal(shown.basis, "year", plan.slug);
      assert.equal(shown.cents, plan.priceCents * MONTHS_PER_YEAR, plan.slug);
      // The monthly rate travels with the figure, because every surface
      // that shows a year has to show the arithmetic beside it.
      assert.equal(shown.perMonthCents, plan.priceCents, plan.slug);
    }
  });

  it("never gives the year the contract discount", () => {
    // The gym's discount is for committing to 12 WEEKS. A year built on
    // that rate would advertise a saving nobody at the gym has offered —
    // $1,188 for Beginners instead of $1,500, a $312 promise.
    assert.ok(annual);
    const beginner = planBySlug("beginner");
    assert.ok(beginner);
    assert.equal(annual.discounted, false);
    assert.equal(priceDisplayFor(beginner, annual).cents, 150_000);
  });

  it("leaves every other term quoted by the month", () => {
    assert.ok(monthly && contract);
    const beginner = planBySlug("beginner");
    assert.ok(beginner);

    assert.deepEqual(priceDisplayFor(beginner, monthly), {
      cents: 12_500,
      basis: "month",
      perMonthCents: 12_500,
    });
    assert.deepEqual(priceDisplayFor(beginner, contract), {
      cents: 9_900,
      basis: "month",
      perMonthCents: 9_900,
    });
    // No term chosen is the common case and must not silently become a
    // year: the member never asked to see one.
    assert.deepEqual(priceDisplayFor(beginner, null), {
      cents: 12_500,
      basis: "month",
      perMonthCents: 12_500,
    });
  });

  it("keeps the quote box working in months", () => {
    // The owner's quote box seeds from priceFor, which is a MONTHLY
    // figure. If an annual term ever made that return a year, the panel
    // would open on $1,800 for a member who pays $150 — and the generated
    // final_cents column would carry it straight into a total.
    assert.ok(annual);
    for (const plan of plans) {
      assert.equal(priceFor(plan, annual), plan.priceCents, plan.slug);
    }
  });
});
