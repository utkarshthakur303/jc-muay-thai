-- What the gym has quoted a member for their plan.
--
-- WHAT THIS IS
--
-- A note for the counter. The owner agrees a figure with somebody in
-- person, writes it here so it is not lost, and reads it back next time
-- they are asked. Nothing charges anyone, nothing is owed on the strength
-- of a row here, and no member can see any of it.
--
-- WHY IT IS NOT A COLUMN ON member_plans
--
-- Because that table's own header forbids it, in as many words: a plan is
-- a stated interest and "must never quietly become the basis of a billing
-- decision". Hanging a price off the same row is exactly how "interested
-- in the three-month" turns into "owes us for the three-month" — one
-- join later, nobody remembers the distinction existed.
--
-- Keeping them apart costs one extra table and preserves the difference:
-- member_plans answers what somebody wants, this answers what they were
-- told it costs, and neither implies the other. It also means the plan
-- step can go on being asked of every new member without any of that
-- touching money.
--
-- MONEY IS STORED IN CENTS, ALWAYS
--
-- Integers, never a float. 0.1 + 0.2 is not 0.3 in binary floating point,
-- and a currency column of type real or double is a rounding error waiting
-- to be argued about at a counter. numeric would also be correct; integer
-- cents is chosen because every arithmetic operation below then stays
-- exact in Postgres *and* in JavaScript, where numeric would arrive as a
-- string and get parsed back into the very float this avoids.

create table if not exists public.member_quotes (
  -- One current quote per member, keyed on the member. Re-quoting is an
  -- UPDATE, not a second row: this is a note, not a ledger. If the gym
  -- ever needs the history of what somebody was offered, that is a second
  -- table and a real conversation about retention, not a reshape of this.
  user_id        uuid        primary key
    references auth.users (id) on delete cascade,

  -- Which plan the figure was quoted for, snapshotted at the time.
  --
  -- Not derived from member_plans by join, deliberately. A member can
  -- change their mind the day after being quoted, and a price silently
  -- following them from the one-month to the six-month plan is wrong in a
  -- way nobody would notice. Storing it means the panel can say "this
  -- quote was for Basic; they have since switched to Advanced" instead of
  -- showing a confident number for the wrong thing.
  --
  -- Same two-places rule as member_plans_slug_known: the slugs live here
  -- and in src/content/plans.ts, and each comments the other.
  plan_slug      text        not null
    constraint member_quotes_slug_known
      check (plan_slug in ('basic', 'intermediate', 'advanced')),

  -- The full price before any discount. Upper bound is a sanity rail, not
  -- a business rule: it turns a slipped decimal point into a rejected
  -- write rather than a $120,000 quote sitting on a member's page.
  price_cents    integer     not null
    constraint member_quotes_price_sane
      check (price_cents >= 0 and price_cents <= 1000000),

  -- 'percent' → discount_value is 0–100.
  -- 'amount'  → discount_value is cents off.
  discount_kind  text        not null default 'percent'
    constraint member_quotes_discount_kind_known
      check (discount_kind in ('percent', 'amount')),

  discount_value integer     not null default 0
    constraint member_quotes_discount_non_negative
      check (discount_value >= 0),

  -- Why this figure. "Student rate", "brought a friend". The thing the
  -- owner will want in six months when he cannot remember why one member
  -- pays less than another.
  note           text
    constraint member_quotes_note_length
      check (note is null or char_length(trim(note)) between 1 and 200),

  updated_at     timestamptz not null default now(),
  -- Who last touched it. There is one admin today; there may be a front
  -- desk later, and "who agreed this" is the first question that gets
  -- asked when two people disagree about a price.
  updated_by     uuid        references auth.users (id) on delete set null,

  constraint member_quotes_percent_in_range
    check (discount_kind <> 'percent' or discount_value <= 100),

  -- A fixed discount can never exceed the price. Together with the range
  -- above, this is what makes the generated column below unable to go
  -- negative — so it needs no clamp, and there is no branch where a
  -- negative total is merely "unlikely".
  constraint member_quotes_amount_within_price
    check (discount_kind <> 'amount' or discount_value <= price_cents)
);

-- THE FINAL AMOUNT, COMPUTED BY THE DATABASE.
--
-- A generated column rather than arithmetic in TypeScript, because the
-- figure the owner reads out loud must not depend on which screen he read
-- it from. Anything that can query this table gets the same total.
--
-- `(price * pct + 50) / 100` is integer division, which truncates — the
-- +50 makes that round half up. Every value involved is non-negative, so
-- it matches JavaScript's `Math.floor((price * pct + 50) / 100)` exactly,
-- which is what src/lib/admin/quotes.ts does and what its tests pin.
alter table public.member_quotes
  drop column if exists final_cents;

alter table public.member_quotes
  add column final_cents integer
  generated always as (
    price_cents - case
      when discount_kind = 'percent' then (price_cents * discount_value + 50) / 100
      else discount_value
    end
  ) stored;

/* ---------------------------------------------------------------
   ROW-LEVEL SECURITY

   Admin only, on every verb. This is the first table in the project
   that a member may not read *at all* — even their own row.

   That is a product decision and not an oversight. The gym settles
   money in person and the plans page says so; a member who could
   fetch their own quote from PostgREST would be reading a price the
   site has deliberately never shown them, and one they were never
   told was final.
   --------------------------------------------------------------- */

alter table public.member_quotes enable row level security;

revoke all on table public.member_quotes from anon, authenticated;
grant select, insert, update, delete
  on table public.member_quotes to authenticated;

drop policy if exists member_quotes_admin_read on public.member_quotes;
create policy member_quotes_admin_read
  on public.member_quotes for select
  to authenticated
  using (public.is_admin());

drop policy if exists member_quotes_admin_write on public.member_quotes;
create policy member_quotes_admin_write
  on public.member_quotes for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists member_quotes_admin_update on public.member_quotes;
create policy member_quotes_admin_update
  on public.member_quotes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Delete is allowed here, unlike everywhere else in this schema. A quote
-- is the gym's own working note about its own pricing, not a record of
-- something a member did, so "clear this and start again" is a legitimate
-- thing to want and leaving a tombstone would serve nobody.
drop policy if exists member_quotes_admin_delete on public.member_quotes;
create policy member_quotes_admin_delete
  on public.member_quotes for delete
  to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';

/* ---------------------------------------------------------------
   CONFIRMATION

   Expect: table 1, policies 4, generated_col 1, checks 7, quotes 0.

   `generated_col` is the one to read twice — if it is 0, final_cents
   is an ordinary column and every total on the page is whatever was
   last written into it.
   --------------------------------------------------------------- */

select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'member_quotes')   as table_exists,

  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'member_quotes')      as policies,

  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'member_quotes'
      and column_name = 'final_cents'
      and is_generated = 'ALWAYS')                                    as generated_col,

  (select count(*) from pg_constraint
    where conrelid = 'public.member_quotes'::regclass
      and contype = 'c')                                              as checks,

  (select count(*) from public.member_quotes)                         as quotes;
