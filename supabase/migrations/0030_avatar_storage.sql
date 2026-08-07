-- 0030_avatar_storage.sql
--
-- What this does
--   Creates the one Supabase Storage bucket this build uses — 'avatars' —
--   and the RLS policies that let a user upload their own photo and let
--   anyone read any avatar. Nothing else in this schema has touched
--   Storage yet; every earlier mention of "avatar upload" and "club logo"
--   in this build's own comments named it as cut for exactly this reason:
--   no bucket existed. This migration is that gap closed, for avatars
--   specifically — see lib/queries/avatar.ts for the reduced scope this
--   pass actually builds against it (no club logo yet, see that file's own
--   header).
--
-- Which spec sections this implements
--   screens/settings.md, "Profile": "Editable by the user themselves:
--   display name, phone, avatar, and for athletes the fields they own."
--   users.avatar_url already existed (04-data-model.md §3); this is the
--   first migration to give it a real write path.
--
-- Why public, not signed URLs
--   A profile photo is not club performance or medical data — it is
--   comparable in sensitivity to a name, which this build already shows
--   broadly within an org. A public bucket means a plain, permanent URL
--   with no expiry to manage; the real tenancy boundary this build cares
--   about (wellness, injuries, GPS, test results) is untouched by this
--   decision, because none of it lives in Storage. The path itself is
--   still organised by org and user id, `{org_id}/{user_id}/avatar.*`, so
--   a listing is legible even though the bucket is public.
--
-- Why storage policies use auth.uid(), not this schema's own
-- auth_user_id()/auth_org_id() helpers
--   Those helpers read this app's custom JWT claims (org_id, athlete_id,
--   roles) added by the access-token hook (05-architecture.md §5).
--   Supabase Storage's own policy engine runs against the same JWT but
--   through its own built-in auth.uid(), the standard, documented way to
--   write a Storage policy — mixing in a custom claims helper here would
--   work but isn't the convention Storage policies are written against
--   anywhere in Supabase's own reference material, and there's no reason
--   to diverge from it for this one case.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

-- A user may upload, replace or remove only objects under their own user id
-- as the second path segment (org_id/user_id/...). storage.foldername splits
-- the object path on '/' into an array; [2] is the user id segment.
create policy avatars_owner_insert on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);

create policy avatars_owner_update on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);

create policy avatars_owner_delete on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);

-- Public bucket: Supabase serves GET requests against a public bucket's
-- objects without a SELECT policy. Still granted explicitly for anyone
-- reading via an authenticated Storage API call rather than the public URL.
create policy avatars_public_select on storage.objects for select
  to public
  using (bucket_id = 'avatars');
