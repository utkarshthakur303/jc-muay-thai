"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  commitmentBySlug,
  priceDisplayFor,
  type Plan,
} from "@/content/plans";
import { updatePlanPrice } from "@/lib/admin/actions";
import { initialAdminState } from "@/lib/admin/state";
import type { PlanReach } from "@/lib/admin/pricing";
import { centsToInput, formatPrice, parseMoneyToCents } from "@/lib/format/money";

/**
 * One plan's advertised prices.
 *
 * Both figures in ONE form, and that is not a layout preference. The
 * database refuses a contract rate above the monthly rate, so two
 * separate forms would make lowering a plan's monthly price below its
 * current contract price impossible without first editing the other
 * field and saving a state the gym does not sell. One submit means the
 * constraint only ever judges the finished pair.
 *
 * The preview underneath is the real point of the screen. These numbers
 * are printed on the home page, on the plan picker and on a member's own
 * account page, and the owner is entitled to see the sentence a member
 * will read before he makes it true.
 */

const FIELD =
  "min-h-11 w-full rounded-full border border-border bg-input-bg px-5 text-sm text-text placeholder:text-text-3 focus:border-accent focus:outline-none";
const LABEL =
  "block font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase";

/**
 * Filled while there is something to save, quiet while there is not.
 *
 * NOT disabled when clean, and the distinction matters: a disabled Save
 * is a dead end whenever the page's idea of "clean" and the owner's
 * disagree — which is exactly the moment he most wants to press it. It
 * stays pressable and the action answers honestly ("No change — that is
 * already the price"). What changes is only how loudly it asks to be
 * pressed.
 *
 * The label never changes with it. A primary-coloured button reading
 * "Saved" was the first version, and it read as an instruction to save
 * something that was already saved.
 */
function Submit({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  const skin = dirty
    ? "border-accent bg-accent text-ink hover:bg-accent-hover"
    : "border-border text-text-2 hover:border-accent hover:text-accent-strong";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`flex min-h-11 shrink-0 items-center rounded-full border px-6 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${skin}`}
    >
      {pending ? "Saving…" : "Save price"}
    </button>
  );
}

export function PriceForm({
  plan,
  savedPriceCents,
  savedContractCents,
  changedLabel,
  reach,
  editable,
}: {
  /** Name, tagline and slug. Copy is code; only the money is editable. */
  plan: Plan;
  /** What the database currently holds, in cents. */
  savedPriceCents: number;
  savedContractCents: number | null;
  /** "23 August 2026", or null for a figure that has never been edited. */
  changedLabel: string | null;
  reach: PlanReach;
  /**
   * False when the prices are the ones compiled into the build. The
   * fields go read-only rather than disappearing: the owner still needs
   * to see what the site is showing, and a Save that cannot save is the
   * half-built control this project does not ship.
   */
  editable: boolean;
}) {
  const [state, action] = useActionState(updatePlanPrice, initialAdminState);

  const [price, setPrice] = useState(centsToInput(savedPriceCents));
  const [contract, setContract] = useState(
    savedContractCents === null ? "" : centsToInput(savedContractCents),
  );

  /**
   * Both fields parsed leniently — half-typed input is the normal state
   * of a form, and a preview that flashes an error mid-keystroke is
   * worse than one that waits. The action does the strict validation and
   * produces the sentence.
   */
  const priceCents = parseMoneyToCents(price);
  const contractCents = contract.trim() === "" ? null : parseMoneyToCents(contract);

  const contractTooHigh =
    priceCents !== null && contractCents !== null && contractCents > priceCents;

  const dirty =
    price.trim() !== centsToInput(savedPriceCents) ||
    contract.trim() !==
      (savedContractCents === null ? "" : centsToInput(savedContractCents));

  /**
   * What a member will read, worked out through the same function the
   * public pages use. Not re-implemented here with a `* 12` — the yearly
   * figure has exactly one definition on this site and this screen is
   * not allowed a second one.
   */
  const preview =
    priceCents !== null && !contractTooHigh
      ? priceDisplayFor(
          { ...plan, priceCents, contractPriceCents: contractCents },
          commitmentBySlug("annual") ?? null,
        )
      : null;

  const contractPreview =
    contractCents !== null && !contractTooHigh ? contractCents : null;

  return (
    <li className="card-surface rounded-card border border-border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-2xl tracking-wide text-text">
          {plan.name.toUpperCase()}
        </h3>
        {/*
          Who this change is about. `quoted` is the reassuring half and
          the reason both are here — see lib/admin/pricing.ts.
        */}
        <p className="font-mono text-[11px] tracking-[0.06em] text-text-3 uppercase">
          {reach.chosen} on this plan · {reach.quoted} quoted
        </p>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-text-2">{plan.tagline}</p>

      <form action={action} className="mt-5">
        <input type="hidden" name="slug" value={plan.slug} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor={`price-${plan.slug}`}>
              Monthly rate
            </label>
            <input
              id={`price-${plan.slug}`}
              name="price"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              readOnly={!editable}
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="125"
              aria-describedby={`preview-${plan.slug}`}
              className={`${FIELD} mt-2 font-mono tabular-nums ${
                editable ? "" : "cursor-not-allowed opacity-70"
              }`}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor={`contract-${plan.slug}`}>
              12-week contract rate
            </label>
            <input
              id={`contract-${plan.slug}`}
              name="contractPrice"
              value={contract}
              onChange={(event) => setContract(event.target.value)}
              readOnly={!editable}
              inputMode="decimal"
              autoComplete="off"
              placeholder="Leave empty for one price only"
              aria-describedby={`contract-help-${plan.slug}`}
              aria-invalid={contractTooHigh || undefined}
              className={`${FIELD} mt-2 font-mono tabular-nums ${
                editable ? "" : "cursor-not-allowed opacity-70"
              }`}
            />
            <p
              id={`contract-help-${plan.slug}`}
              className="mt-2 text-[13px] leading-snug text-text-3"
            >
              Empty means this class has one price only.
            </p>
          </div>
        </div>

        {/*
          Said before the save rather than after it. The database refuses
          this pair outright, so without a line here the owner would
          press Save and get a constraint error back with no indication
          of which of the two numbers to change.
        */}
        {contractTooHigh ? (
          <p role="alert" className="mt-4 text-sm leading-relaxed text-danger">
            The contract rate is higher than the monthly rate. Members are shown
            it as the cheaper option, so it cannot be the dearer one.
          </p>
        ) : null}

        {/*
          THE PREVIEW. Every place a member meets this price, in the
          words they meet it in.
        */}
        <div
          id={`preview-${plan.slug}`}
          className="mt-5 rounded-card border border-divider px-5 py-4"
        >
          <p className={LABEL}>Members will see</p>
          {preview === null ? (
            <p className="mt-2 text-sm leading-relaxed text-text-3">
              Enter a monthly rate to see it.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-lg tabular-nums text-text">
                {formatPrice(preview.perMonthCents)}
              </span>
              <span className="font-mono text-[11px] tracking-[0.06em] text-text-3 uppercase">
                / month
              </span>
              {contractPreview !== null ? (
                <span className="font-mono text-[12px] text-accent-strong">
                  {formatPrice(contractPreview)} on a 12-week contract
                </span>
              ) : null}
              {/*
                The yearly view, because the plans page has a toggle for
                it and this is the figure it shows. Twelve monthly ones
                and nothing else — the gym does not sell a year, and the
                arithmetic is stated so nobody mistakes it for a deal.
              */}
              <span className="w-full font-mono text-[12px] text-text-3">
                {formatPrice(preview.cents)} a year — 12 ×{" "}
                {formatPrice(preview.perMonthCents)}, still billed monthly
              </span>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {editable ? <Submit dirty={dirty} /> : null}

          {state.status !== "idle" && state.message ? (
            <p
              role="status"
              className={`text-sm leading-relaxed ${
                state.status === "error" ? "text-danger" : "text-text-2"
              }`}
            >
              {state.message}
            </p>
          ) : null}

          {state.status === "idle" ? (
            <p className="font-mono text-[11px] tracking-[0.06em] text-text-3 uppercase">
              {changedLabel === null
                ? "Never changed here"
                : `Last changed ${changedLabel}`}
            </p>
          ) : null}
        </div>
      </form>
    </li>
  );
}
