"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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
 * A LINK THAT PREVIEWS ITSELF
 *
 * It was a button that opened a panel. At the client's request it is now
 * a link to /streak that shows the panel on hover, which changes what
 * every part of it has to do:
 *
 * - The click navigates. It no longer toggles anything, so `aria-expanded`
 *   was removed rather than left pointing at a panel the link does not
 *   control. Announcing a toggle that navigates is worse than announcing
 *   nothing.
 * - Hover opens after 120ms and closes after 220ms. The open delay is
 *   what stops the panel firing at every pointer that crosses the rail on
 *   its way somewhere else; the close delay is what lets the pointer
 *   travel the 12px gap into the panel without it vanishing on the way —
 *   WCAG 1.4.13 requires hover content to be hoverable, and a panel with
 *   a live button in it that cannot be reached is worse than no panel.
 * - Focus opens it immediately, and focus leaving the whole control
 *   closes it. A keyboard user gets the same preview, and can tab
 *   straight from the flame into the panel because the panel is the next
 *   thing in the DOM.
 * - Escape closes it, which is the third of 1.4.13's requirements.
 *
 * TOUCH GETS NO PANEL, DELIBERATELY
 *
 * `pointerType` is checked on every enter and leave, so a tap opens
 * nothing and the navigation happens cleanly. Phones and tablets emulate
 * mouse events on tap; without that check the panel would flash open for
 * the instant before the page changed underneath it.
 *
 * Nothing is lost by it. The panel is a preview of /streak and the tap
 * goes to /streak, so a touch member reaches the same content — more of
 * it — in the same one action. The cost is that marking today from a
 * phone is now a tap and then a tap, where it used to be a tap and a tap
 * on a panel. That is the shape the client asked for.
 */

type Placement = "rail" | "bar";

/** Long enough to ignore a pointer passing through, short enough to feel
 *  like the panel was already there. */
const OPEN_DELAY = 120;

/**
 * The grace period after the pointer leaves.
 *
 * It is not the mechanism that lets somebody reach the panel — the bridge
 * below is — but a panel that vanished the instant the pointer twitched
 * off the flame would still feel broken. Measured: at 220ms a deliberate,
 * slow drag across the gap lost the panel; the bridge fixed that outright,
 * and this is the margin on top.
 */
const CLOSE_DELAY = 300;

/**
 * The panel is positioned against the *nav*, not against the trigger.
 *
 * On the bar that is the whole point: anchoring to the button put a 320px
 * panel's right edge on a 48px trigger, which pushed its left edge six
 * pixels off the side of a 390px screen. Leaving the wrapper unpositioned
 * lets `absolute` resolve against the fixed header instead, so the panel
 * spans the bar exactly and cannot overflow at any width.
 *
 * The rail works the same way, and the move up the rail is what forced
 * it. The panel used to hang off the button, which was safe while the
 * button sat at the foot of the rail with the whole rail above it to grow
 * into. Under Contact there is exactly 452px above it, and the panel's
 * tallest state measures around 455. It would have clipped by a few
 * pixels, in the one state the whole feature exists to celebrate.
 *
 * Anchored to the nav with `max-h-full` there is no arithmetic left to
 * get wrong: the panel cannot be taller than the rail and cannot start
 * above it, at any viewport height, whatever is later added to it.
 */
const WRAPPER: Record<Placement, string> = {
  // `shrink-0` because the rail is a flex column that can run out of
  // height: without it this is squashed before the section list scrolls,
  // and a 52px control compressed to 30px loses its label first.
  //
  // `mt-1.5` matches the 6px gap the section list uses between its items,
  // so this reads as the next item down rather than as something stuck to
  // the bottom of Contact.
  rail: "member-only mt-1.5 shrink-0",
  bar: "member-only lg:hidden",
};

/**
 * The positioned wrapper. It carries the 12px offset as PADDING, not as a
 * margin, and that is the whole trick.
 *
 * With a margin, the gap between the flame and the card belongs to
 * nobody: a pointer crossing it is over neither element, `pointerleave`
 * fires, and a slow enough hand loses the panel before reaching it —
 * measured, not theorised. WCAG 1.4.13 requires hover content to be
 * hoverable, so this is a failure and not a nicety.
 *
 * As padding the gap belongs to the wrapper, which is inside the hover
 * container, so the path from trigger to card is continuous. The card
 * keeps its visual separation because padding is invisible.
 *
 * `inset-y-0` on the rail gives the wrapper a definite height, which is
 * what lets the card's own `max-h-full` resolve against the rail rather
 * than against `auto` — the card cannot be taller than the rail at any
 * viewport height, whatever is later added to its contents. `justify-end`
 * keeps it growing upward from the rail's foot, alongside the trigger.
 */
const PANEL: Record<Placement, string> = {
  // w-80 (320px) card + pl-3 (12px) bridge. Written out because Tailwind
  // has no token for "one plus the other".
  rail: "inset-y-0 left-full flex w-[20.75rem] flex-col justify-end",
  bar: "inset-x-0 top-full",
};

/**
 * The bridge, and the scroll container.
 *
 * `pointer-events-auto` re-enables what the wrapper turned off. The
 * wrapper spans the whole rail so the card's `max-h-full` has something
 * definite to resolve against — 332 by 852 pixels of it — and an
 * invisible div that size swallows every click on the content beside the
 * rail for as long as the panel is open. Turning events off on the
 * wrapper and back on here makes the live area exactly the card plus its
 * bridge, which is the only part anybody needs to reach.
 *
 * The scroll lives here rather than on the card so that `max-h-full`
 * resolves against the wrapper's definite height instead of against an
 * `auto` one, where a percentage max-height means nothing at all.
 */
const INNER: Record<Placement, string> = {
  rail: "pointer-events-auto max-h-full overflow-y-auto pl-3",
  bar: "pointer-events-auto pt-3",
};

/** How the card itself is drawn, once the wrapper has placed it. */
const CARD: Record<Placement, string> = {
  rail: "origin-bottom-left",
  bar: "origin-top",
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
 * for exactly this reason. This matches them.
 */
const TRIGGER: Record<Placement, string> = {
  rail: "flex w-16 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-2",
  bar: "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3",
};

const SKIN: Record<Placement, { idle: string; open: string }> = {
  // On the accent-filled rail, drawn in ink like everything else on it.
  //
  // The open state is white on ink, following the nav items directly
  // above it. This control is not a nav destination — it is now, in fact,
  // exactly that — and it wears the same pill in the same column, so
  // leaving it accent-on-ink while its five neighbours went white would
  // have read as the one item that was missed.
  rail: {
    // The hover classes live only on the idle branch, never appended to
    // the open one. That is the whole point of the split: two utilities
    // setting the same property is a coin toss Tailwind decides by
    // variant order, not by string order.
    //
    // They still earn their place now that hover also opens the panel.
    // The panel waits 120ms; without these the trigger would sit
    // completely inert under the pointer for that eighth of a second,
    // which is exactly long enough to read as "nothing here".
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
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streak = useStreak();

  const clearTimer = () => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  };

  const schedule = useCallback((next: boolean, delay: number) => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(next), delay);
  }, []);

  /**
   * Set by Escape, and only by Escape.
   *
   * useDismissable returns focus to the trigger after dismissing — which
   * is right, and which fires `onFocus` on this container, which reopened
   * the panel a frame after Escape closed it. Measured in a browser: the
   * panel visibly refused to close. The flag makes the refocus a no-op,
   * and is cleared the moment focus or the pointer genuinely leaves, so
   * a member who dismisses and then comes back gets the preview again.
   */
  const dismissed = useRef(false);

  const closeNow = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, []);

  const dismiss = useCallback(() => {
    dismissed.current = true;
    closeNow();
  }, [closeNow]);

  // A pending timer firing after the trigger has gone — a member signing
  // out with the pointer over the flame — would set state on an unmounted
  // tree. Cheap to prevent, invisible when it goes wrong.
  useEffect(() => clearTimer, []);

  useDismissable({ open, onDismiss: dismiss, containerRef, triggerRef });

  const current = streak?.summary?.current ?? null;
  const markedToday = streak?.summary?.markedToday ?? false;

  /**
   * The label carries the whole state, because the visible content is a
   * flame and a digit. "Training streak, 4 days, not yet marked today" is
   * what a screen reader user needs; "4" is what everyone else needs.
   *
   * It ends with what the link does. The panel is a hover preview a
   * screen-reader user may never see, so without this the flame is a link
   * whose destination is a number.
   */
  const label =
    current === null
      ? "Your training streak"
      : `Your training streak, ${current} ${current === 1 ? "day" : "days"}${
          markedToday ? ", marked for today" : ", not yet marked today"
        }`;

  return (
    <div
      ref={containerRef}
      className={WRAPPER[placement]}
      // Mouse only. See the header: a tap emulates these, and the panel
      // would flash open for the instant before the page navigated.
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        dismissed.current = false;
        schedule(true, OPEN_DELAY);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        schedule(false, CLOSE_DELAY);
      }}
      // React's onFocus/onBlur are focusin/focusout — they fire for
      // descendants too, which is what keeps the panel open while focus
      // is inside it.
      onFocus={() => {
        if (dismissed.current) return;
        clearTimer();
        setOpen(true);
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        dismissed.current = false;
        closeNow();
      }}
    >
      <Link
        ref={triggerRef}
        href="/streak"
        aria-label={`${label}. Opens your streak page.`}
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
            labels is the one nobody presses. It is also a destination
            itself now, which settles the argument.

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
      </Link>

      {open ? (
        <div
          id="streak-panel"
          role="group"
          aria-label="Streak summary"
          className={`pointer-events-none absolute z-50 ${PANEL[placement]}`}
        >
          <div className={INNER[placement]}>
            <div
              className={`pop-in rounded-card border border-border bg-card shadow-float ${CARD[placement]}`}
            >
              <StreakPanel />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
