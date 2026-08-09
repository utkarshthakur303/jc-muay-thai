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
  const { error } = await supabase.from("bookings").upsert(
    {
      occurrence_id: parsed.data,
      user_id: user.id,
      status: "booked",
      cancelled_at: null,
    },
    { onConflict: "occurrence_id,user_id" },
  );

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
