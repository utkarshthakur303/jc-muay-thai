import type { DayState } from "@/lib/attendance/types";

/**
 * How a day looks, and how it reads out loud. One definition, three
 * surfaces: the popover's week strip, the streak page's week strip, and
 * the twelve-week grid.
 *
 * Extracted when the grid needed the same five states the strip already
 * had. Two hand-written copies would have drifted — one of them would
 * quietly start drawing a closed Sunday like a missed Monday, and nobody
 * would notice, because both still *look* like a row of dots.
 *
 * WHY MISSED AND CLOSED MUST NEVER CONVERGE
 *
 * They are the two states a streak turns on. `missed` is a day the gym
 * was open and the member did not mark; `closed` is a day there was
 * nothing to turn up to. Showing them alike tells somebody their streak
 * broke on a Sunday, which it cannot.
 */

/** The bordered dot used by the week strip. */
export const DAY_DOT: Record<DayState, string> = {
  // Filled and branded — the only state that should catch the eye.
  attended: "border-accent bg-accent text-ink",
  // An open day that went by. Visible as an outline, not shouted about:
  // this is meant to pull somebody back in, not tell them off.
  missed: "border-border text-text-3",
  // The gym was shut. Drawn faintest of all so it cannot read as a miss.
  closed: "border-transparent text-text-3",
  // Today, still winnable. A ring rather than a fill, because it is an
  // invitation and not an achievement.
  today: "border-accent text-accent-strong ring-2 ring-accent/30",
  future: "border-divider text-text-3",
};

/**
 * The small square used by the twelve-week grid.
 *
 * Closed draws nothing at all. Eighty-four cells is enough that a fifth
 * shade would turn the grid into something to be decoded rather than
 * read, and "the gym is shut on Sundays" is better said by an empty row
 * than by a colour with its own legend entry.
 */
export const DAY_CELL: Record<DayState, string> = {
  attended: "bg-accent",
  missed: "bg-border",
  closed: "bg-transparent",
  today: "bg-transparent ring-2 ring-accent ring-inset",
  future: "bg-divider",
};

/**
 * Read out after the day name — "Wednesday, trained".
 *
 * `missed` was once "no session", which is what `closed` means. Spoken
 * aloud, "Monday, no session" tells a member the gym was shut on a day it
 * was open and they simply did not mark it. Conflating the two states in
 * the only channel a screen-reader user has is not a wording nitpick.
 */
export const DAY_STATE_WORDS: Record<DayState, string> = {
  attended: "trained",
  missed: "not marked",
  closed: "gym closed",
  today: "today, not yet marked",
  future: "still to come",
};
