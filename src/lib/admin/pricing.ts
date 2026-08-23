import "server-only";

import { isPlanSlug, plans, type PlanSlug } from "@/content/plans";
import { createClient } from "@/lib/supabase/server";

/**
 * Who a price change is actually about.
 *
 * The pricing page could show four inputs and nothing else and it would
 * work. It would also be the kind of screen where somebody edits a
 * number with no idea whether it touches anybody — so each plan carries
 * two counts, and between them they answer the question the owner will
 * have his finger on the button asking:
 *
 *   chosen  members who picked this plan. They see the new figure on
 *           their account page the moment it saves.
 *   quoted  members with a quote recorded against this plan. They do
 *           NOT see it. A quote snapshots its own price when it is
 *           agreed, and nothing here reads back through to it.
 *
 * The second is the one worth printing, because it is the reassurance
 * rather than the warning, and it is the thing a person would otherwise
 * have to take on trust.
 */

export type PlanReach = {
  readonly chosen: number;
  readonly quoted: number;
};

export type PlanReachByPlan = Readonly<Record<PlanSlug, PlanReach>>;

function empty(): Record<PlanSlug, PlanReach> {
  const out = {} as Record<PlanSlug, PlanReach>;
  for (const plan of plans) out[plan.slug] = { chosen: 0, quoted: 0 };
  return out;
}

/**
 * Two small reads and a tally in JavaScript rather than four grouped
 * counts over the wire.
 *
 * PostgREST has no GROUP BY without a view or an RPC, and the honest
 * alternative — eight `head: true` counts, two per plan — is eight round
 * trips to describe a table with single-digit rows in it. If the gym
 * ever has thousands of members this becomes a view; today it would be
 * eight requests to avoid two.
 *
 * FAILS TO ZERO, NEVER TO A GUESS. An unreadable count renders as "no
 * members on this plan", which is the one wrong answer that cannot
 * mislead anybody into thinking a change is safer than it is — the
 * counts are context beside the form, and the form works without them.
 */
export async function getPlanReach(): Promise<PlanReachByPlan> {
  const supabase = await createClient();
  const reach = empty();

  const [chosen, quoted] = await Promise.all([
    supabase.from("member_plans").select("plan_slug").not("plan_slug", "is", null),
    supabase.from("member_quotes").select("plan_slug"),
  ]);

  if (!chosen.error && chosen.data) {
    for (const row of chosen.data) {
      const slug: unknown = row.plan_slug;
      if (isPlanSlug(slug)) reach[slug] = { ...reach[slug], chosen: reach[slug].chosen + 1 };
    }
  }

  if (!quoted.error && quoted.data) {
    for (const row of quoted.data) {
      const slug: unknown = row.plan_slug;
      if (isPlanSlug(slug)) reach[slug] = { ...reach[slug], quoted: reach[slug].quoted + 1 };
    }
  }

  return reach;
}
