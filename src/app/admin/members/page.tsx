import Link from "next/link";

import { AdminShell } from "@/components/admin/AdminShell";
import { planBySlug } from "@/content/plans";
import { requireAdmin } from "@/lib/admin/guard";
import { listMembers, type PlanAnswer } from "@/lib/admin/members";

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

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();

  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const members = await listMembers(query);

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
        <ul role="list" className="mt-6 flex flex-col gap-2">
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
      )}
    </AdminShell>
  );
}
