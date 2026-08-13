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
 * The rail now works the same way, and the move up the rail is what forced
 * it. The panel used to hang off the button, which was safe while the
 * button sat at the foot of the rail with the whole rail above it to grow
 * into. Under Contact there is exactly 452px above it, and the panel's
 * tallest state — a milestone showing, above the "marked for today" box,
 * which is taller than the plain button it replaces — measures around 455.
 * It would have clipped by a few pixels, in the one state the whole
 * feature exists to celebrate.
 *
 * Anchored to the nav with `max-h-full` there is no arithmetic left to get
 * wrong: the panel cannot be taller than the rail and cannot start above
 * it, at any viewport height, whatever is later added to its contents.
 */
const WRAPPER: Record<Placement, string> = {
  // `shrink-0` because the rail is a flex column that can run out of height:
  // without it this is squashed before the section list scrolls, and a
  // 52px control compressed to 30px loses its label first.
  //
  // `mt-1.5` matches the 6px gap the section list uses between its items,
  // so this reads as the next item down rather than as something stuck to
  // the bottom of Contact.
  rail: "member-only mt-1.5 shrink-0",
  bar: "member-only lg:hidden",
};

/**
 * Both resolve against their nav, and both are bounded by it.
 *
 * `bottom-0` on the rail keeps the upward-and-rightward growth the panel
 * has always had, now measured from the rail's foot rather than the
 * button's — which puts the trigger alongside the panel's top edge, still
 * visibly the thing that opened it. `max-h-full` plus an internal scroll is
 * the part that cannot be broken by a future addition to the panel's
 * contents.
 */
const PANEL: Record<Placement, string> = {
  rail: "bottom-0 left-full ml-3 max-h-full w-80 origin-bottom-left overflow-y-auto",
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
  //
  // The open state is white on ink, following the nav items directly
  // above it. This control is not a nav destination, but it wears the
  // same pill in the same column, and leaving it accent-on-ink while its
  // five neighbours went white would have read as the one item that was
  // missed rather than as a deliberate distinction.
  rail: {
    idle: "text-ink/85 hover:bg-ink/10 hover:text-ink",
    open: "bg-ink text-chalk",
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
        {placement === "rail" ? (
          /*
            THE NUMBER AND THE WORD, not one or the other.

            It used to be the flame and a bare digit, on the reasoning that
            the rail's other five items are labelled with nouns because
            they are destinations, while this one is a value. That reads
            fine once you know what it is. It reads as an unexplained
            number the first time — and it now sits directly beneath five
            labelled items, where the only unlabelled thing in a column of
            labels is the one nobody presses.

            So the value and the icon share the top row and the label goes
            underneath, which puts the item at the same 52px height as its
            neighbours: 8 padding + 20 icon + 6 gap + 10 label + 8 padding.
            The row is 37px wide at three digits against 56px of usable
            width, so a member with a year-long streak does not wrap it.
          */
          <>
            <span className="flex items-center gap-1">
              <Icon
                name="flame"
                size={20}
                className={current && current > 0 ? "flame-alive" : undefined}
              />
              <span
                aria-hidden
                className="font-mono text-[11px] leading-none tracking-[0.04em] tabular-nums"
              >
                {/* An em dash holds the space while it loads, so nothing
                    reflows under the pointer as the number lands. */}
                {current === null ? "—" : current}
              </span>
            </span>

            <span className="font-mono text-[10px] leading-none tracking-[0.04em] uppercase">
              Streak
            </span>
          </>
        ) : (
          <>
            <Icon
              name="flame"
              size={20}
              className={current && current > 0 ? "flame-alive" : undefined}
            />
            <span
              aria-hidden
              className="font-mono text-[11px] leading-none tracking-[0.04em] tabular-nums"
            >
              {current === null ? "—" : current}
            </span>
          </>
        )}
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
