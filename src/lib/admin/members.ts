import "server-only";

import { isPlanSlug, type PlanSlug } from "@/content/plans";
import { LEVELS, type LevelId } from "@/content/schedule";
import { adminIds } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * The member directory, and one member's history.
 *
 * Session-scoped client throughout, exactly as `lib/booking/queries.ts`
 * does — the difference is not the client, it is that this session has an
 * `admins` row and therefore satisfies a second policy. There is no
 * `where user_id = …` in this file to forget, and equally no secret key
 * quietly returning rows no policy allows.
 */

/**
 * Ten to a page, at the client's request.
 *
 * Not merely a slice of a list already fetched: the count, the ordering
 * and the booking tallies below are all built around the ten rows actually
 * being shown, so the work does not grow with the size of the directory.
 */
export const MEMBERS_PER_PAGE = 10;

/**
 * Bounds. This gym has four members and 337 occurrences; these exist so
 * that a directory which one day has two thousand members degrades into a
 * truncated page rather than an unbounded query that times out.
 */
const BOOKING_SCAN_LIMIT = 2000;
const HISTORY_PAGE_SIZE = 100;

/** Nothing off the wire is trusted; PostgREST hands back `unknown`. */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asLevel(value: unknown): LevelId {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
    ? (value as LevelId)
    : "beginner";
}

/**
 * A member's answer to the plan question, in the three states the schema
 * can actually represent. `member_plans.plan_slug` is nullable and the
 * null is load-bearing — see that table's migration.
 */
export type PlanAnswer =
  | { readonly state: "chosen"; readonly slug: PlanSlug }
  | { readonly state: "declined" }
  | { readonly state: "unasked" };

export type AdminMember = {
  readonly userId: string;
  /** Null for accounts made in the dashboard, which carry no metadata. */
  readonly fullName: string | null;
  readonly email: string;
  readonly joinedAt: string;
  readonly plan: PlanAnswer;
  readonly upcomingBookings: number;
  /** Classes booked that have already run. Booked, never "attended". */
  readonly pastBookings: number;
};

function planAnswerFrom(
  row: { plan_slug?: unknown } | undefined,
): PlanAnswer {
  if (!row) return { state: "unasked" };
  const slug = row.plan_slug;
  return isPlanSlug(slug) ? { state: "chosen", slug } : { state: "declined" };
}

/**
 * Every member, with their plan and how much they have booked.
 *
 * Four round trips rather than one embedded query, because `bookings` has
 * no foreign key to `profiles` — it references `auth.users`, which is the
 * correct target and not one PostgREST will embed across. Joining in
 * JavaScript is the honest way to say that; inventing a second FK purely
 * so a query reads nicer would be adding a schema constraint for the
 * benefit of a SELECT.
 */
/**
 * Makes a search box safe to interpolate into a PostgREST filter.
 *
 * The `or=` parameter is a small expression language, not a value slot:
 * commas separate terms, parentheses group them, and a backslash escapes.
 * A member typing "O'Brien, Jim" or a bare `(` would otherwise produce a
 * malformed filter — a 400 at best, and at worst a filter that means
 * something other than what was typed. `%` and `*` are the wildcards, so
 * they are stripped too rather than letting the box do glob matching
 * nobody asked for.
 *
 * Not an injection defence — PostgREST parameterises the values — but the
 * difference between a search that works on real names and one that 400s
 * on an apostrophe.
 */
function sanitizeSearch(raw: string): string {
  return raw.replace(/[(),*%\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export type MemberPage = {
  readonly members: readonly AdminMember[];
  /** Everyone matching the search, not just this page. */
  readonly total: number;
  /** 1-based, and already clamped to something that exists. */
  readonly page: number;
  readonly pageCount: number;
};

export async function listMembers(
  search = "",
  requestedPage = 1,
): Promise<MemberPage> {
  const supabase = await createClient();
  const admins = await adminIds();
  const nowIso = new Date().toISOString();
  const term = sanitizeSearch(search);

  /**
   * Built twice: once to count, once to fetch. Every filter has to be
   * applied to both, so the query is a function rather than a value —
   * a filter added to one and forgotten on the other is a pager that
   * says "Page 1 of 7" over three pages of results.
   */
  const build = (head: boolean) => {
    let query = supabase
      .from("profiles")
      .select("user_id,full_name,email,created_at", {
        count: "exact",
        head,
      })
      // Named members sort alphabetically; the nameless fall to the bottom
      // rather than heading the list under a blank.
      .order("full_name", { ascending: true, nullsFirst: false })
      /**
       * The tie-breaker, and it is what makes paging correct rather than
       * merely plausible. Two members called Alex sort equal, and Postgres
       * is under no obligation to order equal rows the same way twice — so
       * without a unique second key one of them can appear on both page 1
       * and page 2, or on neither. Unnoticeable with four members and
       * guaranteed to bite later.
       */
      .order("user_id", { ascending: true });

    if (admins.length > 0) {
      query = query.not("user_id", "in", `(${admins.join(",")})`);
    }

    /**
     * Name OR email, because the gym knows members by both — a face in the
     * room and an address on a receipt. Matched anywhere in the string
     * rather than as a prefix: "smith" should find "John Smith", and
     * searching by email domain is a genuinely useful way to spot a family
     * sharing one.
     */
    if (term) {
      query = query.or(`full_name.ilike.*${term}*,email.ilike.*${term}*`);
    }

    return query;
  };

  const { count } = await build(true);
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / MEMBERS_PER_PAGE));

  /**
   * Clamped rather than trusted. `?page=999` and `?page=-3` are both one
   * keystroke away in the address bar, and an unclamped `range()` returns
   * an empty list that reads as "no members" instead of "no such page".
   */
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pageCount);
  const from = (page - 1) * MEMBERS_PER_PAGE;

  const profiles = await build(false).range(from, from + MEMBERS_PER_PAGE - 1);

  if (profiles.error || !profiles.data) {
    return { members: [], total: 0, page: 1, pageCount: 1 };
  }

  const pageIds = profiles.data.map((row) => asString(row.user_id)).filter(Boolean);

  if (pageIds.length === 0) {
    return { members: [], total, page, pageCount };
  }

  /**
   * Plans and bookings for the ten people on screen, not for everybody.
   *
   * This is the part of pagination that actually matters. Slicing the
   * rendered rows would have left these two queries reading the whole
   * table on every page load — the directory would look paginated and
   * cost the same as before. `.in(...)` on the page's ids means the work
   * stays flat however large the gym gets.
   */
  const [plans, bookings] = await Promise.all([
    supabase.from("member_plans").select("user_id,plan_slug").in("user_id", pageIds),
    supabase
      .from("bookings")
      .select("user_id,class_occurrences!inner(starts_at)")
      .eq("status", "booked")
      .in("user_id", pageIds)
      .limit(BOOKING_SCAN_LIMIT),
  ]);

  const planByUser = new Map<string, { plan_slug?: unknown }>();
  for (const row of plans.data ?? []) {
    planByUser.set(asString(row.user_id), row);
  }

  const upcoming = new Map<string, number>();
  const past = new Map<string, number>();
  for (const row of bookings.data ?? []) {
    const userId = asString(row.user_id);
    /**
     * `!inner` guarantees the occurrence exists, but supabase-js types the
     * embed as an object or an array depending on how it infers the
     * relationship, and getting that wrong silently counts nothing.
     */
    const embedded = row.class_occurrences;
    const occurrence = Array.isArray(embedded) ? embedded[0] : embedded;
    const startsAt = asString(
      (occurrence as { starts_at?: unknown } | undefined)?.starts_at,
    );
    if (!startsAt) continue;

    const bucket = startsAt > nowIso ? upcoming : past;
    bucket.set(userId, (bucket.get(userId) ?? 0) + 1);
  }

  const members = profiles.data.map((row) => {
    const userId = asString(row.user_id);
    return {
      userId,
      fullName: asNullableString(row.full_name),
      email: asString(row.email),
      joinedAt: asString(row.created_at),
      plan: planAnswerFrom(planByUser.get(userId)),
      upcomingBookings: upcoming.get(userId) ?? 0,
      pastBookings: past.get(userId) ?? 0,
    };
  });

  return { members, total, page, pageCount };
}

export type MemberBooking = {
  readonly occurrenceId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly level: LevelId;
  /** The member cancelled this booking themselves. */
  readonly cancelledByMember: boolean;
  /** The gym cancelled the class. Different fact, different consequence. */
  readonly cancelledByGym: boolean;
};

export type AdminMemberDetail = {
  readonly member: AdminMember;
  readonly bookings: readonly MemberBooking[];
};

/**
 * One member, with their booking history newest-first.
 *
 * Returns null when the id matches nothing — which, under RLS, is the same
 * response an ordinary member gets for somebody else's id. The route turns
 * that into a 404, so a missing member and a forbidden one are
 * indistinguishable from outside.
 */
export async function getMemberDetail(
  userId: string,
): Promise<AdminMemberDetail | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [profile, plan, bookings] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id,full_name,email,created_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("member_plans")
      .select("user_id,plan_slug")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select(
        "occurrence_id,status,class_occurrences!inner(starts_at,ends_at,level,status)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_PAGE_SIZE),
  ]);

  if (profile.error || !profile.data) return null;

  const rows = (bookings.data ?? []).map((row) => {
    const embedded = row.class_occurrences;
    const occurrence = (Array.isArray(embedded) ? embedded[0] : embedded) as
      | { starts_at?: unknown; ends_at?: unknown; level?: unknown; status?: unknown }
      | undefined;

    return {
      occurrenceId: asString(row.occurrence_id),
      startsAt: asString(occurrence?.starts_at),
      endsAt: asString(occurrence?.ends_at),
      level: asLevel(occurrence?.level),
      cancelledByMember: row.status === "cancelled",
      cancelledByGym: occurrence?.status === "cancelled",
    };
  });

  /**
   * Sorted here rather than in Postgres. The query orders by the booking's
   * own `created_at`, which is when it was *made*; a history reads by when
   * the class *happens*, and those two disagree the moment somebody books
   * next Friday before booking tomorrow.
   */
  rows.sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const live = rows.filter((row) => !row.cancelledByMember);

  return {
    member: {
      userId: asString(profile.data.user_id),
      fullName: asNullableString(profile.data.full_name),
      email: asString(profile.data.email),
      joinedAt: asString(profile.data.created_at),
      plan: planAnswerFrom(plan.data ?? undefined),
      upcomingBookings: live.filter((row) => row.startsAt > nowIso).length,
      pastBookings: live.filter((row) => row.startsAt <= nowIso).length,
    },
    bookings: rows,
  };
}
