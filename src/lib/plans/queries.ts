import "server-only";

import { isCommitmentSlug, isPlanSlug } from "@/content/plans";
import type { PlanState } from "@/lib/plans/state";
import { createClient } from "@/lib/supabase/server";

/**
 * Reading a member's stated plan.
 *
 * Runs through the session-scoped client, never the admin one. The policy
 * in 20260813120000_member_plans.sql is what limits the answer to the
 * member's own row; there is deliberately no `where user_id = ...` here to
 * forget, and swapping in the admin client would silently return the first
 * row of everybody's.
 *
 * WHY THIS FAILS OPEN, WHEN THE REST OF THE CODEBASE FAILS LOUDLY
 *
 * Migrations on this project are applied by the client, by hand, by
 * pasting SQL into the Supabase console. The code therefore goes live
 * BEFORE the table exists — there is no ordering that avoids it, because
 * the deploy is a git push and the migration is a person.
 *
 * In that window every read here errors. If that error propagated, or were
 * treated as "this member has not chosen a plan", /book would redirect
 * every existing member to a plans page that cannot save anything, and
 * booking — the thing four real people actually use this site for — would
 * be broken until somebody noticed and ran the SQL.
 *
 * So a failed read reports `available: false`, and every caller treats
 * that as "this feature is not here yet" and behaves exactly as the site
 * did before it existed. The plan step activates by itself the moment the
 * migration lands, with no second deploy.
 *
 * This is not a softening of the "reads fail loudly" rule in PROJECT.md
 * §6. That rule is about never showing a member a WRONG number — a failed
 * attendance read rendering as a streak of zero told someone with thirty
 * days that they had trained never. Nothing here renders a wrong anything;
 * an unavailable table renders no plan UI at all. The write still fails
 * loudly, because a member who picks a plan and is told nothing happened
 * is exactly the case that must never be quiet.
 */
export async function getPlanState(): Promise<PlanState> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("member_plans")
    .select("plan_slug,commitment")
    .maybeSingle();

  if (error) {
    return { available: false, asked: false, slug: null, commitment: null };
  }

  if (!data) {
    return { available: true, asked: false, slug: null, commitment: null };
  }

  // A row exists, so the member has answered. The answer is null when
  // they chose not to pick one, which is a real answer and not an absence
  // — it is what stops them being asked again on every visit.
  //
  // Both fields are narrowed rather than trusted. A slug retired from
  // content/plans.ts must read as "no plan" rather than crash a page or
  // render a blank where a class name belongs — which is exactly the
  // state the two pre-2026-08-18 rows were in before the migration
  // cleared them.
  return {
    available: true,
    asked: true,
    slug: isPlanSlug(data.plan_slug) ? data.plan_slug : null,
    commitment: isCommitmentSlug(data.commitment) ? data.commitment : null,
  };
}
