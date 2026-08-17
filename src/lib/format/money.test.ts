import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { centsToInput, formatMoney, parseMoneyToCents } from "./money.ts";

/**
 * Money is the one number in this project a member can hold the gym to.
 * Every case below is something a person would plausibly type into the
 * price box at a counter.
 */

describe("parseMoneyToCents", () => {
  it("reads plain amounts", () => {
    assert.equal(parseMoneyToCents("300"), 30000);
    assert.equal(parseMoneyToCents("300.50"), 30050);
    assert.equal(parseMoneyToCents("0"), 0);
  });

  it("reads one decimal place as tens of cents, not units", () => {
    // "300.5" is three hundred dollars fifty, not three hundred and five
    // cents. Padding the fraction is what makes that true.
    assert.equal(parseMoneyToCents("300.5"), 30050);
  });

  it("tolerates what people actually type", () => {
    assert.equal(parseMoneyToCents(" $1,200.00 "), 120000);
    assert.equal(parseMoneyToCents("$99"), 9900);
  });

  it("does not lose a cent to floating point", () => {
    // Math.round(parseFloat("8.115") * 100) is 811 — the float is
    // 811.4999999999999. String surgery cannot make that mistake.
    assert.equal(parseMoneyToCents("8.11"), 811);
    assert.equal(parseMoneyToCents("0.29"), 29);
    assert.equal(parseMoneyToCents("1.10"), 110);
  });

  it("refuses anything that is not an amount", () => {
    for (const bad of ["", "  ", "abc", "-50", "1.234", "1.2.3", "1e3", "£20"]) {
      assert.equal(parseMoneyToCents(bad), null, `expected null for ${JSON.stringify(bad)}`);
    }
  });
});

describe("centsToInput", () => {
  it("round-trips through the parser", () => {
    for (const cents of [0, 5, 99, 100, 30050, 120000]) {
      assert.equal(parseMoneyToCents(centsToInput(cents)), cents);
    }
  });

  it("drops a pointless .00 so the box is not fiddly to edit", () => {
    assert.equal(centsToInput(30000), "300");
    assert.equal(centsToInput(30050), "300.50");
    assert.equal(centsToInput(30005), "300.05");
  });
});

describe("formatMoney", () => {
  it("renders dollars", () => {
    assert.equal(formatMoney(30000), "$300.00");
    assert.equal(formatMoney(0), "$0.00");
  });
});
