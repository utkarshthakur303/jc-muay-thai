"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * The panel's navigation, as one row that scrolls rather than a block
 * that wraps.
 *
 * ── WHY THIS STOPPED BEING A `flex-wrap` LIST ───────────────────────
 * Measured, on 2026-08-23, when Pricing made it seven items: the header
 * was **289px tall at 320px wide** and 237px at 360 and 390. On a phone
 * 780px tall that is over a third of the screen spent on navigation
 * before a single class or price is visible — and the client's reason
 * for this panel working on a phone at all is that cancelling a class
 * and checking tonight's roster happen standing in the gym.
 *
 * Seven pills cannot fit two rows at 320px, so wrapping meant four. One
 * scrolling row is a fixed 52px at every width, and the header comes
 * down to roughly 130px.
 *
 * ── WHAT SCROLLING COSTS, AND WHAT PAYS FOR IT ──────────────────────
 * Items past the right edge are out of sight, which is a real loss and
 * is why this is a client component rather than four lines of CSS: on
 * mount the current page's pill is scrolled into view, so arriving on
 * Enquiries never shows a strip that starts at Overview with no
 * indication you are anywhere else.
 *
 * `block: "nearest"` matters. Without it, scrolling a pill into view
 * scrolls the PAGE vertically too, and the panel would open a few
 * hundred pixels down its own content.
 *
 * With JavaScript off the strip still works — it is a list of links in a
 * scrollable box, and the `<h1>` under it names the page regardless.
 */

export type AdminNavItem = {
  readonly href: string;
  readonly label: string;
  /**
   * True for the first item of the second group. Draws a divider before
   * it, which is the whole grouping mechanism — see AdminShell for what
   * the two groups mean.
   */
  readonly startsGroup?: boolean;
};

export function AdminNav({
  items,
  current,
}: {
  items: readonly AdminNavItem[];
  current: string;
}) {
  const active = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const pill = active.current;
    if (!pill) return;

    const strip = pill.parentElement?.parentElement;
    if (!strip) return;

    // Only when it is actually out of view. Calling this unconditionally
    // would yank a strip that had nothing to scroll on a wide screen.
    const pillBox = pill.getBoundingClientRect();
    const stripBox = strip.getBoundingClientRect();
    if (pillBox.left >= stripBox.left && pillBox.right <= stripBox.right) return;

    pill.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current]);

  return (
    <nav aria-label="Admin" className="admin-nav -mx-5 sm:-mx-8 lg:mx-0">
      {/*
        The negative margin lets the strip bleed to both edges of the
        header while its own padding keeps the first and last pill clear
        of them. Without it a scrolled pill is clipped by the container's
        padding and looks broken rather than scrollable.

        Both are dropped at `lg`, where the strip is no longer its own
        row — it sits at the end of the header's first row, all seven
        pills fit, and nothing scrolls. See AdminShell.
      */}
      <ul
        role="list"
        className="flex snap-x snap-proximity gap-2 overflow-x-auto px-5 pb-1 sm:px-8 lg:px-0 lg:pb-0"
      >
        {items.map((item) => {
          const isCurrent = item.href === current;
          return (
            <li
              key={item.href}
              className={
                item.startsGroup
                  ? "ml-2 flex shrink-0 snap-start border-l border-divider pl-4"
                  : "flex shrink-0 snap-start"
              }
            >
              <Link
                ref={isCurrent ? active : undefined}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                /*
                  Mutually exclusive branches, never concatenated.
                  Tailwind orders utilities by variant and not by string
                  position, so an idle `hover:` sitting next to an active
                  `bg-accent` resolves to whichever the stylesheet
                  happened to define last.
                */
                className={`flex min-h-11 items-center rounded-full border px-4 font-mono text-[11px] tracking-[0.08em] whitespace-nowrap uppercase transition-colors ${
                  isCurrent
                    ? "border-accent bg-accent text-ink"
                    : "border-border text-text-2 hover:border-accent hover:text-accent-strong"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
