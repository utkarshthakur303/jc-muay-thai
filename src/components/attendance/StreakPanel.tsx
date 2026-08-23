"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useStreak } from "@/components/attendance/StreakProvider";
import { WeekStrip } from "@/components/attendance/WeekStrip";
import { Icon } from "@/components/ui/Icon";
import type { StreakSummary } from "@/lib/attendance/types";

/**
 * What is inside the streak popover.
 *
 * A PREVIEW NOW, NOT A DESTINATION
 *
 * This used to be the whole feature and it opened on a click. It now
 * appears on hover and the click goes to /streak, at the client's
 * request — so everything here has to be readable in the second or two a
 * pointer rests on the flame, with the graphs, the goal and the rules
 * living on the page behind it.
 *
 * The one action stayed. Marking today is the highest-frequency thing a
 * member does here, and moving it behind a navigation would have turned
 * the fastest control on the site into two steps to save a card that is
 * already on screen. Everything else moved.
 *
 * The close button went with it. A hover card closes when the pointer
 * leaves and on Escape; an × inside one is a control whose job is
 * already done by moving the mouse, and it cost a 44px target's worth of
 * room in a panel that now has to earn every line.
 *
 * WHY THE BIG NUMBER IS THE STREAK AND NOT THE TOTAL
 *
 * The total only ever goes up, so it stops meaning anything the moment
 * it is large. The streak is the number that can be lost, which is the
 * only reason a streak motivates anyone. Best and total sit underneath
 * in small type — present, because a reset should not feel like
 * everything was erased, but not competing.
 *
 * WHY IT SAYS "SELF-MARKED"
 *
 * Nothing verifies any of this. Saying so is not a legal disclaimer, it
 * is the difference between a number a member trusts because it is
 * theirs and a number they assume the gym is keeping — the second of
 * which the gym would eventually be asked to correct.
 */

/**
 * Eight rays fired from behind the flame when a day is marked.
 *
 * The rotation lives on a wrapper and the movement on the child, because
 * the two cannot share a `transform` — an animation on transform would
 * overwrite the inline rotation and every ray would fire straight up.
 */
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function Burst({ id }: { id: number }) {
  return (
    <span
      // Remounting on a new id is what replays the animation. Without it
      // a second check-in in the same session would silently do nothing,
      // because the element is already at its end state.
      key={id}
      aria-hidden
      className="pointer-events-none absolute inset-0"
    >
      {RAY_ANGLES.map((angle) => (
        <span
          key={angle}
          className="absolute top-1/2 left-1/2 block size-0"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span className="streak-ray" />
        </span>
      ))}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.14em] text-text-3 uppercase">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm text-text">{value}</p>
    </div>
  );
}

/**
 * The way out, and the way in. Rendered by EVERY branch of this panel,
 * including the ones that have nothing else to say.
 *
 * On a pointer it is close to redundant — the flame itself is the link.
 * It earns its place twice over anyway:
 *
 * It is the only route for anyone who arrived by keyboard. They reach the
 * panel by tabbing off a trigger they cannot "click through" without
 * leaving, so without a focusable target inside, Tab walks straight past
 * the panel and out the other side, taking the panel with it. Measured in
 * a browser, not reasoned about: with the link missing from the
 * signed-out branch, focus left the control and the panel closed behind
 * it every time.
 *
 * And it says out loud what the hover card is a preview OF, which a flame
 * with a number on it does not.
 */
function FullPage() {
  return (
    <Link
      href="/streak"
      className="mt-4 flex min-h-11 items-center font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase underline underline-offset-4 transition-colors hover:text-accent-strong"
    >
      Graphs, goals and the rules →
    </Link>
  );
}

export function StreakPanel() {
  const streak = useStreak();
  const [burstId, setBurstId] = useState(0);
  const previous = useRef<StreakSummary | null>(null);

  const summary = streak?.summary ?? null;

  /**
   * Fires the burst when the streak actually grows, rather than on every
   * press. A member re-marking a day they had already marked gets no
   * fireworks, which is right — nothing happened.
   */
  useEffect(() => {
    const before = previous.current;
    previous.current = summary;
    if (!summary || !before) return;
    if (summary.current > before.current || summary.total > before.total) {
      setBurstId((value) => value + 1);
    }
  }, [summary]);

  if (!streak) return null;

  if (streak.loading) {
    return (
      <div className="p-5">
        <p className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
          Loading your streak…
        </p>
        <FullPage />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-5">
        <p className="text-sm leading-relaxed text-text-2">
          {streak.error
            ? "Couldn't load your streak. Please try again."
            : "Sign in to track your training."}
        </p>
        <FullPage />
      </div>
    );
  }

  const { current, best, total, markedToday, openToday, week, milestone } =
    summary;

  return (
    <div className="p-5">
      <div className="flex items-center gap-3">
        <span
          className={`relative flex size-11 shrink-0 items-center justify-center rounded-full ${
            current > 0
              ? "bg-accent/12 text-accent-strong"
              : "bg-border/40 text-text-3"
          }`}
        >
          {/* Alive and burning, or cold. The flicker is the only
              always-on motion in the panel and it is deliberately
              small — it should register at the edge of vision, not
              pull the eye off the number beside it. */}
          <Icon
            name="flame"
            size={22}
            className={current > 0 ? "flame-alive" : undefined}
          />
          {burstId > 0 ? <Burst id={burstId} /> : null}
        </span>

        <div>
          <p
            // Keyed on the value so the number re-mounts and replays its
            // pop each time it changes.
            key={current}
            className="streak-pop font-display text-[2.75rem] leading-[0.85] text-text"
          >
            {current}
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-text-2 uppercase">
            {current === 1 ? "day in a row" : "days in a row"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <WeekStrip week={week} />
      </div>

      {/*
        The action. One button, two states, and the label says what will
        happen rather than what is true — "I trained today" is an action,
        "Trained today" would be a status you cannot tell is pressable.
      */}
      <div className="mt-5">
        {markedToday ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/40 bg-accent/8 px-4 py-3">
            <p className="font-mono text-[11px] tracking-[0.08em] text-accent-strong uppercase">
              ✓ Marked for today
            </p>
            <button
              type="button"
              onClick={streak.unmark}
              disabled={streak.pending}
              className="min-h-11 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase underline underline-offset-4 transition-colors hover:text-text disabled:opacity-55"
            >
              Undo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={streak.mark}
            disabled={streak.pending}
            aria-busy={streak.pending}
            className="press-pop flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 font-mono text-[12px] font-semibold tracking-[0.1em] text-ink uppercase transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
          >
            {streak.pending ? "Marking…" : "I trained today"}
          </button>
        )}
      </div>

      {streak.error ? (
        <p role="alert" className="mt-3 text-[12px] leading-snug text-danger">
          That didn&apos;t save. Please try again.
        </p>
      ) : null}

      <div className="mt-5 flex items-start justify-between gap-4 border-t border-divider pt-4">
        <Stat
          label="Best streak"
          value={`${best} ${best === 1 ? "day" : "days"}`}
        />
        {/* "Days trained", not "Sessions" — the table holds one row per
            day, so a member who does two classes on a Tuesday counts once.
            Labelling that "sessions" would overstate it by exactly the
            amount the keenest members train. */}
        <Stat label="Days trained" value={`${total}`} />
      </div>

      {/*
        Both of these are the rule, stated where somebody hits it — not in
        a help page nobody opens. The Sunday line only appears on a Sunday,
        because on a Tuesday it is noise.
      */}
      <p className="mt-4 text-[12px] leading-relaxed text-text-3">
        {!openToday
          ? "The gym is closed today, so today can't break your streak — mark it anyway if you trained."
          : "Self-marked. Miss an open day and the streak starts again."}
      </p>

      <FullPage />

      {/*
        The milestone. Rendered inside the panel rather than as a
        page-level overlay: the member is already looking here, and
        something that takes over the whole screen for a number they can
        see would be a celebration that gets in the way.
      */}
      {milestone ? (
        <div
          role="status"
          className="milestone-pop mt-4 flex items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-ink"
        >
          <span aria-hidden className="font-display text-3xl leading-none">
            {milestone}
          </span>
          <span className="font-mono text-[11px] leading-snug tracking-[0.06em] uppercase">
            {milestone} days in a row. That&apos;s a habit.
          </span>
        </div>
      ) : null}
    </div>
  );
}
