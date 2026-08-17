"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isPlanSlug } from "@/content/plans";
import { LEVELS, type LevelId } from "@/content/schedule";
import { notifyCancellation, type NoticeKind } from "@/lib/admin/notify";
import { finalCents, type DiscountKind } from "@/lib/admin/quote";
import { parseMoneyToCents } from "@/lib/format/money";
import { createClient, getUser } from "@/lib/supabase/server";
// Type-only, and it must stay that way: a "use server" module may export
// nothing but async functions. See lib/admin/state.ts.
import type { AdminActionState } from "@/lib/admin/state";

/**
 * The panel's writes.
 *
 * These run as the signed-in admin, exactly like the reads, so the
 * enforcement is the RLS policy and not anything in this file. There is no
 * `isAdmin()` check below and that is deliberate — a check here would look
 * like the gate while the real one sat in Postgres, and the day the two
 * disagreed the TypeScript would be believed. A member who calls these
 * actions gets a policy refusal, which arrives as 42501 and is reported as
 * "you cannot do that" rather than as a crash.
 *
 * What this file is for is the consequences: what to say when it works,
 * what to say when the class already started, and who to email.
 */

const occurrenceIdSchema = z.string().uuid();
const enquiryIdSchema = z.string().uuid();

/** PostgREST hands back `unknown`; nothing off the wire is trusted. */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asLevel(value: unknown): LevelId {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
    ? (value as LevelId)
    : "beginner";
}

/**
 * The reason, as the member will read it.
 *
 * Optional, because "cancelled" with no explanation is still better than a
 * class that silently vanishes, and requiring a sentence at 6pm on the way
 * to the gym is how a cancellation ends up not happening at all.
 *
 * 200 characters matches the check constraint added in
 * 20260815130000_admin_writes.sql. Both exist: this one produces a message,
 * that one makes the rule true for anything that ever writes the column.
 */
const noteSchema = z
  .string()
  .trim()
  .max(200, "Keep the reason under 200 characters.")
  .optional();

const NOT_ALLOWED =
  "That class can no longer be changed — it has already started, or your session is not an admin one.";

function messageForCode(code: string | undefined, fallback: string): string {
  switch (code) {
    /**
     * 42501 is the policy refusing. It covers two causes this cannot tell
     * apart — the class has started, or the caller is not an admin — so the
     * message names both rather than guessing.
     */
    case "42501":
      return NOT_ALLOWED;
    case "23514":
      // The note-length check. The form limits it too, so reaching this
      // means something posted past the form.
      return "That reason is too long. Keep it under 200 characters.";
    case "PGRST205":
      return "The database is missing the admin migration. Apply it and try again.";
    default:
      return fallback;
  }
}

/**
 * Everyone currently holding a place on a class.
 *
 * Read after the status change rather than before, which is safe because
 * cancelling a class deliberately does not touch bookings — see the
 * migration. Reading it afterwards means the list reflects anyone who
 * booked while the form was open.
 */
async function attendeesOf(
  occurrenceId: string,
): Promise<{ email: string; fullName: string | null }[]> {
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("user_id")
    .eq("occurrence_id", occurrenceId)
    .eq("status", "booked");

  const userIds = [
    ...new Set((bookings ?? []).map((row) => asString(row.user_id))),
  ].filter(Boolean);
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id,full_name,email")
    .in("user_id", userIds);

  return (profiles ?? [])
    .map((row) => {
      const fullName = asString(row.full_name).trim();
      return { email: asString(row.email), fullName: fullName || null };
    })
    .filter((entry) => entry.email !== "");
}

/**
 * Cancelling and un-cancelling are one operation with a direction.
 *
 * Split into two exported actions because the form should say "Cancel this
 * class" and "Put it back on", not toggle something whose current state the
 * button has to be trusted to know — a stale page toggling the wrong way is
 * how a class gets cancelled by a refresh.
 */
async function setClassStatus(
  kind: NoticeKind,
  formData: FormData,
): Promise<AdminActionState> {
  const parsedId = occurrenceIdSchema.safeParse(formData.get("occurrenceId"));
  if (!parsedId.success) {
    return { status: "error", message: "That class could not be identified." };
  }

  const parsedNote = noteSchema.safeParse(formData.get("note") ?? undefined);
  if (!parsedNote.success) {
    return {
      status: "error",
      message:
        parsedNote.error.issues[0]?.message ?? "That reason could not be used.",
    };
  }

  const cancelling = kind === "cancelled";
  const note = cancelling ? (parsedNote.data?.trim() || null) : null;

  const supabase = await createClient();

  /**
   * The occurrence is read first, and not only for the email. `update`
   * against a row the policy refuses reports success with zero rows
   * changed — PostgREST has nothing to complain about, because nothing was
   * forbidden, there was simply no matching row. Fetching the class gives
   * the times the email needs and a definite answer to "does this exist".
   */
  const { data: klass, error: readError } = await supabase
    .from("class_occurrences")
    .select("id,starts_at,ends_at,level,status")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (readError || !klass) {
    return {
      status: "error",
      message: messageForCode(
        readError?.code,
        "We couldn't find that class. It may have been removed.",
      ),
    };
  }

  const { data: updated, error } = await supabase
    .from("class_occurrences")
    .update({
      status: cancelling ? "cancelled" : "scheduled",
      cancellation_note: note,
    })
    .eq("id", parsedId.data)
    // Asking for the changed row back is what turns a silent no-op into a
    // reportable failure: the policy's `starts_at > now()` clause makes a
    // past class match nothing, and without this the panel would say
    // "cancelled" about a class it had not touched.
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      message: messageForCode(
        error.code,
        cancelling
          ? "Something went wrong cancelling that class. Please try again."
          : "Something went wrong putting that class back on. Please try again.",
      ),
    };
  }

  if (!updated) {
    return { status: "error", message: NOT_ALLOWED };
  }

  const recipients = await attendeesOf(parsedId.data);
  const notified = await notifyCancellation({
    kind,
    klass: {
      startsAt: asString(klass.starts_at),
      endsAt: asString(klass.ends_at),
      level: asLevel(klass.level),
    },
    recipients,
    note,
  });

  // /book stops listing a cancelled class; /account marks it. Both are
  // member-facing and both are wrong until they are rebuilt.
  revalidatePath("/book");
  revalidatePath("/account");
  revalidatePath("/admin/classes");
  revalidatePath(`/admin/classes/${parsedId.data}`);

  return {
    status: "success",
    message: cancelling
      ? "Class cancelled."
      : "Class is back on.",
    notified: notified.sent,
    notifyFailed: notified.failed,
  };
}

export async function cancelClass(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return setClassStatus("cancelled", formData);
}

export async function restoreClass(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return setClassStatus("restored", formData);
}

/**
 * Marking an enquiry dealt with, or putting it back in the queue.
 *
 * `handled_at` is a timestamp rather than a boolean because "when did we
 * answer this" is a question the gym will eventually ask and a boolean
 * cannot answer. Un-handling clears it — the original time is lost, which
 * is acceptable: the only reason to un-handle is that it was marked by
 * mistake, and preserving the timestamp of a mistake helps nobody.
 */
export async function setEnquiryHandled(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsedId = enquiryIdSchema.safeParse(formData.get("enquiryId"));
  if (!parsedId.success) {
    return { status: "error", message: "That message could not be identified." };
  }

  const handled = formData.get("handled") === "true";

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("contact_messages")
    .update({ handled_at: handled ? new Date().toISOString() : null })
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      message: messageForCode(
        error.code,
        "Something went wrong updating that message. Please try again.",
      ),
    };
  }

  if (!updated) {
    return { status: "error", message: "That message could not be updated." };
  }

  revalidatePath("/admin/enquiries");
  revalidatePath("/admin");

  return {
    status: "success",
    message: handled ? "Marked as dealt with." : "Back in the queue.",
  };
}

/* ---------------------------------------------------------------
   WHAT A MEMBER HAS BEEN QUOTED

   Money, and therefore the most carefully validated thing in this
   file. Every rule below is also a check constraint on
   `member_quotes` — these produce the sentence, those make the rule
   true for anything that ever writes the table.
   --------------------------------------------------------------- */

const userIdSchema = z.string().uuid();

const quoteNoteSchema = z
  .string()
  .trim()
  .max(200, "Keep the note under 200 characters.")
  .optional();

/**
 * Reads the discount out of the form, in whichever of its two shapes the
 * owner picked.
 *
 * A percentage is a whole number of percent; a fixed discount is money and
 * goes through the same parser as the price, so "$30" and "30.00" both
 * work. Returning a message rather than a number keeps the reason specific
 * — "that is not a number" and "you cannot discount more than the price"
 * are different problems and a single "invalid" helps with neither.
 */
function readDiscount(
  kind: DiscountKind,
  raw: string,
  priceCents: number,
): { value: number } | { error: string } {
  const text = raw.trim();
  if (text === "") return { value: 0 };

  if (kind === "percent") {
    if (!/^\d{1,3}$/.test(text)) {
      return { error: "Enter the discount as a whole number of percent." };
    }
    const value = Number(text);
    if (value > 100) return { error: "A discount cannot be more than 100%." };
    return { value };
  }

  const cents = parseMoneyToCents(text);
  if (cents === null) return { error: "That discount is not an amount." };
  if (cents > priceCents) {
    return { error: "The discount is more than the price." };
  }
  return { value: cents };
}

export async function saveQuote(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await getUser();
  if (!user) return { status: "error", message: "Your session has expired." };

  const parsedUser = userIdSchema.safeParse(formData.get("userId"));
  if (!parsedUser.success) {
    return { status: "error", message: "That member could not be identified." };
  }

  const planSlug = formData.get("planSlug");
  if (!isPlanSlug(planSlug)) {
    // The form only offers the plan the member actually chose, so this is
    // reachable only by posting past it — or by the plan list changing
    // under a page left open.
    return {
      status: "error",
      message: "That plan no longer exists. Reload the page and try again.",
    };
  }

  const priceCents = parseMoneyToCents(String(formData.get("price") ?? ""));
  if (priceCents === null) {
    return { status: "error", message: "That price is not an amount." };
  }
  if (priceCents > 1_000_000) {
    // Matches member_quotes_price_sane. A rail against a slipped decimal
    // point, not a business rule about what a gym may charge.
    return { status: "error", message: "That price looks like a slip — check the decimal point." };
  }

  const kind: DiscountKind =
    formData.get("discountKind") === "amount" ? "amount" : "percent";

  const discount = readDiscount(
    kind,
    String(formData.get("discountValue") ?? ""),
    priceCents,
  );
  if ("error" in discount) return { status: "error", message: discount.error };

  const parsedNote = quoteNoteSchema.safeParse(formData.get("note") ?? undefined);
  if (!parsedNote.success) {
    return {
      status: "error",
      message: parsedNote.error.issues[0]?.message ?? "That note could not be used.",
    };
  }

  const supabase = await createClient();

  /**
   * upsert on the primary key, because re-quoting is an edit of the one
   * current figure rather than a second row. `final_cents` is deliberately
   * absent from this payload — it is a generated column, and sending it
   * would be Postgres refusing the write, correctly.
   */
  const { data, error } = await supabase
    .from("member_quotes")
    .upsert(
      {
        user_id: parsedUser.data,
        plan_slug: planSlug,
        price_cents: priceCents,
        discount_kind: kind,
        discount_value: discount.value,
        note: parsedNote.data?.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "user_id" },
    )
    .select("final_cents")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      message: messageForCode(
        error.code,
        "Something went wrong saving that. Please try again.",
      ),
    };
  }

  if (!data) {
    // Not the class message: the policy that refused here is
    // `member_quotes_admin_write`, and naming a class would be nonsense.
    return {
      status: "error",
      message: "That could not be saved — your session is not an admin one.",
    };
  }

  revalidatePath(`/admin/members/${parsedUser.data}`);

  /**
   * The total is read back off the generated column rather than the one
   * the form was showing. If the two ever disagreed, this is the screen
   * where it would be caught — and the database's answer is the one the
   * owner should be reading out.
   */
  const total =
    typeof data.final_cents === "number"
      ? data.final_cents
      : finalCents(priceCents, kind, discount.value);

  return {
    status: "success",
    message: "Saved.",
    finalCents: total,
  };
}

/**
 * Clearing a quote deletes the row.
 *
 * The only place in this schema where a delete is allowed, and the reason
 * is what the row is: the gym's own working note about its own pricing,
 * not a record of anything a member did. "Scrap that and start again"
 * should leave nothing behind.
 */
export async function clearQuote(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsedUser = userIdSchema.safeParse(formData.get("userId"));
  if (!parsedUser.success) {
    return { status: "error", message: "That member could not be identified." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("member_quotes")
    .delete()
    .eq("user_id", parsedUser.data);

  if (error) {
    return {
      status: "error",
      message: messageForCode(
        error.code,
        "Something went wrong clearing that. Please try again.",
      ),
    };
  }

  revalidatePath(`/admin/members/${parsedUser.data}`);
  return { status: "success", message: "Quote cleared." };
}
