"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { site } from "@/content/site";
import { setEnquiryHandled } from "@/lib/admin/actions";
import { initialAdminState } from "@/lib/admin/state";
import type { Enquiry } from "@/lib/admin/enquiries";

/**
 * One enquiry, with the two things ever done to it: answer it, and mark it
 * dealt with.
 *
 * The message is shown in full rather than truncated to a preview. These
 * are at most 2000 characters — the table's own check constraint — and a
 * preview means opening a second view to read four extra words, on the one
 * screen where the whole job is reading what somebody wrote.
 */

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-11 shrink-0 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function EnquiryCard({
  enquiry,
  receivedLabel,
  handledLabel,
}: {
  enquiry: Enquiry;
  /** Formatted on the server, in the gym's zone. */
  receivedLabel: string;
  handledLabel: string | null;
}) {
  const [state, action] = useActionState(setEnquiryHandled, initialAdminState);
  const handled = enquiry.handledAt !== null;

  /**
   * A mailto with the subject and quoted question already in it.
   *
   * The gym's reply to an enquiry is an email, and the alternative is
   * copying an address out of a web page into a mail client — which is
   * exactly the friction that leaves messages unanswered for a week. The
   * body is encoded rather than concatenated: an apostrophe or a line break
   * in what somebody wrote would otherwise truncate the link.
   */
  const replyHref = `mailto:${encodeURIComponent(enquiry.email)}?subject=${encodeURIComponent(
    `Re: your message to ${site.name}`,
  )}&body=${encodeURIComponent(`\n\n---\nYou wrote:\n${enquiry.message}\n`)}`;

  return (
    <li
      className={`card-surface rounded-card border p-5 ${
        handled ? "border-border opacity-70" : "border-accent"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-text">{enquiry.name}</span>
        <a
          href={replyHref}
          className="inline-flex min-h-11 items-center font-mono text-[12px] text-text-2 underline-offset-4 transition-colors hover:text-accent-strong hover:underline"
        >
          {enquiry.email}
        </a>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-text-3">
          {receivedLabel}
        </span>
      </div>

      {/*
        `whitespace-pre-wrap` because people write in paragraphs and a
        message collapsed to one block is harder to read than the thing they
        actually sent. React escapes the content; nothing here is dangerously
        set.
      */}
      <p className="mt-3 max-w-prose text-sm leading-relaxed whitespace-pre-wrap text-text">
        {enquiry.message}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action={action}>
          <input type="hidden" name="enquiryId" value={enquiry.id} />
          <input type="hidden" name="handled" value={handled ? "false" : "true"} />
          <Submit
            label={handled ? "Put back in the queue" : "Mark as dealt with"}
            pendingLabel="Saving…"
          />
        </form>

        {handledLabel ? (
          <span className="font-mono text-[11px] tabular-nums text-text-3">
            Dealt with {handledLabel}
          </span>
        ) : null}

        {state.status === "error" && state.message ? (
          <span role="alert" className="text-[12px] leading-snug text-danger">
            {state.message}
          </span>
        ) : null}
      </div>
    </li>
  );
}
