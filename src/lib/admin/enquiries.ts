import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The enquiry inbox.
 *
 * Read with the admin's own session, not the secret key — same rule as
 * every other admin query in this folder. `contact_messages` gained its
 * first two policies in 20260815130000_admin_writes.sql; before that
 * migration is applied every call here returns nothing, which the page
 * renders as an empty inbox rather than an error, because an empty inbox
 * is also the correct output when nobody has written in.
 *
 * The public form still writes with the secret key. That path is
 * unchanged: allowing anonymous inserts through PostgREST would make the
 * form's rate limit bypassable, which is the note the table's own
 * migration opens with.
 */

const INBOX_PAGE_SIZE = 200;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export type Enquiry = {
  readonly id: string;
  readonly receivedAt: string;
  readonly name: string;
  readonly email: string;
  readonly message: string;
  /** Null until somebody at the gym marks it dealt with. */
  readonly handledAt: string | null;
};

export type Inbox = {
  /** Not yet dealt with, oldest first. */
  readonly waiting: readonly Enquiry[];
  /** Dealt with, most recently handled first. */
  readonly handled: readonly Enquiry[];
};

function toEnquiry(row: Record<string, unknown>): Enquiry {
  return {
    id: asString(row.id),
    receivedAt: asString(row.created_at),
    name: asString(row.name),
    email: asString(row.email),
    message: asString(row.message),
    handledAt: typeof row.handled_at === "string" ? row.handled_at : null,
  };
}

/**
 * Everything in the inbox, split by whether it still needs an answer.
 *
 * Columns are listed explicitly rather than with `*`, and that is load
 * bearing: the grant on this table is column-level and does not include
 * `ip_hash`, so a `select *` would be refused outright by Postgres. Naming
 * the six columns the panel actually uses is what keeps the two in
 * agreement.
 */
export async function getInbox(): Promise<Inbox> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_messages")
    .select("id,created_at,name,email,message,handled_at")
    .order("created_at", { ascending: false })
    .limit(INBOX_PAGE_SIZE);

  if (error || !data) return { waiting: [], handled: [] };

  const all = data.map(toEnquiry);

  return {
    /**
     * Oldest first, deliberately against the query's own order.
     *
     * An inbox sorted newest-first buries the person who has been waiting
     * longest under everyone who wrote since. The queue is worked from the
     * bottom up, so it is presented that way.
     */
    waiting: all
      .filter((entry) => entry.handledAt === null)
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)),
    handled: all.filter((entry) => entry.handledAt !== null),
  };
}

/**
 * How many enquiries are still waiting.
 *
 * `head: true` asks PostgREST for the count header and no rows — the
 * overview needs the number, not the messages.
 */
export async function countWaitingEnquiries(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .is("handled_at", null);

  if (error) return 0;
  return count ?? 0;
}
