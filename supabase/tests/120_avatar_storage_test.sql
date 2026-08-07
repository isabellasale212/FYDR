-- 120_avatar_storage_test.sql
--
-- migration 0030's own header explains why this exists. storage.objects is
-- outside this schema's usual public tables, but it's still a real RLS
-- boundary and gets the same test discipline: an athlete can write and
-- update their own avatar object, cannot touch anyone else's, and a read
-- is open to everyone, matching the public bucket.
--
-- No delete assertion here, and that's a real finding, not an omission:
-- this hosted project has storage.protect_delete(), a trigger that refuses
-- *any* direct SQL DELETE against storage.objects — "Use the Storage API
-- instead" — regardless of who's asking or what RLS would otherwise allow,
-- to stop a raw SQL delete from orphaning the real file bytes sitting in
-- the underlying object store, which the metadata row alone doesn't
-- delete. avatars_owner_delete (migration 0030) is still real: it's the
-- RLS check the Storage API itself runs internally on a genuine DELETE
-- call, which this test file has no way to invoke — pgTAP speaks SQL, not
-- the Storage API's HTTP surface. That path is verified live in the
-- browser instead, alongside the actual upload UI.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));


-- ===========================================================================
-- 1. An athlete can insert their own avatar object
-- ===========================================================================

select lives_ok(
  format(
    $q$insert into storage.objects (bucket_id, name, owner)
       values ('avatars', %L || '/' || %L || '/avatar.jpg', %L)$q$,
    tests.uid('orga','org'), tests.uid('orga','user_athlete_1'), tests.uid('orga','user_athlete_1')
  ),
  'athlete_1 uploads their own avatar'
);


-- ===========================================================================
-- 2. An athlete cannot insert an object under someone else's user id
-- ===========================================================================

select throws_ok(
  format(
    $q$insert into storage.objects (bucket_id, name, owner)
       values ('avatars', %L || '/' || %L || '/avatar.jpg', %L)$q$,
    tests.uid('orga','org'), tests.uid('orga','user_athlete_2'), tests.uid('orga','user_athlete_1')
  ),
  '42501', null,
  'athlete_1 cannot upload an avatar under athlete_2''s user id'
);


-- ===========================================================================
-- 3. An athlete can replace (re-upload over) their own avatar object
-- ===========================================================================

select lives_ok(
  format(
    $q$update storage.objects set metadata = '{"replaced":true}'::jsonb
       where bucket_id = 'avatars' and name = %L || '/' || %L || '/avatar.jpg'$q$,
    tests.uid('orga','org'), tests.uid('orga','user_athlete_1')
  ),
  'athlete_1 replaces their own avatar object'
);

select is(
  (select metadata ->> 'replaced' from storage.objects
     where bucket_id = 'avatars' and name = tests.uid('orga','org')::text || '/' || tests.uid('orga','user_athlete_1')::text || '/avatar.jpg'),
  'true',
  'and it really did change'
);


-- ===========================================================================
-- 4. An athlete cannot update someone else's avatar object
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format(
    $q$insert into storage.objects (bucket_id, name, owner)
       values ('avatars', %L || '/' || %L || '/avatar.jpg', %L)$q$,
    tests.uid('orga','org'), tests.uid('orga','user_admin'), tests.uid('orga','user_admin')
  ),
  'the admin uploads their own avatar, as fixture data for the next check'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  tests.rows_affected(
    format(
      $q$update storage.objects set metadata = '{"hijacked":true}'::jsonb
         where bucket_id = 'avatars' and name = %L || '/' || %L || '/avatar.jpg'$q$,
      tests.uid('orga','org'), tests.uid('orga','user_admin')
    )
  ),
  0::bigint,
  'athlete_1''s update of the admin''s avatar matches zero rows under RLS, same as any other row-scoped update'
);


-- ===========================================================================
-- 5. Reading any avatar is open — the bucket is public
-- ===========================================================================

select tests.clear_jwt();
set local role anon;
select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'),
  2::bigint,
  'even a signed-out caller reads both avatars objects — the public-read policy, matching the public bucket'
);

select * from finish();
rollback;
