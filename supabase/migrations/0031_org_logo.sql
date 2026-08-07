-- 0031_org_logo.sql
--
-- What this does
--   Adds organisations.logo_url and a second Storage bucket, 'logos', for
--   a club's own crest — the last item in migration 0030's own "what's cut"
--   list ("no club logo yet, see that file's own header") and in
--   orgDetails.ts's ("branding (a logo needs file storage the same way an
--   avatar does)"). Same shape as avatar upload, same file-size and
--   mime-type limits, same public-bucket reasoning — but a genuinely
--   different ownership model, which is why the Storage policies below
--   don't just copy 0030's.
--
-- Which spec section this implements
--   screens/settings.md, "Organisation settings, admin, web":
--   `Logo  [ barnsford-crest.png ]  [Replace] [Remove]`, a row inside Club
--   details, not its own section. 04-data-model.md's own organisations
--   table doesn't list a logo column at all — the same kind of doc gap
--   already found and fixed for the Users role table and for avatar_url's
--   own bucket: the intent was always there in the wireframe, the schema
--   just hadn't caught up yet.
--
-- Why this bucket's policies use auth_org_id()/auth_has_any_role(), not
-- auth.uid() like 'avatars' does
--   0030's own header explains why avatar policies use Storage's built-in
--   auth.uid(): an avatar is owned by exactly the user whose id is in the
--   path, and auth.uid() already *is* that id — no extra lookup needed. A
--   logo has no equivalent single owner. It belongs to the organisation,
--   and "may write" means "is an admin of that organisation", which
--   auth.uid() alone can't express. This schema already carries that exact
--   check as reusable, granted-to-authenticated functions (migration 0010),
--   so this is the one Storage policy in this build that reaches for them
--   instead of Storage's own primitive — a deliberate, narrow exception to
--   0030's convention, not a drift from it.

alter table public.organisations add column logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

-- One file per org, path {org_id}/logo.*  — storage.foldername(name)[1] is
-- the org_id segment (there's no second segment the way avatars has a user
-- id, because the org itself is the only owner here).
create policy logos_admin_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.auth_has_any_role(array['admin']::public.app_role[])
  );

create policy logos_admin_update on storage.objects for update
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.auth_has_any_role(array['admin']::public.app_role[])
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.auth_has_any_role(array['admin']::public.app_role[])
  );

create policy logos_admin_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.auth_has_any_role(array['admin']::public.app_role[])
  );

-- Public bucket, same reasoning as avatars_public_select: a club crest is
-- not performance or medical data, and granted explicitly for anyone
-- reading via an authenticated Storage API call rather than the public URL.
create policy logos_public_select on storage.objects for select
  to public
  using (bucket_id = 'logos');
