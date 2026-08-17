/**
 * Money, in and out.
 *
 * Everything here works in integer cents. Nothing in this project ever
 * holds an amount as a float: `0.1 + 0.2 !== 0.3` in binary floating point,
 * and the place that error surfaces is a total read aloud at a counter to
 * somebody handing over cash.
 *
 * The gym is in Jersey City, so the currency is US dollars. Declared once
 * here rather than passed around, because a second currency is a business
 * change — new prices, new tax, a conversation — not a parameter.
 */

const CURRENCY = "USD";
const LOCALE = "en-US";

const formatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
});

/** 30000 → "$300.00" */
export function formatMoney(cents: number): string {
  return formatter.format(cents / 100);
}

/**
 * What the owner types, back into cents.
 *
 * Parsed by string surgery rather than `Math.round(parseFloat(x) * 100)`,
 * and the difference is not theoretical: `parseFloat("8.115") * 100` is
 * 811.4999999999999, which rounds to 811 and quietly loses a cent. Cutting
 * the string at the decimal point cannot lose anything.
 *
 * Returns null for anything that is not a plain amount, so the caller
 * reports "that is not a number" rather than storing a silent zero.
 */
export function parseMoneyToCents(raw: string): number | null {
  // Currency symbols, thousands separators and stray spaces are what a
  // person actually types when copying a figure. Strip them, then insist
  // on what is left being a number.
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  if (cleaned === "") return null;

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, whole = "0", fraction = ""] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Cents back into what belongs in a text input: "300", "300.50".
 *
 * Deliberately not `formatMoney` — a `$` and a thousands separator inside
 * an input are characters the owner then has to delete before typing, and
 * `parseMoneyToCents` would have to accept its own output anyway.
 */
export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0")}`;
}
