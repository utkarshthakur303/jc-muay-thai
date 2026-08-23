"use client";

import { useActionState } from "react";

import { fieldBorderClass, fieldControlClass } from "@/components/ui/Field";
import { DAYS } from "@/content/schedule";
import { updateStreakGoal } from "@/lib/attendance/actions";
import {
  GOAL_MAX,
  GOAL_MIN,
  daysToGo,
  goalProgress,
  streakTarget,
  suggestedGoal,
} from "@/lib/attendance/goal";
import { initialGoalState } from "@/lib/attendance/state";

/**
 * What the member is aiming for, and how far along they are.
 *
 * WHAT A GOAL IS MEASURED IN
 *
 * Open days. The gym runs Monday to Saturday and the streak steps over
 * Sunday, so a goal of 30 is thirty training days — five calendar weeks,
 * not four. The card says "training days" everywhere rather than "days",
 * because the shorter word is a promise the streak rule does not keep.
 *
 * WHY THERE IS ALWAYS A TARGET
 *
 * A member who has never set a goal is measured against the next
 * milestone instead, so the card is never an empty box asking to be
 * filled in. The eyebrow says which it is — "Your goal" or "Next
 * milestone" — because a target the app picked, presented as theirs, is a
 * small lie that makes every number underneath it suspect.
 *
 * THE MIGRATION WINDOW
 *
 * `available` is false until the client runs the goals migration. In that
 * window the milestone half still works and the forms are simply not
 * rendered. Nothing tells the member a feature is missing, because from
 * where they stand nothing is: they see a target and their progress
 * toward it. A form whose submit button cannot save is the half-built
 * control the client ruled out.
 *
 * THREE FORMS, ONE ACTION
 *
 * The quick picks and the custom field cannot share a form. FormData.get
 * returns the FIRST entry of a name in document order, so a submit button
 * carrying `name="goal"` inside a form that already has an input named
 * `goal` silently loses to the input — the member presses 30 and saves
 * whatever the box happened to contain. Separate forms, one shared
 * action, one error line that can speak for all three.
 */

/**
 * The one-tap options. A subset of MILESTONES, cut at five: the point of
 * a quick pick is that it is faster than typing, and eight of them is a
 * decision rather than a shortcut. 3 is left out because it is a
 * milestone worth celebrating and a poor thing to aim at; 200 and 365 are
 * left to the field, where somebody choosing them has thought about it.
 */
const QUICK_GOALS = [7, 14, 30, 60, 100] as const;

export function GoalCard({
  current,
  goal,
  available,
}: {
  readonly current: number;
  readonly goal: number | null;
  readonly available: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateStreakGoal,
    initialGoalState,
  );

  const target = streakTarget(goal, current);
  const remaining = target ? daysToGo(current, target.value) : 0;
  const reached = target !== null && remaining === 0;

  return (
    <section
      aria-labelledby="goal-heading"
      className="rounded-card border border-border bg-card p-6 sm:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="goal-heading"
          className="font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase"
        >
          {target?.custom ? "Your goal" : "Next milestone"}
        </h2>

        {target ? (
          <p className="font-mono text-sm text-text-2">
            {target.value} training days
          </p>
        ) : null}
      </div>

      {target ? (
        <>
          <p className="mt-3 font-display text-4xl leading-none text-text sm:text-5xl">
            {current}
            <span className="text-text-3"> / {target.value}</span>
          </p>

          {/*
            A real progressbar, not a decorated div. The width is the
            only thing a sighted reader gets; aria-valuetext is the same
            sentence for everybody else, and without it a screen reader
            announces a bare percentage of a thing it cannot name.
          */}
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={target.value}
            aria-valuenow={Math.min(current, target.value)}
            aria-valuetext={`${current} of ${target.value} training days`}
            aria-label="Progress towards your goal"
            className="mt-4 h-3 w-full overflow-hidden rounded-full bg-border/50"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${goalProgress(current, target.value) * 100}%` }}
            />
          </div>

          <p className="mt-3 text-sm leading-relaxed text-text-2">
            {reached
              ? `Goal reached. ${target.value} training days in a row.`
              : `${remaining} more ${remaining === 1 ? "day" : "days"} in a row to get there.`}
          </p>
        </>
      ) : (
        /*
          Past every milestone the app knows about, with no goal set.
          Drawing a full bar against a target they passed months ago would
          be worse than saying there is nothing left to aim at.
        */
        <p className="mt-3 text-sm leading-relaxed text-text-2">
          You&apos;re past every milestone this app celebrates. Set your own
          target below.
        </p>
      )}

      {available ? (
        <div className="mt-6 border-t border-divider pt-5">
          <p className="font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase">
            Aim for
          </p>

          {/* Quick picks. Their own form — see the header. */}
          <form action={formAction} className="mt-3 flex flex-wrap gap-2">
            {QUICK_GOALS.map((value) => {
              const chosen = goal === value;
              return (
                <button
                  key={value}
                  type="submit"
                  name="goal"
                  value={value}
                  disabled={pending}
                  aria-label={`Set your goal to ${value} training days`}
                  aria-current={chosen ? "true" : undefined}
                  className={`flex min-h-11 min-w-14 items-center justify-center rounded-full border px-4 font-mono text-[12px] tracking-[0.06em] transition-colors disabled:opacity-55 ${
                    // Mutually exclusive branches, never concatenated:
                    // Tailwind orders by variant, so a shared
                    // `hover:border-accent` would override the chosen
                    // state's fill the moment the pointer crossed it.
                    chosen
                      ? "border-accent bg-accent text-ink"
                      : "border-border text-text-2 hover:border-accent hover:text-accent-strong"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </form>

          <form
            action={formAction}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <div>
              <label
                htmlFor="goal-days"
                className="block font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase"
              >
                Or your own
              </label>
              <input
                // Remounted when the stored goal changes, so the field
                // follows a quick pick instead of sitting on a stale
                // suggestion the member never typed.
                key={goal ?? "none"}
                id="goal-days"
                name="goal"
                type="number"
                inputMode="numeric"
                min={GOAL_MIN}
                max={GOAL_MAX}
                step={1}
                defaultValue={suggestedGoal(current, goal)}
                disabled={pending}
                aria-describedby="goal-range"
                className={`mt-1.5 w-28 ${fieldControlClass} ${fieldBorderClass(
                  state.status === "error" ? state.message : undefined,
                )}`}
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[12px] tracking-[0.08em] text-text uppercase transition-colors hover:border-accent hover:text-accent-strong disabled:opacity-55"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </form>

          {/*
            The worked example is the point of this line. "30 training
            days" sounds like a month and is five weeks, and a member who
            works that out for themselves a fortnight in has been misled
            by us rather than by arithmetic.

            The week length comes from the timetable, not from a 6 typed
            here. If Sunday sessions are ever added, the streak rule
            follows in the same edit — and so does this sentence.
          */}
          <p id="goal-range" className="mt-3 text-[13px] leading-relaxed text-text-3">
            Between {GOAL_MIN} and {GOAL_MAX} training days. The gym is open{" "}
            {DAYS.length} days a week, so a {QUICK_GOALS[2]}-day goal is about{" "}
            {Math.round((QUICK_GOALS[2] / DAYS.length) * 10) / 10} weeks without
            missing one.
          </p>

          {goal !== null ? (
            <form action={formAction} className="mt-1">
              <input type="hidden" name="intent" value="clear" />
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase underline underline-offset-4 transition-colors hover:text-text disabled:opacity-55"
              >
                Use the app&apos;s milestones instead
              </button>
            </form>
          ) : null}

          {state.status === "error" ? (
            <p role="alert" className="mt-2 text-[13px] leading-snug text-danger">
              {state.message}
            </p>
          ) : null}

          {state.status === "success" && state.message ? (
            <p
              role="status"
              className="mt-2 text-[13px] leading-snug text-accent-strong"
            >
              {state.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
