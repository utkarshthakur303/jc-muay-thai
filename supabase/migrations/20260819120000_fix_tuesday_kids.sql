-- ---------------------------------------------------------------------
-- Delete nine phantom kids' classes at 8:00 AM on Tuesdays.
--
-- WHAT HAPPENED. The Tuesday-kids insert in 20260818140000 built its
-- timestamps with `(d + time '16:00') at time zone 'America/New_York'`,
-- where `d` came from `generate_series(current_date, …)`. That returns
-- TIMESTAMPTZ, not timestamp — `date` casts implicitly to both, and
-- timestamptz is the preferred type, so overload resolution picks it.
--
-- `AT TIME ZONE` then means the opposite of what was intended:
--
--   timestamp   AT TIME ZONE z  ->  timestamptz   interprets AS z   (wanted)
--   timestamptz AT TIME ZONE z  ->  timestamp     converts TO z     (got)
--
-- So 16:00 UTC became the naive local 12:00, and inserting a naive
-- timestamp into a timestamptz column reinterpreted it as 12:00 UTC —
-- 08:00 in Jersey City. Nine classes, eight hours early, every one of
-- them a perfectly ordinary-looking row.
--
-- The correct 16:00 rows already exist: the application's own generator
-- created them from the timetable in src/content/schedule.ts, which is
-- why this migration only deletes and does not re-insert. Nothing needs
-- to be rebuilt.
--
-- Verified before writing this: all nine have booked_count = 0 and carry
-- no bookings at all. They existed for roughly twenty minutes.
--
-- WHY THE PREDICATE IS A TIME COMPARISON rather than a list of ids. Ids
-- would be exact but unreadable, and would silently do nothing if this
-- were ever run against a database where the bad rows had different ids.
-- Asking "which of these rows disagrees with its own slug" is the actual
-- invariant, so it is self-correcting and safe to run twice.
-- ---------------------------------------------------------------------

-- Refuse rather than cascade, on the same principle as the migration that
-- caused this: a row with a booking on it is somebody's Tuesday.
do $$
declare
  blocked integer;
begin
  select count(*) into blocked
  from public.class_occurrences o
  join public.bookings b on b.occurrence_id = o.id
  where b.status = 'booked'
    and o.session_slug = 'tue-1600-kids'
    and (o.starts_at at time zone 'America/New_York')::time <> time '16:00';

  if blocked > 0 then
    raise exception
      'Refusing to delete: % phantom kids class(es) carry live bookings. '
      'Contact those members first.', blocked;
  end if;
end $$;

delete from public.class_occurrences
where session_slug = 'tue-1600-kids'
  and (starts_at at time zone 'America/New_York')::time <> time '16:00';

-- ── Confirmation ────────────────────────────────────────────────────
-- Expect: phantom_rows 0 · correct_rows 9 · wrong_time_anywhere 0
--
-- The third column is the general form of the bug and checks the WHOLE
-- table, not just Tuesdays: every occurrence's real gym-local start time
-- must match the HHMM written into its own session_slug. That is the
-- assertion nobody had, and it is what would have caught this in seconds.
select
  (select count(*) from public.class_occurrences
    where session_slug = 'tue-1600-kids'
      and (starts_at at time zone 'America/New_York')::time <> time '16:00'
  ) as phantom_rows,
  (select count(*) from public.class_occurrences
    where session_slug = 'tue-1600-kids'
  ) as correct_rows,
  (select count(*) from public.class_occurrences
    where to_char(starts_at at time zone 'America/New_York', 'HH24MI')
          <> split_part(session_slug, '-', 2)
  ) as wrong_time_anywhere;
