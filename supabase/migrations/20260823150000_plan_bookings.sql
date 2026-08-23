-- Where a booking came from: the member, or their plan.
--
-- WHY THIS COLUMN HAS TO EXIST
--
-- From 2026-08-23 choosing a plan books classes. A member who picks
-- Intermediate is put into the Intermediate classes in the week ahead,
-- so that "your classes" reflects the plan they chose — the client's
-- instruction, given with the cost of it stated in front of them: these
-- are real bookings, they consume real capacity, and the gym's roster
-- shows real names against classes nobody individually decided on.
--
-- The moment that exists, two facts that used to be the same fact come
-- apart:
--
--   'member'  somebody pressed Book on a specific class. A deliberate
--             decision about a specific evening.
--   'plan'    it followed from their plan. Nobody chose this class.
--
-- Changing plan has to release the first kind and keep the second. A
-- member moving from Beginners to Advanced must not be left in a week of
-- Beginners classes for ever — and must not have a class they deliberately
-- booked cancelled underneath them. Without this column those two are
-- indistinguishable, and the choice is between stranding bookings and
-- destroying them. Neither is acceptable, so the column is not optional.
--
-- DEFAULT 'member', deliberately. Every row that exists today was pressed
-- by a person, so the default states what is already true about them
-- rather than leaving a backfill to be remembered.
--
-- The site is live before this runs — migrations here are applied by hand
-- after the deploy — so the code treats a missing column as "plan booking
-- is not switched on yet" and carries on. Booking, cancelling and the
-- account page all work without it. See lib/plans/autoBook.ts.

alter table public.bookings
  add column if not exists source text not null default 'member';

alter table public.bookings
  drop constraint if exists bookings_source_known;

-- The same duplication as member_plans_slug_known, for the same reason:
-- a member holds a publishable key and can POST straight to PostgREST, so
-- a value validated only in TypeScript is a value that is not validated.
alter table public.bookings
  add constraint bookings_source_known
  check (source in ('member', 'plan'));

comment on column public.bookings.source is
  'member = pressed Book on this class. plan = followed from their chosen '
  'plan and may be released when the plan changes. Never used to grant or '
  'withhold anything.';

-- "Which of this member''s live bookings did their plan make?" — asked on
-- every plan change, to decide what to release.
create index if not exists bookings_user_source_idx
  on public.bookings (user_id, source)
  where status = 'booked';

-- ---------------------------------------------------------------------
-- No RLS change.
--
-- The existing insert and update policies already say everything that
-- matters: a member may only write their own rows, only onto a scheduled
-- class that has not started. `source` is a note about how a booking came
-- to be, not a permission — it grants nothing and withholds nothing, and
-- a member who sets it by hand on their own row only changes whether
-- their own next plan change releases it.
-- ---------------------------------------------------------------------

-- PostgREST serves from a cached copy of the schema. Until it reloads,
-- every write naming this column comes back PGRST204 and the site reads
-- that as "not switched on yet" — correct, but for a few seconds longer
-- than necessary.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Confirmation. A bare DDL run reports "Success. No rows returned",
-- which is indistinguishable from having run nothing at all.
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'bookings'
       and column_name = 'source')                             as column_added,
  (select count(*) from pg_constraint
     where conname = 'bookings_source_known')                  as constraint_added,
  (select count(*) from pg_indexes
     where schemaname = 'public'
       and indexname = 'bookings_user_source_idx')             as index_added,
  (select count(*) from public.bookings)                       as rows_kept,
  (select count(*) from public.bookings where source = 'member') as rows_marked_member,
  (select count(*) from public.bookings where source = 'plan')   as rows_marked_plan;
