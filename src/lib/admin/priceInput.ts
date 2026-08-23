import { formatMoney, parseMoneyToCents } from "@/lib/format/money";
import { PRICE_MAX_CENTS } from "@/lib/plans/priceRows";

/**
 * What the owner typed into the pricing form, read strictly.
 *
 * Its own module rather than a helper inside `actions.ts`, for the same
 * reason `quote.ts` is separate: a `"use server"` file may export only
 * async functions, so nothing in one can be unit tested. This is the
 * half of the pricing action that is worth testing — everything else
 * there is a round trip to Postgres.
 *
 * The rules here mirror `plan_prices`' check constraints exactly, and
 * the point of duplicating them is the message. Postgres refuses a bad
 * pair with 23514 and no indication of which of two numbers to change;
 * these return a sentence naming the field. The database is still the
 * enforcement — this is only what makes the refusal usable.
 */

export type PriceField =
  | { readonly ok: true; readonly cents: number | null }
  | { readonly ok: false; readonly message: string };

/**
 * `required` separates the two fields' rules: the monthly rate must be
 * there, and an empty contract box means "this plan has one price only"
 * rather than an error. That is Kids today, and it is the gym's pricing
 * rather than a gap in ours.
 */
export function readPriceField(raw: unknown, required: boolean): PriceField {
  const text = typeof raw === "string" ? raw.trim() : "";

  if (text === "") {
    return required
      ? { ok: false, message: "Enter the monthly price." }
      : { ok: true, cents: null };
  }

  const cents = parseMoneyToCents(text);
  if (cents === null) {
    return { ok: false, message: `“${text}” is not an amount. Try 125 or 125.50.` };
  }
  if (cents <= 0) {
    // A free class is a different conversation, not a price, and "$0"
    // on a class card reads as a bug rather than as an offer.
    return { ok: false, message: "A price has to be more than nothing." };
  }
  if (cents > PRICE_MAX_CENTS) {
    // Matches plan_prices_price_sane. A rail against a slipped decimal
    // point, not a rule about what a gym may charge.
    return { ok: false, message: "That looks like a slip — check the decimal point." };
  }

  return { ok: true, cents };
}

/**
 * The pair, judged together.
 *
 * Together is the only way it can be judged: the constraint is about the
 * relationship between two numbers, so a form that saved them one at a
 * time could not lower a monthly rate below its own contract rate
 * without passing through a state the gym does not sell.
 */
export type PricePair =
  | { readonly ok: true; readonly priceCents: number; readonly contractCents: number | null }
  | { readonly ok: false; readonly message: string };

export function readPricePair(price: unknown, contract: unknown): PricePair {
  const monthly = readPriceField(price, true);
  if (!monthly.ok) return { ok: false, message: monthly.message };
  // `required: true` guarantees it. Narrowed for the type checker.
  if (monthly.cents === null) {
    return { ok: false, message: "Enter the monthly price." };
  }

  const contractField = readPriceField(contract, false);
  if (!contractField.ok) return { ok: false, message: contractField.message };

  /**
   * THE INVARIANT, CHECKED HERE SO THE OWNER GETS A SENTENCE.
   *
   * Every surface presents the contract figure as the cheaper one, so a
   * higher one renders as a discount that costs more. Postgres refuses
   * it as well — see `plan_prices_contract_not_higher` — and that is the
   * enforcement. This is what makes the refusal say which number to
   * change.
   */
  if (contractField.cents !== null && contractField.cents > monthly.cents) {
    return {
      ok: false,
      message:
        `The contract rate (${formatMoney(contractField.cents)}) is higher than ` +
        `the monthly rate (${formatMoney(monthly.cents)}). It is shown to members ` +
        `as the cheaper option, so it cannot be the dearer one.`,
    };
  }

  return { ok: true, priceCents: monthly.cents, contractCents: contractField.cents };
}
