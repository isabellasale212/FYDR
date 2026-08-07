-- 130_org_logo_storage_test.sql
--
-- migration 0031's own header explains why this bucket's policies check
-- auth_org_id()/auth_has_any_role() rather than auth.uid() the way
-- 120_avatar_storage_test.sql's bucket does. Three things need proving that
-- avatar's test didn't: a non-admin staff member is blocked even though
-- they're a real member of the org (avatars has no such role gate — any
-- authenticated user owns their own avatar), an admin of one org cannot
-- touch another org's logo (the actual tenancy boundary this bucket cares
-- about, since there's no user-id path segment to fall back on), and an
-- admin can still replace and read their own club's logo normally.
--
-- Same real platform finding as 120's file applies here too: no delete
-- assertion, because storage.protect_delete() blocks any raw SQL DELETE
-- against storage.objects regardless of RLS. logos_admin_delete is still
-- real — it's what the Storage API's own DELETE call checks internally —
-- verified live in the browser instead, alongside the actual upload UI.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;

select tests.set_jwt(tests.uid('orga', 'user_admin'));


-- ===========================================================================
-- 1. An admin can insert their own org's logo object
-- ===========================================================================

select lives_ok(
  format(
    $q$insert into storage.objects (bucket_id, name, owner)
       values ('logos', %L || '/logo.jpg', %L)$q$,
    tests.uid('orga','org'), tests.uid('orga','user_admin')
  ),
  'orga''s admin uploads orga''s logo'
);


-- ===========================================================================
-- 2. A coach — a real member of the same org, just not an admin — cannot
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format(
    $q$insert into storage.objects (bucket_id, name, owner)
       values ('logos', %L || '/logo.jpg', %L)$q$,
    tests.uid('orga','org'), tests.uid('orga','user_coach')
  ),
  '42501', null,
  'a coach in the same org cannot upload the club logo — admin only, unlike avatars'
);


-- ===========================================================================
-- 3. An admin of orgb cannot insert an object under orga's id
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_admin'));
select throws_ok(
  format(
    $q$insert into storage.objects (bucket_id, name, owner)
       values ('logos', %L || '/logo.jpg', %L)$q$,
    tests.uid('orga','org'), tests.uid('orgb','user_admin')
  ),
  '42501', null,
  'orgb''s admin cannot upload a logo under orga''s id — the actual tenancy boundary this bucket has, since there''s no per-user path segment'
);


-- ===========================================================================
-- 4. orga's admin can replace (re-upload over) their own club's logo
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format(
    $q$update storage.objects set metadata = '{"replaced":true}'::jsonb
       where bucket_id = 'logos' and name = %L || '/logo.jpg'$q$,
    tests.uid('orga','org')
  ),
  'orga''s admin replaces orga''s logo object'
);

select is(
  (select metadata ->> 'replaced' from storage.objects
     where bucket_id = 'logos' and name = tests.uid('orga','org')::text || '/logo.jpg'),
  'true',
  'and it really did change'
);


-- ===========================================================================
-- 5. Reading any logo is open — the bucket is public
-- ===========================================================================

select tests.clear_jwt();
set local role anon;
select is(
  (select count(*) from storage.objects where bucket_id = 'logos'),
  1::bigint,
  'even a signed-out caller reads the logos bucket — the public-read policy, matching the public bucket'
);

select * from finish();
rollback;
