"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isPlanSlug } from "@/content/plans";
import { safeNextPath } from "@/lib/auth/redirects";
// Type-only, and it has to stay that way: a "use server" module may export
// nothing but async functions. See lib/plans/state.ts.
import type { PlanActionState } from "@/lib/plans/state";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Recording which plan a member says they are interested in.
 *
 * Runs as the signed-in member, not as the service role, so the policies
 * are the enforcement. What this file adds is the message: a policy can
 * refuse a write, it cannot explain that the table has not been created
 * yet.
 *
 * Unlike the read in queries.ts, this fails LOUDLY. A member who picks a
 * plan and is told nothing is a member who believes the gym knows
 * something it does not.
 */
export async function choosePlan(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const user = await getUser();
  if (!user) {
    return { status: "error", message: "Please sign in to choose a plan." };
  }

  /**
   * An empty value is "I'll decide later", and it is stored rather than
   * ignored — a row with a null slug is what records that we asked and
   * they said not yet, which is the only thing that stops the booking flow
   * asking them again every single time.
   */
  const raw = formData.get("slug");
  const slug = isPlanSlug(raw) ? raw : null;

  // Anything that is neither a known slug nor the deliberate blank is a
  // malformed submission, not a decision. Storing null for it would record
  // an answer the member never gave.
  if (raw !== null && raw !== "" && slug === null) {
    return { status: "error", message: "That plan could not be identified." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("member_plans").upsert(
    {
      user_id: user.id,
      plan_slug: slug,
      // Updated on every change, so the column reads as "as of" rather
      // than "first seen".
      chosen_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      status: "error",
      message:
        /**
         * The migration has not been applied yet.
         *
         * PGRST205 is PostgREST's own "not in the schema cache", and it is
         * what actually comes back — verified against the live database
         * rather than assumed. Postgres's own 42P01 ("relation does not
         * exist") is kept beside it because a future direct-SQL path would
         * raise that instead, and the two mean the same thing to a member.
         *
         * Named at all because the alternative is the client staring at
         * "something went wrong" on a feature that was simply never
         * switched on.
         */
        error.code === "PGRST205" || error.code === "42P01"
          ? "Plans aren't set up on this site yet. You can still book classes."
          : "Couldn't save that. Please try again.",
    };
  }

  revalidatePath("/account");
  revalidatePath("/book");

  /**
   * `redirect` throws internally, so it must sit outside any try/catch —
   * a catch here would swallow the redirect and return a success state
   * that goes nowhere. It is also the last statement for that reason.
   *
   * The destination is guarded: without safeNextPath, `?next=https://…`
   * would turn this into an open redirect that borrows the site's
   * credibility to land a member on a lookalike page. A hostile value
   * collapses to "/" rather than being followed.
   *
   * The fallback is /book rather than safeNextPath's own "/" default,
   * because that default was written for the auth screens, where somebody
   * signing in from the home page wants the home page back. Here the whole
   * point of the screen is that it stands between a member and booking.
   */
  const requested = formData.get("next");
  redirect(
    typeof requested === "string" && requested.length > 0
      ? safeNextPath(requested)
      : "/book",
  );
}
