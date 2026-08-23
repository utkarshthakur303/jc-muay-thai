import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readPriceField, readPricePair } from "./priceInput.ts";

/**
 * The owner types these numbers on a phone, standing in a gym, and they
 * end up on the front page of the website. Every case below is a way a
 * plausible keystroke could put a figure there that the gym never
 * agreed to.
 */

const fail = (result: { ok: boolean }) => result.ok === false;

describe("reading one price field", () => {
  it("takes a plain amount", () => {
    assert.deepEqual(readPriceField("125", true), { ok: true, cents: 12_500 });
  });

  it("takes cents", () => {
    assert.deepEqual(readPriceField("125.50", true), { ok: true, cents: 12_550 });
  });

  it("takes what a person actually pastes", () => {
    // A figure copied off their own website arrives with the symbol and
    // the separator attached.
    assert.deepEqual(readPriceField(" $1,250 ", true), { ok: true, cents: 125_000 });
  });

  it("treats an empty required field as missing", () => {
    assert.ok(fail(readPriceField("", true)));
    assert.ok(fail(readPriceField("   ", true)));
  });

  it("treats an empty optional field as 'one price only'", () => {
    assert.deepEqual(readPriceField("", false), { ok: true, cents: null });
    assert.deepEqual(readPriceField("  ", false), { ok: true, cents: null });
  });

  it("refuses words", () => {
    assert.ok(fail(readPriceField("free", true)));
    assert.ok(fail(readPriceField("125 or so", true)));
  });

  it("refuses a negative", () => {
    // The minus is not part of the accepted grammar, so this is caught
    // as "not an amount" rather than as a negative number.
    assert.ok(fail(readPriceField("-50", true)));
  });

  it("refuses nothing at all as a price", () => {
    assert.ok(fail(readPriceField("0", true)));
    assert.ok(fail(readPriceField("0.00", true)));
    assert.ok(fail(readPriceField("0", false)));
  });

  it("refuses a slipped decimal point", () => {
    assert.ok(fail(readPriceField("10001", true)));
    assert.deepEqual(readPriceField("10000", true), { ok: true, cents: 1_000_000 });
  });

  it("refuses more than two decimal places rather than rounding one away", () => {
    assert.ok(fail(readPriceField("125.555", true)));
  });

  it("refuses anything that is not a string", () => {
    // FormData.get returns File | string | null. None of the other two
    // are a price, and a File must not stringify into one.
    assert.ok(fail(readPriceField(null, true)));
    assert.ok(fail(readPriceField(12_500, true)));
    assert.ok(fail(readPriceField(undefined, true)));
  });

  it("quotes back what was typed, so the owner can see the typo", () => {
    const result = readPriceField("12o", true);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.message.includes("12o"), result.ok === false ? result.message : "");
  });
});

describe("reading the pair", () => {
  it("takes a normal plan", () => {
    assert.deepEqual(readPricePair("125", "99"), {
      ok: true,
      priceCents: 12_500,
      contractCents: 9_900,
    });
  });

  it("takes a plan with one price only", () => {
    assert.deepEqual(readPricePair("99", ""), {
      ok: true,
      priceCents: 9_900,
      contractCents: null,
    });
  });

  it("allows the two to be equal", () => {
    const result = readPricePair("100", "100");
    assert.equal(result.ok, true);
  });

  /**
   * THE ONE THAT MATTERS. Every surface shows the contract figure as the
   * cheaper option, so this pair would render as a discount that costs
   * more — and both numbers look perfectly plausible alone.
   */
  it("refuses a contract rate above the monthly rate", () => {
    const result = readPricePair("100", "120");
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.message.includes("$120.00"));
    assert.ok(result.ok === false && result.message.includes("$100.00"));
  });

  it("refuses it by a single cent, too", () => {
    assert.ok(fail(readPricePair("100", "100.01")));
  });

  /**
   * The whole reason both fields are one form. Lowering a monthly rate
   * below the old contract rate is a legitimate edit, and it only works
   * if the pair is judged after both are typed.
   */
  it("lets both move down together in one go", () => {
    assert.deepEqual(readPricePair("80", "70"), {
      ok: true,
      priceCents: 8_000,
      contractCents: 7_000,
    });
  });

  it("reports the monthly field first when both are wrong", () => {
    // Otherwise the owner fixes the contract rate and is then told the
    // monthly one was wrong all along.
    const result = readPricePair("abc", "xyz");
    assert.ok(result.ok === false && result.message.includes("abc"));
  });

  it("refuses a missing monthly rate even with a contract rate present", () => {
    assert.ok(fail(readPricePair("", "99")));
  });
});
