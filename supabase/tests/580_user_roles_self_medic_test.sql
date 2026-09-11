-- A sport scientist cannot grant medic to THEMSELVES — §0ae, second half,
-- confirmed by Isabella 2026-09-11.
--
-- WHAT WAS FOUND. user_roles_admin_insert's WITH CHECK is `org_id =
-- auth_org_id() and auth_has_any_role('sport_scientist')` — nothing about
-- user_id, nothing about which role. Measured on the running app: on the
-- admin's own row the "Medic" toggle is enabled. One click, and the admin
-- holds CLINICAL_ONLY — the one gate the sport scientist, the superset role,
-- does not hold: athletes' problem reports, diagnoses and mechanisms.
--
-- THE RULE. Granting medic to OTHERS stays allowed; granting it to
-- auth_user_id() is refused, by INSERT or by UPDATE. The enum value is
-- 'medic' (0063 renamed 'medical'), and every statement below inserts that
-- real value. 0102 extends user_roles_guard() from 0101; the last-sport-
-- scientist rule is 570's subject and is untouched.

begin;
select * from no_plan();

select tests.fixtures();

/* The fixture's medic is user_medical; user_admin is the sport scientist and
   holds no medic row. */
select is(
  (select count(*)::int from user_roles
    where user_id = tests.uid('orga', 'user_admin') and role = 'medic'),
  0,
  'fixture: the sport scientist does not hold medic'
);

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged for the assertions below');
select tests.set_jwt(tests.uid('orga', 'user_admin'));

-- ===========================================================================
-- 1. Self-grant of medic: refused, by INSERT.
-- ===========================================================================
select throws_ok(
  format($q$insert into user_roles (org_id, user_id, role, granted_by)
           values (%L, %L, 'medic', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'user_admin'), tests.uid('orga', 'user_admin')),
  '42501',
  null,
  'a sport scientist cannot insert a medic row for themselves'
);

select throws_like(
  format($q$insert into user_roles (org_id, user_id, role, granted_by)
           values (%L, %L, 'medic', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'user_admin'), tests.uid('orga', 'user_admin')),
  '%grant yourself the medic role%',
  'and the refusal says so'
);

-- ===========================================================================
-- 2. Nor by UPDATE — re-pointing an existing medic row at oneself.
-- ===========================================================================
select throws_ok(
  format($q$update user_roles set user_id = %L
            where user_id = %L and role = 'medic'$q$,
         tests.uid('orga', 'user_admin'), tests.uid('orga', 'user_medical')),
  '42501',
  null,
  'nor re-point another user''s medic row at themselves'
);

/* Nor by changing the role of one of their own rows to medic. user_admin
   holds only sport_scientist, which 570's rule protects; grant them coach
   first so there is a row to turn. */
select is(
  tests.rows_affected(
    format($q$insert into user_roles (org_id, user_id, role, granted_by)
             values (%L, %L, 'coach', %L)$q$,
           tests.uid('orga', 'org'), tests.uid('orga', 'user_admin'), tests.uid('orga', 'user_admin'))),
  1::bigint,
  'a sport scientist may grant themselves a non-medic role (coach) — only medic is refused'
);
select throws_ok(
  format($q$update user_roles set role = 'medic' where user_id = %L and role = 'coach'$q$,
         tests.uid('orga', 'user_admin')),
  '42501',
  null,
  'nor turn one of their own rows into medic'
);

select is(
  (select count(*)::int from user_roles
    where user_id = tests.uid('orga', 'user_admin') and role = 'medic'),
  0,
  'the sport scientist still holds no medic row after every attempt'
);

-- ===========================================================================
-- 3. Granting medic to ANOTHER user is allowed, unchanged.
-- ===========================================================================
select is(
  tests.rows_affected(
    format($q$insert into user_roles (org_id, user_id, role, granted_by)
             values (%L, %L, 'medic', %L)$q$,
           tests.uid('orga', 'org'), tests.uid('orga', 'user_coach'), tests.uid('orga', 'user_admin'))),
  1::bigint,
  'the same sport scientist grants medic to the coach — allowed'
);

-- ===========================================================================
-- 4. The rule is about the ACTING user, so a connection with no JWT — the
-- service role, seeds, scripts — is not refused: auth_user_id() is null there.
-- ===========================================================================
reset role;
/* The fixture helper set the claim with is_local = true, so it survives
   `reset role`; a real service-role connection carries no JWT at all. Clear it
   the way 520 does, so what is measured is the connection production has. */
select set_config('request.jwt.claims', '', true);
select is(
  tests.rows_affected(
    format($q$insert into user_roles (org_id, user_id, role, granted_by)
             values (%L, %L, 'medic', %L)$q$,
           tests.uid('orga', 'org'), tests.uid('orga', 'user_admin'), tests.uid('orga', 'user_medical'))),
  1::bigint,
  'with no acting user there is no self to refuse: a seed or script can still grant medic to the admin'
);

-- ===========================================================================
-- 5. The trigger now fires on INSERT as well.
-- ===========================================================================
select is(
  (select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'user_roles' and t.tgname = 'user_roles_guard'
     and not t.tgisinternal
     and (t.tgtype & 2) <> 0     -- BEFORE
     and (t.tgtype & 1) <> 0     -- ROW
     and (t.tgtype & 4) <> 0     -- INSERT
     and (t.tgtype & 8) <> 0     -- DELETE
     and (t.tgtype & 16) <> 0),  -- UPDATE
  1,
  'user_roles_guard is a BEFORE INSERT OR DELETE OR UPDATE row trigger on user_roles'
);

select * from finish();
rollback;
