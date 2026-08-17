import Link from "next/link";

import { AdminShell } from "@/components/admin/AdminShell";
import { planBySlug } from "@/content/plans";
import { requireAdmin } from "@/lib/admin/guard";
import {
  listMembers,
  MEMBERS_PER_PAGE,
  type PlanAnswer,
} from "@/lib/admin/members";

/**
 * The member directory.
 *
 * A list of reflowing rows rather than a `<table>`. The data is genuinely
 * tabular, but a four-column table on a 360px phone either scrolls
 * sideways or crushes the names to two characters — and the client asked
 * for this to work on a phone because the gym is where it gets read.
 */

export const metadata = { title: "Members" };

/**
 * The three plan states, said in words rather than shown as a blank.
 *
 * "Never asked" and "Not chosen" look identical in a table that renders
 * both as an empty cell, and they mean opposite things: one is the gym's
 * omission, the other is the member's answer.
 */
function PlanBadge({ plan }: { plan: PlanAnswer }) {
  if (plan.state === "chosen") {
    const detail = planBySlug(plan.slug);
    return (
      <span className="rounded-full bg-accent px-3 py-1 font-mono text-[10px] tracking-[0.08em] text-ink uppercase">
        {detail?.name ?? plan.slug}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] tracking-[0.08em] text-text-3 uppercase">
      {plan.state === "declined" ? "Decide later" : "Never asked"}
    </span>
  );
}

/**
 * Previous / next, as links.
 *
 * Links rather than buttons because a page number belongs in the URL: the
 * gym can bookmark page 3 of a search, the back button does what it says,
 * and the whole thing works before any JavaScript has loaded. A pager
 * built from onClick handlers has none of those properties and looks
 * identical.
 */
function Pager({
  page,
  pageCount,
  query,
}: {
  page: number;
  pageCount: number;
  query: string;
}) {
  // The search has to survive paging, or page 2 of "smith" is page 2 of
  // everybody — the classic way a filtered list quietly stops being
  // filtered.
  const href = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (target > 1) params.set("page", String(target));
    const suffix = params.toString();
    return suffix ? `/admin/members?${suffix}` : "/admin/members";
  };

  const step =
    "flex min-h-11 items-center rounded-full border px-5 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors";

  return (
    <nav
      aria-label="Member directory pages"
      className="mt-6 flex flex-wrap items-center gap-3"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${step} border-border text-text-2 hover:border-accent hover:text-accent-strong`}>
          ← Previous
        </Link>
      ) : (
        /*
          Rendered as a disabled span, not omitted. A pager whose controls
          move as you page through it is one where "Next" ends up under the
          thumb that was aiming for "Previous".
        */
        <span aria-disabled className={`${step} border-divider text-text-3 opacity-55`}>
          ← Previous
        </span>
      )}

      <span className="font-mono text-[12px] tabular-nums text-text-2">
        Page {page} of {pageCount}
      </span>

      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={`${step} border-border text-text-2 hover:border-accent hover:text-accent-strong`}>
          Next →
        </Link>
      ) : (
        <span aria-disabled className={`${step} border-divider text-text-3 opacity-55`}>
          Next →
        </span>
      )}
    </nav>
  );
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();

  const { q, page: rawPage } = await searchParams;
  const query = q?.trim() ?? "";
  // Anything unparseable means page 1. `listMembers` clamps the rest, so a
  // hand-typed `?page=999` lands on the last real page rather than on an
  // empty list that reads as "no members".
  const requested = Number.parseInt(rawPage ?? "1", 10);
  const { members, total, page, pageCount } = await listMembers(
    query,
    Number.isNaN(requested) ? 1 : requested,
  );

  const first = (page - 1) * MEMBERS_PER_PAGE + 1;
  const last = first + members.length - 1;

  return (
    <AdminShell
      current="/admin/members"
      heading="Members"
      lead="Everyone with an account. A plan is a stated interest — it grants nothing and blocks nothing."
    >
      {/*
        A plain GET form, not a client-side filter.

        Filtering an array already on the page would be instant and would
        also be a lie the moment the directory outgrows one page — the box
        would search the visible 500 and quietly miss the rest. Searching
        in Postgres is correct at any size, works with JavaScript off, and
        leaves a shareable URL.
      */}
      <form method="get" role="search" className="mt-8 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name or email"
          aria-label="Search members by name or email"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-input-bg px-5 text-sm text-text placeholder:text-text-3 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-full bg-accent px-6 font-mono text-[11px] tracking-[0.08em] text-ink uppercase transition-colors hover:bg-accent-hover"
        >
          Search
        </button>
        {query ? (
          <Link
            href="/admin/members"
            className="flex min-h-11 shrink-0 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {members.length === 0 ? (
        <p className="mt-10 text-sm leading-relaxed text-text-2">
          {query
            ? `No members match “${query}”.`
            : "No members yet."}
        </p>
      ) : (
        <>
        {/*
          Which slice of what, said in words. "Page 2 of 4" alone does not
          tell the gym whether the person they are looking for is behind
          them or ahead, and a search that matched 3 of 40 members should
          say 3 out loud.
        */}
        <p className="mt-6 font-mono text-[12px] tabular-nums text-text-3">
          {total <= MEMBERS_PER_PAGE
            ? `${total} ${total === 1 ? "member" : "members"}`
            : `${first}–${last} of ${total}`}
          {query ? ` matching “${query}”` : ""}
        </p>

        <ul role="list" className="mt-3 flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.userId}>
              <Link
                href={`/admin/members/${member.userId}`}
                className="card-surface flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-border px-5 py-4 transition-colors hover:border-accent"
              >
                <span className="min-w-48 flex-1">
                  <span className="block text-sm font-semibold text-text">
                    {member.fullName ?? member.email}
                  </span>
                  {member.fullName ? (
                    <span className="mt-0.5 block font-mono text-[12px] text-text-3">
                      {member.email}
                    </span>
                  ) : null}
                </span>

                <PlanBadge plan={member.plan} />

                {/*
                  "Booked", never "attended". Nothing in this system knows
                  who walked through the door, and a column labelled
                  attendance would be wrong the first time somebody did
                  not turn up.
                */}
                <span className="font-mono text-[12px] tabular-nums text-text-2">
                  {member.upcomingBookings} upcoming · {member.pastBookings}{" "}
                  booked
                </span>

                <span aria-hidden className="ml-auto font-mono text-[11px] text-text-3">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {pageCount > 1 ? (
          <Pager page={page} pageCount={pageCount} query={query} />
        ) : null}
        </>
      )}
    </AdminShell>
  );
}
