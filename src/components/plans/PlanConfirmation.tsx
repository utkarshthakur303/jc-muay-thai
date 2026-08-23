"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  commitmentBySlug,
  isCommitmentSlug,
  isPlanSlug,
  planBySlug,
  type CommitmentSlug,
  type PlanSlug,
} from "@/content/plans";
import { PLAN_BOOKING_MAX } from "@/lib/plans/planBookings";

/**
 * What happened when you chose a plan, said on the page you land on.
 *
 * Choosing a plan now books classes — real seats, on a real roster. A
 * member who presses "Intermediate", is dropped on the home page, and
 * finds six bookings in their account three days later has had something
 * done to them. This is the sentence that makes it something they were
 * told about.
 *
 * ── WHY IT READS THE URL AFTER MOUNT, AND NOT ON THE SERVER ─────────
 *
 * The usual destination is `/`, which is statically prerendered and
 * served from the CDN — the property the whole architecture is built
 * around. A Server Component reading `searchParams` would make that page
 * render per request and lose its cache, on the one page that carries all
 * the traffic. `useSearchParams` would opt the subtree out of
 * prerendering and demand a Suspense boundary for it.
 *
 * So it reads `window.location.search` in an effect, exactly as the top
 * bar's account chip reads the display cookie. Nothing on the server
 * touches it, and `/` stays `○ (Static)` in the build output. If it ever
 * stops being static, this is one of the two places to look.
 *
 * ── WHY IT REWRITES THE URL ─────────────────────────────────────────
 *
 * `?booked=6` describes one moment. Left in the address bar it survives
 * a refresh, a bookmark and a shared link, each of which would re-state
 * a week-old event as news. The parameters are stripped once read, with
 * `replaceState` so the back button is not given a stop nobody visited.
 *
 * ── WHY IT IS NOT A RECORD ──────────────────────────────────────────
 *
 * Anyone can type `?plan=advanced&booked=99` into their own address bar.
 * What they get is a sentence that is untrue in their own browser and
 * nowhere else — nothing here reads or writes data. Every number is
 * clamped to what the feature could actually have done, an unrecognised
 * plan renders nothing at all, and the link goes straight to the real
 * list. Same standing as the display cookie: it shows, it does not
 * authorise.
 */

/** Our own keys, stripped from the URL once read. */
const KEYS = ["plan", "term", "booked", "released"] as const;

/** Generous next to a cap of twelve a run, and still a bound. */
const RELEASED_CEILING = 60;

type Outcome = {
  readonly plan: PlanSlug | null;
  readonly term: CommitmentSlug | null;
  /** Null when the counts were absent — the feature is not switched on. */
  readonly booked: number | null;
  readonly released: number;
};

/**
 * Anything unrecognised collapses to "nothing to say" rather than to a
 * default, because every default here would be a claim.
 */
function readOutcome(search: string): Outcome | null {
  const params = new URLSearchParams(search);

  const rawPlan = params.get("plan");
  if (rawPlan === null) return null;
  if (rawPlan !== "none" && !isPlanSlug(rawPlan)) return null;

  const rawTerm = params.get("term");
  const term = isCommitmentSlug(rawTerm) ? rawTerm : null;

  return {
    plan: rawPlan === "none" ? null : rawPlan,
    term,
    booked: clamp(params.get("booked"), PLAN_BOOKING_MAX),
    released: clamp(params.get("released"), RELEASED_CEILING) ?? 0,
  };
}

/** A whole number in range, or null. Never a coerced NaN, never negative. */
function clamp(raw: string | null, ceiling: number): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > ceiling) return null;
  return value;
}

function classesWord(count: number): string {
  return count === 1 ? "class" : "classes";
}

/**
 * "your next Intermediate class" / "your next 6 Intermediate classes".
 *
 * The digit is dropped at one, because "your next 1 class" is a sentence
 * no person has ever said out loud.
 */
function nextClasses(count: number, planName: string): string {
  return count === 1
    ? `your next ${planName} class`
    : `your next ${count} ${planName} classes`;
}

/** The heading, in the display face. Short enough not to wrap on a phone. */
function titleFor(outcome: Outcome): string {
  if (!outcome.plan) return "Noted";
  return planBySlug(outcome.plan)?.name ?? "Noted";
}

/**
 * The sentence. Every branch states only what actually happened — the
 * absent-count case says nothing about bookings at all, because before
 * the migration lands there were none.
 */
function bodyFor(outcome: Outcome): string {
  const planName = outcome.plan ? planBySlug(outcome.plan)?.name : null;

  if (!planName) {
    return outcome.released > 0
      ? `No plan for now, so the ${outcome.released} ${classesWord(outcome.released)} your plan had booked are back in the pool. You can still book anything you like.`
      : "No plan for now. You can still book any class you like.";
  }

  if (outcome.term === "trial") {
    // The trial books nothing by design — see planBookingTarget — but it
    // can still hand back a week that a previous plan had booked, and a
    // member whose classes quietly disappeared deserves to know why.
    const handedBack =
      outcome.released > 0
        ? ` The ${outcome.released} ${classesWord(outcome.released)} your old plan had booked went back in the pool.`
        : "";
    return `${planName} on the two-week trial. A trial is one class at a time, so pick whichever suits you — nothing has been booked for you.${handedBack}`;
  }

  if (outcome.booked === null) {
    // The counts were withheld, which means bookings.source is not there
    // yet. Nothing was booked, so nothing is claimed.
    return `${planName} it is. The gym will pick it up with you in person.`;
  }

  const released =
    outcome.released > 0
      ? ` The ${outcome.released} ${classesWord(outcome.released)} from your old plan went back in the pool.`
      : "";

  if (outcome.booked === 0) {
    return `${planName} it is. Nothing new to add this week — Your classes has what you are already booked into.${released}`;
  }

  return `${planName} it is, and you are booked into ${nextClasses(outcome.booked, planName)}. Cancel any of them from Your classes.${released}`;
}

export function PlanConfirmation() {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    const found = readOutcome(window.location.search);

    /**
     * Stripped whether or not it parsed. A value we refused to render is
     * still a value that should not survive into a bookmark, and leaving
     * it would mean re-refusing it on every load.
     */
    const params = new URLSearchParams(window.location.search);
    let touched = false;
    for (const key of KEYS) {
      if (params.has(key)) {
        params.delete(key);
        touched = true;
      }
    }

    if (touched) {
      const rest = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`,
      );
    }

    setOutcome(found);
  }, []);

  if (!outcome) return null;

  const term = outcome.term ? commitmentBySlug(outcome.term) : undefined;

  return (
    /*
      Fixed rather than in the flow. It arrives after mount, and a banner
      that pushes the hero down a frame after paint moves the page under
      whoever is already reading it.

      `role="status"` and polite: this is a confirmation of something the
      member just did, not an interruption. It does NOT auto-dismiss —
      unlike the booking toast, which repeats what a row on the same
      screen already says. Nothing on the page behind this explains why
      six classes appeared, so it stays until it is closed.
    */
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="toast-punch pointer-events-auto flex w-full max-w-md items-start gap-4 rounded-card border border-accent bg-card p-5 shadow-float">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.18em] text-text-3 uppercase">
            {outcome.plan ? "Plan saved" : "Saved"}
          </p>

          {/*
            aria-hidden and restated by the sentence below. "INTERMEDIATE"
            set in a condensed display face at 2rem is a graphic of a
            word; the body text is what should be read out.
          */}
          <p
            aria-hidden
            className="mt-1 font-display text-[2rem] leading-[0.95] tracking-[0.01em] text-text uppercase"
          >
            {titleFor(outcome)}
          </p>

          <p className="mt-2 text-[13px] leading-relaxed text-text-2">
            {bodyFor(outcome)}
          </p>

          {/*
            The term, when there is one, in the gym's own words. It is the
            axis that moves the price, so a member who set it should see
            it confirmed rather than have to open /account to check.
          */}
          {term ? (
            <p className="mt-1 font-mono text-[11px] leading-snug text-text-3">
              {term.name}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/account"
              className="flex min-h-11 items-center rounded-full bg-accent px-5 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-accent-hover"
            >
              Your classes
            </Link>
            <Link
              href="/book"
              className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
            >
              Book a class
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOutcome(null)}
          aria-label="Dismiss"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl leading-none text-text-3 transition-colors hover:bg-border/40 hover:text-text"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </div>
  );
}
