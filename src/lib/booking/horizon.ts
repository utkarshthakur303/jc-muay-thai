import "server-only";

import { capacityFor, sessions } from "@/content/schedule";
import { site } from "@/content/site";
import { generateOccurrences } from "@/lib/booking/occurrences";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Keeping bookable classes in existence.
 *
 * The timetable is a pattern; a booking needs a row. Something has to turn
 * the first into the second on an ongoing basis, and the options were a
 * scheduled job, a build step, or this — generate on demand, from the
 * pages that need it.
 *
 * On demand won because the other two both fail quietly. A cron job that
 * stops running produces an empty booking page a month later with nothing
 * in the logs; a build step ties the horizon to deploy frequency, so a gym
 * that ships nothing for six weeks runs out of classes to book. This
 * cannot silently fall behind: the page that needs occurrences is the page
 * that makes them.
 */

/** How far ahead members can book. Two weeks is more than anyone plans a gym class. */
export const BOOKING_WINDOW_DAYS = 14;

/** How far ahead rows are created. Comfortably past the window, so the
 *  tail never runs dry between refreshes. */
const HORIZON_DAYS = 35;

/** Refill once the furthest existing class is closer than this. */
const REFRESH_BELOW_DAYS = 21;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ensures the next {@link HORIZON_DAYS} of classes exist. Idempotent, and
 * safe to call concurrently — the unique constraint on
 * (session_slug, starts_at) makes a duplicate insert a no-op rather than a
 * conflict.
 *
 * Never throws. A horizon that fails to extend shows fewer classes, which
 * is a bad day; an exception here would take down the booking page
 * entirely, which is a worse one. The caller reads the return value only
 * if it wants to log.
 */
export async function ensureHorizon(): Promise<
  { ok: true; created: number } | { ok: false; reason: string }
> {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, reason: "SUPABASE_SECRET_KEY is not set" };
  }

  const now = new Date();

  // Cheap guard first: one indexed row. The common case is that the
  // horizon is already long enough and nothing else happens.
  const { data: furthest, error: readError } = await admin
    .from("class_occurrences")
    .select("starts_at")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    return { ok: false, reason: readError.message };
  }

  const furthestAt = furthest?.starts_at
    ? new Date(String(furthest.starts_at))
    : null;

  if (
    furthestAt &&
    furthestAt.getTime() - now.getTime() > REFRESH_BELOW_DAYS * DAY_MS
  ) {
    return { ok: true, created: 0 };
  }

  const drafts = generateOccurrences(sessions, {
    from: now,
    days: HORIZON_DAYS,
    timeZone: site.timeZone,
    capacityFor,
  });

  /**
   * ignoreDuplicates, not a merge. An occurrence that already exists may
   * have been edited — cancelled for a holiday, capacity adjusted — and
   * regenerating from the pattern must never quietly undo that. New rows
   * appear; existing rows are left exactly as they are.
   */
  const { data, error } = await admin
    .from("class_occurrences")
    .upsert(drafts, {
      onConflict: "session_slug,starts_at",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true, created: data?.length ?? 0 };
}
