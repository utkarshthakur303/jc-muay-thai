import type { PlanSlug } from "@/content/plans";

/**
 * The shape of a quote, and the one piece of arithmetic in it.
 *
 * Separate from `quotes.ts` — which is `server-only` — because two other
 * things need this and neither may import a server module: the form, which
 * shows a running total as the owner types, and the test runner, which
 * cannot resolve `server-only` at all.
 *
 * That split is also the honest one. Everything here is pure; everything
 * in `quotes.ts` touches the database.
 */

export type DiscountKind = "percent" | "amount";

export type MemberQuote = {
  /** The plan this figure was agreed for, as it stood at the time. */
  readonly planSlug: PlanSlug;
  readonly priceCents: number;
  readonly discountKind: DiscountKind;
  /** 0–100 for a percentage; cents off for a fixed amount. */
  readonly discountValue: number;
  readonly finalCents: number;
  readonly note: string | null;
  readonly updatedAt: string;
};

/**
 * The same arithmetic the database does, for showing a total before it is
 * saved.
 *
 * `final_cents` in Postgres is a generated column and is the authority.
 * This exists so the form can total up as it is typed without a round
 * trip, and the two must agree *exactly* — so it mirrors the SQL rather
 * than expressing the same idea a nicer way.
 *
 * Hence `Math.floor((price * pct + 50) / 100)` and not
 * `Math.round(price * pct / 100)`: Postgres integer division truncates,
 * and the `+ 50` is what makes that round half up. Every input is
 * non-negative, so the two are identical rather than merely close.
 * `quote.test.ts` pins it.
 */
export function finalCents(
  priceCents: number,
  kind: DiscountKind,
  discountValue: number,
): number {
  const off =
    kind === "percent"
      ? Math.floor((priceCents * discountValue + 50) / 100)
      : discountValue;

  // The database forbids a discount bigger than the price outright, so
  // this clamp never fires there. It is here because this also runs on
  // half-typed input, where it briefly can.
  return Math.max(0, priceCents - off);
}
