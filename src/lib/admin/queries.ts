import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Reads for the admin overview.
 *
 * Every query here runs as the signed-in admin, never with the secret key.
 * That is the whole point of the `admins` table: the panel gets its reach
 * from a policy rather than from a key that ignores policies, so a bug in
 * this file cannot show more than an admin is allowed to see.
 *
 * Counts use `head: true`, which asks PostgREST for the count header and
 * no rows at all. The overview needs six numbers, not six lists.
 */

export type AdminOverview = {
  /** Accounts that are not admins. See `memberCount` below. */
  readonly memberCount: number;
  /** Bookings on classes that have not started yet. */
  readonly upcomingBookings: number;
  /** Members who have actually picked a plan (a null answer is not one). */
  readonly plansChosen: number;
  /** Members who have been asked and have not picked. */
  readonly plansDeclined: number;
  /** Members never asked — no row at all. */
  readonly plansUnasked: number;
  /** Scheduled classes still to come. */
  readonly upcomingClasses: number;
};

/**
 * Admin user ids, so the owner is not counted as one of his own members.
 *
 * He appears in `profiles` like anyone else — the auth trigger does not
 * know what an admin is, and should not. Filtering happens here, at the
 * point where "member" actually means something, rather than by polluting
 * the mirror table with a role column it would then have to keep current.
 */
export async function adminIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("admins").select("user_id");
  if (error || !data) return [];
  return data.map((row) => String(row.user_id));
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await createClient();
  const admins = await adminIds();
  const nowIso = new Date().toISOString();

  /**
   * PostgREST's `not.in` needs a parenthesised list, and an empty one is a
   * syntax error rather than a no-op — so with no admins the filter is
   * dropped entirely instead of being sent empty.
   */
  const excludeAdmins = <T extends { not: (c: string, o: string, v: string) => T }>(
    query: T,
  ): T =>
    admins.length > 0
      ? query.not("user_id", "in", `(${admins.join(",")})`)
      : query;

  const [members, upcoming, chosen, declined, classes, everAsked] =
    await Promise.all([
      excludeAdmins(
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
      ),

      supabase
        .from("bookings")
        .select("id, class_occurrences!inner(starts_at)", {
          count: "exact",
          head: true,
        })
        .eq("status", "booked")
        .gt("class_occurrences.starts_at", nowIso),

      supabase
        .from("member_plans")
        .select("user_id", { count: "exact", head: true })
        .not("plan_slug", "is", null),

      supabase
        .from("member_plans")
        .select("user_id", { count: "exact", head: true })
        .is("plan_slug", null),

      supabase
        .from("class_occurrences")
        .select("id", { count: "exact", head: true })
        .eq("status", "scheduled")
        .gt("starts_at", nowIso),

      excludeAdmins(
        supabase.from("member_plans").select("user_id", { count: "exact", head: true }),
      ),
    ]);

  const memberCount = members.count ?? 0;

  return {
    memberCount,
    upcomingBookings: upcoming.count ?? 0,
    plansChosen: chosen.count ?? 0,
    plansDeclined: declined.count ?? 0,
    // Never asked = members who have no row at all. Clamped at zero because
    // the two counts are separate round trips and a member could sign up
    // between them.
    plansUnasked: Math.max(0, memberCount - (everAsked.count ?? 0)),
    upcomingClasses: classes.count ?? 0,
  };
}
