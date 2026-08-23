-- The gym's advertised prices move into the database.
--
-- ── WHAT THIS REVERSES, AND WHAT IT DOES NOT ────────────────────────
--
-- On 2026-08-17 the decision was that plan definitions stay in code
-- (`src/content/plans.ts`) and out of the database. That decision still
-- holds for almost all of it. What moves here is FOUR NUMBERS and
-- nothing else:
--
--     price_cents           the advertised monthly rate
--     contract_price_cents  the rate on a 12-week contract, or none
--
-- What deliberately stays in code, and why:
--
--   slug        it is `LevelId` — the same string as a class in the
--               timetable. A renamable slug is how a plan and a class
--               stop naming the same thing, which is the exact bug
--               20260818130000 was written to fix.
--   name,       copy. Editing it is a deploy, because it is read
--   tagline,    alongside sentences elsewhere on the page that would
--   includes    have to change with it.
--   commitments the three terms are the gym's product shape, not a
--               number. Adding one is a code change with a migration.
--
-- The client asked on 2026-08-23 for the panel to update plan pricing.
-- A price is the one part of a plan that genuinely changes without the
-- rest of the site changing with it, and asking a developer to deploy
-- for it is the thing that stops it ever being right.
--
-- ── WHAT A PRICE HERE STILL IS NOT ──────────────────────────────────
--
-- NOTHING ON THIS SITE CHARGES ANYBODY. This is the figure the gym
-- advertises. What a given member actually pays is `member_quotes`,
-- which the owner sets per member and which SNAPSHOTS its own
-- `price_cents` at the moment it is agreed. That is not an accident of
-- schema design and it is load-bearing here: raising the advertised
-- Beginners rate must not silently re-quote the people already on it.
-- It cannot, because no quote reads this table.
--
-- ── CODE IS THE FALLBACK, NOT THE TRUTH ─────────────────────────────
--
-- The four rows are seeded below with the figures currently compiled
-- into the build, so this table is authoritative from its first read.
-- If it cannot be read — migration not yet applied, Supabase
-- unreachable, a row that fails validation — the site draws the
-- built-in figures and looks exactly as it did yesterday. Same rule as
-- `site_images`: a failed read degrades to the previous version of the
-- site, never to a blank space where a price was.

create table if not exists public.plan_prices (
  -- The four plans, and no fifth. Adding a plan is a code change (the
  -- slug is a LevelId), so there is no INSERT grant below and this
  -- check is the second lock on the same door.
  --
  -- Two-places rule, as with member_plans_slug_known: these slugs live
  -- here and in src/content/plans.ts, and each comments the other.
  slug text primary key
    constraint plan_prices_slug_known
      check (slug in ('beginner', 'intermediate', 'advanced', 'kids')),

  -- Integer cents, never a float. See member_quotes' header for the
  -- full reasoning; the short version is that 0.1 + 0.2 is not 0.3 and
  -- the place that surfaces is a figure read aloud at a counter.
  --
  -- Strictly positive: a free class is not a price, it is a different
  -- conversation, and a $0 card on the home page reads as a bug. The
  -- upper rail is a slipped decimal point, not a rule about what a gym
  -- may charge.
  price_cents integer not null
    constraint plan_prices_price_sane
      check (price_cents > 0 and price_cents <= 1000000),

  -- Null means "this plan has one price only" — that is Kids today, and
  -- it is the gym's pricing rather than a gap in ours. Nullable and
  -- editable, so if they ever start offering Kids on contract the owner
  -- can say so without a deploy.
  contract_price_cents integer
    constraint plan_prices_contract_sane
      check (
        contract_price_cents is null
        or (contract_price_cents > 0 and contract_price_cents <= 1000000)
      ),

  -- THE INVARIANT THAT MATTERS.
  --
  -- Every surface presents the contract rate as the lower one — "$99 on
  -- a 12-week contract" sits under "$125 / month" and reads as a saving.
  -- A contract rate ABOVE the standard rate would render as a discount
  -- that costs more: a mistake that survives review because both numbers
  -- look perfectly plausible on their own. It is refused here, in
  -- Postgres, and not only in the form, because the form is not the only
  -- thing that can write this column.
  --
  -- The same rule is asserted at build time over the compiled-in figures
  -- in src/content/plans.ts. Two enforcement points for one rule,
  -- because there are two sources for the number.
  constraint plan_prices_contract_not_higher
    check (
      contract_price_cents is null
      or contract_price_cents <= price_cents
    ),

  -- Stamped by the trigger below, never by the caller. See there.
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

/* ---------------------------------------------------------------
   WHO LAST TOUCHED IT — STAMPED, NOT SUBMITTED

   `updated_at` and `updated_by` are not in the column grant further
   down, so a client cannot write them at all. This trigger fills them
   in instead.

   The difference is worth the eight lines: a timestamp the caller
   supplies is a timestamp that can lie, and "when did this price
   change" is the question the owner will actually ask when a member
   turns up quoting a figure from a screenshot. `auth.uid()` is null
   for a service-role write, which is honest — nobody signed in did it.
   --------------------------------------------------------------- */
create or replace function public.stamp_plan_price()
returns trigger
language plpgsql
-- Empty search_path so the function cannot be captured by a shadowing
-- object in a caller-controlled schema. Everything below is qualified.
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists plan_prices_stamp on public.plan_prices;
create trigger plan_prices_stamp
  before update on public.plan_prices
  for each row
  execute function public.stamp_plan_price();

/* ---------------------------------------------------------------
   THE SEED

   The figures currently compiled into the build, from
   src/content/plans.ts, which took them from jcmuaythai201.com/classes
   on 2026-08-18. Seeding rather than leaving the table empty means the
   panel has something real to show the first time it is opened, and
   the site never has to explain a plan whose price is "not set yet".

   `on conflict do nothing` so re-running this file cannot overwrite a
   price the owner has since changed. That is the whole reason it is
   not `do update`.
   --------------------------------------------------------------- */
insert into public.plan_prices (slug, price_cents, contract_price_cents)
values
  ('beginner',     12500,  9900),
  ('intermediate', 15000, 12500),
  ('advanced',     19000, 16500),
  ('kids',          9900,  null)
on conflict (slug) do nothing;

/* ---------------------------------------------------------------
   ROW LEVEL SECURITY

   Read: everybody, signed in or not. These are prices printed on a
   public web page; `anon` reads them because the home page is
   statically prerendered and fetches them with the publishable key and
   no session at all. Same grant, and the same reason, as
   site_images_read_all.

   Write: admins only, UPDATE only, and only the two price columns.
   --------------------------------------------------------------- */
alter table public.plan_prices enable row level security;

revoke all on table public.plan_prices from anon, authenticated;

-- A COLUMN GRANT ON THE READ, TOO, AND `updated_by` IS NOT IN IT.
--
-- That column holds an admin's `auth.users` id. This table is read by
-- `anon` from a statically prerendered page, so granting the whole row
-- would publish the owner's user id on the public API — an internal
-- identifier, on a table whose reason to be public is four prices.
-- Nothing renders it, so nothing loses anything.
--
-- ⚠ THE CONSEQUENCE, STATED WHERE IT WILL BE HIT: `select=*` against
-- this table now fails with 42501, because Postgres refuses a SELECT
-- naming a column you lack the privilege for and PostgREST expands `*`
-- to every column in the schema cache. Name the columns —
-- `lib/plans/prices.ts` does. A `*` read would come back not-ok, and
-- the site would quietly fall back to the prices compiled into the
-- build while the panel said pricing was not switched on.
--
-- `updated_by` is still stored, and still readable from the Supabase
-- dashboard with the service key, which is where "who changed this"
-- gets asked and answered.
grant select (slug, price_cents, contract_price_cents, updated_at)
  on table public.plan_prices to anon, authenticated;

-- THE COLUMN GRANT, and it is the more useful half of this section.
--
-- Without it, a policy that lets an admin change a price also lets them
-- change the slug — because RLS grants access to the ROW and says
-- nothing about which of its columns you touched. Renaming 'beginner'
-- to 'begginer' from the pricing form would break the join to every
-- class in the timetable, and Postgres will now refuse it rather than
-- trusting the form not to send the field.
--
-- No INSERT and no DELETE, on purpose. There are four plans, they are
-- seeded above, and both operations are ways for the table to end up
-- disagreeing with the code that names them. Deleting a row would not
-- even look broken: the site would quietly fall back to the built-in
-- figure and the owner's change would appear to have been undone.
grant update (price_cents, contract_price_cents)
  on table public.plan_prices to authenticated;

drop policy if exists plan_prices_read_all on public.plan_prices;
create policy plan_prices_read_all
  on public.plan_prices for select
  to anon, authenticated
  using (true);

drop policy if exists plan_prices_admin_update on public.plan_prices;
create policy plan_prices_admin_update
  on public.plan_prices for update
  to authenticated
  using (public.is_admin())
  -- Both halves. `using` decides which rows may be targeted; `with
  -- check` decides what they may be left looking like. Omitting the
  -- second is how an admin-only table ends up writable by anyone who
  -- can make the first one true.
  with check (public.is_admin());

notify pgrst, 'reload schema';

/* ---------------------------------------------------------------
   CONFIRMATION

   Run this file and read the row it returns. Everything should be
   true, and the four prices should be the ones on the gym's site.
   --------------------------------------------------------------- */
select
  (select count(*) from public.plan_prices)                    as rows_now,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'plan_prices') as policies_now,
  (select count(*) from pg_trigger
    where tgrelid = 'public.plan_prices'::regclass
      and not tgisinternal)                                    as triggers_now,
  (select count(*) from pg_constraint
    where conrelid = 'public.plan_prices'::regclass
      and contype = 'c')                                       as checks_now,
  -- Should be false: anon must not be able to read who edited a price.
  (select has_column_privilege('anon', 'public.plan_prices', 'updated_by', 'select'))
                                                               as anon_sees_editor,
  (select string_agg(
            slug || '=' || price_cents || '/' ||
            coalesce(contract_price_cents::text, 'none'),
            ' ' order by slug)
     from public.plan_prices)                                  as prices_now;
