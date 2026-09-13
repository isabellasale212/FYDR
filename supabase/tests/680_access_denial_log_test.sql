-- PATTERN-S6 C7, the denial log (Isabella, 2026-09-13: "build it, including
-- the migration and the reference codes — under a v1 that gets sold, a denial
-- a user cannot describe is a support call that cannot be resolved").
--
-- WHAT 0112 ADDS: log_access_denial(p_gate, p_path) — a security-definer
-- function any signed-in user may call, which writes one audit_log row for
-- their own org as themselves (action 'access.denied', entity_type 'route',
-- the gate, the path and the roles they held in metadata) and returns a
-- reference code derived from the row's id, "D-" followed by the id in
-- base 36. The code is what the denied screen shows and what a sport
-- scientist finds in Settings › Audit log. The row is append-only like every
-- audit row (0007's trigger and 0012's absent policies).

begin;
select * from no_plan();

select tests.fixtures();

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');

-- 1. a coach refused at a gate logs it as themselves and gets a code back
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  $q$select public.log_access_denial('report:squad', '/reports/squad')$q$,
  'a signed-in staff member may log a denial'
);
select matches(
  (select public.log_access_denial('analytics', '/analytics')),
  '^D-[0-9A-Z]{1,13}$',
  'the reference is "D-" and the id in base 36, upper case'
);
select isnt(
  (select public.log_access_denial('analytics', '/analytics')),
  (select public.log_access_denial('analytics', '/analytics')),
  'every denial gets its own code'
);

-- 2. the row is the audit log's, readable by the sport scientist, not the coach
select is(
  (select count(*)::int from audit_log where action = 'access.denied'),
  0, 'the coach cannot read the log back — audit_log select is the sport scientist''s'
);
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select cmp_ok(
  (select count(*)::int from audit_log where action = 'access.denied' and org_id = tests.uid('orga', 'org')),
  '>=', 4, 'the sport scientist reads the denials'
);
select is(
  (select actor_id from audit_log where action = 'access.denied' order by id desc limit 1),
  tests.uid('orga', 'user_coach'), 'the actor is the person refused, never anyone else'
);
select is(
  (select entity_type from audit_log where action = 'access.denied' order by id desc limit 1),
  'route', 'entity_type route'
);
select is(
  (select metadata ->> 'gate' from audit_log where action = 'access.denied' order by id desc limit 1),
  'analytics', 'the gate is in the metadata'
);
select is(
  (select metadata ->> 'path' from audit_log where action = 'access.denied' order by id desc limit 1),
  '/analytics', 'and the path'
);
select ok(
  (select (metadata -> 'roles') ? 'coach' from audit_log where action = 'access.denied' order by id desc limit 1),
  'and the roles the person held, from the token, not from the caller'
);
select is(
  (select metadata ->> 'reference' from audit_log where action = 'access.denied' order by id desc limit 1),
  (select 'D-' || public.reference_base36(id) from audit_log where action = 'access.denied' order by id desc limit 1),
  'the reference stored on the row is the one derived from its id, so it is searchable'
);

-- 3. the code round-trips: base 36 of the id, and back
select is(public.reference_base36(0), '0', 'base 36: zero');
select is(public.reference_base36(35), 'Z', 'base 36: 35 is Z');
select is(public.reference_base36(36), '10', 'base 36: 36 is 10');
select is(public.reference_base36(1295), 'ZZ', 'base 36: 1295 is ZZ');

-- 4. a path is stored as given but capped; nothing else in the payload reaches the row
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select matches(
  (select public.log_access_denial('report:squad', repeat('x', 900))),
  '^D-[0-9A-Z]{1,13}$',
  'a long path does not break the call'
);
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select cmp_ok(
  (select length(metadata ->> 'path') from audit_log where action = 'access.denied' order by id desc limit 1),
  '<=', 512, 'and is capped at 512 characters on the row'
);

-- 5. an athlete may log one too (the athlete shell's gates), as themselves
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  $q$select public.log_access_denial('staff_only', '/dashboard')$q$,
  'an athlete refused at a staff gate logs it'
);

-- 6. unauthenticated: refused
select tests.clear_jwt();
reset role;
set local role anon;
select throws_ok(
  $q$select public.log_access_denial('analytics', '/analytics')$q$,
  'P0001', 'not_authenticated',
  'no session, no row'
);

select * from finish();
rollback;
