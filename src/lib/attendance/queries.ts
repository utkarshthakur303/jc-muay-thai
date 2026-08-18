import "server-only";

import { site } from "@/content/site";
import { summarise } from "@/lib/attendance/streak";
import type { StreakSummary } from "@/lib/attendance/types";
import { gymCivilDate } from "@/lib/format/gymClock";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Reading a member's attendance.
 *
 * Through the session-scoped client, never the admin one — the select
 * policy in 20260810120000_attendance.sql is what makes another member's
 * history unreadable, and swapping in the admin client would defeat that.
 *
 * The explicit `user_id` filter was added 2026-08-19. `attendance` is the
 * one member table with NO additive admin policy — the admin migration
 * left it out as a deliberate product decision, so this file was not
 * affected by the bug that hit bookings and plans on the same day. It is
 * filtered anyway, because the only reason it was safe is that somebody
 * remembered to leave it out of an unrelated migration, and that is not a
 * property this file can check. If an admin read policy is ever added
 * here, a streak must not quietly become the whole gym's.
 */

/**
 * Three years of daily training is about 940 rows, so this cannot truncate
 * anyone real — but it is here so the query cost stays flat as the gym
 * ages rather than growing with its oldest member. If it ever does bite,
 * the symptom is a `best` that under-reports ancient history, never a
 * wrong `current`: the recent end of the list is always present.
 */
const MAX_ROWS = 2000;

function asDate(value: unknown): string | null {
  // PostgREST returns `date` as `YYYY-MM-DD`. Anything else is a schema
  // change nobody told this file about, and is dropped rather than fed to
  // the streak arithmetic as a subtly wrong key.
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

/**
 * Every date this member has marked, newest first.
 *
 * Throws rather than returning an empty list on failure, and the
 * distinction is the difference between an error message and a lie. An
 * empty list is indistinguishable from "this member has never trained",
 * so a read failure would render as a streak of zero — telling somebody
 * who has turned up thirty days running that they have turned up never.
 * They would then press the button to fix it, which is how a display bug
 * becomes corrupt data.
 */
export async function listAttendanceDates(): Promise<string[]> {
  const supabase = await createClient();

  const user = await getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("attendance")
    .select("attended_on")
    .eq("user_id", user.id)
    .order("attended_on", { ascending: false })
    .limit(MAX_ROWS);

  if (error) throw new Error(`attendance read failed: ${error.code ?? "unknown"}`);
  if (!data) return [];

  return data
    .map((row: { attended_on: unknown }) => asDate(row.attended_on))
    .filter((value): value is string => value !== null);
}

/**
 * @param justMarked Passed through to the milestone gate — see types.ts.
 *                   A plain page load must never re-fire a celebration.
 */
export async function getStreakSummary(
  justMarked = false,
): Promise<StreakSummary | null> {
  const user = await getUser();
  if (!user) return null;

  const dates = await listAttendanceDates();

  // The gym's date, from the gym's zone. The server clock is UTC on
  // Vercel, so `new Date()` alone would roll the streak over at 8pm
  // Eastern — an hour when people are still in class.
  return summarise(dates, gymCivilDate(new Date(), site.timeZone), justMarked);
}
