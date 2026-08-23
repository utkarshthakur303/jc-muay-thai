import { DAY_DOT, DAY_STATE_WORDS } from "@/components/attendance/dayLook";
import type { WeekDay } from "@/lib/attendance/types";

/**
 * Monday to Sunday of the gym's current week, as seven dots.
 *
 * A list rather than a row of divs so a screen reader can walk it, and
 * each dot carries its own day and state in the accessible name —
 * "Wednesday, trained" — because a filled circle says nothing out loud.
 *
 * Shared by the hover popover and the streak page. No client hooks and
 * no server-only imports, so it renders in either tree unchanged; the
 * alternative was two copies that eventually disagree about what a
 * Sunday looks like.
 */
export function WeekStrip({
  week,
  size = "sm",
}: {
  readonly week: readonly WeekDay[];
  /** `lg` on the page, where there is room and it is the main event. */
  readonly size?: "sm" | "lg";
}) {
  /**
   * The large strip is fluid, not a fixed 44px.
   *
   * Fixed, it measured 57px of horizontal overflow at 320px: seven 44px
   * circles and six 4px gaps is 332px, against 232px of usable width
   * inside the card on the narrowest phone the site supports. `w-full`
   * inside a `flex-1` list item with `aspect-square` to keep it round
   * takes whatever is going and caps at 44 — so it is 30px on a 320px
   * screen and full size everywhere else, with no breakpoint to land on
   * the wrong side of.
   */
  const dot =
    size === "lg"
      ? "aspect-square w-full max-w-11 text-sm"
      : "size-8 text-[11px]";

  return (
    <ul
      role="list"
      aria-label="This week"
      className="flex items-center justify-between gap-1"
    >
      {week.map((day) => (
        <li key={day.key} className="flex flex-1 flex-col items-center gap-1.5">
          <span
            className={`flex items-center justify-center rounded-full border font-mono transition-colors ${dot} ${
              DAY_DOT[day.state]
            } ${day.state === "attended" ? "dot-in" : ""}`}
          >
            <span aria-hidden>
              {day.state === "attended"
                ? "✓"
                : day.state === "closed"
                  ? "–"
                  : day.initial}
            </span>
            <span className="sr-only">
              {day.label}, {DAY_STATE_WORDS[day.state]}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
