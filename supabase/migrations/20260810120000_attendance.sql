-- Self-marked attendance, and the streak built on it.
--
-- WHAT THIS IS, AND WHAT IT IS NOT
--
-- Every row here is a member's own claim that they trained that day.
-- Nothing verifies it. There is no coach's register, no door scanner, no
-- check against whether they had booked anything — those were deliberately
-- left out of scope, and this table does not quietly pretend to be them.
--
-- That distinction has to survive into the UI, and it does: the account
-- page still says "classes booked" and never "attended", and everything
-- built on this table is labelled as self-marked. A number a member sets
-- themselves is a fine motivator and a terrible record. It must never
-- become the basis of a billing decision, a no-show policy, or anything
-- else with a consequence attached.
--
-- SHAPE
--
-- One row per member per calendar day, keyed on a DATE rather than a
-- timestamp. Attendance is a fact about a day, not an instant: "I trained
-- on the 10th" is the whole claim, and storing 14:32:07 alongside it would
-- invite someone to later treat the time as meaningful when it only ever
-- recorded when the button was pressed.
--
-- The date is the GYM's calendar date, never the visitor's. A member
-- checking in from a work trip in California at 10pm Pacific is marking
-- the gym's tomorrow if we use their clock, which would let them mark two
-- days in one evening and break the streak's meaning. See gym_today().

create table if not exists public.attendance (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,

  -- Gym-local civil date. See gym_today() below.
  attended_on date        not null,

  created_at  timestamptz not null default now(),

  -- One claim per day. Without this, a member holding the button down
  -- inflates their own total — harmless to anyone else, but it makes the
  -- streak arithmetic wrong, since the streak counts distinct days.
  constraint attendance_one_per_day unique (user_id, attended_on)
);

-- Every read is "this member's dates, newest first". The composite index
-- serves that ordering directly, so the query never sorts.
create index if not exists attendance_user_date_idx
  on public.attendance (user_id, attended_on desc);

-- ---------------------------------------------------------------------
-- gym_today()
--
-- The gym's current calendar date.
--
-- The zone is written out here as a literal, which duplicates
-- `site.timeZone` in src/content/site.ts. That duplication is deliberate
-- and it is the lesser evil: the row-level security policies below have to
-- decide "is this today?" inside the database, where no TypeScript
-- constant can reach them. Moving the check into application code instead
-- would mean a member could POST any date they liked straight to PostgREST
-- and backdate a streak.
--
-- If the gym ever moves, both places change together. There are exactly
-- two, and this comment is the other one's signpost.
-- ---------------------------------------------------------------------
create or replace function public.gym_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/New_York')::date;
$$;

-- ---------------------------------------------------------------------
-- Row-level security.
--
-- The client holds a publishable key and can talk to PostgREST directly,
-- so these policies are the enforcement — not the server actions that
-- happen to call them. Anything checked only in TypeScript is not checked.
-- ---------------------------------------------------------------------
alter table public.attendance enable row level security;

revoke all on public.attendance from anon, authenticated;
grant select, insert, delete on public.attendance to authenticated;

drop policy if exists attendance_select_own on public.attendance;
create policy attendance_select_own
  on public.attendance for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Today only, and only for yourself.
--
-- The date restriction is the load-bearing half. A streak that can be
-- filled in retrospectively is not a streak, it is a form — and the whole
-- motivational premise is that the row records something that happened on
-- the day it says it did. Turning up is the only way to extend it.
drop policy if exists attendance_insert_today on public.attendance;
create policy attendance_insert_today
  on public.attendance for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and attended_on = public.gym_today()
  );

-- Undo, for the mis-tap. Also today only: a member may take back what they
-- just claimed, and may not quietly delete a day from their own history
-- weeks later to reshape a streak.
--
-- Unlike bookings, which are never deleted because a cancelled booking is
-- a fact somebody may need to look up, an un-done check-in is not a fact
-- about anything. It is a claim withdrawn within the day it was made, and
-- keeping a tombstone for it would serve nobody.
drop policy if exists attendance_delete_today on public.attendance;
create policy attendance_delete_today
  on public.attendance for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and attended_on = public.gym_today()
  );

-- No update policy. A row here has exactly two states, present and absent,
-- and both transitions are covered above. An UPDATE could only ever move a
-- claim to a different day, which is backdating with extra steps.
