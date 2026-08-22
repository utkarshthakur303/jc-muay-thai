-- ---------------------------------------------------------------------
-- Admins need SELECT on storage.objects, or deletion silently does
-- nothing.
--
-- FOLLOW-UP TO 20260823120000. That migration granted admins INSERT,
-- UPDATE and DELETE on the bucket's objects and deliberately omitted
-- SELECT, reasoning that a public bucket is served through
-- /storage/v1/object/public/... which never consults RLS. That reasoning
-- is correct about SERVING and wrong about everything else.
--
-- Storage resolves a delete by first LOOKING UP the object. With no
-- SELECT policy the lookup returns nothing, so the delete matches
-- nothing — and the API answers **HTTP 200 with an empty array**. No
-- error. No exception. supabase-js reports success.
--
-- Measured before writing this, as the real admin account:
--
--   upload  →  200, file created
--   remove  →  200 []          ← zero rows deleted
--   list    →  0 objects       ← cannot see the file it just wrote
--
-- The visible symptom was the whole point of the feature failing
-- quietly: the client's decision on 2026-08-23 was that removing a
-- photograph deletes its file, and every removal left the file behind
-- while the panel said "Photograph removed."
--
-- This is the second time this project has been bitten by a 200 with an
-- empty body meaning "refused" — PostgREST does the same on a
-- policy-filtered DELETE. Check rows affected, never the status code.
-- lib/admin/photos.ts now does.
--
-- WHY NOT anon. Public read does not need this and never did: files are
-- served straight from the public path. Granting anon SELECT here would
-- let anybody enumerate the bucket, which is a different and worse thing
-- than being able to fetch a photograph whose URL is printed on the home
-- page.
-- ---------------------------------------------------------------------

drop policy if exists site_images_admin_select on storage.objects;
create policy site_images_admin_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'site-images' and public.is_admin());

-- ── Confirmation ────────────────────────────────────────────────────
-- Expect: storage_policies 4  (select, insert, update, delete)
--         select_policy    1
select
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'site_images_admin_%')      as storage_policies,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'site_images_admin_select')    as select_policy;
