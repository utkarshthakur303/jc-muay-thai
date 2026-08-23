"use client";

import { useActionState, useState } from "react";

import {
  commitmentBySlug,
  commitments,
  MONTHS_PER_YEAR,
  priceDisplayFor,
  type CommitmentSlug,
  type Plan,
  type PlanSlug,
  type PriceDisplay,
} from "@/content/plans";
import { formatPrice } from "@/lib/format/money";
import { choosePlan } from "@/lib/plans/actions";
import { initialPlanState } from "@/lib/plans/state";

/**
 * The four classes, as four submit buttons in one form, with the billing
 * term above them.
 *
 * TWO QUESTIONS, ONE PRESS. A browser submits the name and value of the
 * button actually pressed, alongside every checked radio in the same
 * form. So pressing "Intermediate" sends both the class and the term.
 *
 * The whole card is the button, not a button inside a card. A card with a
 * "Choose" button at the bottom gives you a large obvious target that does
 * nothing and a small one that works; people press the card.
 *
 * ── WHY THERE IS CLIENT STATE HERE NOW, WHEN THERE DELIBERATELY WAS NOT
 *
 * This form used to run on no `useState` at all, and that was written up
 * as a virtue: nothing could highlight one term and submit another,
 * because the checked radio was the only record of the choice.
 *
 * The monthly/yearly toggle asked for on 2026-08-23 ends that. Every
 * price on the page has to move when the toggle moves, and a figure that
 * reacts needs a value React can read during render.
 *
 * The guarantee is kept a different way instead of being dropped. There
 * is ONE piece of state, `term`, and it drives both sides: `checked` on
 * each radio, and the price on every card. They cannot disagree, because
 * there is nothing for them to disagree about — what is submitted is the
 * radio whose `checked` came from the same variable the price was
 * computed from. What is gone is the ability to submit without JavaScript,
 * which this page already required for `useActionState`.
 *
 * ── WHY THE TERM IS NOW PRESELECTED, WHEN IT DELIBERATELY WAS NOT
 *
 * A toggle always sits somewhere; it cannot express "not decided". The
 * default is MONTHLY — month to month — and that direction is chosen, not
 * arbitrary: it is the gym's UNDISCOUNTED rate, so a member who never
 * touches the control is never shown less than the gym charges. Defaulting
 * to the contract rate would flatter every price on the page by up to $26
 * a month and be walked back at the desk.
 *
 * ── WHY TRIAL AND CONTRACT ARE STILL HERE, BELOW THE TOGGLE
 *
 * They are two of the gym's three real terms. Leaving them out to keep the
 * toggle to two positions would have made them unrecordable — the owner
 * would simply stop learning that anyone wanted a 12-week contract, which
 * is the term that actually saves a member money. They sit underneath in
 * smaller type because they are not billing bases, they are commitments,
 * and the toggle above is the question most people are answering.
 *
 * `useActionState` rather than a bare form action, because the action
 * reports failures by returning them. It succeeds by redirecting, which
 * throws — so a returned state is always a failure, and the component is
 * still mounted to render it.
 */

/**
 * The two the toggle switches between, and the two that sit under it.
 *
 * Split by hand rather than filtered on `basis`, because the split is
 * editorial — which question is being asked most loudly — and not a
 * property of the data. Both lists read from the same `commitments`
 * array, so a term cannot exist in this file and nowhere else.
 */
const TOGGLE_TERMS: readonly CommitmentSlug[] = ["monthly", "annual"];
const OTHER_TERMS: readonly CommitmentSlug[] = ["trial", "contract"];

/** See the note above on why this direction and not the other. */
const DEFAULT_TERM: CommitmentSlug = "monthly";

/**
 * The line under the headline figure. Null when the figure needs nothing
 * said about it — which is only ever the plain monthly rate.
 *
 * Every branch here exists because the number above it would otherwise be
 * read as something it is not.
 */
function priceNote(
  plan: Plan,
  term: CommitmentSlug,
  shown: PriceDisplay,
): string | null {
  switch (term) {
    case "annual":
      // NEVER a bare yearly total. The gym does not sell a year and does
      // not bill one; this figure is arithmetic on their monthly rate,
      // and it says so every single time it appears.
      return `${MONTHS_PER_YEAR} × ${formatPrice(shown.perMonthCents)} a month — the gym still bills monthly`;
    case "contract":
      // Kids has one advertised price and no contract rate. Saying "on a
      // 12-week contract" over an unchanged number would imply a discount
      // that does not exist.
      return plan.contractPriceCents === null
        ? `${plan.name} is one price on every term`
        : "on a 12-week contract";
    case "trial":
      // The trial's price is genuinely unpublished — the gym's own site
      // states the commitment and no figure. The number above is the
      // standard monthly rate, so the gap is named rather than papered
      // over with a guess at "free".
      return "Two weeks first — the gym does not publish a price for the trial";
    default:
      return null;
  }
}

/** Read after the amount: "$1,800 a year". */
const BASIS_WORD: Record<PriceDisplay["basis"], string> = {
  month: "month",
  year: "year",
};

export function PlanPicker({
  next,
  current,
  currentCommitment,
  plans,
}: {
  /** Where to go once a choice is recorded. */
  next: string;
  /** The member's existing answer, when they are here to change it. */
  current: PlanSlug | null;
  /** Their existing term, so returning here does not silently drop it. */
  currentCommitment: CommitmentSlug | null;
  /**
   * The plans, carrying the prices in force.
   *
   * A prop rather than the module constant, since 2026-08-23 when the
   * gym's rates moved into the database. The page fetches them; this
   * component compares them. Everything else about a plan — its name,
   * its tagline, what it includes — is still code and still arrives in
   * these same objects.
   */
  plans: readonly Plan[];
}) {
  const [state, formAction, pending] = useActionState(
    choosePlan,
    initialPlanState,
  );

  /**
   * Opens on what they already told us, so a member returning to change
   * their class does not have their term quietly reset to the default on
   * the way past.
   */
  const [term, setTerm] = useState<CommitmentSlug>(
    currentCommitment ?? DEFAULT_TERM,
  );

  const selected = commitmentBySlug(term) ?? null;

  /** For the panel's copy, so the trial is described in the gym's words. */
  const trialTerm = commitmentBySlug("trial");

  return (
    <>
      <form action={formAction}>
        <input type="hidden" name="next" value={next} />

        {/*
          A real <fieldset>/<legend>, not a heading and some inputs. It is
          what makes a screen reader announce "How do you want to pay?"
          before each option instead of reading four unattached labels — the
          difference between a question and a list.
        */}
        <fieldset className="mt-8">
          <legend className="label-mono">How do you want to pay?</legend>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
            {/*
              THE TOGGLE. One pill split in two, rather than two separate
              buttons: a segmented control reads as "one of these", which is
              what a radio group is, and two loose pills read as two
              independent switches.
            */}
            <div className="inline-flex rounded-full border border-border bg-card p-1">
              {TOGGLE_TERMS.map((slug) => {
                const commitment = commitmentBySlug(slug);
                if (!commitment) return null;
                const active = term === slug;

                return (
                  <label
                    key={slug}
                    className={`flex min-h-11 cursor-pointer items-center rounded-full px-5 font-mono text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                      /*
                        Mutually exclusive branches, never concatenated.
                        Tailwind orders utilities by variant and not by
                        position in the string, so `hover:text-text` beside
                        `text-ink` is a coin toss — which is how an active
                        segment once computed to ink on ink elsewhere in
                        this codebase.
                      */
                      active
                        ? "bg-accent text-ink"
                        : "text-text-2 hover:text-text"
                    } ${pending ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="commitment"
                      value={slug}
                      checked={active}
                      onChange={() => setTerm(slug)}
                      disabled={pending}
                      className="sr-only"
                    />
                    {commitment.name}
                  </label>
                );
              })}
            </div>

            {/*
              The gym's other two terms. Same radio group — exactly one of
              the four is ever chosen — but visually secondary, because
              these are commitments rather than billing bases.
            */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden
                className="font-mono text-[11px] tracking-[0.08em] text-text-3 lowercase"
              >
                or
              </span>
              {OTHER_TERMS.map((slug) => {
                const commitment = commitmentBySlug(slug);
                if (!commitment) return null;
                const active = term === slug;

                return (
                  <label
                    key={slug}
                    className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                      active
                        ? "border-ink bg-ink text-chalk"
                        : "border-border text-text-2 hover:border-accent hover:text-accent-strong"
                    } ${pending ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="commitment"
                      value={slug}
                      checked={active}
                      onChange={() => setTerm(slug)}
                      disabled={pending}
                      className="sr-only"
                    />
                    {commitment.name}
                  </label>
                );
              })}
            </div>
          </div>

          {/*
            What the chosen term actually means, in the gym's own words.
            `role="status"` so a screen-reader user who changes the toggle
            hears the consequence rather than having to hunt for what moved.
          */}
          {selected ? (
            <p
              role="status"
              className="mt-3 max-w-prose text-[13px] leading-relaxed text-text-3"
            >
              {selected.blurb}
            </p>
          ) : null}
        </fieldset>

        <ul
          role="list"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {plans.map((plan) => {
            const isCurrent = plan.slug === current;
            const shown = priceDisplayFor(plan, selected);
            const note = priceNote(plan, term, shown);

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
                    most likely to decide the press, and it carries its unit
                    because "$1,800" alone is alarming next to "$150".
                  */
                  aria-label={`Choose ${plan.name}, ${formatPrice(shown.cents)} a ${BASIS_WORD[shown.basis]}`}
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
                    sharing the row with it hangs off the edge.
                  */}
                  <span className="font-display text-2xl leading-tight tracking-wide text-text">
                    {plan.name.toUpperCase()}
                  </span>

                  {/*
                    THE PRICE, promoted from a 18px mono line to the display
                    face at 40–48px — the second thing on the card and the
                    first thing that reads at arm's length.

                    Anton rather than the mono used for figures elsewhere:
                    at this size mono goes wide and thin and "$1,800" ran to
                    the card edge on a 320px phone. Anton is condensed, so
                    the longest figure on the page fits the narrowest card.

                    `tabular-nums` is what stops the digits shuffling
                    sideways as the toggle changes the number underneath the
                    pointer.

                    THE SIZE STEPS BACK DOWN AT lg AND UP AGAIN AT xl, which
                    looks like a mistake and is not. The grid goes four-up at
                    1024, where a card is 228px wide — measured. At 48px,
                    "$2,280" plus "/ YEAR" is 193px against 180px of content
                    box, so the unit wrapped onto its own line for one
                    breakpoint band. 40px fits both on one line at 171px.
                    Above 1280 the card is 292px and there is room again.
                  */}
                  <span className="mt-2 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-[2.5rem] leading-none tracking-wide tabular-nums text-text sm:text-5xl lg:text-[2.5rem] xl:text-5xl">
                      {formatPrice(shown.cents)}
                    </span>
                    <span className="font-mono text-[11px] tracking-widest text-text-2 uppercase">
                      / {BASIS_WORD[shown.basis]}
                    </span>
                  </span>

                  {/* Why that number is that number. See priceNote. */}
                  {note ? (
                    <span className="mt-1.5 font-mono text-[11px] leading-snug text-text-3">
                      {note}
                    </span>
                  ) : null}

                  {/*
                    The contract rate, kept on the card at the client's
                    instruction on 2026-08-23 rather than becoming a third
                    toggle position. It is the gym's only real discount —
                    up to $26 a month — and the one line here that can save
                    a member money, so it stays visible whatever the toggle
                    is doing.

                    Hidden only when the contract IS the chosen term, where
                    the headline figure above already is the contract rate
                    and repeating it would read as a second, further
                    discount. Kids has no contract rate at all, so it never
                    shows one.
                  */}
                  {plan.contractPriceCents !== null && term !== "contract" ? (
                    <span className="mt-2 font-mono text-[11px] leading-snug text-accent-strong">
                      {formatPrice(plan.contractPriceCents)} a month on a
                      12-week contract
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
                      isCurrent ? "bg-ink text-chalk" : "bg-accent text-ink"
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

      </form>

      {/*
        ── THE WAY OUT ────────────────────────────────────────────────

        Without it this screen is a wall in front of the one thing members
        actually use the site for. It stores a row with an empty slug — a
        real recorded answer, which is what stops anybody being asked
        twice — and goes to the booking calendar.

        ITS OWN FORM, AND ITS OWN `next`. It used to be a submit button
        inside the picker, sharing that form's hidden `next`. From
        2026-08-23 the picker's default destination is the home page,
        which would have left this button promising booking and
        delivering the home page. A button cannot carry a second
        name/value pair, and a second `next` entry in the same FormData
        loses to the first — so the only way for it to name its own
        destination is to have its own form.

        It also carries no `commitment`, deliberately: the term radios
        are in the other form, and a term recorded against "no plan" is
        an answer to a question the member just declined.
      */}
      <form action={formAction} className="mt-8 border-t border-divider pt-6">
        <input type="hidden" name="next" value="/book" />
        <input type="hidden" name="slug" value="" />

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase underline underline-offset-4 transition-colors hover:text-text disabled:opacity-60"
        >
          {pending ? "Saving…" : "I'll decide later — take me to booking"}
        </button>
      </form>

      {/*
        ── THE TRIAL PANEL ────────────────────────────────────────────

        Asked for on 2026-08-23: an option to book a trial class at the
        foot of this page.

        A SECOND FORM, not another button in the first one. The term
        radios above are named `commitment`, and a submit button reusing
        that name would put two entries in the same FormData — the
        action reads the first, which is the radio, so the button would
        quietly do nothing it says. Its own form has its own fields and
        cannot collide with anything.

        IT CARRIES THE MEMBER'S EXISTING PLAN THROUGH, in a hidden field.
        Both forms write the same row, and a member who has already
        chosen Intermediate should not lose it by saying they would like
        to try a class first.

        IT DOES NOT BOOK ANYTHING. Every other route through this page
        books the week ahead at the chosen level; the trial deliberately
        does not, because a two-week trial is somebody trying the gym
        out rather than adopting its schedule. That rule lives in
        `planBookingTarget`, in one place, so this panel cannot disagree
        with it. It sends them to /book to pick a class instead — which
        is why this is the one control here whose `next` is explicit.
      */}
      <form action={formAction} className="mt-10">
        <input type="hidden" name="next" value="/book" />
        <input type="hidden" name="slug" value={current ?? ""} />
        <input type="hidden" name="commitment" value="trial" />

        <div className="rounded-card border border-border bg-card p-6">
          <p className="font-display text-2xl leading-tight tracking-wide text-text">
            NOT READY TO COMMIT?
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-2">
            {trialTerm?.blurb ??
              "Try the gym for two weeks before you settle on anything."}
          </p>
          {/*
            The gym's own site states the commitment and no figure, so
            neither does this. An unstated price is a conversation at the
            desk; a guess at "free" is a promise somebody has to keep.
          */}
          <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-text-3">
            Pick whichever class suits you and go. Nothing is booked for
            you, nothing is charged here, and the gym settles the trial
            with you in person.
          </p>

          <button
            type="submit"
            disabled={pending}
            className="mt-5 flex min-h-11 items-center rounded-full bg-accent px-6 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Book a trial class"}
          </button>
        </div>
      </form>
    </>
  );
}
