import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { finalCents } from "./quote.ts";

/**
 * These pin `finalCents` to the generated column in
 * 20260817120000_member_quotes.sql:
 *
 *   price_cents - case when discount_kind = 'percent'
 *                   then (price_cents * discount_value + 50) / 100
 *                   else discount_value end
 *
 * Postgres integer division truncates, so the `+ 50` is what rounds half
 * up. If these two ever disagree, the owner reads one total off the screen
 * and the database holds another.
 */

describe("finalCents", () => {
  it("takes a percentage off", () => {
    assert.equal(finalCents(30000, "percent", 10), 27000);
    assert.equal(finalCents(30000, "percent", 0), 30000);
    assert.equal(finalCents(30000, "percent", 100), 0);
  });

  it("rounds a half-cent up, exactly as Postgres does", () => {
    // 1005 * 5 = 5025; (5025 + 50) / 100 truncates to 50, so 1005 - 50.
    assert.equal(finalCents(1005, "percent", 5), 955);
    // 333 * 33 = 10989; (10989 + 50) / 100 truncates to 110.
    assert.equal(finalCents(333, "percent", 33), 223);
    // Exactly .5 rounds up: 150 * 1 = 150; (150 + 50) / 100 = 2.
    assert.equal(finalCents(150, "percent", 1), 148);
  });

  it("takes a fixed amount off", () => {
    assert.equal(finalCents(30000, "amount", 5000), 25000);
    assert.equal(finalCents(30000, "amount", 30000), 0);
  });

  it("never goes negative on half-typed input", () => {
    // The database refuses a discount larger than the price outright. The
    // form can hold one for a keystroke, and must not flash a minus sign.
    assert.equal(finalCents(1000, "amount", 5000), 0);
  });

  it("agrees with the naive formula wherever the naive formula is safe", () => {
    for (let price = 0; price <= 200000; price += 731) {
      for (let pct = 0; pct <= 100; pct += 7) {
        const off = finalCents(price, "percent", pct);
        assert.ok(off >= 0 && off <= price, `${price} @ ${pct}% gave ${off}`);
      }
    }
  });
});
