import "server-only";

import {
  sessionSlug,
  type DayId,
  type LevelId,
  type Session,
} from "@/content/schedule";
import { site } from "@/content/site";
import { generateOccurrences } from "@/lib/booking/occurrences";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking/horizon";
import {
  getTimetable,
  getTimetableState,
  type TimetableEntry,
  type TimetableSource,
} from "@/lib/schedule/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Keeping dated classes in step with an edited timetable.
 *
 * THE RULE, decided by the client on 2026-08-15 and the reason this is a
 * service and not a foreign key with ON DELETE CASCADE:
 *
 *   regenerate the unbooked, flag the booked.
 *
 * A cascade would be one line and would silently delete classes members
 * have already arranged their week around. Moving a Tuesday class by an
 * hour must not quietly cancel the four people booked into it — the owner
 * has to be told, so he can ring them. So this returns a report, and
 * anything with a live booking on it is left exactly where it is.
 *
 * Everything here runs through the SESSION-SCOPED client, as the
 * signed-in owner. The insert and delete policies added in
 * 20260822120000_class_sessions.sql are what permit it, and they are
 * bounded to `starts_at > now()` — so no edit to next month's timetable
 * can rewrite what happened last month, whatever this file asks for.
 */

/** How far ahead the editor rebuilds. Matches what /book will offer. */
const SYNC_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Identity of a dated class: its session, and the INSTANT it starts.
 *
 * Keyed on `Date.parse` rather than the timestamp string, and this is the
 * single most important line in the file. Postgres renders a timestamptz
 * as `2026-10-10T17:00:00+00:00`; `Date.toISOString()` renders the very
 * same instant as `2026-10-10T17:00:00.000Z`. Comparing those as strings
 * says they are different classes.
 *
 * That bug shipped on 2026-08-22 and was caught by the first real test of
 * it: because no existing class ever matched a generated one, a single
 * edit treated the ENTIRE calendar as orphaned and deleted 267 classes.
 * The booked one survived — the guarantee held, which is the only reason
 * this is a story about a near miss — but nothing else did.
 *
 * Two representations of one instant must compare equal. Parsing to
 * epoch milliseconds is what makes that true regardless of how either
 * side chose to spell it.
 */
function occurrenceKey(slug: string, startsAt: string): string {
  const instant = Date.parse(startsAt);
  return `${slug}@${Number.isNaN(instant) ? startsAt : instant}`;
}

export type SyncReport = {
  /** Future classes created for sessions that gained them. */
  readonly created: number;
  /** Unbooked future classes removed because their session changed or went. */
  readonly removed: number;
  /**
   * Classes that SHOULD have been removed and were not, because somebody
   * has booked them. The owner has to deal with these by hand — cancel
   * the class from the Classes screen, which emails the people affected.
   */
  readonly flagged: readonly {
    readonly id: string;
    readonly startsAt: string;
    readonly level: LevelId;
    readonly bookedCount: number;
  }[];
  /** Capacity changes that could not be applied without evicting someone. */
  readonly capacityBlocked: readonly {
    readonly startsAt: string;
    readonly level: LevelId;
    readonly bookedCount: number;
    readonly requested: number;
  }[];
};

export const emptyReport: SyncReport = {
  created: 0,
  removed: 0,
  flagged: [],
  capacityBlocked: [],
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Rebuilds the next {@link SYNC_DAYS} of classes from the timetable.
 *
 * Idempotent: running it twice with nothing changed creates nothing,
 * removes nothing and reports zero. That matters, because it runs after
 * every single edit.
 */
export async function syncOccurrences(): Promise<SyncReport> {
  const supabase = await createClient();
  const timetable = await getTimetable();
  const now = new Date();

  /**
   * What the timetable says should exist, keyed the way the database
   * keys it. `session_slug` encodes day, start and level, so a class that
   * moved by an hour has a DIFFERENT slug from the one that was there —
   * which is exactly what makes "this occurrence no longer belongs to any
   * session" a decidable question rather than a guess.
   */
  const wantedIncludingToday = generateOccurrences(timetable, {
    from: now,
    days: SYNC_DAYS,
    timeZone: site.timeZone,
    capacityFor: (session: Session) => {
      const match = timetable.find(
        (entry) => sessionSlug(entry) === sessionSlug(session),
      );
      return match?.capacity ?? 16;
    },
  });

  /**
   * FUTURE ONLY, and this is not tidying — it is what makes the insert
   * possible at all.
   *
   * `generateOccurrences` starts at today's DATE, so at 11pm it happily
   * produces this morning's 9am class. The RLS policy on
   * `class_occurrences` requires `starts_at > now()`, and Postgres
   * evaluates that per row against a MULTI-ROW insert: one draft in the
   * past makes the entire batch fail with 42501, and every class the edit
   * should have created silently never appears.
   *
   * That is precisely what happened on the first live test of this
   * feature — seven classes removed, zero created, no error on screen.
   * A class in the past is not something an edit to next week's timetable
   * should be creating anyway, so dropping them is both the fix and the
   * correct behaviour.
   */
  const wanted = wantedIncludingToday.filter(
    (draft) => Date.parse(draft.starts_at) > now.getTime(),
  );

  const wantedKeys = new Set(
    wanted.map((draft) => occurrenceKey(draft.session_slug, draft.starts_at)),
  );
  const capacityBySlug = new Map(
    timetable.map((entry) => [sessionSlug(entry), entry.capacity]),
  );

  /**
   * Everything on the calendar INSIDE the window this function just
   * generated for — not simply everything in the future.
   *
   * The bound matters. `wanted` describes the next SYNC_DAYS and nothing
   * beyond, so an occurrence further out than that is not "orphaned", it
   * is merely outside the question being asked. Without the upper bound,
   * lengthening the horizon later would make this delete the tail of the
   * calendar every time the owner edited a class.
   */
  const windowEnd = new Date(now.getTime() + SYNC_DAYS * DAY_MS);

  const { data: existing, error } = await supabase
    .from("class_occurrences")
    .select("id,session_slug,starts_at,level,capacity,booked_count,status")
    .gt("starts_at", now.toISOString())
    .lt("starts_at", windowEnd.toISOString())
    .limit(2000);

  if (error || !existing) return emptyReport;

  const existingKeys = new Set(
    existing.map((row) =>
      occurrenceKey(asString(row.session_slug), asString(row.starts_at)),
    ),
  );

  /* ── 1. Retire what the timetable no longer describes ──────────── */

  const orphans = existing.filter(
    (row) =>
      !wantedKeys.has(
        occurrenceKey(asString(row.session_slug), asString(row.starts_at)),
      ),
  );

  const removable = orphans.filter((row) => asCount(row.booked_count) === 0);
  const flagged = orphans
    .filter((row) => asCount(row.booked_count) > 0)
    .map((row) => ({
      id: asString(row.id),
      startsAt: asString(row.starts_at),
      level: asString(row.level) as LevelId,
      bookedCount: asCount(row.booked_count),
    }));

  let removed = 0;
  if (removable.length > 0) {
    /**
     * Deleted by id, in one statement, and the ids come from rows this
     * function has just read and checked. `booked_count` is maintained by
     * a trigger, so "0" is the database's own answer to "has anybody
     * booked this", not this function's opinion.
     */
    const { data: gone, error: deleteError } = await supabase
      .from("class_occurrences")
      .delete()
      .in(
        "id",
        removable.map((row) => asString(row.id)),
      )
      .select("id");

    // Reported, not swallowed. A delete that fails silently leaves the
    // calendar disagreeing with the timetable, which is the state this
    // whole function exists to prevent.
    if (deleteError) return { ...emptyReport, flagged };

    removed = gone?.length ?? 0;
  }

  /* ── 2. Create what it now describes and the calendar lacks ────── */

  const missing = wanted.filter(
    (draft) =>
      !existingKeys.has(occurrenceKey(draft.session_slug, draft.starts_at)),
  );

  let created = 0;
  if (missing.length > 0) {
    const { data: made, error: insertError } = await supabase
      .from("class_occurrences")
      .upsert(missing, {
        onConflict: "session_slug,starts_at",
        ignoreDuplicates: true,
      })
      .select("id");

    /**
     * Also reported rather than swallowed, and this one bit hard: when the
     * key comparison was broken, every draft looked missing, the insert
     * failed, `data` came back null, and `created` quietly read 0 — so the
     * panel announced "267 removed" and said nothing at all about having
     * created none. A silent zero is the worst possible reading of a
     * failed write.
     */
    if (insertError) return { created: 0, removed, flagged, capacityBlocked: [] };

    created = made?.length ?? 0;
  }

  /* ── 3. Push capacity changes onto classes that survived ───────── */

  // Mutable while building; the readonly type is the contract to callers.
  // capacityBlocked is declared after the early returns above so those
  // paths cannot report a partial list as a complete one.
  const capacityBlocked: {
    startsAt: string;
    level: LevelId;
    bookedCount: number;
    requested: number;
  }[] = [];
  const surviving = existing.filter((row) =>
    wantedKeys.has(`${asString(row.session_slug)}@${asString(row.starts_at)}`),
  );

  for (const row of surviving) {
    const target = capacityBySlug.get(asString(row.session_slug));
    if (target === undefined || target === asCount(row.capacity)) continue;

    /**
     * A capacity cannot drop below the number of people already in the
     * class. The database enforces that with a check constraint, so the
     * write would fail anyway — catching it here means the owner is told
     * WHICH class and by how much, rather than seeing a constraint name.
     *
     * Nobody is ever evicted from a class they booked to satisfy a
     * number typed on another screen.
     */
    if (target < asCount(row.booked_count)) {
      capacityBlocked.push({
        startsAt: asString(row.starts_at),
        level: asString(row.level) as LevelId,
        bookedCount: asCount(row.booked_count),
        requested: target,
      });
      continue;
    }

    await supabase
      .from("class_occurrences")
      .update({ capacity: target })
      .eq("id", asString(row.id));
  }

  return { created, removed, flagged, capacityBlocked };
}

/* ------------------------------------------------------------------
   Reading the pattern for the editor.
   ------------------------------------------------------------------ */

export type TimetableByDay = readonly {
  readonly day: DayId;
  readonly sessions: readonly TimetableEntry[];
}[];

/**
 * The timetable grouped for the editor, with each day's classes in the
 * order they run. Read through {@link getTimetable} rather than a second
 * query, so the screen the owner edits and the page a visitor sees are
 * looking at the same rows.
 */
export async function getTimetableByDay(days: readonly DayId[]): Promise<{
  readonly byDay: TimetableByDay;
  readonly total: number;
  /**
   * `fallback` when the table could not be read. The editor has to know:
   * seed rows carry synthetic ids, so every Edit and Remove button over
   * them would fail. It shows an explanation instead of controls that
   * cannot work.
   */
  readonly source: TimetableSource;
}> {
  const { entries, source } = await getTimetableState();

  return {
    source,
    total: entries.length,
    byDay: days.map((day) => ({
      day,
      sessions: entries
        .filter((entry) => entry.day === day)
        .sort((a, b) => a.start.localeCompare(b.start)),
    })),
  };
}

/** Classes already generated from this session that somebody has booked. */
export async function bookedCountForSession(
  entry: Session,
): Promise<number> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("class_occurrences")
    .select("booked_count")
    .eq("session_slug", sessionSlug(entry))
    .gt("starts_at", new Date().toISOString());

  return (data ?? []).reduce((sum, row) => sum + asCount(row.booked_count), 0);
}

export { BOOKING_WINDOW_DAYS };
