"use server";

import { site } from "@/content/site";
import { getStreakSummary } from "@/lib/attendance/queries";
import { dateKey } from "@/lib/attendance/streak";
// Type-only, and it has to stay that way: a "use server" module may export
// nothing but async functions. See lib/attendance/types.ts.
import type { StreakSummary } from "@/lib/attendance/types";
import { gymCivilDate } from "@/lib/format/gymClock";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Marking, un-marking, and loading a streak.
 *
 * None of these enforce anything. The rules that matter — you may only
 * mark today, you may only mark yourself, you may only undo today — are
 * row-level security policies, because a member holds the publishable key
 * and can reach PostgREST without going through this file at all.
 *
 * What lives here is the date the client is *not* trusted to supply.
 * `attended_on` is computed from the gym's clock on the server and the
 * policy then re-checks it against the database's own clock, so a request
 * carrying a hand-written date is refused twice.
 */

function gymTodayKey(): string {
  return dateKey(gymCivilDate(new Date(), site.timeZone));
}

/** The whole payload, for a client that has just mounted. */
export async function loadStreak(): Promise<StreakSummary | null> {
  return getStreakSummary();
}

export async function markToday(): Promise<StreakSummary | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  /**
   * Idempotent by construction. A double tap, a slow connection retried,
   * two tabs open — all land on the same (user_id, attended_on) row, and
   * `ignoreDuplicates` turns the second one into a no-op instead of a
   * unique-violation the member would see as an error for having done the
   * right thing twice.
   */
  const { error } = await supabase
    .from("attendance")
    .upsert(
      { user_id: user.id, attended_on: gymTodayKey() },
      { onConflict: "user_id,attended_on", ignoreDuplicates: true },
    );

  /**
   * Thrown, not swallowed, and this one matters more than it looks.
   *
   * Returning a fresh summary after a failed write would hand the client
   * a perfectly valid-looking object with the old numbers in it — so the
   * panel would show no error, no change, and a button that appears to do
   * nothing when pressed. The member's conclusion is that the site is
   * broken, and they are right, but nothing on screen says so.
   *
   * Rejecting instead lets the provider surface it: "That didn't save."
   */
  if (error) {
    throw new Error(`attendance write failed: ${error.code ?? "unknown"}`);
  }

  return getStreakSummary(true);
}

export async function unmarkToday(): Promise<StreakSummary | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  /**
   * The user_id filter is belt to the policy's braces. The policy is what
   * enforces ownership; this is here because a DELETE with no owner filter
   * is the kind of line that gets copied somewhere the policy is weaker.
   */
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("user_id", user.id)
    .eq("attended_on", gymTodayKey());

  if (error) {
    throw new Error(`attendance undo failed: ${error.code ?? "unknown"}`);
  }

  return getStreakSummary();
}
