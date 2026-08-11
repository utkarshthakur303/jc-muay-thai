import "server-only";

import { LEVELS, type LevelId } from "@/content/schedule";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking/horizon";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads for the booking pages.
 *
 * Every query here runs through the *session-scoped* client, never the
 * admin one. That is the whole security model: the policies in
 * 20260807120000_class_booking.sql decide what comes back, so a member
 * asking for "bookings" receives their own and there is no `where user_id
 * = ...` in this file to forget. Swapping in the admin client would
 * silently return everybody's.
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
 * The embedded `bookings` is not filtered by user here, and does not need
 * to be: RLS applies to embedded resources too, so the only rows that can
 * come back are the member's own. Adding an explicit filter would read as
 * though it were the thing protecting the data, which it is not.
 */
export async function listBookableClasses(): Promise<BookableClass[]> {
  const supabase = await createClient();
  const now = new Date();
  const until = new Date(now.getTime() + BOOKING_WINDOW_DAYS * DAY_MS);

  const { data, error } = await supabase
    .from("class_occurrences")
    .select(
      "id,starts_at,ends_at,level,capacity,booked_count,bookings(id,status)",
    )
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
  const nowIso = new Date().toISOString();
  const upcoming = when === "upcoming";

  let query = supabase
    .from("class_occurrences")
    .select(
      "id,starts_at,ends_at,level,status,cancellation_note,bookings!inner(status)",
    )
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

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    occurrenceId: asString(row.id),
    startsAt: asString(row.starts_at),
    endsAt: asString(row.ends_at),
    level: asLevel(row.level),
    cancelledByGym: row.status === "cancelled",
    cancellationNote:
      typeof row.cancellation_note === "string" ? row.cancellation_note : null,
  }));
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

  const { count, error } = await supabase
    .from("class_occurrences")
    .select("id,bookings!inner(status)", { count: "exact", head: true })
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

  const { count, error } = await supabase
    .from("class_occurrences")
    .select("id,bookings!inner(status)", { count: "exact", head: true })
    .eq("bookings.status", "booked")
    .lte("starts_at", new Date().toISOString());

  if (error || count === null) return 0;
  return count;
}
