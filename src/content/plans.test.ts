import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  commitmentBySlug,
  commitments,
  isCommitmentSlug,
  isPlanSlug,
  planBySlug,
  plans,
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

  it("accepts exactly the three real commitment terms", () => {
    for (const commitment of commitments) {
      assert.equal(isCommitmentSlug(commitment.slug), true);
    }
    assert.equal(isCommitmentSlug("annual"), false);
    assert.equal(isCommitmentSlug(null), false);
  });
});
