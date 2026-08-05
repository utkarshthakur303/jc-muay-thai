"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { site } from "@/content/site";
import { HONEYPOT_FIELD, contactSchema } from "@/lib/validation/contact";
import { fieldErrorsFrom, type FormState } from "@/lib/validation/fields";

/**
 * Receiving a contact enquiry.
 *
 * The mockup's version of this called preventDefault, changed the button
 * to read "Message Sent ✓", and changed it back after 2.4 seconds. It sent
 * nothing, stored nothing, and told the person it had worked. That is the
 * single worst thing on the page — a prospective customer walks away
 * believing they have contacted the gym.
 *
 * The rule this replaces it with: the success message is only ever
 * returned after a row is durably committed. Anything else — a missing
 * key, a missing table, a network failure — returns an error that says so.
 *
 * Delivery has two stages, deliberately unequal:
 *   1. The database write. Must succeed, or the visitor is told it failed.
 *   2. The notification email. Best effort. If Resend is unconfigured or
 *      down, the enquiry is still safe in Postgres and the visitor is
 *      still told the truth. Reporting failure because a *notification*
 *      failed would be its own kind of lie.
 */

const RATE_LIMIT_PER_HOUR = 5;

/**
 * Reported back for a genuine submit and for a honeypot hit alike. A bot
 * that can tell it was rejected is a bot that gets fixed.
 */
const SUCCESS_MESSAGE =
  "Thanks — your message is with us. We'll reply to the address you gave.";

/**
 * The visitor's IP, pseudonymised.
 *
 * Stored as a SHA-256 digest, never in the clear: the only thing it is
 * ever used for is counting recent submissions from the same origin, and
 * that works exactly as well on a hash. Salted with the Supabase secret so
 * the digest cannot be reversed with a rainbow table of the four billion
 * IPv4 addresses, which an unsalted hash absolutely can be.
 */
async function requesterHash(): Promise<string | null> {
  const headerList = await headers();
  // x-forwarded-for is a chain; the first entry is the client. The rest
  // are proxies and must not be trusted or used.
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerList.get("x-real-ip")?.trim();
  if (!ip) return null;

  const salt = serverEnv().SUPABASE_SECRET_KEY ?? site.name;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Fire-and-forget notification. Never throws — the caller has already
 * committed the message and must not fail on account of this.
 */
async function notify(input: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const { RESEND_API_KEY, CONTACT_FROM_EMAIL, CONTACT_NOTIFICATION_EMAIL } =
    serverEnv();

  if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL || !CONTACT_NOTIFICATION_EMAIL) {
    // Expected until questionnaire Q1.9/Q1.10 come back and the key is
    // added to the Vercel project. The row is already committed; whoever
    // reads the table sees the enquiry either way.
    console.warn(
      "[contact] Enquiry stored but not emailed: Resend is not configured.",
    );
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: [CONTACT_NOTIFICATION_EMAIL],
        // Replying in a mail client goes to the enquirer, not to the
        // no-reply sender — without this, answering an enquiry means
        // copying the address out by hand every time.
        reply_to: input.email,
        subject: `New enquiry from ${input.name}`,
        text: `${input.name} <${input.email}>\n\n${input.message}`,
      }),
      // A hanging mail API must not hold the visitor's request open.
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("[contact] Resend rejected the notification", {
        status: response.status,
      });
    }
  } catch (error) {
    console.error("[contact] Notification email failed", error);
  }
}

export async function submitContactMessage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  // Before anything else, and before any database work: a filled honeypot
  // costs us one string comparison instead of two round trips.
  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim() !== "") {
    return { status: "success", message: SUCCESS_MESSAGE };
  }

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: raw,
    };
  }

  const supabase = createAdminClient();
  if (!supabase) {
    console.error(
      "[contact] SUPABASE_SECRET_KEY is not set — cannot store enquiries.",
    );
    return {
      status: "error",
      message:
        "We can't take messages through the site right now. Please try again shortly.",
      values: raw,
    };
  }

  const ipHash = await requesterHash();

  if (ipHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gt("created_at", since);

    // A failed count must not become a free pass, but it also must not
    // block a real person: log it and let the insert proceed, where a
    // genuine outage will surface as an honest error anyway.
    //
    // `count === null` with no error is the same situation wearing a
    // different hat — a HEAD request against a table PostgREST cannot see
    // comes back with no body to report an error in. It is logged too,
    // because a rate limit that has quietly stopped counting looks exactly
    // like one that is working.
    if (error || count === null) {
      console.error(
        "[contact] Rate-limit check inconclusive — allowing the submission",
        error?.message ?? "no count returned",
      );
    } else if (count >= RATE_LIMIT_PER_HOUR) {
      return {
        status: "error",
        message:
          "That's a few messages in a short time. Please give it an hour before sending another.",
        values: raw,
      };
    }
  }

  const { error } = await supabase.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    message: parsed.data.message,
    ip_hash: ipHash,
  });

  if (error) {
    // Logged in full server-side, summarised for the visitor: a raw
    // Postgres error reveals table and column names to anyone who can
    // trigger it.
    console.error("[contact] Insert failed", error.message);
    return {
      status: "error",
      message:
        "Something went wrong saving your message. Please try again in a moment.",
      values: raw,
    };
  }

  await notify(parsed.data);

  return { status: "success", message: SUCCESS_MESSAGE };
}
