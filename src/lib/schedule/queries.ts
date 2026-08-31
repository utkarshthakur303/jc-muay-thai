import {
  isDayId,
  LEVELS,
  sessions as seedTimetable,
  type LevelId,
  type Session,
} from "@/content/schedule";
import { env } from "@/lib/env";

/**
 * Reading the weekly timetable.
 *
 * ── WHY THIS IS A BARE fetch AND NOT THE SUPABASE CLIENT ────────────
 * `/` must stay statically prerendered — the first non-negotiable in
 * the project's engineering rules, and the thing that lets the marketing
 * page be served from
 * the edge with no Node process behind it.
 *
 * `lib/supabase/server.ts` calls `cookies()`. Touching `cookies()` during
 * render opts the whole route out of static generation, permanently and
 * silently: the build output flips from `○ (Static)` to `ƒ (Dynamic)`
 * and nothing else complains. So the timetable — which every visitor
 * sees the same version of, and which has no per-user component at all —
 * is fetched with the publishable key over plain HTTP, no session, no
 * cookies.
 *
 * That is not a hole. The `class_sessions_read_all` policy grants SELECT
 * on this table to `anon`, deliberately, because a class timetable is
 * public information printed on the home page.
 *
 * Next's fetch cache then makes this free: the response is cached under
 * the tag below, so the page is built once and rebuilt only when the
 * owner actually edits something and the action calls
 * `revalidateTag(TIMETABLE_TAG)`.
 * ────────────────────────────────────────────────────────────────────
 */

export const TIMETABLE_TAG = "timetable";

/** Shape as stored: gym-local wall clock, `HH:MM:SS` off the wire. */
type TimetableRow = {
  readonly id: string;
  readonly day: string;
  readonly level: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly capacity: number;
};

/** A session plus the things only the database knows. */
export type TimetableEntry = Session & {
  readonly id: string;
  readonly capacity: number;
};

/**
 * Postgres renders `time` as `HH:MM:SS`; the rest of this codebase works
 * in `HH:MM`, and `toMinutes` throws on anything else. Trimming here
 * rather than at each call site means one place knows about the wire
 * format.
 */
function toHHMM(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value);
  return match ? `${match[1]}:${match[2]}` : null;
}

function asLevel(value: unknown): LevelId | null {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
    ? (value as LevelId)
    : null;
}

/**
 * Rows are validated, not trusted, and an unreadable row is DROPPED
 * rather than defaulted.
 *
 * Everywhere else in this codebase a bad field falls back to something
 * sensible — `asLevel` returns "beginner", `asString` returns "". That is
 * right for display. It is wrong here: a session with a defaulted level
 * or a defaulted time becomes a real class on the public timetable and a
 * real row in class_occurrences that somebody can book. A class that
 * silently invents itself is worse than one that quietly goes missing,
 * and the missing one is visible to the owner the moment he looks at the
 * schedule.
 */
function toEntry(row: TimetableRow): TimetableEntry | null {
  const start = toHHMM(row.starts_at);
  const end = toHHMM(row.ends_at);
  const level = asLevel(row.level);

  if (!start || !end || !level) return null;
  if (typeof row.day !== "string" || !isDayId(row.day)) return null;
  if (typeof row.id !== "string" || row.id === "") return null;
  if (start >= end) return null;

  return {
    id: row.id,
    day: row.day,
    level,
    start,
    end,
    capacity:
      typeof row.capacity === "number" && Number.isFinite(row.capacity)
        ? row.capacity
        : 16,
  };
}

/**
 * The timetable, ordered.
 *
 * FALLS BACK TO THE SEED IN src/content/schedule.ts, on purpose and for
 * the same reason `getPlanState` reports `available: false` rather than
 * throwing: migrations on this project are applied by a person pasting
 * SQL, so the code is live before the table exists. In that window the
 * home page must still print a timetable, and the one compiled into the
 * bundle is the one that was correct at deploy time.
 *
 * The fallback also covers Supabase being unreachable. A gym's schedule
 * going blank because a database had a bad minute is a worse failure than
 * showing a schedule that is a few edits stale.
 */
/**
 * Where the timetable came from.
 *
 * `fallback` means the seed compiled into the bundle — the table is
 * missing, empty, or unreachable. The public site does not care and
 * renders either identically. The EDITOR cares enormously: a seed row
 * has no database id, so an Edit button over one is a control that
 * cannot do what it implies, which is the exact thing the client's
 * standing instructions forbid shipping.
 */
export type TimetableSource = "database" | "fallback";

export type TimetableState = {
  readonly entries: readonly TimetableEntry[];
  readonly source: TimetableSource;
};

/** The entries alone, for everything that only needs to render them. */
export async function getTimetable(): Promise<readonly TimetableEntry[]> {
  return (await getTimetableState()).entries;
}

export async function getTimetableState(): Promise<TimetableState> {
  const url =
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/class_sessions` +
    `?select=id,day,level,starts_at,ends_at,capacity` +
    `&order=starts_at.asc`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
      },
      next: { tags: [TIMETABLE_TAG] },
    });

    if (!response.ok) return fallback();

    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return fallback();

    const entries = rows
      .map((row) => toEntry(row as TimetableRow))
      .filter((entry): entry is TimetableEntry => entry !== null);

    // An empty table is indistinguishable from a table nobody has seeded,
    // and a gym with no classes is not a thing this site should render.
    //
    // Note this DOES mean an owner who deletes every session sees the
    // seed reappear rather than an empty week. That is the right trade
    // for the public page and it is why the editor reports the source:
    // it can tell him he is looking at the fallback.
    return entries.length > 0
      ? { entries, source: "database" }
      : fallback();
  } catch {
    return fallback();
  }
}

function fallback(): TimetableState {
  return { entries: withIds(seedTimetable), source: "fallback" };
}

/**
 * The seed has no database ids. Synthesising one from the slug keeps the
 * type honest — every consumer can key a list off `id` without caring
 * which source it came from — while making it obvious in a debugger that
 * these rows are not editable.
 */
function withIds(timetable: readonly Session[]): readonly TimetableEntry[] {
  return timetable.map((session) => ({
    ...session,
    id: `seed-${session.day}-${session.start.replace(":", "")}-${session.level}`,
    capacity: 16,
  }));
}
