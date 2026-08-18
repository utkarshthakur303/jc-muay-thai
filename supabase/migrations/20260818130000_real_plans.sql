-- ---------------------------------------------------------------------
-- The plans become the gym's real ones.
--
-- WHAT WAS WRONG. `member_plans` and `member_quotes` both constrain
-- plan_slug to ('basic', 'intermediate', 'advanced'), which were three
-- invented membership blocks of one, three and six months. The gym does
-- not sell those and never did. Its real offering, published on its own
-- site, is a monthly price per CLASS — Beginners, Intermediate, Advanced
-- & Fighter, Kids — with the commitment term as a separate choice that
-- moves the price.
--
-- WHAT CHANGES.
--   1. plan_slug widens to the four real classes, and is renamed to match
--      `LevelId` in src/content/schedule.ts. A plan and a class now name
--      the same thing in the same words, in the database and in the code.
--   2. `commitment` is added: two-week trial, 12-week contract, or month
--      to month. Nullable, because picking a class without settling the
--      term is the normal case and the term is what the gym discusses in
--      person.
--   3. The two existing rows are DELETED. See below — this is the part
--      worth reading.
--
-- WHY THE ROWS GO RATHER THAN GET MAPPED. Two people had answered:
-- one real member chose 'advanced' and the owner's own account chose
-- 'basic'. Under the old copy 'advanced' meant "six months, the whole
-- timetable, nothing held back". Under the real one it means Advanced &
-- Fighter Training — 30 minutes of sparring at the end of every class,
-- for people preparing to compete, at $190 a month. Carrying the string
-- across would silently record a member as wanting fighter training
-- because they once picked a six-month block, and the admin quote box
-- would open on $190 for them.
--
-- An answer to a question that no longer exists is not data. Both rows
-- go, and both people get asked once more against something true. The
-- client made this call directly on 2026-08-18 with the alternative on
-- the table.
--
-- WHAT DOES NOT CHANGE. A plan still grants nothing and blocks nothing.
-- It is an interest for the gym to follow up in person. Nothing in this
-- schema is an entitlement, and no policy anywhere reads plan_slug to
-- decide what a member may book.
-- ---------------------------------------------------------------------

-- Deliberately before the constraint change. These rows hold values the
-- new constraint would reject, so they have to be gone first — and they
-- were going regardless.
delete from public.member_plans;

-- Quotes were priced against the old plans too. The table is empty today
-- (nothing has been quoted yet), so this is a guard rather than a
-- deletion: a quote naming a plan that no longer exists is a figure
-- attached to nothing.
delete from public.member_quotes;

-- ── member_plans ────────────────────────────────────────────────────

alter table public.member_plans
  drop constraint if exists member_plans_slug_known;

alter table public.member_plans
  add constraint member_plans_slug_known
  check (
    plan_slug is null
    or plan_slug in ('beginner', 'intermediate', 'advanced', 'kids')
  );

alter table public.member_plans
  add column if not exists commitment text;

alter table public.member_plans
  drop constraint if exists member_plans_commitment_known;

alter table public.member_plans
  add constraint member_plans_commitment_known
  check (
    commitment is null
    or commitment in ('trial', 'contract', 'monthly')
  );

-- The column-level grant is what actually lets a member write the new
-- field. RLS grants access to a ROW and says nothing about which columns
-- were touched, so without this the policy would pass and the write would
-- still be refused — with a 42501 that names permissions, not policies,
-- and reads like a bug in the app.
grant update (commitment) on table public.member_plans to authenticated;
grant insert (commitment) on table public.member_plans to authenticated;

comment on column public.member_plans.commitment is
  'Two-week trial, 12-week contract, or month to month. The gym''s own '
  'terms. Nullable: a member may pick a class without settling the term. '
  'Records an intention only — it authorises nothing and charges nothing.';

-- ── member_quotes ───────────────────────────────────────────────────

alter table public.member_quotes
  drop constraint if exists member_quotes_slug_known;

alter table public.member_quotes
  add constraint member_quotes_slug_known
  check (plan_slug in ('beginner', 'intermediate', 'advanced', 'kids'));

notify pgrst, 'reload schema';

-- ── Confirmation ────────────────────────────────────────────────────
-- A bare DDL run reports only "Success. No rows returned", which is
-- indistinguishable from having run nothing at all.
--
-- Expect exactly: plans_rows 0 · quotes_rows 0 · commitment_col 1
--                 plan_slugs_ok 1 · commitment_check 1 · quote_slugs_ok 1
select
  (select count(*) from public.member_plans)                as plans_rows,
  (select count(*) from public.member_quotes)               as quotes_rows,
  (select count(*) from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'member_plans'
       and column_name  = 'commitment')                     as commitment_col,
  (select count(*) from pg_constraint
     where conname = 'member_plans_slug_known'
       and pg_get_constraintdef(oid) like '%kids%')         as plan_slugs_ok,
  (select count(*) from pg_constraint
     where conname = 'member_plans_commitment_known')       as commitment_check,
  (select count(*) from pg_constraint
     where conname = 'member_quotes_slug_known'
       and pg_get_constraintdef(oid) like '%kids%')         as quote_slugs_ok;
