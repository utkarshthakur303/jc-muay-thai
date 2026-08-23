import "server-only";

import type { LevelId } from "@/content/schedule";
import { ensureHorizon } from "@/lib/booking/horizon";
import {
  PLAN_BOOKING_DAYS,
  PLAN_BOOKING_MAX,
  releaseForPlan,
  selectForPlan,
  type HeldByPlan,
  type PlanCandidate,
} from "@/lib/plans/planBookings";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Turning a chosen plan into actual bookings.
 *
 * The rules are in `planBookings.ts` and tested there. This is the part
 * that talks to the database, and everything in it is written around one
 * fact: these are real seats in a real gym, and the four people using this
 * site will feel it if this is wrong.
 *
 * ── IT RUNS FROM AN ACTION, NEVER FROM A RENDER ──────────────────────
 *
 * Only `choosePlan` calls this, and only because somebody pressed a
 * button. It is deliberately not wired into /account or /book the way
 * `ensureHorizon` is, and the difference is not stylistic: generating
 * timetable rows is idempotent and costs nothing, while booking consumes
 * capacity. A render that books classes is a render that books classes on
 * a prefetch, on a React double-render, on a refresh — and the member
 * never pressed anything.
 *
 * ── IT NEVER THROWS ──────────────────────────────────────────────────
 *
 * A plan choice must be recorded even when the booking half fails. The
 * member answered a question; losing that answer because the gym's
 * Thursday class filled up would be the worst possible trade. Every path
 * returns counts, and the caller reports exactly what happened rather
 * than what was intended.
 *
 * ── IT SWITCHES ITSELF ON ────────────────────────────────────────────
 *
 * `bookings.source` arrives in a migration the client runs by hand, after
 * this code is already live. In that window the first query below fails,
 * this returns zeros, and choosing a plan behaves exactly as it did
 * before the feature existed — the plan is saved, nothing is booked,
 * nothing is claimed. It starts working the moment the SQL runs, with no
 * second deploy.
 *
 * Failing shut is the only safe direction. Without `source` there is no
 * way to tell a booking the plan made from one the member pressed, so
 * releasing anything would risk cancelling a class somebody actually
 * chose.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bounded independently of the cap. The gym runs about ten classes a week
 * at a given level; sixty is room for a much busier timetable without
 * ever asking for an unbounded page.
 */
const CANDIDATE_PAGE_SIZE = 60;

/** How many plan-made bookings can be considered for release at once. */
const HELD_PAGE_SIZE = 200;

export type PlanBookingOutcome = {
  /**
   * False when `bookings.source` is not there yet, or the read that
   * proves it exists failed. Nothing was booked and nothing was released.
   */
  readonly available: boolean;
  readonly booked: number;
  readonly released: number;
  /** Classes at the member's level that were already full. */
  readonly full: number;
  /** Inserts the database refused for any other reason. */
  readonly failed: number;
};

const NOTHING: PlanBookingOutcome = {
  available: false,
  booked: 0,
  released: 0,
  full: 0,
  failed: 0,
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Brings a member's bookings into line with the plan they just chose.
 *
 * `target` is the level their plan should be booking, or null for "book
 * nothing" — no plan, or the two-week trial. See `planBookingTarget`.
 *
 * Release happens before booking, and the order is chosen. If the second
 * half fails the member is left with fewer classes than they had, which
 * they can see and re-book. The other order leaves them holding two
 * levels at once, which reads as a bug and quietly doubles what they are
 * taking off the gym's floor.
 */
export async function syncPlanBookings(
  target: LevelId | null,
): Promise<PlanBookingOutcome> {
  const user = await getUser();
  if (!user) return NOTHING;

  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();

  /**
   * ── THE PROBE, AND IT IS ALSO REAL WORK ────────────────────────────
   *
   * Every future class this member's plan put them in. The filter names
   * `bookings.source`, so a successful response is proof the column
   * exists — PostgREST validates filters against the schema before it
   * runs anything, and would refuse this outright otherwise.
   *
   * That is why there is no separate availability check. A dedicated
   * probe would be a second round trip to learn something this query
   * already tells us.
   *
   * ANY error bails, not just the missing column. An unreadable answer
   * here means we cannot tell which bookings the plan made, and the one
   * thing this must never do is cancel a class somebody chose.
   */
  const { data: heldRows, error: heldError } = await supabase
    .from("class_occurrences")
    .select("id,level,bookings!inner(id,status,source)")
    .eq("bookings.user_id", user.id)
    .eq("bookings.status", "booked")
    .eq("bookings.source", "plan")
    .gt("starts_at", nowIso)
    .limit(HELD_PAGE_SIZE);

  if (heldError) return NOTHING;

  const held: HeldByPlan[] = (heldRows ?? []).map((row) => ({
    occurrenceId: asString(row.id),
    // Cast is safe for the comparison this feeds: an unrecognised level
    // simply will not equal the target, so the booking is released.
    level: asString(row.level) as LevelId,
  }));

  let released = 0;
  const toRelease = releaseForPlan(held, target);

  if (toRelease.length > 0) {
    /**
     * Cancelled, never deleted — the same rule the member's own cancel
     * button follows. "The plan booked this and then let it go" is a
     * fact the gym may need, and the roster already shows dropouts.
     *
     * `.select("id")` is not decoration. PostgREST answers a
     * policy-filtered UPDATE with 200 and an empty array, so the status
     * code says nothing at all about whether rows moved. The returned
     * rows are the only honest count.
     */
    const { data: cancelled } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: nowIso })
      .eq("user_id", user.id)
      .eq("status", "booked")
      .eq("source", "plan")
      .in("occurrence_id", toRelease)
      .select("id");

    released = cancelled?.length ?? 0;
  }

  if (target === null) {
    return { available: true, booked: 0, released, full: 0, failed: 0 };
  }

  /**
   * Classes cannot be booked if they do not exist. Idempotent and cheap
   * in the common case, and its failure is not fatal — a short horizon
   * means fewer classes to book, which the counts below report honestly.
   */
  await ensureHorizon();

  const until = new Date(now.getTime() + PLAN_BOOKING_DAYS * DAY_MS);

  /**
   * The week ahead at this level, with this member's own booking rows
   * embedded — live and cancelled alike, which is why the embed filters
   * on `user_id` only. A cancelled row is what "they already said no to
   * this one" looks like, and it has to survive into the decision.
   */
  const { data: rows, error: candidateError } = await supabase
    .from("class_occurrences")
    .select("id,capacity,booked_count,bookings(id)")
    .eq("bookings.user_id", user.id)
    .eq("level", target)
    .eq("status", "scheduled")
    .gt("starts_at", nowIso)
    .lt("starts_at", until.toISOString())
    .order("starts_at", { ascending: true })
    .limit(CANDIDATE_PAGE_SIZE);

  if (candidateError || !rows) {
    return { available: true, booked: 0, released, full: 0, failed: 0 };
  }

  const candidates: PlanCandidate[] = rows.map((row) => ({
    occurrenceId: asString(row.id),
    capacity: asCount(row.capacity),
    bookedCount: asCount(row.booked_count),
    existingRows: Array.isArray(row.bookings) ? row.bookings.length : 0,
  }));

  const { book, full } = selectForPlan(candidates, PLAN_BOOKING_MAX);
  if (book.length === 0) {
    return { available: true, booked: 0, released, full, failed: 0 };
  }

  /**
   * ── ONE INSERT PER CLASS, NOT ONE INSERT OF MANY ROWS ──────────────
   *
   * A multi-row insert is a single statement: one refusal rolls back all
   * of them. So a member whose Thursday class filled up thirty seconds
   * ago would be booked into nothing at all, and told so, for a reason
   * that has nothing to do with the other nine classes.
   *
   * Separate inserts, in parallel, on distinct rows, so nothing
   * serialises against anything. `allSettled` because a rejection here
   * must not take the plan choice down with it — supabase-js resolves
   * with an error object rather than throwing, and this is the belt to
   * that brace.
   *
   * `insert`, never `upsert`: every id here was chosen precisely because
   * the member has no row on it. If one appears in the meantime, the
   * unique constraint refuses this one, and that is correct — whatever
   * arrived first was a real decision.
   */
  const results = await Promise.allSettled(
    book.map((occurrenceId) =>
      supabase.from("bookings").insert({
        occurrence_id: occurrenceId,
        user_id: user.id,
        status: "booked",
        source: "plan",
      }),
    ),
  );

  let booked = 0;
  let raced = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === "rejected") {
      failed += 1;
      continue;
    }
    const { error } = result.value;
    if (!error) {
      booked += 1;
    } else if (error.code === "23514") {
      // The oversold check, from inside the occupancy trigger: it filled
      // between the read above and this insert. The race resolving
      // correctly, not a failure.
      raced += 1;
    } else if (error.code === "23505") {
      // They booked it themselves in the meantime. Already theirs.
      raced += 1;
    } else {
      failed += 1;
    }
  }

  return { available: true, booked, released, full: full + raced, failed };
}

/**
 * Is plan booking switched on?
 *
 * Read by /plans, so the page can promise it only when it can keep the
 * promise. Between the deploy and the client pasting
 * 20260823150000_plan_bookings.sql into the Supabase console, choosing a
 * plan records the answer and books nothing — and a page that said
 * otherwise would be lying to a member about what the button they are
 * looking at does.
 *
 * One indexed read of at most one of the member's own rows. RLS keeps it
 * to their own; an empty result is still proof the column parsed, because
 * PostgREST validates a select against the schema before it runs
 * anything.
 */
export async function planBookingAvailable(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").select("source").limit(1);
  return !error;
}
