-- ---------------------------------------------------------------------
-- The site's photographs move out of the repository and into the
-- database, so the gym can change its own pictures.
--
-- WHAT WAS WRONG. Every image on this site is a file in `public/images`
-- referenced by a string literal in a component. Changing the hero photo
-- meant a developer, a commit and a deploy — which in practice meant it
-- was never changed at all. Eight of the ten pictures on the site are
-- STOCK photographs chosen for the mockup: a generic fighter shadow
-- boxing, generic gloves, a generic silhouette. Only two are the actual
-- gym, and they arrived on 2026-08-18 by hand.
--
-- A gym's photographs are the single most persuasive thing on its
-- website, and this one has been advertising itself with pictures of a
-- gym that is not it.
--
-- TWO KINDS OF PICTURE, ONE TABLE.
--
--   slot = 'gallery'   The gallery grid. Many rows, ORDERED, and the
--                      owner adds and removes them freely.
--
--   slot = anything    A fixed position in the layout — the hero, the
--   else               promo strip, one of the four class cards. At most
--                      one row each, replaceable but not re-orderable.
--
-- One table rather than two because they differ only in cardinality:
-- both are "a picture, its description, and its real pixel size". The
-- partial unique index below is what makes the distinction true rather
-- than merely intended.
--
-- WHY width AND height ARE STORED. next/image needs the intrinsic
-- dimensions to reserve the right box before the bytes arrive. Without
-- them the gallery reflows as each photograph lands, which is a layout
-- shift on the home page and a Core Web Vitals failure. They are read
-- out of the uploaded file's own header at upload time — see
-- src/lib/images/dimensions.ts — never typed by hand and never guessed.
--
-- WHY alt IS NOT ALWAYS REQUIRED, despite the standing rule that it is.
-- The hero and the promo strip are DECORATIVE: they sit behind copy that
-- already says everything, with `alt=""` on purpose. Forcing a
-- description onto them would make a screen reader announce the
-- photograph and then read the heading that describes it — worse
-- accessibility, arrived at by following an accessibility rule. Every
-- other slot requires one, and the check below enforces exactly that.
-- ---------------------------------------------------------------------

-- ── 1. The bucket ───────────────────────────────────────────────────
--
-- PUBLIC, deliberately. These are marketing photographs printed on a
-- page that anyone can read without an account. The alternative — signed
-- URLs — cannot work here at all: a signed URL expires, and `/` is
-- statically prerendered, so the HTML holding that URL can outlive it and
-- the home page would eventually serve five broken images.
--
-- Public means public READ. Writing is governed by the policies below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-images',
  'site-images',
  true,
  8388608,                                    -- 8 MB, mirrored in the app
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Who may write to it ──────────────────────────────────────────
--
-- Storage policies are ordinary RLS policies on `storage.objects`. This
-- is the enforcement — the upload runs as the signed-in owner, not as the
-- service role, so an ordinary member calling the same endpoint is
-- refused by Postgres rather than by a TypeScript check somebody has to
-- remember to write.
--
-- No SELECT policy is needed: a public bucket is served through
-- /storage/v1/object/public/... which does not consult RLS at all.
--
-- ⚠ If any of these three raise "must be owner of table objects", create
-- them instead from Storage → Policies in the dashboard with the same
-- expression. Nothing else in this migration depends on them succeeding.
drop policy if exists site_images_admin_insert on storage.objects;
create policy site_images_admin_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-images' and public.is_admin());

drop policy if exists site_images_admin_update on storage.objects;
create policy site_images_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-images' and public.is_admin())
  with check (bucket_id = 'site-images' and public.is_admin());

drop policy if exists site_images_admin_delete on storage.objects;
create policy site_images_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-images' and public.is_admin());

-- ── 3. The table ────────────────────────────────────────────────────

create table if not exists public.site_images (
  id            uuid primary key default gen_random_uuid(),

  slot          text not null
    constraint site_images_slot_known
    check (slot in (
      'gallery',
      'hero',
      'promo',
      'class-beginner',
      'class-intermediate',
      'class-advanced',
      'class-kids'
    )),

  -- Gallery order, 0 upward. Meaningless for the fixed slots, which have
  -- one row each; left at 0 there rather than made nullable, so ORDER BY
  -- never has to reason about nulls.
  position      integer not null default 0
    constraint site_images_position_sane check (position >= 0),

  -- Either a path under /public (the photographs compiled into the build)
  -- or an absolute URL into the bucket above. Both are things next/image
  -- can render, and keeping both means the seed below changes nothing on
  -- screen on the day this runs.
  src           text not null
    constraint site_images_src_present check (length(trim(src)) > 0),

  -- Empty string is a legitimate value and means "decorative" — see the
  -- header. The check makes it legitimate for exactly two slots.
  alt           text not null default '',
  constraint site_images_alt_required check (
    slot in ('hero', 'promo') or length(trim(alt)) > 0
  ),

  -- The file's own pixel dimensions, read from its header at upload.
  width         integer not null
    constraint site_images_width_sane check (width between 1 and 20000),
  height        integer not null
    constraint site_images_height_sane check (height between 1 and 20000),

  -- Path inside the bucket, so a deleted row can take its file with it.
  -- NULL means the picture is a file in the repository and there is
  -- nothing in storage to remove.
  storage_path  text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.site_images is
  'Every photograph on the public site. slot = ''gallery'' is the ordered '
  'gallery grid; any other slot is a single fixed position in the layout.';

comment on column public.site_images.storage_path is
  'Path inside the site-images bucket. NULL for the photographs shipped '
  'in the repository under public/images, which have no stored file.';

-- At most one picture per fixed slot. Without this a second `hero` row
-- would make which photograph the home page shows depend on row order.
create unique index if not exists site_images_one_per_slot
  on public.site_images (slot)
  where slot <> 'gallery';

-- ── 4. Seed: exactly what the site shows today ──────────────────────
--
-- Taken from src/content/gallery.ts, HeroCard, PromoCard and
-- src/content/classes.ts, with the dimensions measured off the files on
-- disk rather than copied from the code — the code's numbers were
-- measured once and this is a chance to check them.
--
-- Day one therefore changes nothing at all: the same ten pictures in the
-- same order, now with an edit box beside each. `class-kids` is
-- deliberately absent — see the note in src/content/classes.ts. It is an
-- empty slot the gym can fill when it has a real photograph of a kids'
-- session, and until then that card stays plain.
--
-- GUARDED ON THE TABLE BEING EMPTY, not on `on conflict do nothing`.
-- The fixed slots have a unique index and would collide harmlessly, but
-- the gallery rows have none — nothing about two identical gallery
-- photographs is a constraint violation. So a second paste of this file
-- would quietly double the gallery. Migrations here are pasted by hand
-- into a SQL editor, which is exactly the setting where a file gets run
-- twice.
insert into public.site_images (slot, position, src, alt, width, height)
select v.slot, v.position, v.src, v.alt, v.width, v.height
from (values
  ('gallery', 0, '/images/gym-class.jpeg',
   'A class of ten students gathered on the mat at the end of a session, in gloves, shin guards and Thai shorts, with heavy bags hanging along the wall behind them',
   1440, 1080),
  ('gallery', 1, '/images/gym-pads.jpeg',
   'Two students working pads on the mat, one throwing a high kick while their partner holds',
   499, 974),
  ('gallery', 2, '/images/gloves.jpeg',
   'Worn Muay Thai gloves and wraps racked at the side of the mat',
   2560, 1706),
  ('gallery', 3, '/images/shadow.jpeg',
   'A fighter working through shadow boxing rounds alone in the gym',
   2560, 1828),
  ('gallery', 4, '/images/silhouette.jpeg',
   'A student throwing a roundhouse kick, lit from behind',
   2560, 1706),
  ('hero', 0, '/images/hero.jpeg', '', 2560, 1706),
  ('promo', 0, '/images/promo.jpeg', '', 1706, 2560),
  ('class-beginner', 0, '/images/beginner.jpeg',
   'A student drilling strikes on a heavy bag', 1531, 2560),
  ('class-intermediate', 0, '/images/intermediate.jpeg',
   'Two training partners working Thai pads', 2560, 1706),
  ('class-advanced', 0, '/images/advanced.jpeg',
   'A coach and fighter sparring in the ring', 2560, 1706)
) as v(slot, position, src, alt, width, height)
where not exists (select 1 from public.site_images);

-- ── 5. RLS ──────────────────────────────────────────────────────────

alter table public.site_images enable row level security;

-- anon included on purpose, and for the same reason as class_sessions:
-- the home page is statically prerendered and must be able to read its
-- own photographs without a session. These are pictures printed on a
-- public web page.
drop policy if exists site_images_read_all on public.site_images;
create policy site_images_read_all
  on public.site_images for select
  to anon, authenticated
  using (true);

drop policy if exists site_images_admin_write on public.site_images;
create policy site_images_admin_write
  on public.site_images for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists site_images_admin_edit on public.site_images;
create policy site_images_admin_edit
  on public.site_images for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists site_images_admin_remove on public.site_images;
create policy site_images_admin_remove
  on public.site_images for delete
  to authenticated
  using (public.is_admin());

grant select on table public.site_images to anon, authenticated;

-- Column-level grants as the second fence, on the same principle as
-- 20260815130000_admin_writes.sql: RLS grants access to a ROW and says
-- nothing about which columns were touched. `id` and `created_at` are
-- deliberately absent from both lists — nothing outside the database
-- should be choosing a primary key or backdating a record.
grant insert (slot, position, src, alt, width, height, storage_path)
  on table public.site_images to authenticated;
grant update (slot, position, src, alt, width, height, storage_path, updated_at)
  on table public.site_images to authenticated;
grant delete on table public.site_images to authenticated;

notify pgrst, 'reload schema';

-- ── Confirmation ────────────────────────────────────────────────────
-- Expect: images 10 · gallery 5 · fixed 5 · bucket 1 · bucket_public t
--         table_policies 4 · storage_policies 3 · kids_slot 0
--
-- kids_slot 0 is not a failure — it is the empty Kids slot, which the
-- panel offers as an upload and the site renders as a plain card until
-- somebody fills it.
--
-- If storage_policies comes back below 3, read the ⚠ note in section 2:
-- the table is fine and uploads will be refused until those exist.
select
  (select count(*) from public.site_images)                     as images,
  (select count(*) from public.site_images
     where slot = 'gallery')                                    as gallery,
  (select count(*) from public.site_images
     where slot <> 'gallery')                                   as fixed,
  (select count(*) from storage.buckets
     where id = 'site-images')                                  as bucket,
  (select public from storage.buckets
     where id = 'site-images')                                  as bucket_public,
  (select count(*) from pg_policies
     where tablename = 'site_images')                           as table_policies,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'site_images_admin_%')               as storage_policies,
  (select count(*) from public.site_images
     where slot = 'class-kids')                                 as kids_slot;
