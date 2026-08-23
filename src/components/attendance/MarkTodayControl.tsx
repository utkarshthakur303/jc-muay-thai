"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

import { markToday, unmarkToday } from "@/lib/attendance/actions";

/**
 * "I trained today", on the streak page.
 *
 * WHY THIS DOES NOT USE THE STREAK PROVIDER
 *
 * The popover's copy of this control does, because the popover lives on
 * the home page where reading the session during render would cost the
 * page its static prerender — so its numbers arrive after mount from a
 * client-side fetch. This page has no such constraint: it is a member
 * page rendered on the server with the real numbers already in the HTML,
 * and there is no provider in its tree at all.
 *
 * So the action goes straight to the server and the page re-renders.
 * `router.refresh()` is what keeps the graphs honest — a check-in changes
 * the streak, this week's strip, a cell in the grid, a bar in the chart
 * and possibly the goal's progress, and updating the number alone would
 * leave five things on screen disagreeing with it.
 *
 * The refresh runs inside the same transition as the write, so `pending`
 * covers both. Without that the button would go idle the instant the row
 * landed and the page would visibly change a beat later, which reads as
 * a glitch rather than as a save.
 */
export function MarkTodayControl({ markedToday }: { markedToday: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  /**
   * A second write landing while the first is in flight — a double tap on
   * a slow connection — would resolve out of order and briefly show the
   * older of the two answers. `pending` disables the button, and this is
   * the belt to that: a disabled attribute is a hint to the browser, not
   * a guarantee about what a script can dispatch.
   */
  const inFlight = useRef(false);

  const run = useCallback(
    (action: () => Promise<unknown>) => {
      if (inFlight.current) return;
      inFlight.current = true;

      startTransition(async () => {
        setFailed(false);
        try {
          await action();
          router.refresh();
        } catch {
          // The action throws on a failed write rather than returning a
          // stale summary — see lib/attendance/actions.ts. A member who
          // presses a button and is told nothing concludes the site is
          // broken, and they are right.
          setFailed(true);
        } finally {
          inFlight.current = false;
        }
      });
    },
    [router],
  );

  return (
    <div>
      {markedToday ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/8 px-5 py-4">
          <p className="font-mono text-[12px] tracking-[0.08em] text-accent-strong uppercase">
            ✓ Marked for today
          </p>
          <button
            type="button"
            onClick={() => run(unmarkToday)}
            disabled={pending}
            aria-busy={pending}
            className="min-h-11 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase underline underline-offset-4 transition-colors hover:text-text disabled:opacity-55"
          >
            {pending ? "Working…" : "Undo"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => run(markToday)}
          disabled={pending}
          aria-busy={pending}
          className="press-pop flex min-h-13 w-full items-center justify-center rounded-full bg-accent px-6 font-mono text-[13px] font-semibold tracking-[0.1em] text-ink uppercase transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
        >
          {pending ? "Marking…" : "I trained today"}
        </button>
      )}

      {failed ? (
        <p role="alert" className="mt-3 text-[13px] leading-snug text-danger">
          That didn&apos;t save. Please try again.
        </p>
      ) : null}
    </div>
  );
}
