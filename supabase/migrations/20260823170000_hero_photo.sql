-- The hero photograph's recorded size, after the picture behind it changed.
--
-- WHAT CHANGED, AND WHY THIS IS NOT URGENT
--
-- /images/hero.jpeg is a different photograph as of 2026-08-23 — a
-- portrait studio shot, at the client's request. The path did not change,
-- so the row already points at the right file and the site shows the new
-- picture the moment the deploy lands, with or without this migration.
--
-- What is stale is the SIZE. The row says 2560x1706 and the file is
-- 941x1672 — landscape numbers against a portrait picture.
--
-- Nothing on the public site reads them: HeroCard draws this slot with
-- next/image `fill`, which takes its box from the card and ignores the
-- intrinsic size entirely. So this is a correctness fix to the data, not
-- a fix to anything a visitor can see, and it can be run whenever.
--
-- It is worth running anyway. A row that describes a file it does not
-- match is a trap for whatever reads it next — an admin panel showing
-- the wrong dimensions, or a future component that reserves a box from
-- them and reserves a landscape one for a portrait photograph.
--
-- WHY THE NUMBERS ARE NOT TYPED FROM THE FILENAME
--
-- 941x1672 was read out of the JPEG's own bytes by the parser in
-- src/lib/images/dimensions.ts, and dimensions.test.ts asserts it against
-- the real file on every test run. If the picture is ever replaced again
-- and these drift, that test fails before this row can go stale unnoticed.

update public.site_images
   set width  = 941,
       height = 1672
 where slot = 'hero'
   and src = '/images/hero.jpeg'
   -- Only the built-in row. If the owner has since uploaded their own
   -- hero through the panel, that row carries a storage_path and its own
   -- correct dimensions, and must not be overwritten with these.
   and storage_path is null;

-- ---------------------------------------------------------------------
-- Confirmation. A bare UPDATE reports only "Success. No rows returned",
-- which is indistinguishable from having matched nothing at all.
-- ---------------------------------------------------------------------
select
  slot,
  src,
  width,
  height,
  (width = 941 and height = 1672) as now_correct
from public.site_images
where slot = 'hero';
