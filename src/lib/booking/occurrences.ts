import {
  addCivilDays,
  civilWeekdayIndex,
  gymCivilDate,
  gymTimeToInstant,
  WEEK,
  type CivilDate,
} from "@/lib/format/gymClock";
import { toMinutes } from "@/lib/format/time";
import { isDayId, sessionSlug, type Session } from "@/content/schedule";

/**
 * Turning the weekly pattern into dated, bookable classes.
 *
 * Pure. It takes the timetable as an argument rather than importing it,
 * which is not ceremony: the timetable moves into the database the day the
 * admin dashboard is built, and when it does, this file does not change —
 * only the call site that supplies the sessions.
 */

export type OccurrenceDraft = {
  readonly session_slug: string;
  /** ISO 8601, UTC. */
  readonly starts_at: string;
  readonly ends_at: string;
  readonly level: string;
  readonly capacity: number;
};

export type GenerateOptions = {
  /** Generation starts on this instant's gym-local date. */
  readonly from: Date;
  /** Gym-local calendar days to cover, counting `from`'s date as day one. */
  readonly days: number;
  readonly timeZone: string;
  readonly capacityFor: (session: Session) => number;
};

/**
 * Every occurrence of every session across a window of gym-local days.
 *
 * Iteration is over calendar dates, not over elapsed time. Stepping by
 * 24 hours would drift by an hour at each daylight saving boundary and
 * eventually skip or repeat a day; stepping the civil date and converting
 * each day's wall time independently is correct by construction.
 *
 * Sunday produces nothing, because the gym does not open — `isDayId`
 * rejects it and the day is skipped rather than special-cased.
 */
export function generateOccurrences(
  sessions: readonly Session[],
  options: GenerateOptions,
): OccurrenceDraft[] {
  const { from, days, timeZone, capacityFor } = options;
  const startDate = gymCivilDate(from, timeZone);

  const byDay = new Map<string, Session[]>();
  for (const session of sessions) {
    const list = byDay.get(session.day) ?? [];
    list.push(session);
    byDay.set(session.day, list);
  }

  const drafts: OccurrenceDraft[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date: CivilDate = addCivilDays(startDate, offset);
    const weekday = WEEK[civilWeekdayIndex(date)];
    if (!weekday || !isDayId(weekday)) continue;

    for (const session of byDay.get(weekday) ?? []) {
      drafts.push({
        session_slug: sessionSlug(session),
        starts_at: gymTimeToInstant(
          date,
          toMinutes(session.start),
          timeZone,
        ).toISOString(),
        ends_at: gymTimeToInstant(
          date,
          toMinutes(session.end),
          timeZone,
        ).toISOString(),
        level: session.level,
        capacity: capacityFor(session),
      });
    }
  }

  return drafts;
}
