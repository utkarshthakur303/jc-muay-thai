import type { CommitmentSlug, PlanSlug } from "@/content/plans";
import type { LevelId } from "@/content/schedule";

/**
 * The rules behind "your plan books your classes".
 *
 * Pure, and separate from the database work in `autoBook.ts`, for the
 * same reason `admin/quote.ts` is separate from `admin/quotes.ts`: these
 * are the decisions, and decisions that consume a real gym's capacity
 * should be testable without a database in front of them.
 *
 * ── WHAT THIS FEATURE ACTUALLY DOES, STATED PLAINLY ──────────────────
 *
 * Choosing a plan books real classes. Not suggestions, not a shortlist —
 * rows in `bookings`, seats out of a capacity of sixteen, and the
 * member's name on the roster the coach reads at the door.
 *
 * That is the client's decision, taken on 2026-08-23 with the cost put in
 * front of them: the alternative on the table was to surface the classes
 * for one-tap booking and reserve nothing. They chose to book. So the job
 * here is not to argue with it, it is to make it behave — which means
 * every rule below exists to stop it doing something the member or the
 * gym would not have chosen.
 * ────────────────────────────────────────────────────────────────────
 */

/**
 * How far ahead a plan books.
 *
 * One week, and the number is doing real work. The gym runs the same
 * three graded classes every morning Monday to Saturday and again every
 * evening Monday to Thursday, so a single level is ten classes a week —
 * over the full 30-day booking window that would be forty-three, which is
 * forty-three seats taken out of the gym's floor for one person who will
 * attend perhaps three of them.
 *
 * A week is the horizon somebody can actually picture, it is short enough
 * that the wrong ones are cheap to cancel, and it tops itself up every
 * time the member touches their plan.
 */
export const PLAN_BOOKING_DAYS = 7;

/**
 * The hard ceiling on one run, whatever the timetable says.
 *
 * Ten classes a week is the timetable as it stands, and the timetable is
 * now editable from the admin panel. Without a cap, an owner who adds a
 * morning session to every day quietly turns this into a bigger number
 * for every member on that level, and nobody would connect the two. The
 * cap is what makes that a smaller effect rather than a runaway.
 */
export const PLAN_BOOKING_MAX = 12;

/**
 * Which level, if any, a member's plan should be booking.
 *
 * `PlanSlug` and `LevelId` are deliberately the same strings — a plan
 * names a class — so this is a rule, not a conversion.
 *
 * TWO ways it comes back null, and both matter:
 *
 *   No plan.  Including "I'll decide later", which is a real recorded
 *             answer. Booking classes for somebody who has just declined
 *             to choose would be the most obvious possible violation of
 *             what they said.
 *
 *   Trial.    The gym's two-week trial is somebody trying the place out.
 *             They have not adopted its weekly schedule and putting them
 *             in ten classes says they have. A trial books one class at
 *             a time, by hand, which is what the trial panel on /plans
 *             sends them to /book to do.
 */
export function planBookingTarget(
  slug: PlanSlug | null,
  term: CommitmentSlug | null,
): LevelId | null {
  if (slug === null) return null;
  if (term === "trial") return null;
  return slug;
}

/**
 * A future class the member's plan already put them in.
 *
 * `level` is read off the occurrence rather than off the plan, because an
 * occurrence is self-contained by design — it keeps the level it was
 * generated with even after the pattern changes.
 */
export type HeldByPlan = {
  readonly occurrenceId: string;
  readonly level: LevelId;
};

/**
 * Which plan-made bookings to release, given where the member is going.
 *
 * ONLY bookings the plan made are ever considered — the caller filters on
 * `source = 'plan'` before this sees them — and that filter is the whole
 * reason the `source` column exists. A member who moves from Beginners to
 * Advanced must not be left sitting in a week of Beginners classes, and
 * must not have a class they deliberately pressed Book on cancelled
 * underneath them. Told apart only by where the booking came from.
 *
 * Same level in and out means nothing is released. Switching term from
 * Monthly to Yearly does not churn a member's whole week, because the
 * level did not move.
 */
export function releaseForPlan(
  held: readonly HeldByPlan[],
  target: LevelId | null,
): string[] {
  return held
    .filter((entry) => entry.level !== target)
    .map((entry) => entry.occurrenceId);
}

/** A candidate class, as much of it as the decision needs. */
export type PlanCandidate = {
  readonly occurrenceId: string;
  readonly capacity: number;
  readonly bookedCount: number;
  /**
   * How many booking rows this member already has on it — 0 or 1, since
   * `bookings_one_per_member` allows no more. Live *and* cancelled, and
   * the cancelled case is the one that matters.
   */
  readonly existingRows: number;
};

export type PlanSelection = {
  /** Occurrence ids to book, in the order they were offered. */
  readonly book: readonly string[];
  /** Classes skipped because they were already full. */
  readonly full: number;
};

/**
 * Which of the coming week's classes to actually book.
 *
 * Three rules, and each one is a thing this must never do:
 *
 * 1. NEVER TOUCH A CLASS THE MEMBER HAS A ROW ON. Not the live ones —
 *    they are already booked — and above all not the cancelled ones. A
 *    member who cancels Thursday and finds themselves booked back into it
 *    the next time they open their plan has been argued with by software.
 *    Bookings are never deleted here, so the absence of a row is the only
 *    honest definition of "never asked", and it is the one used.
 *
 * 2. NEVER FILL THE LAST SEAT BLINDLY. A full class is skipped and
 *    counted, not attempted. The database would refuse it anyway — the
 *    oversold check is unbypassable — but a member should not be shown
 *    "we booked your week" over four silent failures.
 *
 * 3. NEVER MORE THAN THE CAP. See PLAN_BOOKING_MAX.
 *
 * The occupancy read is a snapshot and this does not pretend otherwise:
 * a class can fill between this decision and the insert. That race is
 * already settled correctly by `class_occurrences_not_oversold` — the
 * insert loses, the member keeps the rest of their week, and the count
 * they are shown is what actually happened rather than what was planned.
 */
export function selectForPlan(
  candidates: readonly PlanCandidate[],
  max: number = PLAN_BOOKING_MAX,
): PlanSelection {
  const book: string[] = [];
  let full = 0;

  for (const candidate of candidates) {
    if (book.length >= max) break;
    if (candidate.existingRows > 0) continue;
    if (candidate.bookedCount >= candidate.capacity) {
      full += 1;
      continue;
    }
    book.push(candidate.occurrenceId);
  }

  return { book, full };
}
