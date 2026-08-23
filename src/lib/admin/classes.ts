import "server-only";

import { LEVELS, type LevelId } from "@/content/schedule";
import { createClient } from "@/lib/supabase/server";

/**
 * Classes and their rosters.
 *
 * The roster is the screen the gym actually stands in front of — "who is
 * coming to the seven o'clock" — so it is built from the occurrence
 * outward rather than from bookings inward.
 */

const CLASS_PAGE_SIZE = 400;
const ROSTER_PAGE_SIZE = 200;

/** How far ahead the class list runs by default. */
export const CLASS_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asLevel(value: unknown): LevelId {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
    ? (value as LevelId)
    : "beginner";
}

export type AdminClass = {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly level: LevelId;
  readonly capacity: number;
  readonly bookedCount: number;
  readonly spotsLeft: number;
  readonly cancelled: boolean;
  readonly cancellationNote: string | null;
};

function toAdminClass(row: Record<string, unknown>): AdminClass {
  const capacity = asCount(row.capacity);
  const bookedCount = asCount(row.booked_count);
  return {
    id: asString(row.id),
    startsAt: asString(row.starts_at),
    endsAt: asString(row.ends_at),
    level: asLevel(row.level),
    capacity,
    bookedCount,
    spotsLeft: Math.max(0, capacity - bookedCount),
    cancelled: row.status === "cancelled",
    cancellationNote: asNullableString(row.cancellation_note),
  };
}

/**
 * Classes from now to the end of the window.
 *
 * Cancelled classes are included, unlike the member-facing booking query
 * which filters them out. The gym needs to see what it has cancelled — a
 * class that silently vanishes from the admin list is one nobody can
 * un-cancel or check the fallout of.
 *
 * `booked_count` is read straight off the occurrence rather than counted
 * from bookings. A database trigger maintains it under a check constraint
 * that makes an oversold class unrepresentable, so it is the authoritative
 * number and counting rows here would only invent a second opinion.
 */
export async function listClasses(
  days: number = CLASS_WINDOW_DAYS,
): Promise<AdminClass[]> {
  const supabase = await createClient();
  const now = new Date();
  const until = new Date(now.getTime() + days * DAY_MS);

  const { data, error } = await supabase
    .from("class_occurrences")
    .select(
      "id,starts_at,ends_at,level,capacity,booked_count,status,cancellation_note",
    )
    .gt("starts_at", now.toISOString())
    .lt("starts_at", until.toISOString())
    .order("starts_at", { ascending: true })
    .limit(CLASS_PAGE_SIZE);

  if (error || !data) return [];
  return data.map(toAdminClass);
}

/**
 * A booking row as it arrives, with `source` optional — the two selects
 * below differ by exactly that column, and one shape here is what lets
 * them share a mapper instead of duplicating it.
 */
type BookingRow = {
  user_id?: unknown;
  status?: unknown;
  created_at?: unknown;
  source?: unknown;
};

export type RosterEntry = {
  readonly userId: string;
  readonly fullName: string | null;
  readonly email: string;
  /** False when the member booked and then cancelled. */
  readonly attending: boolean;
  readonly bookedAt: string;
  /**
   * Their plan put them here; they did not press Book on this class.
   *
   * The gym has to be able to see this. From 2026-08-23 choosing a plan
   * books the week ahead at that level, which means names on this roster
   * that nobody individually decided on — and "eight people are coming"
   * means something different depending on how many of them chose the
   * evening. Marking it is what keeps the roster a fact rather than an
   * impression.
   */
  readonly fromPlan: boolean;
};

export type ClassRoster = {
  readonly klass: AdminClass;
  /** Members currently holding a place, alphabetical. */
  readonly attending: readonly RosterEntry[];
  /**
   * Members who booked and cancelled. Kept visible because "three people
   * dropped out of Thursday" is a fact about the class, and the bookings
   * table never deletes precisely so it stays answerable.
   */
  readonly cancelled: readonly RosterEntry[];
};

/**
 * One class and everyone on it.
 *
 * Two queries, joined here, for the same reason as the member directory:
 * `bookings.user_id` points at `auth.users`, not at `profiles`, so there
 * is no relationship for PostgREST to embed across.
 *
 * Returns null for an unknown id, which the route renders as a 404.
 */
export async function getClassRoster(
  occurrenceId: string,
): Promise<ClassRoster | null> {
  const supabase = await createClient();

  const { data: occurrence, error } = await supabase
    .from("class_occurrences")
    .select(
      "id,starts_at,ends_at,level,capacity,booked_count,status,cancellation_note",
    )
    .eq("id", occurrenceId)
    .maybeSingle();

  if (error || !occurrence) return null;

  /**
   * `source` arrives in a migration the client runs by hand, after this
   * code is live. Asking PostgREST for a column it has never heard of
   * fails the whole query, and a failed query here is an EMPTY ROSTER —
   * the screen the gym stands in front of, saying nobody is coming to a
   * class eight people booked. So the richer shape is attempted and the
   * original is the fallback; the only thing missing in that window is a
   * label for a feature that is not switched on yet.
   */
  const withSource = await supabase
    .from("bookings")
    .select("user_id,status,created_at,source")
    .eq("occurrence_id", occurrenceId)
    .limit(ROSTER_PAGE_SIZE);

  let rows: BookingRow[] = withSource.data ?? [];

  // PGRST204 is PostgREST's "column not in the schema cache"; 42703 is
  // Postgres's own "column does not exist". Any other error leaves the
  // list empty, exactly as it did before — a real failure is not quietly
  // retried into a half answer.
  if (
    withSource.error &&
    (withSource.error.code === "PGRST204" || withSource.error.code === "42703")
  ) {
    const plain = await supabase
      .from("bookings")
      .select("user_id,status,created_at")
      .eq("occurrence_id", occurrenceId)
      .limit(ROSTER_PAGE_SIZE);
    rows = plain.data ?? [];
  }
  const userIds = [...new Set(rows.map((row) => asString(row.user_id)))].filter(
    Boolean,
  );

  const profileByUser = new Map<string, { full_name?: unknown; email?: unknown }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id,full_name,email")
      .in("user_id", userIds);

    for (const profile of profiles ?? []) {
      profileByUser.set(asString(profile.user_id), profile);
    }
  }

  const entries: RosterEntry[] = rows.map((row) => {
    const userId = asString(row.user_id);
    const profile = profileByUser.get(userId);
    return {
      userId,
      fullName: asNullableString(profile?.full_name),
      email: asString(profile?.email),
      attending: row.status === "booked",
      bookedAt: asString(row.created_at),
      // Anything but the literal 'plan' reads as the member's own —
      // including the absent column, which is what every row was before
      // plan booking existed.
      fromPlan: row.source === "plan",
    };
  });

  /**
   * By name, with the nameless last. A roster is read down the page while
   * looking for one person, which is the only ordering that helps; booking
   * order helps nobody standing at the door.
   */
  const byName = (a: RosterEntry, b: RosterEntry): number => {
    if (a.fullName && b.fullName) return a.fullName.localeCompare(b.fullName);
    if (a.fullName) return -1;
    if (b.fullName) return 1;
    return a.email.localeCompare(b.email);
  };

  return {
    klass: toAdminClass(occurrence),
    attending: entries.filter((entry) => entry.attending).sort(byName),
    cancelled: entries.filter((entry) => !entry.attending).sort(byName),
  };
}
