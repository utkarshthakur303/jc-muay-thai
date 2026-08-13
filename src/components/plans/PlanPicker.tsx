"use client";

import { useActionState } from "react";

import { plans, planDuration, type PlanSlug } from "@/content/plans";
import { choosePlan } from "@/lib/plans/actions";
import { initialPlanState } from "@/lib/plans/state";

/**
 * The three plans, as three submit buttons in one form.
 *
 * One form rather than three, with each button carrying its own
 * `name="slug" value="…"`. A browser submits the name and value of the
 * button that was actually pressed, so the choice needs no client state at
 * all — no `useState` deciding which card is selected, and therefore no
 * way for what is highlighted to disagree with what gets sent.
 *
 * The whole card is the button, not a button inside a card. A card with a
 * "Choose" button at the bottom gives you a large obvious target that does
 * nothing and a small one that works; people press the card.
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
}: {
  /** Where to go once a choice is recorded. */
  next: string;
  /** The member's existing answer, when they are here to change it. */
  current: PlanSlug | null;
}) {
  const [state, formAction, pending] = useActionState(
    choosePlan,
    initialPlanState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />

      <ul role="list" className="mt-8 grid gap-4 lg:grid-cols-3">
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
                  The visible copy is a heading, a duration and a list, so
                  the accessible name is assembled here — otherwise a
                  screen reader reads the entire card as the button's
                  label, bullet points and all, before saying "button".
                */
                aria-label={`Choose ${plan.name}, ${planDuration(plan)}`}
                className={`flex w-full flex-col rounded-card border bg-card card-gradient p-6 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isCurrent
                    ? "border-ink ring-2 ring-ink"
                    : "border-border hover:border-accent"
                }`}
              >
                {/*
                  `flex-wrap`, and it is not defensive tidying — without it
                  "3 MONTHS" hung off the edge of the Intermediate card.
                  The name is set in Anton and cannot shrink or break, the
                  duration is `shrink-0`, and the two together are wider
                  than a 192px card interior. Wrapping drops the duration
                  onto its own line exactly when it has to.
                */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-display text-2xl tracking-wide text-text">
                    {plan.name.toUpperCase()}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tracking-widest text-accent-strong uppercase">
                    {planDuration(plan)}
                  </span>
                </div>

                <span className="mt-2 text-sm leading-relaxed text-text-2">
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
        nobody is asked twice. It is a quiet link rather than a fourth
        card because it is an escape hatch, not a fourth option.
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
