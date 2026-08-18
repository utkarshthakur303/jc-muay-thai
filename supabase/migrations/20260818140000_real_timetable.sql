-- ---------------------------------------------------------------------
-- The timetable becomes the gym's real one.
--
-- WHAT WAS WRONG. `class_occurrences` was generated from a weekly pattern
-- that was close to the gym's real schedule but wrong in four places,
-- each of which is a member turning up to a class that does not exist:
--
--   fri-1600-open-gym       There is no open gym. It was invented for the
--                           mockup, and the gym is shut by 1:30 on a
--                           Friday, so it could not have run anyway.
--   mon-1600-kids           Kids run Tue/Wed/Thu, not Monday. The old
--                           site says so in its schedule; a blurb higher
--                           up the same page contradicts it, and the
--                           client confirmed the schedule.
--   sat-1800-intermediate   The old site says "no Saturdays" against
--   sat-1900-advanced       every evening class.
--
-- And four slugs ran 60 minutes where Advanced actually runs 90, morning
-- and evening, every day — sending a fighter home half an hour early.
--
-- WHAT IS DELETED, AND WHAT IS NOT.
--
--   FUTURE occurrences of the four retired slugs are deleted. 29 rows,
--   and it was verified against this database before writing this file
--   that NOT ONE of them carries a booking or a non-zero booked_count.
--
--   PAST occurrences are kept — all 8 of them. They are the record of
--   what the site once offered, they are what a member's booking history
--   points at, and deleting history to tidy a mistake makes the mistake
--   unauditable. The `where starts_at > now()` below is doing real work.
--
--   The delete is written to REFUSE rather than cascade if a booking
--   appears between this being written and being run. A row with a
--   booking on it is somebody's Saturday evening, and it needs a human
--   deciding to tell them, not a migration silently removing it.
--
-- WHAT IS CREATED. tue-1600-kids, which the real timetable has and this
-- database has never had. Generated here rather than left to the app: the
-- horizon already reaches 60 days out, so nothing would have refilled for
-- another two weeks, and the site would have advertised a Tuesday kids'
-- class with no bookable row behind it. (src/lib/booking/horizon.ts has
-- also been taught to notice this case — see the coverage check there.)
-- ---------------------------------------------------------------------

-- ── 1. Retire the four invented sessions ────────────────────────────

-- Refuse rather than cascade. If this raises, a booking landed on a class
-- that is being retired: find it, tell the member, then re-run.
do $$
declare
  blocked integer;
begin
  select count(*) into blocked
  from public.class_occurrences o
  join public.bookings b on b.occurrence_id = o.id
  where o.starts_at > now()
    and b.status = 'booked'
    and o.session_slug in (
      'fri-1600-open-gym',
      'mon-1600-kids',
      'sat-1800-intermediate',
      'sat-1900-advanced'
    );

  if blocked > 0 then
    raise exception
      'Refusing to delete: % future occurrence(s) of the retired sessions '
      'now carry live bookings. Contact those members first.', blocked;
  end if;
end $$;

delete from public.class_occurrences
where starts_at > now()
  and session_slug in (
    'fri-1600-open-gym',
    'mon-1600-kids',
    'sat-1800-intermediate',
    'sat-1900-advanced'
  );

-- ── 2. Advanced runs 90 minutes, not 60 ─────────────────────────────
--
-- ends_at is derived from starts_at rather than typed, so this cannot
-- drift across the daylight-saving boundary in early November: adding an
-- interval to a timestamptz moves the instant, which is what a 90-minute
-- class actually is.
--
-- Future only, again. A past class ran for however long it ran.
update public.class_occurrences
set ends_at = starts_at + interval '90 minutes'
where starts_at > now()
  and level = 'advanced'
  and ends_at = starts_at + interval '60 minutes';

-- ── 3. Kids on Tuesday ──────────────────────────────────────────────
--
-- Local wall-clock times converted per-date, not by adding hours to a
-- UTC instant — 4:00 PM in Jersey City is a different offset either side
-- of the DST change, and `at time zone` resolves each date on its own.
--
-- The 60-day window and the capacity of 16 both mirror the application:
-- HORIZON_DAYS in src/lib/booking/horizon.ts, and DEFAULT_CLASS_CAPACITY
-- in src/content/schedule.ts. That 16 is still the one invented number in
-- this project and is still flagged there.
insert into public.class_occurrences
  (session_slug, starts_at, ends_at, level, capacity)
select
  'tue-1600-kids',
  (d + time '16:00') at time zone 'America/New_York',
  (d + time '16:45') at time zone 'America/New_York',
  'kids',
  16
from generate_series(
  current_date,
  current_date + 60,
  interval '1 day'
) as d
where extract(dow from d) = 2   -- Tuesday
on conflict (session_slug, starts_at) do nothing;

-- ── Confirmation ────────────────────────────────────────────────────
-- Expect: retired_future 0 · retired_past 8 · short_advanced 0
--         tue_kids 8 or 9 · orphan_bookings 0
--
-- retired_past being 8 is the point: history survived. orphan_bookings
-- must be 0 — if it is not, a booking lost its class and somebody needs
-- telling.
select
  (select count(*) from public.class_occurrences
    where starts_at > now()
      and session_slug in ('fri-1600-open-gym', 'mon-1600-kids',
                           'sat-1800-intermediate', 'sat-1900-advanced')
  ) as retired_future,
  (select count(*) from public.class_occurrences
    where session_slug in ('fri-1600-open-gym', 'mon-1600-kids',
                           'sat-1800-intermediate', 'sat-1900-advanced')
  ) as retired_past,
  (select count(*) from public.class_occurrences
    where starts_at > now()
      and level = 'advanced'
      and ends_at - starts_at < interval '90 minutes'
  ) as short_advanced,
  (select count(*) from public.class_occurrences
    where session_slug = 'tue-1600-kids' and starts_at > now()
  ) as tue_kids,
  (select count(*) from public.bookings b
    where not exists (
      select 1 from public.class_occurrences o where o.id = b.occurrence_id
    )
  ) as orphan_bookings;
