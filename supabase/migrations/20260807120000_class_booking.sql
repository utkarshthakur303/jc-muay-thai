-- Class booking.
--
-- Two tables. `class_occurrences` are concrete, dated instances of the
-- weekly pattern in src/content/schedule.ts; `bookings` join a member to
-- one of them.
--
-- Why occurrences exist at all, rather than keying bookings on
-- (session, date) and computing the rest: a timetable is a pattern, and
-- everything that actually happens to a gym is an exception to it. A coach
-- is away, a holiday falls on a Monday, the summer schedule thins out — the
-- site's own copy warns about that last one. You cannot attach an exception
-- to a row that does not exist, so the pattern is materialised into rows on
-- a rolling horizon and exceptions become ordinary edits.
--
-- Occurrences are also self-contained: level and capacity are copied in
-- rather than looked up. An occurrence is a historical fact once it has
-- happened, and editing the pattern must not rewrite what a member attended
-- three months ago.

create table if not exists public.class_occurrences (
  id            uuid primary key default gen_random_uuid(),

  -- Lineage back to the weekly pattern, e.g. 'mon-1900-advanced'. Not a
  -- foreign key: the pattern lives in TypeScript today and moves to a table
  -- when the admin dashboard is built. Occurrences do not change shape
  -- either way, which is the point of keeping this a plain string.
  session_slug  text        not null,

  -- UTC instants. Gym-local wall time is a display concern; storing local
  -- time would make "which classes are in the next 24 hours" wrong twice a
  -- year, in opposite directions.
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,

  level         text        not null,
  capacity      smallint    not null,
  booked_count  smallint    not null default 0,

  status        text        not null default 'scheduled',
  -- Shown to members whose booking is affected, e.g. "Coach away".
  cancellation_note text,

  created_at    timestamptz not null default now(),

  constraint class_occurrences_ends_after_start check (ends_at > starts_at),
  constraint class_occurrences_capacity_positive check (capacity > 0),
  constraint class_occurrences_status_known
    check (status in ('scheduled', 'cancelled')),

  -- THE constraint that makes overselling impossible.
  --
  -- Capacity cannot be enforced by reading a count and then inserting: two
  -- members hitting Book in the same instant both read the same count and
  -- both pass. The trigger below turns every booking into an UPDATE of this
  -- column, which takes a row lock, which serialises those two requests —
  -- and then this check refuses the one that would go over. The race is not
  -- mitigated, it is removed: an oversold class cannot be represented.
  constraint class_occurrences_not_oversold
    check (booked_count >= 0 and booked_count <= capacity),

  -- Regenerating the horizon is idempotent because of this.
  constraint class_occurrences_unique_slot unique (session_slug, starts_at)
);

-- "What can I book in the next fortnight" — the only query this table
-- serves at any volume.
create index if not exists class_occurrences_starts_at_idx
  on public.class_occurrences (starts_at)
  where status = 'scheduled';

create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null
    references public.class_occurrences (id) on delete cascade,
  user_id       uuid not null
    references auth.users (id) on delete cascade,

  status        text not null default 'booked',
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,

  constraint bookings_status_known check (status in ('booked', 'cancelled')),

  -- One row per member per class, forever. Cancelling flips the status; it
  -- does not delete. Re-booking flips it back. This is what stops a member
  -- taking two spots, and it keeps the history intact — a booking that was
  -- made and dropped is a different fact from one that never happened.
  constraint bookings_one_per_member unique (occurrence_id, user_id)
);

create index if not exists bookings_user_idx
  on public.bookings (user_id, created_at desc);

create index if not exists bookings_occurrence_idx
  on public.bookings (occurrence_id);

/* ---------------------------------------------------------------
   OCCUPANCY

   booked_count is derived, and derived data that anything but the
   database maintains will drift. A trigger keeps it exact, and the
   check constraint above makes the wrong value impossible to commit
   rather than merely unlikely.

   SECURITY DEFINER because the member doing the booking has no write
   access to class_occurrences and must not be given any — the only
   write they are allowed to cause is this one, through this path.
   --------------------------------------------------------------- */
create or replace function public.sync_occurrence_booked_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'booked' then
      update public.class_occurrences
         set booked_count = booked_count + 1
       where id = new.occurrence_id;
    end if;

  elsif tg_op = 'UPDATE' then
    -- Only a status transition moves the count. Touching any other column
    -- must not.
    if old.status is distinct from new.status then
      update public.class_occurrences
         set booked_count = booked_count + case when new.status = 'booked' then 1 else -1 end
       where id = new.occurrence_id;
    end if;

  elsif tg_op = 'DELETE' then
    if old.status = 'booked' then
      update public.class_occurrences
         set booked_count = booked_count - 1
       where id = old.occurrence_id;
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists bookings_sync_occupancy on public.bookings;
create trigger bookings_sync_occupancy
  after insert or update or delete on public.bookings
  for each row execute function public.sync_occurrence_booked_count();

/* ---------------------------------------------------------------
   ROW-LEVEL SECURITY

   This is the first per-member data in the project. Everything before
   it was written with the secret key, which bypasses RLS entirely.
   Bookings are the opposite: the server actions run as the signed-in
   member, so these policies are the actual enforcement, not a second
   opinion. A mistake here shows one member another member's schedule.
   --------------------------------------------------------------- */

alter table public.class_occurrences enable row level security;
alter table public.bookings enable row level security;

revoke all on table public.class_occurrences from anon, authenticated;
revoke all on table public.bookings from anon, authenticated;

grant select on table public.class_occurrences to authenticated;
grant select, insert, update on table public.bookings to authenticated;

-- Anyone signed in may read the timetable. There is nothing private in an
-- occurrence: it is the same schedule already published on the home page,
-- with a date attached.
create policy "members read class occurrences"
  on public.class_occurrences for select
  to authenticated
  using (true);

-- No insert, update or delete policy on class_occurrences, deliberately.
-- Generating the horizon and cancelling a class are server-side jobs that
-- use the secret key. Under RLS, no policy means no access.

create policy "members read own bookings"
  on public.bookings for select
  to authenticated
  using (user_id = (select auth.uid()));

-- The booking rule, stated once, in the place that cannot be bypassed:
-- you may book a class that has not started, is not cancelled, and is
-- your own.
--
-- The server action checks the same things to produce a decent error
-- message. It is not the enforcement — a member holds a publishable key
-- and their own JWT, and can talk to PostgREST directly.
create policy "members book for themselves"
  on public.bookings for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'booked'
    and exists (
      select 1
        from public.class_occurrences o
       where o.id = occurrence_id
         and o.status = 'scheduled'
         and o.starts_at > now()
    )
  );

-- Cancelling, and re-booking something previously cancelled. Same window:
-- until the class starts. There is deliberately no cutoff beyond that —
-- a cutoff exists to stop a spot being freed too late for anyone else to
-- take it, which is a problem this gym does not have yet. Adding one later
-- is a policy edit; explaining an arbitrary two-hour rule to a member
-- standing outside is not.
create policy "members change own bookings"
  on public.bookings for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.class_occurrences o
       where o.id = occurrence_id
         and o.starts_at > now()
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.class_occurrences o
       where o.id = occurrence_id
         and o.status = 'scheduled'
         and o.starts_at > now()
    )
  );

-- No delete policy. A booking is history; it is never removed.
