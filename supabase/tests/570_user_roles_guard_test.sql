-- user_roles is guarded at the database: an organisation can never be left
-- with no sport scientist — §0ae, 2026-09-11.
--
-- WHAT WAS FOUND. user_roles_admin_delete lets any sport scientist delete any
-- user_roles row in the org, their own included, with no count. The only rule
-- against removing the last admin was setUserRoles in the browser — a
-- JavaScript check in the admin's own devtools. Delete that one row and the
-- club has nobody who can insert into user_roles (user_roles_admin_insert
-- needs a sport scientist), so nobody in the app can grant it back. Recovery
-- is database access.
--
-- WHAT 0101 DOES. A BEFORE DELETE OR UPDATE row trigger refuses any change
-- that would leave the row's org with zero sport_scientist rows. It holds for
-- every role, service_role included: the rule is about the organisation's
-- integrity, not about who is asking, and a scripted removal must grant
-- another admin first exactly as a person must. TRUNCATE fires no row
-- triggers, so reset-scratch.mjs is unaffected — it never deletes roles one
-- by one.
--
-- The second half of §0ae — refusing a self-grant of medic — is NOT here. It
-- is waiting on Isabella's confirmation after the reviewer's check, and lands
-- as its own migration and its own assertions when it does.

begin;
select * from no_plan();

select tests.fixtures();

/* The fixture gives each org exactly one sport scientist: user_admin. */
select is(
  (select count(*)::int from user_roles
    where org_id = tests.uid('orga', 'org') and role = 'sport_scientist'),
  1,
  'fixture: orga has exactly one sport scientist, so the last-admin case is real'
);

-- ===========================================================================
-- 1. The only sport scientist removes their own role: refused, as themselves.
-- ===========================================================================
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged for the assertions below');
select tests.set_jwt(tests.uid('orga', 'user_admin'));

select throws_ok(
  format($q$delete from user_roles where user_id = %L and role = 'sport_scientist'$q$,
         tests.uid('orga', 'user_admin')),
  '42501',
  null,
  'the only sport scientist cannot delete their own sport_scientist row'
);

select throws_like(
  format($q$delete from user_roles where user_id = %L and role = 'sport_scientist'$q$,
         tests.uid('orga', 'user_admin')),
  '%last sport scientist%',
  'and the refusal says what it protects'
);

/* An UPDATE that turns the row into another role is the same removal by
   another door. */
select throws_ok(
  format($q$update user_roles set role = 'coach' where user_id = %L and role = 'sport_scientist'$q$,
         tests.uid('orga', 'user_admin')),
  '42501',
  null,
  'nor demote it by UPDATE'
);

/* And the row is still there afterwards — a refused statement changes nothing. */
select is(
  (select count(*)::int from user_roles
    where org_id = tests.uid('orga', 'org') and role = 'sport_scientist'),
  1,
  'the sport_scientist row survives both attempts'
);

-- ===========================================================================
-- 2. Unrelated roles are untouched by the guard.
-- ===========================================================================
select is(
  tests.rows_affected(
    format($q$delete from user_roles where user_id = %L and role = 'coach'$q$,
           tests.uid('orga', 'user_dual'))),
  1::bigint,
  'deleting a coach row when the org has one sport scientist is allowed — the guard is about sport_scientist only'
);

-- ===========================================================================
-- 3. With a second sport scientist in place, the first may go.
-- ===========================================================================
select is(
  tests.rows_affected(
    format($q$insert into user_roles (org_id, user_id, role, granted_by)
             values (%L, %L, 'sport_scientist', %L)$q$,
           tests.uid('orga', 'org'), tests.uid('orga', 'user_coach'), tests.uid('orga', 'user_admin'))),
  1::bigint,
  'a sport scientist grants sport_scientist to the coach — two admins now'
);

select is(
  tests.rows_affected(
    format($q$delete from user_roles where user_id = %L and role = 'sport_scientist'$q$,
           tests.uid('orga', 'user_admin'))),
  1::bigint,
  'and may now remove their own — one remains'
);

select is(
  (select count(*)::int from user_roles
    where org_id = tests.uid('orga', 'org') and role = 'sport_scientist'),
  1,
  'exactly one sport scientist remains, the coach'
);

/* The rule follows the row to whoever is last. The coach is now the only
   admin; acting as them, the same refusal. */
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$delete from user_roles where user_id = %L and role = 'sport_scientist'$q$,
         tests.uid('orga', 'user_coach')),
  '42501',
  null,
  'the new last sport scientist is refused in turn'
);

-- ===========================================================================
-- 4. Per organisation: orgb's admin count is not orga's.
-- ===========================================================================
select tests.set_jwt(tests.uid('orgb', 'user_admin'));
select throws_ok(
  format($q$delete from user_roles where user_id = %L and role = 'sport_scientist'$q$,
         tests.uid('orgb', 'user_admin')),
  '42501',
  null,
  'orgb, with its own single sport scientist, is refused independently of orga'
);

-- ===========================================================================
-- 5. The service role is held to the same rule.
-- ===========================================================================
reset role;
select throws_ok(
  format($q$delete from user_roles where user_id = %L and role = 'sport_scientist'$q$,
         tests.uid('orgb', 'user_admin')),
  '42501',
  null,
  'a connection that bypasses RLS is refused too: the rule is the organisation''s, not the caller''s'
);

/* And a cascade reaches it: deleting the user row itself cascades to
   user_roles, and the guard fires on the cascaded row. */
select throws_ok(
  format($q$delete from users where id = %L$q$, tests.uid('orgb', 'user_admin')),
  '42501',
  null,
  'deleting the only sport scientist''s user row is refused through the cascade'
);

-- ===========================================================================
-- 6. The trigger exists, in the position the rule needs.
-- ===========================================================================
select is(
  (select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'user_roles' and t.tgname = 'user_roles_guard'
     and not t.tgisinternal
     and (t.tgtype & 2) <> 0     -- BEFORE
     and (t.tgtype & 1) <> 0     -- ROW
     and (t.tgtype & 8) <> 0     -- DELETE
     and (t.tgtype & 16) <> 0),  -- UPDATE
  1,
  'user_roles_guard is a BEFORE DELETE OR UPDATE row trigger on user_roles'
);

select * from finish();
rollback;
