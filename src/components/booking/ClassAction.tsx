"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { useBookingToast } from "@/components/booking/BookingToast";
import { bookClass, cancelBooking } from "@/lib/booking/actions";
import { initialBookingState, type BookingState } from "@/lib/booking/state";

/**
 * The Book / Cancel control on a single class.
 *
 * State is per-class, not per-page. A shared one would mean an error from
 * booking the Tuesday class appearing beside the Thursday one, and a
 * pending spinner on every button at once — the member pressed one thing
 * and forty of them reacted.
 *
 * WHY THIS IS NOT `useActionState`
 *
 * It was, and the toast broke on one page because of it. `useActionState`
 * hands the result back as component state, so the only place to react to
 * it is an effect — and on /account a successful cancel removes the very
 * row this component lives in. React commits the removal and the new state
 * together, the component unmounts, and its effect never runs. Booking
 * from the calendar announced itself; cancelling from the account page did
 * not, silently, and only there.
 *
 * Awaiting the action in a submit handler puts the result in a plain
 * closure instead. A closure does not care that the component that created
 * it has gone, and `showToast` belongs to the provider up in MemberShell,
 * which has not. Same server action, same validation, same errors — the
 * result is simply read somewhere that outlives the row.
 *
 * WHAT THAT COSTS
 *
 * A `<form action={serverAction}>` can be submitted before React hydrates,
 * because React renders it as a real POST endpoint. Wrapping the action in
 * a client function gives that up: a tap in the window between HTML
 * arriving and JavaScript running now does nothing rather than booking the
 * class. Accepted, because that window is already inert on this page — the
 * calendar's day buttons are client state, so before hydration a member
 * cannot reach any class but the default day's anyway.
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
      : "border border-border text-text-2 hover:border-danger hover:text-danger";

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
  const [state, setState] = useState<BookingState>(initialBookingState);
  const showToast = useBookingToast();

  const action = booked ? cancelBooking : bookClass;
  const intent = booked ? "cancel" : "book";

  /**
   * React keeps `useFormStatus` pending for as long as this promise is
   * unresolved, so the button still reports itself busy.
   *
   * setState may land after this row has been removed from the page — that
   * is the whole point — where React treats it as a no-op. The toast is
   * what carries the news at that point.
   */
  async function submit(formData: FormData) {
    let result: BookingState;
    try {
      result = await action(initialBookingState, formData);
    } catch {
      // The actions return their failures rather than throwing, so this is
      // the transport giving out: a dropped connection, a deploy mid-click.
      // Left unhandled it would reach the error boundary and replace the
      // whole page over one failed button.
      result = {
        intent,
        status: "error",
        message: "Couldn't reach the gym's system. Please try again.",
      };
    }

    setState(result);

    if (result.status === "success") {
      showToast?.({ intent: result.intent ?? intent, detail: label });
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <form action={submit}>
        <input type="hidden" name="occurrenceId" value={occurrenceId} />

        {/* The visible word is "Book", which read out of context forty
            times in a row says nothing. The accessible name carries the
            class it belongs to. */}
        <Pending
          label={booked ? "Cancel" : full ? "Full" : "Book"}
          accessibleName={booked ? `Cancel ${label}` : `Book ${label}`}
          pendingLabel={booked ? "Cancelling…" : "Booking…"}
          tone={intent}
          disabled={!booked && full}
        />
      </form>

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="max-w-52 text-right text-[11px] leading-snug text-danger"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
