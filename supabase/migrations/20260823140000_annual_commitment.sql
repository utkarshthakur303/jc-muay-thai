-- ---------------------------------------------------------------------
-- `commitment` learns a fourth value: 'annual'.
--
-- WHY. The client asked on 2026-08-23 for a monthly/yearly toggle on the
-- plans page. The gym publishes no annual rate — their own site lists
-- exactly three terms (two-week trial, 12-week contract, month to month)
-- and no yearly price at any figure. That was put to the client with the
-- alternatives on the table, and they chose to show a yearly view built
-- as twelve times the monthly rate.
--
-- WHAT 'annual' MEANS, precisely, because the owner will read this column
-- in the admin panel and act on it:
--
--   A member who chose it wants to think about the cost by the year. It
--   is NOT an agreement to pay a year up front, NOT a discount, and NOT
--   a term the gym advertises. The figure they saw was their standard
--   monthly rate × 12, labelled as such on screen. Billing is unchanged:
--   monthly, in person, as it has always been.
--
-- WHY THE CHECK IS WIDENED RATHER THAN DROPPED. The constraint is what
-- stops a typo, a stale client or a hand-run UPDATE putting a value in
-- this column that no code path knows how to render. Four known strings
-- is still a closed set.
--
-- `member_quotes` is untouched on purpose: it has no `commitment` column.
-- A quote is a monthly figure the owner sets per member, and the yearly
-- view never reaches it — `priceFor` returns the standard MONTHLY rate on
-- an annual term, so the quote box opens on the same number it always did.
--
-- SAFE TO RE-RUN. Nothing is deleted and no row is rewritten; widening a
-- CHECK cannot reject data that already satisfies the narrower one.
-- ---------------------------------------------------------------------

alter table public.member_plans
  drop constraint if exists member_plans_commitment_known;

alter table public.member_plans
  add constraint member_plans_commitment_known
  check (
    commitment is null
    or commitment in ('trial', 'contract', 'monthly', 'annual')
  );

comment on column public.member_plans.commitment is
  'Two-week trial, 12-week contract, month to month, or annual. The first '
  'three are the gym''s own published terms. ''annual'' is a BILLING VIEW '
  'added 2026-08-23, not a product the gym sells: the member was shown '
  'their standard monthly rate multiplied by twelve, labelled as such. It '
  'is not a discount and not a prepayment. Records an intention only — it '
  'authorises nothing and charges nothing.';

-- ── Verification ────────────────────────────────────────────────────
-- Run this in the same window. A bare DDL run reports only "Success. No
-- rows returned", which is indistinguishable from having run nothing.
--
-- Expect exactly: annual_allowed 1 · trial_still_allowed 1 · rows_kept
-- unchanged from before the run (whatever it was — the migration touches
-- no rows).
select
  (select count(*) from pg_constraint
     where conname = 'member_plans_commitment_known'
       and pg_get_constraintdef(oid) like '%annual%')   as annual_allowed,
  (select count(*) from pg_constraint
     where conname = 'member_plans_commitment_known'
       and pg_get_constraintdef(oid) like '%trial%')    as trial_still_allowed,
  (select count(*) from public.member_plans)            as rows_kept;
