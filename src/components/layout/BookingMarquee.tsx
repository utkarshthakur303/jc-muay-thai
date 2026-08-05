"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/Icon";

/**
 * The scrolling line in the top bar.
 *
 * Three decisions worth stating, because a marquee is easy to get wrong
 * in ways that only show up for the people least able to complain.
 *
 * 1. It is not a link. The bar already carries "Sign in" and "Book free
 *    class", and the booking destination is one of them. Making a third
 *    control point at the same place would add a tab stop and no choice —
 *    the same reason the hero's three identical circles became two
 *    labelled buttons.
 *
 * 2. A screen reader hears the sentence once. A seamless loop needs two
 *    identical copies of the text in the DOM, and the mockup's version of
 *    this shipped both to assistive technology — so it read the sentence
 *    twice, in a bar, on every page load. Here the whole moving strip is
 *    aria-hidden and one plain sentence sits behind it for anyone
 *    listening.
 *
 * 3. There is a real pause button. WCAG 2.2.2 requires a mechanism for
 *    anything that moves automatically for more than five seconds beside
 *    other content, and "the user can turn on Reduce Motion in their
 *    operating system" is not a mechanism on the page. Hover and focus
 *    also pause it, but those are conveniences — neither helps someone
 *    reading on a touchscreen.
 *
 * Desktop only. Below lg the bar holds the wordmark, the theme control
 * and the account link inside 320px, and there is no empty space left to
 * fill — which was the entire reason for this.
 */

const MESSAGE = "Book your first class today";

/** Copies per group. Eight fills the widest realistic bar without the
 *  repetition reading as filler on a laptop. The group is also floored at
 *  the window's own width in CSS, so a wider monitor spreads these out
 *  rather than opening a gap in the loop. */
const COPIES = Array.from({ length: 8 }, (_, i) => i);

function Group() {
  return (
    <span className="flex min-w-[100cqw] shrink-0 items-center justify-around gap-10">
      {COPIES.map((i) => (
        <span key={i} className="flex shrink-0 items-center gap-10">
          <span className="font-mono text-[12px] tracking-[0.14em] whitespace-nowrap text-accent-strong uppercase">
            {MESSAGE}
          </span>
          <span className="size-1 shrink-0 rounded-full bg-accent" />
        </span>
      ))}
    </span>
  );
}

export function BookingMarquee() {
  const [paused, setPaused] = useState(false);

  return (
    <div className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
      <div
        className="marquee-window relative flex min-w-0 flex-1 items-center"
        // Absent rather than "false": an attribute selector should not
        // have to distinguish the two.
        data-paused={paused ? "" : undefined}
      >
        <span className="sr-only">{MESSAGE}</span>
        <span aria-hidden className="marquee-track flex w-max items-center">
          <Group />
          <Group />
        </span>
      </div>

      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        aria-pressed={paused}
        aria-label={
          paused ? "Resume the scrolling banner" : "Pause the scrolling banner"
        }
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-3 transition-colors hover:bg-border/40 hover:text-text"
      >
        <Icon name={paused ? "play" : "pause"} size={14} />
      </button>
    </div>
  );
}
