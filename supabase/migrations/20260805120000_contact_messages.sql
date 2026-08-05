-- Contact enquiries submitted from the website.
--
-- Access model: row-level security is ON and there are deliberately NO
-- policies. Under Postgres RLS, a table with no policy denies everything,
-- so neither the publishable key that every visitor holds nor a signed-in
-- member can read, insert, update or delete a row here. The only way in is
-- the `sb_secret_*` key, which bypasses RLS and lives on the server.
--
-- That is not belt-and-braces. If anonymous inserts were allowed, the
-- rate limit in the server action would be bypassable by posting straight
-- to PostgREST, and the whole table would be one curl loop from full.

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- Bounds mirror lib/validation/contact.ts exactly. Enforced here as well
  -- as there so the limits hold for anything that ever writes to this
  -- table, including a future admin tool or an import script.
  name        text not null check (char_length(name) between 2 and 80),
  email       text not null check (char_length(email) between 3 and 254),
  message     text not null check (char_length(message) between 10 and 2000),

  -- SHA-256 of a salted client IP. Never the address itself: the only
  -- question ever asked of it is "how many from this origin in the last
  -- hour", which a digest answers just as well, and a gym's website has no
  -- business holding a log of who visited it.
  ip_hash     text,

  -- Set when someone has dealt with the enquiry. Gives the client a way to
  -- work through the table without deleting anything.
  handled_at  timestamptz
);

alter table public.contact_messages enable row level security;

-- Belt and braces on top of RLS: PostgREST exposes tables to these roles
-- by default, and revoking makes the intent explicit to anyone reading the
-- schema rather than leaving it implied by the absence of policies.
revoke all on table public.contact_messages from anon, authenticated;

-- Reading the inbox: newest first.
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- The rate-limit query: WHERE ip_hash = $1 AND created_at > $2. Composite
-- and in this order because ip_hash is the equality predicate and
-- created_at the range one — the reverse would make the index useless for
-- the lookup and turn every submission into a sequential scan.
create index if not exists contact_messages_ip_hash_created_at_idx
  on public.contact_messages (ip_hash, created_at desc);

-- Triage: the unanswered ones, which is the query the client will run most.
create index if not exists contact_messages_unhandled_idx
  on public.contact_messages (created_at desc)
  where handled_at is null;
