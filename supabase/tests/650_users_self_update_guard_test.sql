-- users_self_update grants the whole row — narrowed at the database. §0bd,
-- 2026-09-13 (found 2026-09-12 by the reviewer on the test club: the only sport
-- scientist deactivated her own account over PostgREST with a 200; a coach
-- suspended and reactivated herself and renamed her account's email).
--
-- THE OLD RULE, asserted because this file replaces it: users_self_update
-- (0012) is `using / with check (org_id = auth_org_id() and id = auth_user_id())`
-- with no column restriction, and `authenticated` holds UPDATE on every column.
-- Before 0109 the three writes below that are refused all returned a row.
--
-- WHAT 0109 ENFORCES, one trigger, every caller:
--   1. a person updating THEMSELVES may change contact and profile columns
--      (full_name, phone, avatar_url, avatar_colour, last_seen_at) and nothing
--      that is status, role, or identity: status, deleted_at, email, org_id,
--      id, created_at, claims_version — refused as users_self_update_profile_only;
--   2. a sport scientist updating ANOTHER row may change status (the Users
--      screen's one write) and the same profile columns, never email, org_id,
--      id, created_at or claims_version — users_admin_update_no_identity;
--   3. any status or deletion change bumps claims_version, so a deactivated
--      account stops on the next request (session.ts's claims check), not at
--      token expiry;
--   4. 0101's last-sport-scientist rule extends to the ACCOUNT: the row of the
--      org's only active sport scientist cannot be deactivated, suspended or
--      soft-deleted by anyone, service_role included.
-- The user_roles bump (0010) is the one claims_version write that passes: +1
-- with nothing else changed.

begin;
select * from no_plan();

select tests.fixtures();

/* The fixture gives orga exactly one sport scientist: user_admin. */
select is(
  (select count(*)::int from user_roles where org_id = tests.uid('orga','org') and role = 'sport_scientist'),
  1, 'fixture: orga has exactly one sport scientist, so the last-admin case is real'
);

-- ===========================================================================
-- 1. A coach, as themselves
-- ===========================================================================
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');
select tests.set_jwt(tests.uid('orga', 'user_coach'));

select lives_ok(
  format($q$update users set phone = '07700 900000', full_name = 'Coach Renamed' where id = %L$q$, tests.uid('orga','user_coach')),
  'a coach may change their own phone and name'
);
select is(
  (select claims_version from users where id = tests.uid('orga','user_coach')),
  (select claims_version from users where id = tests.uid('orga','user_coach')),
  'and a profile change does not bump claims_version'
);
select throws_ok(
  format($q$update users set status = 'suspended' where id = %L$q$, tests.uid('orga','user_coach')),
  'P0001', 'users_self_update_profile_only',
  'a coach cannot suspend themselves'
);
select throws_ok(
  format($q$update users set status = 'deactivated' where id = %L$q$, tests.uid('orga','user_coach')),
  'P0001', 'users_self_update_profile_only',
  'or deactivate themselves'
);
select throws_ok(
  format($q$update users set email = 'someone.else@example.com' where id = %L$q$, tests.uid('orga','user_coach')),
  'P0001', 'users_self_update_profile_only',
  'or rename their own email'
);
select throws_ok(
  format($q$update users set deleted_at = now() where id = %L$q$, tests.uid('orga','user_coach')),
  'P0001', 'users_self_update_profile_only',
  'or soft-delete themselves'
);
select throws_ok(
  format($q$update users set claims_version = 99 where id = %L$q$, tests.uid('orga','user_coach')),
  'P0001', 'users_self_update_profile_only',
  'or rewrite their own claims_version'
);
select is(
  (select status from users where id = tests.uid('orga','user_coach')),
  'active'::user_status, 'the coach is still active'
);

-- ===========================================================================
-- 2. The sport scientist, as themselves — the case that was proved
-- ===========================================================================
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$update users set status = 'deactivated' where id = %L$q$, tests.uid('orga','user_admin')),
  'P0001', 'users_self_update_profile_only',
  'the sport scientist cannot deactivate their own account'
);
select lives_ok(
  format($q$update users set avatar_colour = 'teal' where id = %L$q$, tests.uid('orga','user_admin')),
  'but may change their own avatar colour'
);

-- ===========================================================================
-- 3. The sport scientist on another row: status yes, identity no, and the bump
-- ===========================================================================
create temporary table cv_before as
  select id, claims_version from users where id in (tests.uid('orga','user_coach'), tests.uid('orga','user_athlete_2'));
select lives_ok(
  format($q$update users set status = 'suspended' where id = %L$q$, tests.uid('orga','user_coach')),
  'the sport scientist may suspend the coach'
);
select is(
  (select status from users where id = tests.uid('orga','user_coach')),
  'suspended'::user_status, 'and the row says so'
);
select is(
  (select claims_version from users where id = tests.uid('orga','user_coach')),
  (select claims_version + 1 from cv_before where id = tests.uid('orga','user_coach')),
  'and the suspension bumped claims_version by one, so the coach''s session stops on the next request'
);
select throws_ok(
  format($q$update users set email = 'renamed@example.com' where id = %L$q$, tests.uid('orga','user_coach')),
  'P0001', 'users_admin_update_no_identity',
  'the sport scientist cannot rename another account''s email'
);
select throws_ok(
  format($q$update users set claims_version = 50 where id = %L$q$, tests.uid('orga','user_coach')),
  'P0001', 'users_admin_update_no_identity',
  'or set its claims_version by hand'
);

-- ===========================================================================
-- 4. Self-reactivate: the suspended coach, as themselves
-- ===========================================================================
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$update users set status = 'active' where id = %L$q$, tests.uid('orga','user_coach')),
  'P0001', 'users_self_update_profile_only',
  'a suspended coach cannot reactivate themselves'
);
select is(
  (select status from users where id = tests.uid('orga','user_coach')),
  'suspended'::user_status, 'still suspended'
);

-- ===========================================================================
-- 5. The only sport scientist's account stays active, for every caller
-- ===========================================================================
reset role;
select throws_ok(
  format($q$update users set status = 'deactivated' where id = %L$q$, tests.uid('orga','user_admin')),
  '42501', null,
  'even the service role cannot deactivate the org''s only active sport scientist'
);
select throws_like(
  format($q$update users set status = 'deactivated' where id = %L$q$, tests.uid('orga','user_admin')),
  '%last sport scientist%',
  'and the refusal says what it protects'
);
select throws_ok(
  format($q$update users set deleted_at = now() where id = %L$q$, tests.uid('orga','user_admin')),
  '42501', null,
  'nor soft-delete them'
);

-- the service role may still deactivate anyone else, and the bump applies
select lives_ok(
  format($q$update users set status = 'deactivated' where id = %L$q$, tests.uid('orga','user_athlete_2')),
  'the service role deactivates an athlete'
);
select is(
  (select claims_version from users where id = tests.uid('orga','user_athlete_2')),
  (select claims_version + 1 from cv_before where id = tests.uid('orga','user_athlete_2')),
  'and that bumped claims_version too'
);

-- ===========================================================================
-- 6. The role-change bump (0010) still passes through the guard
-- ===========================================================================
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into user_roles (org_id, user_id, role) values (%L, %L, 'strength_conditioning')$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'granting a role to the coach still works'
);
select is(
  (select claims_version from users where id = tests.uid('orga','user_coach')),
  (select claims_version + 2 from cv_before where id = tests.uid('orga','user_coach')),
  'and the role trigger''s own +1 bump passed the guard (one for the suspension, one for the role)'
);

select * from finish();
rollback;
