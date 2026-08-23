"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, getUser } from "@/lib/supabase/server";
// Type-only, and it has to stay that way: a "use server" module may export
// nothing but async functions. See lib/booking/state.ts.
import type { BookingState } from "@/lib/booking/state";

/**
 * Booking and cancelling.
 *
 * These run as the signed-in member, not as the service role. Every rule
 * they appear to enforce is actually enforced by a row-level security
 * policy — a member holds the publishable key and their own JWT and can
 * talk to PostgREST directly, so anything checked only here is not checked
 * at all.
 *
 * What this file is for is the *message*. A policy can refuse a booking;
 * it cannot explain that the class filled up thirty seconds ago.
 */

const occurrenceIdSchema = z.string().uuid();

/**
 * Postgres error codes, mapped to something a person can act on.
 *
 * 23514 is the one that matters. It is raised by the
 * class_occurrences_not_oversold check, from inside the trigger that
 * increments the occupancy count — which means the class filled between
 * this member opening the page and pressing the button. It is not an error
 * in the ordinary sense; it is the race being resolved correctly, and the
 * honest response is to say the class is full.
 */
function messageForCode(code: string | undefined): string {
  switch (code) {
    case "23514":
      return "That class just filled up. Try another time — spots do open up.";
    case "42501":
      // RLS refused: the class has started, or the gym cancelled it.
      return "That class is no longer open for booking.";
    case "23503":
      return "We couldn't find that class. It may have been removed.";
    default:
      return "Something went wrong booking that class. Please try again.";
  }
}

export async function bookClass(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const user = await getUser();
  if (!user) {
    return {
      intent: "book",
      status: "error",
      message: "Please sign in to book a class.",
    };
  }

  const parsed = occurrenceIdSchema.safeParse(formData.get("occurrenceId"));
  if (!parsed.success) {
    return {
      intent: "book",
      status: "error",
      message: "That class could not be identified.",
    };
  }

  const supabase = await createClient();

  /**
   * upsert, not insert. A member who books, cancels, then changes their
   * mind already has a row for this class — the unique constraint that
   * stops them taking two spots also stops a plain insert. Flipping the
   * existing row back to 'booked' is the same operation from their side,
   * and the trigger treats a status change exactly as it treats a new
   * booking, so occupancy stays correct either way.
   */
  const row = {
    occurrence_id: parsed.data,
    user_id: user.id,
    status: "booked",
    cancelled_at: null,
  };

  /**
   * `source: "member"` marks this as a decision about a specific class,
   * which is what protects it from a later plan change: choosing a
   * different plan releases the bookings the plan made and leaves these
   * alone. It is written on every press, including a re-book of
   * something the plan had booked and the member cancelled — that
   * second press is a decision, and it should survive.
   *
   * ── AND WHY IT IS ATTEMPTED RATHER THAN ASSUMED ────────────────────
   *
   * The column arrives in a migration the client runs by hand, after
   * this code is already live. Naming a column PostgREST has never heard
   * of comes back PGRST204 and fails the write — which would mean
   * BOOKING ITSELF BROKEN, for every member, for as long as the SQL sat
   * unrun. That is not a degradation anybody would accept for a label.
   *
   * So the label is optional: if the column is not there, the same row
   * goes in without it. The only thing lost in that window is the
   * distinction, and nothing reads the distinction until the migration
   * lands either.
   */
  const attempt = (withSource: boolean) => {
    // One payload shape, built then narrowed, rather than two object
    // literals in a ternary — the generated PostgREST types reject a
    // union of row shapes at the call site.
    const payload: Record<string, unknown> = { ...row };
    if (withSource) payload.source = "member";

    return supabase
      .from("bookings")
      .upsert(payload, { onConflict: "occurrence_id,user_id" });
  };

  let { error } = await attempt(true);

  // PGRST204 is PostgREST's "column not in the schema cache"; 42703 is
  // Postgres's own "column does not exist", which a direct path would
  // raise instead. Both mean the migration has not been run.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ error } = await attempt(false));
  }

  if (error) {
    return {
      intent: "book",
      status: "error",
      message: messageForCode(error.code),
    };
  }

  revalidatePath("/book");
  revalidatePath("/account");
  return {
    intent: "book",
    status: "success",
    message: "Booked. See you on the mat.",
  };
}

export async function cancelBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const user = await getUser();
  if (!user) {
    return {
      intent: "cancel",
      status: "error",
      message: "Please sign in to manage your classes.",
    };
  }

  const parsed = occurrenceIdSchema.safeParse(formData.get("occurrenceId"));
  if (!parsed.success) {
    return {
      intent: "cancel",
      status: "error",
      message: "That class could not be identified.",
    };
  }

  const supabase = await createClient();

  /**
   * The booking is never deleted. A class that was booked and dropped is a
   * different fact from one that was never booked, and attendance and any
   * future no-show policy both need to tell them apart.
   *
   * The user_id filter is belt to the policy's braces. The policy is what
   * enforces ownership; this is here because an UPDATE with no owner filter
   * is the kind of line that gets copied somewhere the policy is weaker.
   */
  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("occurrence_id", parsed.data)
    .eq("user_id", user.id);

  if (error) {
    return {
      intent: "cancel",
      status: "error",
      message:
        error.code === "42501"
          ? // The policy refuses an update once the class has begun. It
            // also refuses one on a class the gym cancelled, which is why
            // this does not name a single cause it cannot distinguish.
            "That class can no longer be changed — it has already started."
          : "Something went wrong cancelling that class. Please try again.",
    };
  }

  revalidatePath("/book");
  revalidatePath("/account");
  return {
    intent: "cancel",
    status: "success",
    message: "Cancelled. Your spot is back in the pool.",
  };
}
