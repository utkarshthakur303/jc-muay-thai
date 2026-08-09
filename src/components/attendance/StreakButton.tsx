"use client";

import { useCallback, useRef, useState } from "react";

import { StreakPanel } from "@/components/attendance/StreakPanel";
import { useStreak } from "@/components/attendance/StreakProvider";
import { Icon } from "@/components/ui/Icon";
import { useDismissable } from "@/lib/ui/useDismissable";

/**
 * The streak trigger.
 *
 * Wrapped in `.member-only`, so CSS decides whether it exists at all from
 * an attribute the pre-paint script sets off a cookie. A guest never sees
 * it and never sees it disappear — no flash of a control they cannot use,
 * no session read during render, and the home page keeps its static cache.
 *
 * WHY IT IS NOT IN THE MOBILE BOTTOM BAR
 *
 * That was the first attempt and it broke the bar. Six items already
 * divided a 288px strip on a 320px phone, at roughly 48px each, and the
 * file's own comment records that labels longer than five characters were
 * truncated the last time something took width from them. A seventh item
 * did exactly that again: measured at 320px and 360px, CLASSES and CONTACT
 * were both clipped.
 *
 * So on phones it lives in the top bar instead, beside the account chip —
 * which is where member state already is, and the only surface with room.
 * Desktop keeps it in the rail, as asked.
 *
 * A DISCLOSURE, NOT A DIALOG
 *
 * No focus trap, no inert background, no scroll lock. Nothing here demands
 * a decision — a member can open it, read the number and carry on
 * scrolling. Making it modal would mean trapping somebody inside a
 * motivational widget, which is the sort of thing people uninstall apps
 * over.
 */

type Placement = "rail" | "bar";

/**
 * The panel is positioned against the *nav*, not against the button.
 *
 * On the bar that is the whole point: anchoring to the button put a 320px
 * panel's right edge on a 48px trigger, which pushed its left edge six
 * pixels off the side of a 390px screen. Leaving the wrapper unpositioned
 * lets `absolute` resolve against the fixed header instead, so the panel
 * spans the bar exactly and cannot overflow at any width.
 *
 * The rail keeps a positioned wrapper because it opens sideways into open
 * space, where aligning to the button is what looks right.
 */
const WRAPPER: Record<Placement, string> = {
  rail: "member-only relative",
  bar: "member-only lg:hidden",
};

const PANEL: Record<Placement, string> = {
  rail: "bottom-0 left-full ml-3 w-80 origin-bottom-left",
  bar: "inset-x-0 top-full mt-3 origin-top",
};

/**
 * Layout only. Colour lives in SKIN below, and the split is not tidiness.
 *
 * The first version appended the open-state classes to the idle ones and
 * let the cascade sort it out. It does not: `hover:text-ink` beat
 * `text-accent` and `hover:bg-ink/10` beat `bg-ink`, so an open trigger
 * under the pointer computed to ink on ten-percent ink — the flame and the
 * number vanished into a black rectangle on the red rail. Tailwind orders
 * utilities by variant, not by the order they appear in the string, so two
 * classes setting the same property is a coin toss you lose silently.
 *
 * The rail's own nav items have always used mutually exclusive branches
 * for exactly this reason. This now matches them.
 */
const TRIGGER: Record<Placement, string> = {
  rail: "flex w-16 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-2",
  bar: "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3",
};

const SKIN: Record<Placement, { idle: string; open: string }> = {
  // On the accent-filled rail, drawn in ink like everything else on it.
  rail: {
    idle: "text-ink/85 hover:bg-ink/10 hover:text-ink",
    open: "bg-ink text-accent",
  },
  // On a themed surface, matched to the theme toggle and account chip
  // beside it so the three read as one cluster of controls.
  bar: {
    idle: "border-border bg-card text-text-2 hover:border-accent hover:text-accent-strong",
    open: "border-accent bg-card text-accent-strong",
  },
};

export function StreakButton({ placement }: { placement: Placement }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const streak = useStreak();

  const close = useCallback(() => setOpen(false), []);
  useDismissable({ open, onDismiss: close, containerRef, triggerRef });

  const current = streak?.summary?.current ?? null;
  const markedToday = streak?.summary?.markedToday ?? false;

  /**
   * The label carries the whole state, because the visible content is a
   * flame and a digit. "Training streak, 4 days, not yet marked today" is
   * what a screen reader user needs; "4" is what everyone else needs.
   */
  const label =
    current === null
      ? "Training streak"
      : `Training streak, ${current} ${current === 1 ? "day" : "days"}${
          markedToday ? ", marked for today" : ", not yet marked today"
        }`;

  return (
    <div ref={containerRef} className={WRAPPER[placement]}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="streak-panel"
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={`${TRIGGER[placement]} transition-colors ${
          open ? SKIN[placement].open : SKIN[placement].idle
        }`}
      >
        <Icon
          name="flame"
          size={20}
          className={current && current > 0 ? "flame-alive" : undefined}
        />

        {/*
          A number, not the word "Streak". The rail's other five items are
          labelled with nouns because they are destinations; this one is a
          value, and the value is the reason to look at it. An em dash
          holds the space while it loads, so nothing reflows under the
          member's thumb as the number lands.
        */}
        <span
          aria-hidden
          className="font-mono text-[11px] leading-none tracking-[0.04em] tabular-nums"
        >
          {current === null ? "—" : current}
        </span>
      </button>

      {open ? (
        <div
          id="streak-panel"
          className={`pop-in absolute z-50 rounded-card border border-border bg-card shadow-float ${PANEL[placement]}`}
        >
          <StreakPanel onClose={close} />
        </div>
      ) : null}
    </div>
  );
}
