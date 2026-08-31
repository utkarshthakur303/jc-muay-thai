import "server-only";

import { notFound, redirect } from "next/navigation";

import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Is the current session an admin?
 *
 * Asked of the database, using the member's own session, so the answer
 * comes from the same RLS policy that governs every admin read elsewhere.
 * A non-admin selecting from `admins` matches zero rows — not because this
 * query filters them out, but because `admins_read_for_admins` does. There
 * is one definition of "admin" in this system and it lives in Postgres.
 *
 * This is deliberately NOT the enforcement. The panel's data is protected
 * by the policies on each table; this function decides what to *render*.
 * If it were the only check, an admin page would be a page whose contents
 * anyone could fetch from PostgREST directly with their own key — which is
 * precisely the failure mode the project's second engineering rule
 * describes.
 *
 * FAILS CLOSED. Any error — network, PGRST205 before the migration is
 * applied, a revoked grant — resolves to `false`. This is the opposite of
 * `getPlanState`, which fails open so a missing table cannot strand a
 * member in front of a broken chooser. The asymmetry is intentional: the
 * cost of guessing wrong there is a page that does not appear, and here it
 * is every member's data shown to whoever asked.
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}

/**
 * Gate for every route under /admin.
 *
 * Signed out is treated differently from signed in and unauthorised, and
 * the difference is deliberate:
 *
 *   - Signed out → /admin/login. The gym owner arriving at a bookmark
 *     with an expired session needs a way in, and bouncing him to a 404
 *     would look like the panel had been deleted. The staff door rather
 *     than the member one, because the member one asks for a credential
 *     that would not get him here.
 *
 *   - Signed in, not an admin → notFound(). Not a redirect and not a "you
 *     do not have permission" page, because both of those confirm to a
 *     logged-in member that an admin area exists and that they have found
 *     it. A 404 tells them nothing they did not already know.
 *
 * Returns the user so callers do not fetch it twice.
 */
export async function requireAdmin() {
  const user = await getUser();
  if (!user) redirect("/admin/login");

  if (!(await isAdmin())) notFound();

  return user;
}
