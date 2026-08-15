"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { cancelClass, restoreClass } from "@/lib/admin/actions";
import { initialAdminState } from "@/lib/admin/state";

/**
 * Calling off a class, and putting it back on.
 *
 * Two-step on purpose. Cancelling is the one control in this panel that
 * reaches out and changes something for other people — it empties a class
 * from the booking calendar and puts an email in every attendee's inbox —
 * and a single tap next to a roster is a tap that will eventually be made
 * by a thumb reaching for something else.
 *
 * `useActionState` here, where `ClassAction` deliberately avoids it. The
 * difference is what happens after success: a member cancelling a booking
 * removes the row this component lives in, so its effect never runs. This
 * component's row is the class itself, which does not go anywhere — it
 * re-renders with a cancelled banner and the form stays mounted to report
 * how many people were told.
 */

function Submit({
  label,
  pendingLabel,
  tone,
}: {
  label: string;
  pendingLabel: string;
  tone: "danger" | "quiet";
}) {
  const { pending } = useFormStatus();

  const base =
    "flex min-h-11 shrink-0 items-center justify-center rounded-full px-6 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-55";

  // Mutually exclusive branches, never a concatenated idle + hover pair:
  // Tailwind orders by variant rather than string position, so appending a
  // hover class does not reliably beat the base one.
  const skin =
    tone === "danger"
      ? "border border-danger text-danger hover:bg-danger hover:text-chalk"
      : "bg-accent text-ink hover:bg-accent-hover";

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={base + " " + skin}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * What the panel says about the emails.
 *
 * Never "members have been notified" — this system cannot know that. It
 * knows how many messages a mail API accepted, which is a different and
 * smaller claim, and the contact list beside this form is what the gym
 * falls back on when the claim is small.
 */
function NotifyLine({
  notified,
  failed,
  attendees,
}: {
  notified: number;
  failed: boolean;
  attendees: number;
}) {
  if (attendees === 0) {
    return <>Nobody had booked it, so there was no one to tell.</>;
  }

  if (failed && notified === 0) {
    return (
      <>
        <strong className="font-semibold text-danger">
          No emails went out.
        </strong>{" "}
        Everyone affected is listed below — please contact them directly.
      </>
    );
  }

  if (failed) {
    return (
      <>
        {notified} of {attendees} emails were accepted; the rest were not.
        Check the list below and contact anyone you are unsure about.
      </>
    );
  }

  /*
    Deliberately does not add "…and the app has been updated". It has been,
    the instant the row changed, but this line is read after both
    cancelling and restoring and a sentence that is only true of one of
    them is worse than a sentence that says less.
  */
  return (
    <>
      {notified} {notified === 1 ? "email was" : "emails were"} sent.
    </>
  );
}

export function CancelClassForm({
  occurrenceId,
  cancelled,
  past,
  attendees,
}: {
  occurrenceId: string;
  cancelled: boolean;
  /** A class that has already started cannot be changed — the policy says so. */
  past: boolean;
  /** How many people currently hold a place, for the result message. */
  attendees: number;
}) {
  const [state, action] = useActionState(
    cancelled ? restoreClass : cancelClass,
    initialAdminState,
  );
  const [confirming, setConfirming] = useState(false);

  if (past) {
    return (
      <p className="mt-8 text-sm leading-relaxed text-text-2">
        {/*
          The button is not merely hidden here — the RLS policy refuses an
          update on a class that has started. Saying why is what stops the
          gym hunting for a control that was never going to work.
        */}
        This class has already started, so it can no longer be cancelled.
      </p>
    );
  }

  return (
    <div className="mt-8">
      {cancelled ? (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="occurrenceId" value={occurrenceId} />
          <Submit
            label="Put it back on"
            pendingLabel="Restoring…"
            tone="quiet"
          />
          <span className="max-w-prose text-[13px] leading-snug text-text-2">
            Everyone who still holds a place will be emailed that it is going
            ahead after all.
          </span>
        </form>
      ) : confirming ? (
        <form
          action={action}
          className="card-surface rounded-card border border-danger p-5"
        >
          <input type="hidden" name="occurrenceId" value={occurrenceId} />

          <label
            htmlFor="cancel-note"
            className="block font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase"
          >
            Reason (optional)
          </label>
          <p className="mt-2 max-w-prose text-[13px] leading-snug text-text-2">
            {/*
              Optional, and said so plainly. Requiring a sentence at six in
              the evening is how a cancellation ends up not being sent at
              all — and a member reading "cancelled" with no reason is still
              far better served than one who turns up to a locked door.
            */}
            This goes out word-for-word in the email. Something like “Coach is
            unwell — back to normal on Thursday.”
          </p>
          <input
            id="cancel-note"
            type="text"
            name="note"
            maxLength={200}
            autoComplete="off"
            placeholder="Coach away, back Thursday"
            className="mt-3 min-h-11 w-full rounded-full border border-border bg-input-bg px-5 text-sm text-text placeholder:text-text-3 focus:border-accent focus:outline-none"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Submit
              label={
                attendees > 0
                  ? `Cancel and email ${attendees}`
                  : "Cancel this class"
              }
              pendingLabel="Cancelling…"
              tone="danger"
            />
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
            >
              Keep it on
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex min-h-11 items-center rounded-full border border-border px-6 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-danger hover:text-danger"
        >
          Cancel this class
        </button>
      )}

      {state.status !== "idle" && state.message ? (
        <p
          role="status"
          className={`mt-4 max-w-prose text-sm leading-relaxed ${
            state.status === "error" ? "text-danger" : "text-text-2"
          }`}
        >
          <strong className="font-semibold text-text">{state.message}</strong>{" "}
          {state.status === "success" ? (
            <NotifyLine
              notified={state.notified ?? 0}
              failed={state.notifyFailed ?? false}
              attendees={attendees}
            />
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
