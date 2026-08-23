"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { isPlanSlug } from "@/content/plans";
import { GALLERY_SLOT, isSlotId, slotById } from "@/content/imageSlots";
import { LEVELS, type LevelId } from "@/content/schedule";
import { notifyCancellation, type NoticeKind } from "@/lib/admin/notify";
import { readPricePair } from "@/lib/admin/priceInput";
import { finalCents, type DiscountKind } from "@/lib/admin/quote";
import { formatMoney, parseMoneyToCents } from "@/lib/format/money";
import { syncOccurrences } from "@/lib/admin/timetable";
import {
  moveGalleryPhoto,
  removePhoto,
  updateAlt,
  uploadPhoto,
} from "@/lib/admin/photos";
import { IMAGES_TAG } from "@/lib/images/queries";
import { PLAN_PRICES_TAG } from "@/lib/plans/prices";
import { TIMETABLE_TAG } from "@/lib/schedule/queries";
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

/** Malformed submission — a field missing, or a value the form cannot produce. */
const INVALID = "Those details could not be read. Please check and try again.";

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

/* ------------------------------------------------------------------
   THE TIMETABLE

   The weekly pattern, which until 2026-08-22 lived in
   src/content/schedule.ts and could only be changed by a developer.

   Every one of these ends the same way: write the pattern, then rebuild
   the dated classes from it, then report what happened to both. The
   rebuild is the interesting half — see lib/admin/timetable.ts for why
   it refuses to touch a class somebody has booked.
   ------------------------------------------------------------------ */

const DAY_VALUES = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

const sessionSchema = z.object({
  day: z.enum(DAY_VALUES),
  level: z.enum(LEVELS),
  /** 24-hour HH:MM, which is what <input type="time"> submits. */
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time"),
  capacity: z.coerce.number().int().min(1).max(200),
});

function readSession(formData: FormData) {
  return sessionSchema.safeParse({
    day: formData.get("day"),
    level: formData.get("level"),
    start: formData.get("start"),
    end: formData.get("end"),
    capacity: formData.get("capacity"),
  });
}

/**
 * Everything a timetable write has to do after the row itself lands.
 *
 * The order matters. `revalidateTag` first, so the rebuild below reads
 * the pattern it just wrote rather than the cached previous one — get
 * that backwards and the first edit appears to do nothing and the second
 * appears to apply the first.
 */
async function afterTimetableWrite(): Promise<AdminActionState["sync"]> {
  /**
   * `updateTag`, not `revalidateTag`, and the difference is the whole
   * reason this works. `revalidateTag` marks the cache stale for the NEXT
   * request; `updateTag` gives read-your-own-writes inside this action.
   * With the wrong one, `syncOccurrences` below would read the timetable
   * as it was before the edit — so the first change would appear to do
   * nothing, and the second would appear to apply the first.
   */
  updateTag(TIMETABLE_TAG);

  const report = await syncOccurrences();

  // The public timetable, the booking calendar and the admin views all
  // read this data. None of them may keep showing last week's schedule.
  revalidatePath("/");
  revalidatePath("/book");
  revalidatePath("/admin/timetable");
  revalidatePath("/admin/classes");

  return {
    created: report.created,
    removed: report.removed,
    flagged: report.flagged.map((row) => ({ ...row })),
    capacityBlocked: report.capacityBlocked.map((row) => ({ ...row })),
  };
}

function describe(sync: AdminActionState["sync"], verb: string): string {
  if (!sync) return `${verb}.`;
  const bits = [`${verb}`];
  if (sync.created > 0) bits.push(`${sync.created} classes added`);
  if (sync.removed > 0) bits.push(`${sync.removed} removed`);
  return `${bits.join(" · ")}.`;
}

export async function createSession(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = readSession(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  }

  const { day, level, start, end, capacity } = parsed.data;

  if (start >= end) {
    return { status: "error", message: "The class has to end after it starts." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("class_sessions").insert({
    day,
    level,
    starts_at: start,
    ends_at: end,
    capacity,
  });

  if (error) {
    // 23505 is the unique constraint on (day, starts_at, level): two
    // classes of the same level cannot start at the same minute on the
    // same day, because booking could not tell them apart.
    return {
      status: "error",
      message:
        error.code === "23505"
          ? "There is already a class of that level at that time."
          : NOT_ALLOWED,
    };
  }

  const sync = await afterTimetableWrite();
  return { status: "success", message: describe(sync, "Class added"), sync };
}

export async function updateSession(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: INVALID };

  const parsed = readSession(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  }

  const { day, level, start, end, capacity } = parsed.data;

  if (start >= end) {
    return { status: "error", message: "The class has to end after it starts." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("class_sessions")
    .update({
      day,
      level,
      starts_at: start,
      ends_at: end,
      capacity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.data)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      message:
        error.code === "23505"
          ? "There is already a class of that level at that time."
          : NOT_ALLOWED,
    };
  }

  // A policy refusal is not an error, it is zero rows changed. Without
  // reading the row back, a member calling this action would be told it
  // worked.
  if (!updated) return { status: "error", message: NOT_ALLOWED };

  const sync = await afterTimetableWrite();
  return { status: "success", message: describe(sync, "Class updated"), sync };
}

export async function deleteSession(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: INVALID };

  const supabase = await createClient();
  const { data: gone, error } = await supabase
    .from("class_sessions")
    .delete()
    .eq("id", id.data)
    .select("id")
    .maybeSingle();

  if (error || !gone) return { status: "error", message: NOT_ALLOWED };

  const sync = await afterTimetableWrite();
  return { status: "success", message: describe(sync, "Class removed"), sync };
}

// ── Photographs ──────────────────────────────────────────────────────

/**
 * Everything the pictures touch.
 *
 * `updateTag` rather than `revalidateTag` for the same read-your-own-writes
 * reason as the timetable — the panel re-renders inside this request and
 * must not draw the photograph it has just replaced.
 *
 * The path list is longer than it looks like it should be because the
 * hero appears on the sign-in and sign-up screens as well as the home
 * page. A replaced hero that changed on `/` and not on `/login` would be
 * the kind of half-applied edit the owner has no way to explain.
 */
async function afterPhotoWrite(): Promise<void> {
  updateTag(IMAGES_TAG);
  revalidatePath("/");
  revalidatePath("/login");
  revalidatePath("/signup");
  revalidatePath("/admin/photos");
}

/**
 * Whether this slot needs a description, decided from the slot list
 * rather than from the form.
 *
 * A hidden field saying "this one is decorative" is a field anybody can
 * post, and the whole alt-text rule would come off with it.
 */
function altRequiredFor(slot: string): boolean {
  if (slot === GALLERY_SLOT) return true;
  return isSlotId(slot) ? slotById(slot).needsAlt : true;
}

export async function uploadPhotoAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const slot = formData.get("slot");
  if (typeof slot !== "string" || (slot !== GALLERY_SLOT && !isSlotId(slot))) {
    return { status: "error", message: INVALID };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { status: "error", message: INVALID };
  }

  const alt = formData.get("alt");

  const result = await uploadPhoto({
    slot,
    file,
    alt: typeof alt === "string" ? alt : "",
    needsAlt: altRequiredFor(slot),
  });

  if (!result.ok) return { status: "error", message: result.message };

  await afterPhotoWrite();
  return {
    status: "success",
    message:
      slot === GALLERY_SLOT
        ? "Photograph added to the gallery."
        : "Photograph replaced. It is live on the site now.",
  };
}

export async function removePhotoAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: INVALID };

  const result = await removePhoto(id.data);
  await afterPhotoWrite();

  return result.ok
    ? { status: "success", message: "Photograph removed." }
    : { status: "error", message: result.message };
}

export async function movePhotoAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const direction = formData.get("direction");
  if (!id.success || (direction !== "up" && direction !== "down")) {
    return { status: "error", message: INVALID };
  }

  const result = await moveGalleryPhoto(id.data, direction);
  if (!result.ok) return { status: "error", message: result.message };

  await afterPhotoWrite();
  return { status: "success", message: "Order updated." };
}

export async function updateAltAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const slot = formData.get("slot");
  const alt = formData.get("alt");

  if (!id.success || typeof slot !== "string" || typeof alt !== "string") {
    return { status: "error", message: INVALID };
  }

  const result = await updateAlt(id.data, alt, altRequiredFor(slot));
  if (!result.ok) return { status: "error", message: result.message };

  await afterPhotoWrite();
  return { status: "success", message: "Description saved." };
}

/* ═══════════════════════════════════════════════════════════════════
   PLAN PRICES

   The gym's advertised rates. See 20260823180000_plan_prices.sql for
   what moved into the database and what deliberately did not.

   NOTHING HERE CHARGES ANYBODY, and one consequence is worth stating
   where it can be read next to the code: changing a price does not
   touch a single quote. `member_quotes` snapshots its own
   `price_cents` when the owner agrees a figure with somebody, and no
   query in this file reads `plan_prices` on that member's behalf. The
   four people already on Beginners keep the number they were told.
   ═══════════════════════════════════════════════════════════════════ */

/**
 * What to say when Postgres refuses a price.
 *
 * Its own mapper rather than a case added to `messageForCode`: 23514 is
 * the cancellation-note length there and the contract-rate invariant
 * here, and one function answering both would have to guess which.
 */
/** PostgREST hands back `unknown`; a price that is not a number is not a price. */
function asCents(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : 0;
}

function messageForPriceCode(code: string | undefined): string {
  switch (code) {
    case "42501":
      return "That could not be saved — your session is not an admin one.";
    case "23514":
      // plan_prices_contract_not_higher, or one of the sanity rails.
      // The form checks the same rule first, so arriving here means
      // something posted past it.
      return "The contract rate cannot be higher than the monthly rate.";
    case "PGRST205":
    case "PGRST204":
      return "Editable prices are not switched on yet — the pricing migration has not been applied.";
    default:
      return "Something went wrong saving that price. Please try again.";
  }
}

export async function updatePlanPrice(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await getUser();
  if (!user) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const slug = formData.get("slug");
  if (!isPlanSlug(slug)) {
    // Reachable only by posting past the form, or by the plan list
    // changing under a page left open.
    return { status: "error", message: "That plan no longer exists. Reload the page." };
  }

  const pair = readPricePair(
    formData.get("price"),
    formData.get("contractPrice"),
  );
  if (!pair.ok) return { status: "error", message: pair.message };

  const supabase = await createClient();

  /**
   * Read before writing, and it earns its round trip three times over.
   *
   * 1. It tells a missing ROW apart from a refused WRITE. Both would
   *    otherwise come back from the update as zero rows affected, and
   *    "the migration has not been applied" and "you are not an admin"
   *    are not a message the owner should have to guess between.
   * 2. It makes a no-op save honest. The trigger stamps `updated_at` on
   *    every update, so saving an unchanged form would move "changed 2
   *    minutes ago" without anything having changed — and that
   *    timestamp is exactly what gets checked when a member turns up
   *    quoting a figure from a screenshot.
   * 3. The old figures go into the confirmation, so the owner reads
   *    back what actually changed rather than what he typed.
   */
  const { data: before, error: readError } = await supabase
    .from("plan_prices")
    .select("price_cents,contract_price_cents")
    .eq("slug", slug)
    .maybeSingle();

  if (readError) {
    return { status: "error", message: messageForPriceCode(readError.code) };
  }
  if (!before) {
    return {
      status: "error",
      message:
        "There is no price row for that plan. Apply the pricing migration's seed and try again.",
    };
  }

  const wasPrice = asCents(before.price_cents);
  const wasContract =
    typeof before.contract_price_cents === "number"
      ? before.contract_price_cents
      : null;

  if (wasPrice === pair.priceCents && wasContract === pair.contractCents) {
    return {
      status: "success",
      message: "No change — that is already the price.",
    };
  }

  const { data, error } = await supabase
    .from("plan_prices")
    .update({
      price_cents: pair.priceCents,
      contract_price_cents: pair.contractCents,
    })
    /*
      `slug` is deliberately absent from the payload. It is not in the
      column grant either, so sending it would be Postgres refusing the
      write — correctly. A plan's slug is a LevelId shared with the
      timetable and is not a thing the pricing form may touch.
    */
    .eq("slug", slug)
    .select("price_cents,contract_price_cents")
    .maybeSingle();

  if (error) {
    return { status: "error", message: messageForPriceCode(error.code) };
  }

  /**
   * A 200 IS NOT A SUCCESS. PostgREST answers a policy-filtered UPDATE
   * with 200 and an empty body — the row exists (we just read it) and
   * the write matched nothing, which leaves exactly one explanation.
   */
  if (!data) {
    return {
      status: "error",
      message: "That could not be saved — your session is not an admin one.",
    };
  }

  await afterPriceWrite();

  /**
   * Confirmed with the figures read back off the row, not the ones the
   * form was holding. If the two ever disagreed, the screen the owner
   * reads a price off should be showing the database's answer.
   */
  const savedPrice = asCents(data.price_cents);
  const savedContract =
    typeof data.contract_price_cents === "number" ? data.contract_price_cents : null;

  const parts = [`${formatMoney(wasPrice)} → ${formatMoney(savedPrice)} a month`];
  if (wasContract !== savedContract) {
    parts.push(
      savedContract === null
        ? "contract rate removed"
        : `contract rate ${
            wasContract === null ? "set to" : `${formatMoney(wasContract)} →`
          } ${formatMoney(savedContract)}`,
    );
  }

  return {
    status: "success",
    message: `Saved and live. ${parts.join(", ")}.`,
  };
}

/**
 * Everywhere a price is printed.
 *
 * `updateTag` rather than `revalidateTag` for the same read-your-own-
 * writes reason as the photographs: the pricing page re-reads inside
 * this action and must not show the figure it has just replaced.
 *
 * The path list is longer than it looks like it should be because a
 * price appears on four unrelated screens — the class cards on the home
 * page, the plan picker, a member's own account page, and the quote box
 * that seeds from the standard rate. A price that changed on `/` and not
 * on `/plans` is the half-applied edit that ends in an argument at the
 * counter.
 */
async function afterPriceWrite(): Promise<void> {
  updateTag(PLAN_PRICES_TAG);
  revalidatePath("/");
  revalidatePath("/plans");
  revalidatePath("/account");
  revalidatePath("/admin/pricing");
}
