-- ---------------------------------------------------------------------
-- The weekly timetable moves out of the code and into the database.
--
-- Until now the pattern lived in src/content/schedule.ts, which meant
-- changing a class time was a code edit, a commit and a deploy — so in
-- practice it was done by hand in the Supabase console against
-- class_occurrences instead. That is exactly how the invented Friday
-- open gym and Saturday evening classes survived for three months, and
-- how nine kids' classes ended up at 8:00 AM. The owner needs to be able
-- to change the timetable himself, in one place, with the consequences
-- made visible.
--
-- TWO TABLES, TWO JOBS, AND THE DISTINCTION MATTERS:
--
--   class_sessions      the PATTERN. "Beginners, Mondays, 9-10."
--                       34 rows. Editable by the owner.
--
--   class_occurrences   DATED CLASSES. "Beginners, Mon 24 Aug, 9-10."
--                       ~300 rows, generated from the pattern, and the
--                       thing bookings actually point at.
--
-- Editing the pattern regenerates future occurrences — but never one a
-- member has already booked. That rule is enforced in the service layer
-- and is the whole reason this is not a cascade.
--
-- WHY capacity LIVES HERE. DEFAULT_CLASS_CAPACITY = 16 has been the one
-- invented number in this project since launch, flagged in every handover
-- and never answered, because there was nowhere to put the real one. Now
-- there is: capacity is per session, so a kids' class and an advanced
-- class can differ, and the owner can correct it without a deploy. 16 is
-- carried across as the starting value for every row — still a guess, but
-- now a guess with an edit box next to it.
-- ---------------------------------------------------------------------

create table if not exists public.class_sessions (
  id          uuid primary key default gen_random_uuid(),

  -- Sunday is deliberately not permitted. The gym is closed, and a
  -- session on a closed day would generate occurrences nobody can attend
  -- — the same class of bug as the Friday evening classes.
  day         text not null
    constraint class_sessions_day_known
    check (day in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat')),

  level       text not null
    constraint class_sessions_level_known
    check (level in ('beginner', 'intermediate', 'advanced', 'kids')),

  -- Gym-local wall clock, not an instant. A class is "9 AM on a Monday"
  -- all year; the UTC instant that corresponds to moves with daylight
  -- saving, and resolving it per-date is the generator's job.
  starts_at   time not null,
  ends_at     time not null,

  capacity    integer not null default 16
    constraint class_sessions_capacity_sane
    check (capacity between 1 and 200),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint class_sessions_ends_after_starts check (ends_at > starts_at),

  -- The uniqueness that session_slug depends on. Two sessions sharing a
  -- day, start and level would produce one slug for two classes, which
  -- booking cannot tell apart.
  constraint class_sessions_no_duplicate unique (day, starts_at, level)
);

comment on table public.class_sessions is
  'The weekly timetable pattern. Dated, bookable classes live in '
  'class_occurrences and are generated from these rows.';

-- ── Seed: the 34 sessions currently in src/content/schedule.ts ───────
-- Generated from that file rather than retyped, so day one changes
-- nothing on screen. Idempotent.
insert into public.class_sessions (day, level, starts_at, ends_at, capacity)
values
  ('mon', 'beginner', TIME '09:00', TIME '10:00', 16),
  ('mon', 'intermediate', TIME '10:00', TIME '11:00', 16),
  ('mon', 'advanced', TIME '11:00', TIME '12:30', 16),
  ('mon', 'beginner', TIME '17:00', TIME '18:00', 16),
  ('mon', 'intermediate', TIME '18:00', TIME '19:00', 16),
  ('mon', 'advanced', TIME '19:00', TIME '20:30', 16),
  ('tue', 'beginner', TIME '09:00', TIME '10:00', 16),
  ('tue', 'intermediate', TIME '10:00', TIME '11:00', 16),
  ('tue', 'advanced', TIME '11:00', TIME '12:30', 16),
  ('tue', 'kids', TIME '16:00', TIME '16:45', 16),
  ('tue', 'beginner', TIME '17:00', TIME '18:00', 16),
  ('tue', 'intermediate', TIME '18:00', TIME '19:00', 16),
  ('tue', 'advanced', TIME '19:00', TIME '20:30', 16),
  ('wed', 'beginner', TIME '09:00', TIME '10:00', 16),
  ('wed', 'intermediate', TIME '10:00', TIME '11:00', 16),
  ('wed', 'advanced', TIME '11:00', TIME '12:30', 16),
  ('wed', 'kids', TIME '16:00', TIME '16:45', 16),
  ('wed', 'beginner', TIME '17:00', TIME '18:00', 16),
  ('wed', 'intermediate', TIME '18:00', TIME '19:00', 16),
  ('wed', 'advanced', TIME '19:00', TIME '20:30', 16),
  ('thu', 'beginner', TIME '09:00', TIME '10:00', 16),
  ('thu', 'intermediate', TIME '10:00', TIME '11:00', 16),
  ('thu', 'advanced', TIME '11:00', TIME '12:30', 16),
  ('thu', 'kids', TIME '16:00', TIME '16:45', 16),
  ('thu', 'beginner', TIME '17:00', TIME '18:00', 16),
  ('thu', 'intermediate', TIME '18:00', TIME '19:00', 16),
  ('thu', 'advanced', TIME '19:00', TIME '20:30', 16),
  ('fri', 'beginner', TIME '09:00', TIME '10:00', 16),
  ('fri', 'intermediate', TIME '10:00', TIME '11:00', 16),
  ('fri', 'advanced', TIME '11:00', TIME '12:30', 16),
  ('sat', 'beginner', TIME '09:00', TIME '10:00', 16),
  ('sat', 'intermediate', TIME '10:00', TIME '11:00', 16),
  ('sat', 'advanced', TIME '11:00', TIME '12:30', 16),
  ('sat', 'kids', TIME '13:00', TIME '13:45', 16)
on conflict (day, starts_at, level) do nothing;

-- ── RLS ─────────────────────────────────────────────────────────────

alter table public.class_sessions enable row level security;

-- The timetable is public information — it is printed on the home page
-- and readable by a visitor with no account at all. anon included, on
-- purpose: the home page is statically prerendered and must not need a
-- session to render the schedule.
drop policy if exists class_sessions_read_all on public.class_sessions;
create policy class_sessions_read_all
  on public.class_sessions for select
  to anon, authenticated
  using (true);

drop policy if exists class_sessions_admin_insert on public.class_sessions;
create policy class_sessions_admin_insert
  on public.class_sessions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists class_sessions_admin_update on public.class_sessions;
create policy class_sessions_admin_update
  on public.class_sessions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists class_sessions_admin_delete on public.class_sessions;
create policy class_sessions_admin_delete
  on public.class_sessions for delete
  to authenticated
  using (public.is_admin());

grant select on table public.class_sessions to anon, authenticated;
grant insert (day, level, starts_at, ends_at, capacity)
  on table public.class_sessions to authenticated;
grant update (day, level, starts_at, ends_at, capacity, updated_at)
  on table public.class_sessions to authenticated;
grant delete on table public.class_sessions to authenticated;

-- ── Occurrences: admins may now create and retire dated classes ──────
--
-- Previously only the service-role key could write these rows, from
-- ensureHorizon. The timetable editor has to do it as the signed-in
-- owner instead, so that RLS is the enforcement rather than a server
-- action remembering to check — a standing rule of this project.
--
-- The DELETE policy is bounded to FUTURE occurrences. A past class is
-- the record of what actually ran and what somebody booked; no edit to
-- next month's timetable may rewrite it.
drop policy if exists class_occurrences_admin_insert on public.class_occurrences;
create policy class_occurrences_admin_insert
  on public.class_occurrences for insert
  to authenticated
  with check (public.is_admin() and starts_at > now());

drop policy if exists class_occurrences_admin_delete on public.class_occurrences;
create policy class_occurrences_admin_delete
  on public.class_occurrences for delete
  to authenticated
  using (public.is_admin() and starts_at > now());

grant insert (session_slug, starts_at, ends_at, level, capacity)
  on table public.class_occurrences to authenticated;
grant delete on table public.class_occurrences to authenticated;

-- capacity was not previously updatable by anyone but the service role.
-- The editor needs it so that changing a session's capacity can be
-- pushed onto the classes already generated from it.
grant update (capacity) on table public.class_occurrences to authenticated;

notify pgrst, 'reload schema';

-- ── Confirmation ────────────────────────────────────────────────────
-- Expect: sessions 34 · policies 4 · occ_policies 2 · sunday 0 · dupes 0
select
  (select count(*) from public.class_sessions)                as sessions,
  (select count(*) from pg_policies
     where tablename = 'class_sessions')                      as policies,
  (select count(*) from pg_policies
     where tablename = 'class_occurrences'
       and policyname in ('class_occurrences_admin_insert',
                          'class_occurrences_admin_delete'))  as occ_policies,
  (select count(*) from public.class_sessions
     where day = 'sun')                                       as sunday,
  (select count(*) from (
     select day, starts_at, level from public.class_sessions
     group by day, starts_at, level having count(*) > 1) x)   as dupes;
