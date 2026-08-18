"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { PlanSlug } from "@/content/plans";
import { clearQuote, saveQuote } from "@/lib/admin/actions";
import { finalCents, type DiscountKind, type MemberQuote } from "@/lib/admin/quote";
import { initialAdminState } from "@/lib/admin/state";
import { centsToInput, formatMoney, parseMoneyToCents } from "@/lib/format/money";

/**
 * What this member has been quoted for their plan.
 *
 * A price, a discount, and the figure that falls out of the two. It is a
 * note for the counter — nothing here charges anybody, and no member can
 * read it, which is enforced by the policies on `member_quotes` rather
 * than by this component declining to render.
 *
 * The total updates as it is typed, using the same arithmetic the database
 * generates the stored column with. That is not a nicety: the owner is
 * going to read this number out loud to somebody, and finding out it was
 * wrong after saving is finding out too late.
 */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-11 shrink-0 items-center rounded-full bg-accent px-6 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function ClearButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-11 shrink-0 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? "Clearing…" : "Clear"}
    </button>
  );
}

const FIELD =
  "min-h-11 w-full rounded-full border border-border bg-input-bg px-5 text-sm text-text placeholder:text-text-3 focus:border-accent focus:outline-none";
const LABEL =
  "block font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase";

export function QuoteForm({
  userId,
  planSlug,
  planName,
  standardPriceCents,
  quote,
}: {
  userId: string;
  /** The plan the member currently has chosen. */
  planSlug: PlanSlug;
  planName: string;
  /**
   * The gym's published rate for this plan and term, from
   * content/plans.ts. Prefills the box the first time only — an existing
   * quote is always what the owner already agreed, and must never be
   * overwritten by a list price.
   */
  standardPriceCents: number;
  quote: MemberQuote | null;
}) {
  const [state, action] = useActionState(saveQuote, initialAdminState);
  const [clearState, clearAction] = useActionState(clearQuote, initialAdminState);

  const [price, setPrice] = useState(
    centsToInput(quote ? quote.priceCents : standardPriceCents),
  );
  const [kind, setKind] = useState<DiscountKind>(quote?.discountKind ?? "percent");
  const [discount, setDiscount] = useState(
    quote
      ? quote.discountKind === "amount"
        ? centsToInput(quote.discountValue)
        : String(quote.discountValue)
      : "",
  );

  /**
   * The running total, from whatever is in the boxes right now.
   *
   * Both fields are parsed leniently — half-typed input is the normal
   * state of a form, and a total that flashes an error mid-keystroke is
   * worse than one that waits. Anything unparseable simply means "no
   * total yet"; the action does the strict validation and produces the
   * sentence.
   */
  const priceCents = parseMoneyToCents(price);
  const discountCents =
    kind === "amount" ? parseMoneyToCents(discount) : null;
  const discountPercent =
    kind === "percent" && /^\d{1,3}$/.test(discount.trim())
      ? Number(discount.trim())
      : null;

  const discountValue =
    kind === "amount" ? discountCents : discountPercent;

  const preview =
    priceCents === null
      ? null
      : finalCents(priceCents, kind, discountValue ?? 0);

  const overDiscounted =
    priceCents !== null &&
    ((kind === "amount" && discountCents !== null && discountCents > priceCents) ||
      (kind === "percent" && discountPercent !== null && discountPercent > 100));

  return (
    <section className="mt-12">
      <h2 className={LABEL}>Quote</h2>
      <p className="mt-2 max-w-prose text-[13px] leading-snug text-text-2">
        {/*
          Stated on the screen, not only in the migration. This is the one
          place in the panel showing money, and it is exactly where
          somebody would otherwise assume a payment had been taken.
        */}
        What you have quoted this member for <strong className="font-semibold text-text">{planName}</strong>.
        Visible to you only — nothing is charged, and the member is never shown a price.
      </p>

      <form action={action} className="card-surface mt-4 rounded-card border border-border p-5">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="planSlug" value={planSlug} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quote-price" className={LABEL}>
              Price
            </label>
            <input
              id="quote-price"
              name="price"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="300"
              className={`mt-2 ${FIELD}`}
            />
          </div>

          <div>
            <label htmlFor="quote-discount" className={LABEL}>
              Discount
            </label>
            <div className="mt-2 flex gap-2">
              {/*
                A real <select>, not a custom control. It is two options on
                a form the owner may well be filling in on a phone at the
                counter, and the native picker is the one his thumb already
                knows.
              */}
              <select
                name="discountKind"
                aria-label="Discount type"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value === "amount" ? "amount" : "percent")
                }
                className="min-h-11 shrink-0 rounded-full border border-border bg-input-bg px-4 text-sm text-text focus:border-accent focus:outline-none"
              >
                <option value="percent">%</option>
                <option value="amount">$ off</option>
              </select>
              <input
                id="quote-discount"
                name="discountValue"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                placeholder={kind === "percent" ? "10" : "30"}
                className={FIELD}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="quote-note" className={LABEL}>
            Note (optional)
          </label>
          <input
            id="quote-note"
            name="note"
            type="text"
            maxLength={200}
            autoComplete="off"
            defaultValue={quote?.note ?? ""}
            placeholder="Student rate, agreed at the counter"
            className={`mt-2 ${FIELD}`}
          />
        </div>

        {/*
          The figure, big and in the mono face the rest of the panel uses
          for data. `aria-live` so a screen reader hears it change rather
          than only finding it on the way past.
        */}
        <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-divider pt-5">
          <span className={LABEL}>Final amount</span>
          <span
            aria-live="polite"
            className="font-mono text-3xl tabular-nums text-text"
          >
            {overDiscounted
              ? "—"
              : preview === null
                ? "—"
                : formatMoney(preview)}
          </span>
          {priceCents !== null && preview !== null && !overDiscounted && preview !== priceCents ? (
            <span className="font-mono text-[12px] tabular-nums text-text-3">
              was {formatMoney(priceCents)}
            </span>
          ) : null}
        </div>

        {overDiscounted ? (
          <p role="alert" className="mt-3 text-[13px] leading-snug text-danger">
            {kind === "amount"
              ? "The discount is more than the price."
              : "A discount cannot be more than 100%."}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Submit label={quote ? "Update quote" : "Save quote"} />
          {state.status !== "idle" && state.message ? (
            <span
              role="status"
              className={`text-[13px] leading-snug ${
                state.status === "error" ? "text-danger" : "text-text-2"
              }`}
            >
              {state.message}
              {state.status === "success" && state.finalCents !== undefined
                ? ` Final amount ${formatMoney(state.finalCents)}.`
                : null}
            </span>
          ) : null}
        </div>
      </form>

      {quote ? (
        <form action={clearAction} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="userId" value={userId} />
          <ClearButton />
          <span className="text-[13px] leading-snug text-text-2">
            Removes the figure entirely. The member&rsquo;s plan is untouched.
          </span>
          {clearState.status === "error" && clearState.message ? (
            <span role="alert" className="text-[13px] text-danger">
              {clearState.message}
            </span>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
