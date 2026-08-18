"use client";

import { useActionState } from "react";

import {
  commitments,
  plans,
  type CommitmentSlug,
  type PlanSlug,
} from "@/content/plans";
import { formatPrice } from "@/lib/format/money";
import { choosePlan } from "@/lib/plans/actions";
import { initialPlanState } from "@/lib/plans/state";

/**
 * The four classes, as four submit buttons in one form, with the
 * commitment term as a radio group above them.
 *
 * TWO QUESTIONS, ONE PRESS. A browser submits the name and value of the
 * button actually pressed, alongside every checked radio in the same
 * form. So pressing "Intermediate" sends both the class and the term with
 * no client state at all — no `useState` deciding what is selected, and
 * therefore no way for what is highlighted to disagree with what is sent.
 *
 * The whole card is the button, not a button inside a card. A card with a
 * "Choose" button at the bottom gives you a large obvious target that does
 * nothing and a small one that works; people press the card.
 *
 * NO PRESELECTED TERM, and that is deliberate. Defaulting to "month to
 * month" would record a decision nobody made, on the axis that actually
 * moves the price at this gym. Left blank, the row says "picked a class,
 * hasn't settled the term" — which is true, and is what the owner then
 * talks through at the desk.
 *
 * BOTH PRICES ARE ON EVERY CARD rather than one price that reacts to the
 * radio. A reactive figure needs client state, and the state it needs is
 * the one thing this form has managed to do without. Showing both is also
 * how the gym advertises it, and it means the discount is legible before
 * you have chosen anything.
 *
 * `useActionState` rather than a bare form action, because the action
 * reports failures by returning them. It succeeds by redirecting, which
 * throws — so a returned state is always a failure, and the component is
 * still mounted to render it. (The unmount problem that pushed ClassAction
 * off `useActionState` does not arise here: nothing on this page is
 * removed by its own success.)
 */

export function PlanPicker({
  next,
  current,
  currentCommitment,
}: {
  /** Where to go once a choice is recorded. */
  next: string;
  /** The member's existing answer, when they are here to change it. */
  current: PlanSlug | null;
  /** Their existing term, so returning here does not silently drop it. */
  currentCommitment: CommitmentSlug | null;
}) {
  const [state, formAction, pending] = useActionState(
    choosePlan,
    initialPlanState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />

      {/*
        The term first, because it is the shorter question and because it
        changes the number on every card below it.

        A real <fieldset>/<legend>, not a heading and some inputs. It is
        what makes a screen reader announce "How long do you want to
        commit for?" before each option instead of reading three
        unattached labels — the difference between a question and a list.
      */}
      <fieldset className="mt-8 rounded-card border border-border p-5 sm:p-6">
        <legend className="label-mono px-2">
          How long do you want to commit for?
        </legend>

        <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
          {commitments.map((commitment) => (
            <label
              key={commitment.slug}
              className="flex min-h-11 cursor-pointer gap-3 rounded-[14px] border border-border p-3.5 transition-colors hover:border-accent has-checked:border-ink has-checked:ring-2 has-checked:ring-ink"
            >
              <input
                type="radio"
                name="commitment"
                value={commitment.slug}
                defaultChecked={commitment.slug === currentCommitment}
                disabled={pending}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-text">
                  {commitment.name}
                </span>
                <span className="text-[12px] leading-snug text-text-3">
                  {commitment.blurb}
                </span>
              </span>
            </label>
          ))}
        </div>

        <p className="mt-3.5 text-[12px] leading-snug text-text-3">
          Optional — leave it blank and the gym will talk it through with
          you.
        </p>
      </fieldset>

      <ul role="list" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.slug === current;

          return (
            <li key={plan.slug} className="flex">
              <button
                type="submit"
                name="slug"
                value={plan.slug}
                disabled={pending}
                /*
                  The visible copy is a heading, a price, a line of prose
                  and a list, so the accessible name is assembled here —
                  otherwise a screen reader reads the entire card as the
                  button's label, bullet points and all, before saying
                  "button". The price is included because it is the fact
                  most likely to decide the press.
                */
                aria-label={`Choose ${plan.name}, ${formatPrice(plan.priceCents)} a month`}
                className={`flex w-full flex-col rounded-card border bg-card card-gradient p-6 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isCurrent
                    ? "border-ink ring-2 ring-ink"
                    : "border-border hover:border-accent"
                }`}
              >
                {/*
                  The name alone on its line. It is set in Anton, which
                  cannot shrink or break, and "ADVANCED & FIGHTER" is
                  already wider than a four-up card at 1024px — anything
                  sharing the row with it hangs off the edge. The price
                  goes underneath, where it also reads better.
                */}
                <span className="font-display text-2xl leading-tight tracking-wide text-text">
                  {plan.name.toUpperCase()}
                </span>

                <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-lg tabular-nums text-text">
                    {formatPrice(plan.priceCents)}
                  </span>
                  <span className="font-mono text-[11px] tracking-widest text-text-3 uppercase">
                    / month
                  </span>
                </span>

                {/*
                  The contract rate, where there is one. Kids has none —
                  the gym advertises that class at a single price, so the
                  line is absent rather than repeating the same figure
                  under a "discount" label that discounts nothing.
                */}
                {plan.contractPriceCents !== null ? (
                  <span className="mt-1 font-mono text-[11px] leading-snug text-accent-strong">
                    {formatPrice(plan.contractPriceCents)} on a 12-week
                    contract
                  </span>
                ) : null}

                <span className="mt-3 text-sm leading-relaxed text-text-2">
                  {plan.tagline}
                </span>

                <ul role="list" className="mt-4 flex flex-1 flex-col gap-2">
                  {plan.includes.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-[13px] leading-snug text-text-2"
                    >
                      <span aria-hidden className="text-accent-strong">
                        ·
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <span
                  aria-hidden
                  className={`mt-5 flex min-h-11 items-center justify-center rounded-full px-5 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase ${
                    isCurrent
                      ? "bg-ink text-chalk"
                      : "bg-accent text-ink"
                  }`}
                >
                  {isCurrent ? "Your plan" : "Choose"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {state.status === "error" && state.message ? (
        <p role="alert" className="mt-6 text-sm leading-snug text-danger">
          {state.message}
        </p>
      ) : null}

      {/*
        The way out.

        Without it this screen is a wall in front of the one thing members
        actually use the site for, and the four people already booking
        classes would hit it tomorrow morning. It submits an empty slug,
        which stores a row with no plan — a real answer, recorded, so
        nobody is asked twice. It is a quiet link rather than another card
        because it is an escape hatch, not another option.
      */}
      <div className="mt-8 border-t border-divider pt-6">
        <button
          type="submit"
          name="slug"
          value=""
          disabled={pending}
          className="min-h-11 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase underline underline-offset-4 transition-colors hover:text-text disabled:opacity-60"
        >
          {pending ? "Saving…" : "I'll decide later — take me to booking"}
        </button>
      </div>
    </form>
  );
}
