import "server-only";

import { LEVELS, type LevelId } from "@/content/schedule";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking/horizon";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Reads for the booking pages.
 *
 * Every query here runs through the *session-scoped* client, never the
 * admin one. RLS remains the enforcement: the policies in
 * 20260807120000_class_booking.sql are what make it impossible for a
 * member to read somebody else's booking, and swapping in the admin
 * client would defeat that no matter what this file asked for.
 *
 * ── WHY EVERY QUERY BELOW ALSO FILTERS BY user_id (2026-08-19) ───────
 * This file used to have no `user_id` filter anywhere, deliberately, on
 * the grounds that RLS already returned only the member's own rows and a
 * redundant filter would read as though it were the thing protecting the
 * data.
 *
 * That reasoning was sound until 2026-08-15, when the admin panel added
 * `bookings_read_all_for_admins` — an additive SELECT policy. Postgres
 * ORs SELECT policies, so from that day "what RLS lets me see" and "what
 * is mine" stopped being the same set for one account, and nobody
 * revisited the files that had been built on them being identical.
 *
 * The result was live for four days: signed in as the gym owner,
 * /account listed all nine bookings in the database as his own, eight of
 * which belonged to other members. Measured, not theorised — see the
 * session log for 2026-08-19.
 *
 * So the filter is not defence in depth and is not distrust of RLS. RLS
 * answers "may I see this row"; these pages are asking a different
 * question — "is this row mine" — and they now ask it out loud. An admin
 * is still a member, and their own account page is still theirs.
 * ────────────────────────────────────────────────────────────────────
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bounded so a member with years of history cannot ask for all of it. */
const PAST_PAGE_SIZE = 20;
const UPCOMING_PAGE_SIZE = 50;

export type BookableClass = {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly level: LevelId;
  readonly capacity: number;
  readonly bookedCount: number;
  readonly spotsLeft: number;
  /** Whether *this* member holds a live booking on it. */
  readonly booked: boolean;
};

export type BookedClass = {
  readonly occurrenceId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly level: LevelId;
  readonly cancelledByGym: boolean;
  readonly cancellationNote: string | null;
  /**
   * The member's plan booked this, not the member.
   *
   * Shown on the row, because ten classes appearing in "Coming up" that
   * somebody does not remember booking is exactly the kind of thing that
   * makes people distrust a schedule they are meant to turn up to. False
   * whenever the distinction cannot be read — before the migration that
   * adds `bookings.source`, every class simply reads as their own, which
   * is what it was until the feature existed.
   */
  readonly fromPlan: boolean;
};

/** Rows arrive as `unknown` from PostgREST; nothing is trusted on the way in. */
function asLevel(value: unknown): LevelId {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
    ? (value as LevelId)
    : "beginner";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Classes a member can book, over the next {@link BOOKING_WINDOW_DAYS}.
 *
 * The embedded `bookings` is what drives the "you have booked this" state
 * on every card, so it has to be *this member's* bookings and nobody
 * else's. As an admin, unfiltered, it marked all nine bookings in the
 * database as his — every class anyone had taken showed as booked.
 */
export async function listBookableClasses(): Promise<BookableClass[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];

  const now = new Date();
  const until = new Date(now.getTime() + BOOKING_WINDOW_DAYS * DAY_MS);

  const { data, error } = await supabase
    .from("class_occurrences")
    .select(
      "id,starts_at,ends_at,level,capacity,booked_count,bookings(id,status)",
    )
    // Filters the embedded rows only — a class nobody has booked still
    // comes back, with an empty array, which is what "bookable" means.
    .eq("bookings.user_id", user.id)
    .eq("status", "scheduled")
    .gt("starts_at", now.toISOString())
    .lt("starts_at", until.toISOString())
    .order("starts_at", { ascending: true })
    .limit(500);

  if (error || !data) return [];

  return data.map((row) => {
    const capacity = asCount(row.capacity);
    const bookedCount = asCount(row.booked_count);
    const mine = Array.isArray(row.bookings) ? row.bookings : [];

    return {
      id: asString(row.id),
      startsAt: asString(row.starts_at),
      endsAt: asString(row.ends_at),
      level: asLevel(row.level),
      capacity,
      bookedCount,
      spotsLeft: Math.max(0, capacity - bookedCount),
      booked: mine.some(
        (booking: { status?: unknown }) => booking.status === "booked",
      ),
    };
  });
}

/**
 * The member's own classes, split by whether they have happened.
 *
 * Queried from the occurrence side with an inner join rather than from the
 * booking side, for one practical reason: it lets Postgres do the ordering
 * and the limiting on `starts_at`. Fetching bookings and sorting by their
 * embedded occurrence in JavaScript would mean a LIMIT that takes an
 * arbitrary twenty rows and then sorts them — which shows the wrong twenty.
 */
async function listMine(
  when: "upcoming" | "past",
): Promise<BookedClass[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];

  const nowIso = new Date().toISOString();
  const upcoming = when === "upcoming";

  /**
   * ── WHY THE SELECT IS ATTEMPTED TWICE ──────────────────────────────
   *
   * `bookings.source` arrives in a migration the client runs by hand,
   * after this code is already live. Asking for a column PostgREST has
   * never heard of does not degrade the answer — it fails the query, and
   * this function reports a failed query as an empty list. The account
   * page would show a member with six classes booked that they have
   * none, on the one screen whose whole job is to tell them when they
   * are next training.
   *
   * So the richer shape is tried first and the original is the fallback.
   * The only thing lost in that window is the "from your plan" tag,
   * which describes a feature that is not switched on yet anyway.
   */
  const run = (withSource: boolean) => {
    let query = supabase
      .from("class_occurrences")
      .select(
        withSource
          ? "id,starts_at,ends_at,level,status,cancellation_note,bookings!inner(status,source)"
          : "id,starts_at,ends_at,level,status,cancellation_note,bookings!inner(status)",
      )
      .eq("bookings.user_id", user.id)
      .eq("bookings.status", "booked");

    query = upcoming
      ? query
          .gt("starts_at", nowIso)
          .order("starts_at", { ascending: true })
          .limit(UPCOMING_PAGE_SIZE)
      : query
          .lte("starts_at", nowIso)
          .order("starts_at", { ascending: false })
          .limit(PAST_PAGE_SIZE);

    return query;
  };

  let { data, error } = await run(true);

  // PGRST204 / 42703 both mean "that column is not there yet". Any other
  // error is a real failure and is reported as one, unchanged.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ data, error } = await run(false));
  }

  if (error || !data) return [];

  return data.map((row) => ({
    occurrenceId: asString(row.id),
    startsAt: asString(row.starts_at),
    endsAt: asString(row.ends_at),
    level: asLevel(row.level),
    cancelledByGym: row.status === "cancelled",
    cancellationNote:
      typeof row.cancellation_note === "string" ? row.cancellation_note : null,
    fromPlan: bookedByPlan(row.bookings),
  }));
}

/**
 * Did the plan make this booking?
 *
 * The embed is filtered to this member and to live bookings, so there is
 * at most one row — `bookings_one_per_member` allows no more. Written
 * defensively anyway because PostgREST hands back an object for a
 * to-one embed and an array for a to-many, and which one it decides on
 * depends on the constraints it can see.
 *
 * Anything unreadable is `false`: "their own booking" is the state this
 * page has always described, so an unknown reads as the status quo
 * rather than as a claim about where a class came from.
 */
function bookedByPlan(value: unknown): boolean {
  const rows = Array.isArray(value) ? value : [value];
  return rows.some(
    (row) =>
      typeof row === "object" &&
      row !== null &&
      (row as { source?: unknown }).source === "plan",
  );
}

export function listUpcomingBookings(): Promise<BookedClass[]> {
  return listMine("upcoming");
}

export function listPastBookings(): Promise<BookedClass[]> {
  return listMine("past");
}

/**
 * How many classes the member has coming up.
 *
 * Read separately from {@link listUpcomingBookings} because the two have
 * different callers: /account wants the rows, and /book wants only the
 * number, for the count on the "Your classes" tab. Fetching fifty rows to
 * call `.length` on them would put a member's whole schedule on the wire
 * to render a single digit.
 *
 * Cancelled-by-the-gym classes are counted. They are still on the member's
 * list and still need reading — a tab that says 2 beside a list of 3 is a
 * tab nobody trusts again.
 */
export async function countUpcomingBookings(): Promise<number> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("class_occurrences")
    .select("id,bookings!inner(status)", { count: "exact", head: true })
    .eq("bookings.user_id", user.id)
    .eq("bookings.status", "booked")
    .gt("starts_at", new Date().toISOString());

  if (error || count === null) return 0;
  return count;
}

/**
 * How many classes the member has booked that have already happened.
 *
 * Deliberately *booked*, not attended. Nothing in this system knows who
 * walked through the door — that needs a coach marking a register, which
 * was scoped out. A number labelled "attended" that counts bookings is
 * wrong the first time someone does not turn up, and drifts further every
 * week; the UI must keep calling this what it is.
 *
 * `head: true` so the count comes back without the rows.
 */
export async function countPastBookings(): Promise<number> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("class_occurrences")
    .select("id,bookings!inner(status)", { count: "exact", head: true })
    .eq("bookings.user_id", user.id)
    .eq("bookings.status", "booked")
    .lte("starts_at", new Date().toISOString());

  if (error || count === null) return 0;
  return count;
}
