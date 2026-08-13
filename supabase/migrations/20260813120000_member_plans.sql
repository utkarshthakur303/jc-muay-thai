-- Which membership plan a member says they are interested in.
--
-- WHAT THIS IS, AND WHAT IT IS NOT
--
-- A stated interest. Nothing more.
--
-- It is not a subscription, not a payment, and not an entitlement. Nobody
-- has been charged, nothing has been agreed, and no row here grants or
-- withholds anything: a member with no plan can book exactly the classes a
-- member with the six-month plan can book. Payments were deliberately left
-- out of v1 and the gym handles money in person, so the only honest thing
-- this table can hold is "here is what they told us they wanted", for the
-- gym to follow up on face to face.
--
-- That distinction has to survive into the UI, and it does: the plans page
-- says payment is sorted at the gym, and no screen anywhere claims a
-- membership is active. This is the same discipline the attendance table
-- is under — a member's own claim, labelled as their own claim. It must
-- never quietly become the basis of a billing decision or an access rule.
--
-- SHAPE
--
-- One row per member, keyed on the user itself rather than a synthetic id,
-- because a member has exactly one current answer. Changing plan is an
-- UPDATE of that answer, not a new row.
--
-- That means there is deliberately no history. A log of every plan someone
-- ever considered would be a genuinely useful thing for the gym to have,
-- and it is not what was asked for; adding it later is a second table, not
-- a reshape of this one.
--
-- plan_slug is NULLABLE, and the null is load-bearing. It is the
-- difference between "we have not asked yet" (no row) and "we asked and
-- they chose not to pick one" (a row with null). Without that distinction
-- the booking flow cannot tell a new member from one who has already said
-- 'not yet', so it would either ask nobody or ask the same person forever.

create table if not exists public.member_plans (
  user_id    uuid        primary key
    references auth.users (id) on delete cascade,

  -- NULL = asked, declined to choose. See above.
  plan_slug  text,

  -- When the current answer was given. Updated whenever it changes, so it
  -- reads as "as of", not "first seen".
  chosen_at  timestamptz not null default now(),

  -- The slugs are duplicated from src/content/plans.ts, and the
  -- duplication is deliberate for the same reason gym_today() repeats the
  -- timezone: the check has to run inside the database, where no
  -- TypeScript constant can reach it. A member holds a publishable key and
  -- can POST straight to PostgREST, so a slug validated only in the server
  -- action is a slug that is not validated.
  --
  -- There are exactly two places. If a plan is added or renamed, both
  -- change together, and each comments the other.
  constraint member_plans_slug_known
    check (plan_slug is null or plan_slug in ('basic', 'intermediate', 'advanced'))
);

-- ---------------------------------------------------------------------
-- Row-level security.
--
-- The client holds a publishable key and can talk to PostgREST directly,
-- so these policies are the enforcement — not the server action that
-- happens to call them. Anything checked only in TypeScript is not
-- checked.
-- ---------------------------------------------------------------------
alter table public.member_plans enable row level security;

revoke all on public.member_plans from anon, authenticated;
grant select, insert, update on public.member_plans to authenticated;

drop policy if exists member_plans_select_own on public.member_plans;
create policy member_plans_select_own
  on public.member_plans for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists member_plans_insert_own on public.member_plans;
create policy member_plans_insert_own
  on public.member_plans for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Changing your mind. Both halves check ownership: `using` decides which
-- row you may touch, `with check` decides what it may become — without the
-- second, a member could reassign their row to somebody else's user_id.
drop policy if exists member_plans_update_own on public.member_plans;
create policy member_plans_update_own
  on public.member_plans for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No delete policy. Withdrawing an answer is choosing "not yet", which is
-- an UPDATE to null and keeps the fact that we asked.

-- ---------------------------------------------------------------------
-- Tell PostgREST the table exists.
--
-- The API layer serves from a cached copy of the schema, and until it
-- reloads, every request for this table comes back PGRST205 — "could not
-- find the table in the schema cache" — which the site reads as "the
-- migration has not been run yet". Supabase normally reloads on its own
-- within a few seconds; this makes it immediate rather than something to
-- sit and wonder about.
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Confirmation.
--
-- A bare DDL run reports "Success. No rows returned", which is
-- indistinguishable from having run nothing at all. This prints what was
-- actually created.
-- ---------------------------------------------------------------------
select
  (select count(*) from public.member_plans)                       as rows_now,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'member_plans')   as policies_created,
  (select relrowsecurity from pg_class
     where oid = 'public.member_plans'::regclass)                  as rls_enabled;
