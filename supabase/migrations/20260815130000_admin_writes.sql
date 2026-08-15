-- The first writes an admin is allowed to make.
--
-- Everything in 20260815120000_admin_identity.sql was SELECT. That was
-- deliberate: read access shows the gym its own data, and getting it wrong
-- shows too much. Write access changes member-visible facts, and getting it
-- wrong changes them for real, so each power arrives in the migration for
-- the feature that needs it rather than being granted up front.
--
-- Two powers here, and no others:
--
--   1. Cancel (and un-cancel) a class that has not yet started.
--   2. Mark a contact enquiry as dealt with.
--
-- Both are scoped twice over — by row, through an RLS policy calling
-- `public.is_admin()`, and by *column*, through a column-level GRANT. The
-- second is the unusual one and it is the more useful: without it, a policy
-- that permits an admin to cancel a class also permits them to rewrite its
-- start time, its capacity, or its level, because RLS grants access to the
-- row and says nothing about which of its columns you touched. An admin has
-- no business editing a class's time from the cancel button, and after this
-- migration Postgres will refuse it rather than trusting the form not to
-- send the field.

/* ---------------------------------------------------------------
   1. CANCELLING A CLASS

   What cancelling does NOT do, on purpose: it does not touch anyone's
   booking. Those rows stay `status = 'booked'`, and /account already
   reads the occurrence's status to tell a member "the gym cancelled
   this one". Flipping the bookings instead would destroy the
   distinction between a class the gym called off and a class the
   member dropped out of — two facts that look identical afterwards
   and mean opposite things — and `booked_count` would have to be
   rebuilt to un-cancel. Leaving them alone makes restoring a class a
   single UPDATE that puts everything back exactly as it was.
   --------------------------------------------------------------- */

-- A note has to say something and has to fit on the screen it is shown on.
-- Enforced here as well as in the form, because the form is not the only
-- thing that can write this column.
--
-- Guarded rather than plain `add constraint`: Postgres has no
-- `add constraint if not exists`, and this file must survive being run
-- twice. Verified safe against production first — no occurrence has ever
-- carried a note, so there is nothing existing for it to reject.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'class_occurrences_note_length'
       and conrelid = 'public.class_occurrences'::regclass
  ) then
    alter table public.class_occurrences
      add constraint class_occurrences_note_length
      check (
        cancellation_note is null
        or char_length(trim(cancellation_note)) between 1 and 200
      );
  end if;
end
$$;

-- THE COLUMN GRANT. Two columns, and the write privilege ends there.
--
-- `starts_at`, `capacity`, `level` and `session_slug` are deliberately
-- absent. An occurrence is a historical fact once it has happened, and the
-- weekly pattern is what gets edited when the timetable changes — that
-- arrives in its own phase, with its own migration, and will need its own
-- grant. `booked_count` is absent too and must stay that way: it is
-- maintained by a SECURITY DEFINER trigger under a check constraint that
-- makes an oversold class unrepresentable, and a hand-written UPDATE is
-- exactly how that guarantee gets quietly broken.
grant update (status, cancellation_note)
  on table public.class_occurrences to authenticated;

drop policy if exists class_occurrences_admin_cancel on public.class_occurrences;
create policy class_occurrences_admin_cancel
  on public.class_occurrences for update
  to authenticated
  -- `starts_at > now()` is the second half of the rule and it is not
  -- cosmetic. Cancelling a class that already ran does not warn anybody;
  -- it rewrites what the gym did last Tuesday, and members' history along
  -- with it. The panel hides the button on a past class. This is what
  -- makes hiding it true.
  using (public.is_admin() and starts_at > now())
  with check (
    public.is_admin()
    and starts_at > now()
    and status in ('scheduled', 'cancelled')
  );

-- Still no insert or delete policy on this table. Generating the horizon
-- remains a server-side job holding the secret key, and an occurrence is
-- never deleted — a cancelled class is a thing that was announced and then
-- called off, which is not the same as one that never existed.

/* ---------------------------------------------------------------
   2. THE ENQUIRY INBOX

   `contact_messages` has had RLS enabled and zero policies since it
   was created, which under Postgres denies everything to everyone
   holding a publishable key. That was the right default while the
   only reader was a server action with the secret key.

   The inbox changes the audience, not the rule: exactly one person
   may read this table through PostgREST, and the policy is what says
   so. The anonymous insert path is untouched — the public form still
   writes with the secret key, and still cannot be posted to directly,
   which is what keeps its rate limit from being one curl loop away
   from meaningless.
   --------------------------------------------------------------- */

-- `ip_hash` is not in this list, and its absence is the point.
--
-- It is a salted digest of a visitor's IP that exists for exactly one
-- query — "how many messages from this origin in the last hour" — and the
-- inbox never asks it. A column nobody needs is a column that should not be
-- reachable, and leaving it out of the grant means Postgres refuses it
-- rather than the panel merely declining to render it.
grant select (id, created_at, name, email, message, handled_at)
  on table public.contact_messages to authenticated;

-- Marking one dealt with, and putting it back. Nothing else about an
-- enquiry can be edited: the gym does not get to reword what somebody
-- wrote to it.
grant update (handled_at)
  on table public.contact_messages to authenticated;

drop policy if exists contact_messages_read_for_admins on public.contact_messages;
create policy contact_messages_read_for_admins
  on public.contact_messages for select
  to authenticated
  using (public.is_admin());

drop policy if exists contact_messages_handle_for_admins on public.contact_messages;
create policy contact_messages_handle_for_admins
  on public.contact_messages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No delete policy, and no delete grant. An enquiry is somebody asking the
-- gym a question; `handled_at` is how it leaves the queue. A panel with a
-- delete button is a panel where a misread message disappears with no way
-- to find out what it said.

/* ---------------------------------------------------------------
   3. RELOAD

   PostgREST serves from a cached schema. Until it reloads, the new
   grants and policies do not exist as far as the API is concerned.
   --------------------------------------------------------------- */

notify pgrst, 'reload schema';

/* ---------------------------------------------------------------
   4. CONFIRMATION

   Expect: cancel_policy 1, inbox_policies 2, note_constraint 1,
   occurrence_update_cols 2, enquiry_select_cols 6, enquiry_update_cols 1.

   `enquiry_select_cols` is the one to read twice. If it says 7, the
   grant went to the whole table and `ip_hash` came with it.
   --------------------------------------------------------------- */

select
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename = 'class_occurrences'
      and policyname = 'class_occurrences_admin_cancel')            as cancel_policy,

  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename = 'contact_messages')                           as inbox_policies,

  (select count(*) from pg_constraint
    where conname = 'class_occurrences_note_length')                as note_constraint,

  (select count(*) from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'class_occurrences'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE')                                as occurrence_update_cols,

  (select count(*) from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'contact_messages'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT')                                as enquiry_select_cols,

  (select count(*) from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'contact_messages'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE')                                as enquiry_update_cols,

  (select count(*) from public.contact_messages)                    as enquiries_waiting;
