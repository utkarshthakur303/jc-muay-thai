"use server";

import { revalidatePath } from "next/cache";

import { site } from "@/content/site";
import { GOAL_MAX, GOAL_MIN, parseGoal } from "@/lib/attendance/goal";
import { getStreakSummary } from "@/lib/attendance/queries";
// Type-only, and it has to stay that way: a "use server" module may
// export nothing but async functions. See lib/attendance/state.ts.
import type { GoalActionState } from "@/lib/attendance/state";
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

/**
 * Setting a streak goal, and dropping one.
 *
 * ONE ACTION, TWO INTENTS
 *
 * The card has three forms — the quick picks, the custom field, and
 * "Use milestones instead" — and they share this action the way the
 * plan picker's three forms share choosePlan. They have to share
 * *something*: a single `useActionState` is the only way one error line
 * can speak for all three, and three separate hooks would mean three
 * places a message can appear and two of them stale.
 *
 * The quick picks and the custom field are separate forms for a reason
 * that has bitten this codebase before. A button carrying
 * `name="goal"` inside a form that already has an input named `goal`
 * loses: FormData.get returns the first entry in document order, which
 * is the input. Two fields of the same name in one form is a silent
 * wrong answer, so each gets its own form.
 *
 * Runs as the signed-in member, not as the service role, so the policies
 * in 20260823160000_streak_goals.sql are the enforcement. What this file
 * adds is the sentence: a CHECK constraint can refuse 500, it cannot
 * explain that the range is 2 to 365, and a policy cannot say that the
 * table has not been created yet.
 *
 * Fails LOUDLY, unlike the read in queries.ts. A member who types a
 * number, presses the button and is told nothing will assume it saved —
 * and go on training against a target the gym never recorded.
 */
export async function updateStreakGoal(
  _prev: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getUser();
  if (!user) {
    return { status: "error", message: "Please sign in to set a goal." };
  }

  const supabase = await createClient();

  /**
   * Anything that is not the literal "clear" is a save. The default is
   * the safe direction: a malformed intent that fell through to the
   * clear branch would delete a goal the member was trying to change.
   */
  if (formData.get("intent") === "clear") {
    // The user_id filter is belt to the policy's braces, exactly as in
    // unmarkToday. The policy is the enforcement; this is here because a
    // DELETE with no owner filter is the kind of line that gets copied
    // to somewhere the policy is weaker.
    const { error } = await supabase
      .from("member_goals")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return { status: "error", message: "That didn't save. Please try again." };
    }

    revalidatePath("/streak");
    return { status: "success", message: "Back to the app's milestones." };
  }

  const parsed = parseGoal(formData.get("goal"));
  if (!parsed.ok) {
    return {
      status: "error",
      message:
        parsed.reason === "missing"
          ? "Enter how many days you're aiming for."
          : parsed.reason === "out-of-range"
            ? `Pick a goal between ${GOAL_MIN} and ${GOAL_MAX} days.`
            : "That needs to be a whole number of days.",
    };
  }

  const { error } = await supabase.from("member_goals").upsert(
    {
      user_id: user.id,
      streak_goal: parsed.value,
      // Written explicitly because this is an upsert. The column's
      // default only fires on INSERT, so without this line a member who
      // changes their goal keeps the timestamp of the first one — and
      // `set_at` would quietly mean "first set" while reading as "as of".
      set_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    /**
     * PGRST205 is the migration window, not a bug: the table does not
     * exist yet because the SQL has not been run. Naming it plainly is
     * better than "something went wrong" — the person most likely to see
     * it is the owner, testing the feature the day it deploys.
     *
     * 23514 is the CHECK. It should be unreachable, since parseGoal
     * refuses the same range first; if it ever fires, the two bounds
     * have drifted apart, and the message should describe the range the
     * database believes in rather than the one this file does.
     */
    return {
      status: "error",
      message:
        error.code === "PGRST205"
          ? "Custom goals aren't switched on yet. Check back shortly."
          : error.code === "23514"
            ? `Pick a goal between ${GOAL_MIN} and ${GOAL_MAX} days.`
            : "That didn't save. Please try again.",
    };
  }

  revalidatePath("/streak");
  return {
    status: "success",
    message: `Goal set: ${parsed.value} days in a row.`,
  };
}
