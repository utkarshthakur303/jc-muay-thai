"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * The confirmation that lands after a booking.
 *
 * Booking a class was previously silent from the member's side. The row
 * flipped to "Cancel" and the seat count dropped by one, which is a
 * correct answer delivered as a diff — you have to have been watching the
 * right two numbers to see it. For the one action on this site that
 * commits somebody to turning up at a gym on a Tuesday night, that is too
 * quiet.
 *
 * WHY A TOAST CAN AUTO-DISMISS HERE
 *
 * WCAG 2.2.1 is about time limits on things you must act on. This is not
 * one: everything it says is already permanently on the page behind it —
 * the class row now reads "Cancel", and the class is listed under Coming
 * up on the account page. The toast is a second telling, not the only
 * telling, so it may leave. There is a close button regardless, and it is
 * not a dialog: nothing is focus-trapped and nothing is stolen from
 * whatever the member does next.
 *
 * ANNOUNCEMENT
 *
 * The live region is mounted permanently and empty, with the message
 * inserted into it later. A live region that appears already containing
 * its text is frequently not announced at all — screen readers watch
 * existing regions for mutations rather than treating a whole new subtree
 * as one. `role="status"` (polite) rather than `alert`: this is good news
 * arriving at a moment the member chose, not something worth interrupting
 * them mid-sentence for.
 *
 * ONE AT A TIME
 *
 * A new toast replaces the current one instead of stacking under it. Two
 * bookings in quick succession is an ordinary thing to do on a calendar,
 * and a stack would walk up the screen over the classes being booked.
 */

type ToastRequest = {
  readonly intent: "book" | "cancel";
  /** The class, already formatted. "Advanced, Tue 12 Aug, 7–8:30 PM". */
  readonly detail: string;
};

type Toast = ToastRequest & { readonly id: number };

const ToastContext = createContext<((request: ToastRequest) => void) | null>(
  null,
);

/** Null outside a provider, so a ClassAction rendered elsewhere still works. */
export function useBookingToast() {
  return useContext(ToastContext);
}

const VISIBLE_MS = 6000;

const COPY = {
  book: {
    title: "You're in",
    lead: "Booked",
    /** Read instead of the title, which is styled for punch, not for speech. */
    spoken: "Booked.",
  },
  cancel: {
    title: "Spot released",
    lead: "Cancelled",
    spoken: "Cancelled.",
  },
} as const;

export function BookingToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const show = useCallback(
    (request: ToastRequest) => {
      clearTimer();
      nextId.current += 1;
      setToast({ ...request, id: nextId.current });
    },
    [clearTimer],
  );

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  useEffect(() => {
    if (!toast) return;
    timerRef.current = setTimeout(() => setToast(null), VISIBLE_MS);
    return clearTimer;
    // Depends on the object, which `show` replaces on every call — so
    // booking a second class restarts the clock rather than inheriting
    // whatever was left of the first one's.
  }, [toast, clearTimer]);

  // Unmounting mid-timer leaves a setTimeout holding a setState on a dead
  // component. Cheap to prevent, tedious to diagnose.
  useEffect(() => clearTimer, [clearTimer]);

  const copy = toast ? COPY[toast.intent] : null;

  return (
    <ToastContext.Provider value={show}>
      {children}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {toast && copy ? (
          <div
            /* Keyed so a second booking re-runs the entrance animation
               rather than silently swapping the text inside a card that is
               already sitting still — which reads as nothing having
               happened. */
            key={toast.id}
            className={`toast-punch pointer-events-auto flex w-full max-w-sm items-start gap-4 rounded-card p-5 shadow-float ${
              toast.intent === "book"
                ? "bg-accent text-ink"
                : "border border-border bg-card text-text"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p
                className={`font-mono text-[10px] tracking-[0.18em] uppercase ${
                  toast.intent === "book" ? "text-ink/85" : "text-text-3"
                }`}
              >
                {copy.lead}
              </p>

              {/* aria-hidden and re-stated below: "You're in" set in a
                  condensed display face at 2.5rem is a graphic of a
                  sentence. The spoken version says what happened. */}
              <p
                aria-hidden
                className="mt-1 font-display text-[2.5rem] leading-[0.9] tracking-[0.01em] uppercase"
              >
                {copy.title}
              </p>

              <p
                className={`mt-2 font-mono text-[12px] leading-snug ${
                  toast.intent === "book" ? "text-ink/80" : "text-text-2"
                }`}
              >
                <span className="sr-only">{copy.spoken} </span>
                {toast.detail}
              </p>
            </div>

            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className={`flex size-11 shrink-0 items-center justify-center rounded-full text-xl leading-none transition-colors ${
                toast.intent === "book"
                  ? "text-ink/60 hover:bg-ink/10 hover:text-ink"
                  : "text-text-3 hover:bg-border/40 hover:text-text"
              }`}
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
