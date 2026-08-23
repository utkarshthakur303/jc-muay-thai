-- A member's own streak target.
--
-- WHAT THIS IS, AND WHAT IT IS NOT
--
-- A number somebody set for themselves. Nothing more.
--
-- It is not a commitment to the gym, not part of a plan, and nothing
-- anywhere reads it to decide what a member may do. It exists so the
-- streak page has something to measure progress against that the member
-- chose, instead of a milestone list this codebase picked for them.
--
-- Same discipline as `attendance` and `member_plans`: a member's own
-- claim, labelled as their own claim, with no consequence attached.
--
-- WHY A SEPARATE TABLE AND NOT A COLUMN ON member_plans
--
-- Because of what a missing row means there. member_plans documents its
-- null as load-bearing — no row is "we have not asked yet", a row with a
-- null slug is "we asked and they said not yet". Hanging a goal off that
-- table would mean setting a goal has to create a plan row, which would
-- silently tell the booking flow it had already asked somebody it never
-- asked. A goal is not a plan; it gets its own key.
--
-- SHAPE
--
-- One row per member. Changing the goal is an UPDATE, not a new row, so
-- there is deliberately no history of previous goals. Nothing in the
-- product shows one, and a log nobody reads is a table that only ever
-- grows.

create table if not exists public.member_goals (
  user_id     uuid        primary key
    references auth.users (id) on delete cascade,

  -- Consecutive OPEN days the member is aiming for. See streak.ts: the
  -- gym runs Monday to Saturday and Sunday is stepped over, so this is a
  -- count of training days, not of calendar days.
  streak_goal integer     not null,

  -- When the current goal was set. Reads as "as of", not "first seen".
  set_at      timestamptz not null default now(),

  -- The bounds are duplicated from src/lib/attendance/goal.ts, and the
  -- duplication is deliberate for the same reason gym_today() repeats the
  -- timezone: the check has to run inside the database, where no
  -- TypeScript constant can reach it. A member holds a publishable key
  -- and can POST straight to PostgREST, so a bound enforced only in the
  -- server action is not enforced.
  --
  -- The floor is 2, not 1. A goal of one day is met by the act of
  -- setting it, which makes it a button that congratulates you for
  -- pressing it. The ceiling is 365, the largest milestone the app
  -- celebrates and already a year of never missing an open day.
  constraint member_goals_range
    check (streak_goal >= 2 and streak_goal <= 365)
);

-- ---------------------------------------------------------------------
-- Row-level security.
--
-- The client holds a publishable key and can talk to PostgREST directly,
-- so these policies are the enforcement — not the server action that
-- happens to call them. Anything checked only in TypeScript is not
-- checked.
-- ---------------------------------------------------------------------
alter table public.member_goals enable row level security;

revoke all on public.member_goals from anon, authenticated;
grant select, insert, update, delete on public.member_goals to authenticated;

drop policy if exists member_goals_select_own on public.member_goals;
create policy member_goals_select_own
  on public.member_goals for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists member_goals_insert_own on public.member_goals;
create policy member_goals_insert_own
  on public.member_goals for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Raising or lowering the target. Both halves check ownership: `using`
-- decides which row you may touch, `with check` decides what it may
-- become — without the second, a member could reassign their row to
-- somebody else's user_id and set a goal on their behalf.
drop policy if exists member_goals_update_own on public.member_goals;
create policy member_goals_update_own
  on public.member_goals for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Clearing it. A goal you can set and never unset is a trap: the page
-- would go on measuring somebody against a number they have stopped
-- caring about, with no way back to the app's own milestones.
--
-- Deleting is right here where it would be wrong on `bookings`. A
-- cancelled booking is a fact about a class somebody may need to look
-- up; a withdrawn goal is a fact about nothing.
drop policy if exists member_goals_delete_own on public.member_goals;
create policy member_goals_delete_own
  on public.member_goals for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Tell PostgREST the table exists. Without this the API keeps answering
-- PGRST205 from a cached schema until it happens to reload, and the
-- feature stays invisible for minutes after a successful migration.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Confirmation. A bare DDL run reports "Success. No rows returned",
-- which is indistinguishable from having run nothing at all.
-- ---------------------------------------------------------------------
select
  to_regclass('public.member_goals') is not null            as table_created,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'member_goals') as policies_created,
  (select count(*) from pg_constraint
     where conname = 'member_goals_range')                  as check_created,
  (select count(*) from public.member_goals)                as rows_now;
