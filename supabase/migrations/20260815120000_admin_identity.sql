-- Admin identity, and the member directory the admin panel reads.
--
-- WHY THIS EXISTS
--
-- Until now every policy in this database has said the same thing:
-- `user_id = auth.uid()`. Own rows, nothing else. That is the correct
-- default and it is why there has never been a way for anyone to read
-- another member's bookings — including the gym.
--
-- The admin panel needs exactly that, so this migration introduces the
-- first asymmetry in the schema. It is deliberately small: one table of
-- admin user ids, one function to ask the question, and read-only policies
-- that call it. Nothing here grants an admin the ability to write to member
-- data; that arrives per-feature, in the migration that needs it, so each
-- new power is visible in the diff that adds it.
--
-- WHERE THE ENFORCEMENT LIVES
--
-- Inside these policies, not in TypeScript. The browser holds a publishable
-- key and can reach PostgREST directly, so a panel that checked `isAdmin`
-- only in a Server Component would be a panel whose data was readable by
-- anyone with a session and curl. Every admin read below is gated by
-- `public.is_admin()` at the row level.

/* ---------------------------------------------------------------
   1. WHO IS AN ADMIN
   --------------------------------------------------------------- */

create table if not exists public.admins (
  user_id    uuid        primary key
    references auth.users (id) on delete cascade,

  -- Free text, for whoever reads this table in a year: 'Gym owner',
  -- 'Front desk'. Not a role — there is exactly one level of admin and
  -- inventing a second before anyone has asked for it would mean writing
  -- policies for a distinction nobody has defined.
  note       text,

  created_at timestamptz not null default now()
);

/**
 * The question, asked in one place.
 *
 * SECURITY DEFINER is not incidental here, it is what makes this work at
 * all. The policy on `admins` below calls this function, and this function
 * reads `admins` — under a normal function that is infinite recursion, and
 * Postgres will say so. Running as the owner bypasses RLS on the table it
 * reads, which breaks the cycle.
 *
 * STABLE, so the planner calls it once per statement rather than once per
 * row. On a roster query that is the difference between one lookup and one
 * per booking.
 *
 * `set search_path = public` because a SECURITY DEFINER function without a
 * pinned search path is the classic Postgres privilege-escalation hole: a
 * caller who can create a schema earlier in the path chooses what `admins`
 * means.
 */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

-- EXECUTE is granted to PUBLIC by default on new functions. Narrow it:
-- anon has no session, so the answer is always false, but a function that
-- reads a privilege table should not be callable by an unauthenticated
-- caller at all.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.admins enable row level security;

revoke all on table public.admins from anon, authenticated;
grant select on table public.admins to authenticated;

-- An admin may see who else is an admin. Nobody else learns the table has
-- rows in it.
drop policy if exists admins_read_for_admins on public.admins;
create policy admins_read_for_admins
  on public.admins for select
  to authenticated
  using (public.is_admin());

-- No insert, update or delete policy, and that is the point.
--
-- Granting admin is the one operation in this system that can hand over
-- every member's data, so it does not belong in a web form — a panel that
-- can create admins turns any session hijack into permanent access. It is
-- a deliberate SQL statement run by whoever holds the database, which is
-- the same person who ran this migration.

/* ---------------------------------------------------------------
   2. THE MEMBER DIRECTORY

   A roster has to show names, and names live in
   `auth.users.raw_user_meta_data` — a schema PostgREST does not expose and
   should not. Rather than reaching for the secret key on every admin page
   and losing RLS as the enforcement, the two fields the panel actually
   needs are mirrored into a public table that policies can reach.

   This table is a mirror, never a source. Nothing but the trigger writes
   to it: there are no client insert, update or delete grants at all, so a
   member cannot rename themselves here and have it disagree with the
   account they log in with. Changing a name means changing it in auth,
   and the trigger follows.
   --------------------------------------------------------------- */

create table if not exists public.profiles (
  user_id    uuid        primary key
    references auth.users (id) on delete cascade,

  -- Collected at sign-up (`options.data.full_name`). Nullable because an
  -- account created straight from the Supabase dashboard — which is how
  -- the gym's own admin account gets made — has no metadata at all, and a
  -- roster showing a blank name is better than one refusing to load.
  full_name  text,

  -- Mirrored so the panel can identify an account whose name is missing,
  -- and so "who is this booking" is answerable without the auth admin API.
  email      text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Everyone, alphabetically" is the member directory's only sort.
create index if not exists profiles_full_name_idx
  on public.profiles (full_name);

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, created_at, updated_at)
  values (
    new.id,
    -- A name of '' or '   ' is not a name. Normalising here means the
    -- panel checks for null and nothing else.
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    new.email,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (user_id) do update
     set full_name  = excluded.full_name,
         email      = excluded.email,
         updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_changed on auth.users;
create trigger on_auth_user_changed
  -- INSERT for new sign-ups. UPDATE narrowed to the two columns actually
  -- mirrored, so a token refresh or a last-sign-in touch — which happen
  -- constantly — does not fire a write.
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();

-- Backfill. The trigger only sees changes from here on, and there are four
-- real members who signed up in August and would otherwise be invisible to
-- the panel that exists to show them.
insert into public.profiles (user_id, full_name, email, created_at, updated_at)
select
  id,
  nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
  email,
  coalesce(created_at, now()),
  now()
from auth.users
on conflict (user_id) do update
   set full_name  = excluded.full_name,
       email      = excluded.email,
       updated_at = now();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

-- Select only, for both audiences. The trigger is the only writer.
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own
  on public.profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists profiles_read_all_for_admins on public.profiles;
create policy profiles_read_all_for_admins
  on public.profiles for select
  to authenticated
  using (public.is_admin());

/* ---------------------------------------------------------------
   3. WHAT AN ADMIN MAY READ

   Additive only. Every existing "own rows" policy stays exactly as it is —
   these are extra SELECT policies, and Postgres ORs them together, so a
   member's access is unchanged and an admin gets a second way in.

   Read, and nothing else. Cancelling classes, setting discounts and
   editing the timetable all need writes, and each arrives with the
   migration for that feature rather than being granted up front.
   --------------------------------------------------------------- */

drop policy if exists bookings_read_all_for_admins on public.bookings;
create policy bookings_read_all_for_admins
  on public.bookings for select
  to authenticated
  using (public.is_admin());

drop policy if exists member_plans_read_all_for_admins on public.member_plans;
create policy member_plans_read_all_for_admins
  on public.member_plans for select
  to authenticated
  using (public.is_admin());

-- `class_occurrences` deliberately absent: its existing policy is
-- `using (true)` for every signed-in user, because a dated timetable is
-- already public information. An admin can read it today.
--
-- `attendance` deliberately absent too, and this one is a product decision
-- rather than an oversight. Every row in that table is a member's own
-- unverified claim that they trained, and its migration states it must
-- never become the basis of a billing or no-show decision. Putting it in
-- front of the person who takes the money is how it quietly becomes one.
-- If the gym ever asks for it, that is a conversation, not a policy.

/* ---------------------------------------------------------------
   4. THE FIRST ADMIN

   Resolved by email rather than by a pasted uuid, so this runs correctly
   whether or not the account exists yet. If it has not been created, this
   inserts nothing and the confirmation below reports `admin_found: false`
   — create the account, then re-run just this statement. That is exactly
   what happened on the first run (2026-08-15), and it is the reason the
   statement is written this way.
   --------------------------------------------------------------- */

/**
 * THE ADDRESS CHANGED BETWEEN WRITING THIS AND RUNNING IT.
 *
 * Originally `admin@jcmuaythai.com`. The client created
 * `jcmuaythaiofficial@gmail.com` instead, which is the better choice and
 * not merely a substitution: the original was a role address on a domain
 * with no evidence of receiving mail, and an admin account whose password
 * cannot be reset is one lockout away from nobody being able to
 * administer the gym. A real mailbox also means the cancellation emails
 * agreed for a later phase have somewhere to come from and go back to.
 *
 * The account was made in the Supabase dashboard with Auto Confirm ticked,
 * so it has no `full_name` in its metadata and its profile row carries a
 * null name. That is handled rather than fixed — see the column comment on
 * profiles.full_name.
 */
insert into public.admins (user_id, note)
select id, 'Gym owner'
from auth.users
where email = 'jcmuaythaiofficial@gmail.com'
on conflict (user_id) do nothing;

-- PostgREST serves from a cached copy of the schema. Until it reloads,
-- every request for these tables returns PGRST205 and the app reads that
-- as "the migration has not been run".
notify pgrst, 'reload schema';

/* ---------------------------------------------------------------
   5. CONFIRMATION

   A bare DDL run reports "Success. No rows returned", which is
   indistinguishable from having run nothing at all.

   `admin_found` is the one to check. If it is false, the tables are all
   correctly in place and nobody can get into the panel yet.
   --------------------------------------------------------------- */

select
  (select count(*) from public.admins)                             as admins_now,
  (select exists (
     select 1 from public.admins a
       join auth.users u on u.id = a.user_id
      where u.email = 'jcmuaythaiofficial@gmail.com'))             as admin_found,
  (select count(*) from public.profiles)                           as profiles_backfilled,
  (select count(*) from auth.users)                                as accounts_total,
  (select count(*) from pg_policies
     where schemaname = 'public'
       and tablename in ('admins', 'profiles', 'bookings', 'member_plans'))
                                                                   as policies_total,
  (select count(*) from pg_trigger
     where tgname = 'on_auth_user_changed' and not tgisinternal)    as sync_trigger;
