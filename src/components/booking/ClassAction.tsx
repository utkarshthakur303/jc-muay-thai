"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { bookClass, cancelBooking } from "@/lib/booking/actions";
import { initialBookingState } from "@/lib/booking/state";

/**
 * The Book / Cancel control on a single class.
 *
 * One `useActionState` per class rather than one per page. A shared state
 * would mean an error from booking the Tuesday class appearing beside the
 * Thursday one, and a pending spinner on every button at once — the member
 * pressed one thing and forty of them reacted.
 *
 * A form, not an onClick fetch, so it still works before hydration and
 * without JavaScript: the server action is its own POST endpoint, and the
 * page re-renders from the server either way.
 */

function Pending({
  label,
  accessibleName,
  pendingLabel,
  tone,
  disabled,
}: {
  label: string;
  /**
   * Set straight on the button. It used to be an aria-labelledby on a
   * wrapping span, which named the span — an element with no role, so the
   * name went nowhere — and the wrapper then sat over the button and
   * swallowed clicks. A label belongs on the thing it labels.
   */
  accessibleName: string;
  pendingLabel: string;
  tone: "book" | "cancel";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  const base =
    "flex min-h-11 shrink-0 items-center justify-center rounded-full px-5 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-55";

  const skin =
    tone === "book"
      ? "bg-accent text-ink hover:bg-accent-hover"
      : "border border-border text-text-2 hover:border-crimson hover:text-crimson";

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      aria-label={accessibleName}
      className={`${base} ${skin}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ClassAction({
  occurrenceId,
  booked,
  full,
  label,
}: {
  occurrenceId: string;
  booked: boolean;
  /** Ignored when already booked — a member never loses their own spot to a full class. */
  full?: boolean;
  /** What this class is, for the accessible name. "Tue 12 Aug, 7–8:30 PM Advanced". */
  label: string;
}) {
  const [state, formAction] = useActionState(
    booked ? cancelBooking : bookClass,
    initialBookingState,
  );

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <form action={formAction}>
        <input type="hidden" name="occurrenceId" value={occurrenceId} />

        {/* The visible word is "Book", which read out of context forty
            times in a row says nothing. The accessible name carries the
            class it belongs to. */}
        <Pending
          label={booked ? "Cancel" : full ? "Full" : "Book"}
          accessibleName={booked ? `Cancel ${label}` : `Book ${label}`}
          pendingLabel={booked ? "Cancelling…" : "Booking…"}
          tone={booked ? "cancel" : "book"}
          disabled={!booked && full}
        />
      </form>

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="max-w-52 text-right text-[11px] leading-snug text-crimson"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
