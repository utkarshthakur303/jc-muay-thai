import "server-only";

import { LEVEL_LABELS, type LevelId } from "@/content/schedule";
import { site } from "@/content/site";
import { serverEnv } from "@/lib/env.server";
import {
  formatClassDateLong,
  formatClassTimeRange,
} from "@/lib/format/classTime";

/**
 * Telling members their class is off.
 *
 * Three ways, and the gym was explicit that it wanted all of them:
 *
 *   1. In the app. Already true and it costs nothing — /account reads the
 *      occurrence's status, so a cancelled class is marked the moment the
 *      row changes, with no message to send or deliver.
 *   2. By email. This file. Best effort.
 *   3. On the screen. The panel lists everyone affected with their address,
 *      so the owner can pick up a phone if it matters, whatever happened
 *      to the email.
 *
 * (3) exists because of what (2) is. Email is a system that accepts a
 * message and then quietly decides. A gym cancelling the 7pm two hours
 * before it starts needs to know who to reach, not to be told it was
 * "sent" — so the cancellation is never reported as delivered, only as
 * attempted, and the list of names stays on the page either way.
 *
 * Nothing here throws. The class is already cancelled by the time this
 * runs, and failing the action over a mail API would tell the owner his
 * cancellation had not worked when it had.
 */

/**
 * A hard cap on messages per cancellation.
 *
 * Capacity is 16, so this is never reached in practice. It is here so that
 * a bug — a bad occurrence id matching a thousand bookings, a retry loop —
 * cannot turn one button into a thousand outbound emails from a domain the
 * gym needs to keep deliverable.
 */
const MAX_RECIPIENTS = 60;

/** Per-message timeout. A hanging mail API must not hold the action open. */
const SEND_TIMEOUT_MS = 8000;

export type CancellationRecipient = {
  readonly email: string;
  readonly fullName: string | null;
};

export type CancellationClass = {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly level: LevelId;
};

/**
 * Which way the class moved.
 *
 * "restored" exists because the cancel button can be pressed by mistake,
 * and un-cancelling silently would leave every member holding an email
 * saying the class is off. The in-app view corrects itself the instant the
 * row changes; the inbox does not, and a member who reads their email and
 * stays home is not helped by the site having quietly changed its mind.
 */
export type NoticeKind = "cancelled" | "restored";

export type NotifyResult = {
  /** Messages the mail API accepted. */
  readonly sent: number;
  /**
   * True when at least one message could not be handed over, or when email
   * is not configured at all. The distinction the caller needs is not
   * "which error" but "can I assume these people have been told".
   */
  readonly failed: boolean;
};

function greeting(name: string | null): string {
  // "Hi," rather than "Hi there," or a fabricated name. Accounts made from
  // the dashboard carry no metadata, and an email opening with "Hi null"
  // has been shipped by better projects than this one.
  return name ? `Hi ${name},` : "Hi,";
}

function body(
  kind: NoticeKind,
  recipient: CancellationRecipient,
  klass: CancellationClass,
  note: string | null,
): string {
  const when = `${formatClassDateLong(klass.startsAt, site.timeZone)}, ${formatClassTimeRange(klass.startsAt, klass.endsAt, site.timeZone)}`;
  const what = `${LEVEL_LABELS[klass.level]} class on ${when}`;

  if (kind === "restored") {
    return [
      greeting(recipient.fullName),
      "",
      `Good news — your ${what} is going ahead after all. Please ignore the cancellation notice we sent.`,
      "",
      "Your place is still yours; there is nothing to rebook.",
      "",
      `— ${site.name}`,
    ].join("\n");
  }

  return [
    greeting(recipient.fullName),
    "",
    `Your ${what} has been cancelled.`,
    // The gym's own words, when it gave any. A reason is the difference
    // between a member rebooking and a member wondering.
    ...(note ? ["", note] : []),
    "",
    "Your place has been released — nothing to cancel at your end. You can book another session any time on the site.",
    "",
    `— ${site.name}`,
  ].join("\n");
}

async function sendOne(
  kind: NoticeKind,
  apiKey: string,
  from: string,
  replyTo: string | undefined,
  recipient: CancellationRecipient,
  klass: CancellationClass,
  note: string | null,
): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        /**
         * One recipient per message, always.
         *
         * The tempting version puts every member in one `to` array and
         * sends a single request. It also shows all sixteen of them each
         * other's email addresses, which is a data breach performed by a
         * convenience. BCC would hide them, but then a member's reply goes
         * to a message they cannot see themselves on — so: one each.
         */
        to: [recipient.email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject:
          kind === "restored"
            ? `Back on: ${LEVEL_LABELS[klass.level]}, ${formatClassDateLong(klass.startsAt, site.timeZone)}`
            : `Cancelled: ${LEVEL_LABELS[klass.level]}, ${formatClassDateLong(klass.startsAt, site.timeZone)}`,
        text: body(kind, recipient, klass, note),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("[admin] Resend rejected a cancellation notice", {
        status: response.status,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("[admin] Cancellation notice failed to send", error);
    return false;
  }
}

export async function notifyCancellation(input: {
  kind: NoticeKind;
  klass: CancellationClass;
  recipients: readonly CancellationRecipient[];
  note: string | null;
}): Promise<NotifyResult> {
  const recipients = input.recipients
    .filter((entry) => entry.email.includes("@"))
    .slice(0, MAX_RECIPIENTS);

  if (recipients.length === 0) return { sent: 0, failed: false };

  const { RESEND_API_KEY, CONTACT_FROM_EMAIL, CONTACT_NOTIFICATION_EMAIL } =
    serverEnv();

  if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL) {
    /**
     * Expected today. The Resend key and a verified sender are still open
     * items, and until they land the gym cancels a class and tells people
     * itself from the list on the screen.
     *
     * Reported as `failed`, not as a quiet zero. "Nobody was emailed"
     * looks identical to "there was nobody to email" if this returns
     * success, and those need different behaviour from whoever is standing
     * there with the members' addresses in front of them.
     */
    console.warn(
      `[admin] Class ${input.kind} but members not emailed: Resend is not configured.`,
    );
    return { sent: 0, failed: true };
  }

  // Replies go to the gym's own inbox, not to the no-reply sender. A member
  // answering "was that just tonight or all week?" should reach somebody.
  const replyTo = CONTACT_NOTIFICATION_EMAIL;

  const results = await Promise.all(
    recipients.map((recipient) =>
      sendOne(
        input.kind,
        RESEND_API_KEY,
        CONTACT_FROM_EMAIL,
        replyTo,
        recipient,
        input.klass,
        input.note,
      ),
    ),
  );

  const sent = results.filter(Boolean).length;
  return { sent, failed: sent < recipients.length };
}
