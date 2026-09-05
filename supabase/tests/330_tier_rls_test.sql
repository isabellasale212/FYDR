-- 330_tier_rls_test.sql
--
-- Migration 0061: subscription tier enters RLS for the first time. CLAUDE.md §5 makes the
-- test for a permission rule mandatory, so this file is the rule.
--
-- Why the rule was needed
--   docs/12-product-tiers.md §8 required every revenue-protecting rule to exist in RLS or
--   an Edge Function. `tier` appeared in no policy at all. The live consequence was the
--   Apple Health toggle: HealthkitConsentToggle writes athlete_consents through the
--   BROWSER client, so on Basic the app withheld the control and the database accepted
--   the row anyway.
--
-- What it proves
--   1. A Basic club's athlete cannot grant HealthKit sync.
--   2. A Premium club's athlete can.
--   3. WITHDRAWAL WORKS ON EVERY TIER. This is the assertion that matters most. Consent
--      that cannot be withdrawn is not consent, and healthkit.ts withdraws by setting
--      withdrawn_at while LEAVING granted_at in place -- so a predicate written against
--      granted_at alone would trap a Basic athlete in a consent they wanted to revoke.
--      If someone later "simplifies" 0061 that way, this file fails and says why.
--   4. Re-granting after withdrawal is blocked again on Basic.
--   5. leaderboard_visibility is untouched: it is not a paid feature.
--   6. The helper fails CLOSED -- no claims resolves to Basic, never Premium.
--   7. Reading a consent is not gated on either tier, and existing rows survive: a club
--      that downgrades keeps its record of what was granted and when.
--
-- Which spec sections this implements
--   12-product-tiers.md §8 (technical enforcement)
--   09-security-and-compliance.md (consent is the athlete's)
--   CLAUDE.md §2 rule 2

begin;
select * from no_plan();

select tests.fixtures();

-- Fixtures are built on the column default, which is the Basic tier. Asserted rather than
-- assumed: every deny case below is worthless if these orgs were Premium all along.
select is(
  (select tier::text from organisations where id = tests.uid('orga', 'org')),
  'core',
  'org A starts on Basic, so the deny cases below are actually testing something'
);

update organisations set tier = 'performance' where id = tests.uid('orgb', 'org');

select is(
  (select tier::text from organisations where id = tests.uid('orgb', 'org')),
  'performance',
  'org B is Premium'
);

-- From here the session is an ordinary application user. Without this the file
-- runs as the table owner, and an owner bypasses RLS unless the table is set to
-- FORCE ROW LEVEL SECURITY, which none of these are. Every refusal asserted
-- below was therefore not being tested at all: the write simply succeeded.
-- 020_cross_tenant_test.sql has carried this line since it was written; this
-- file was missing it.
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');

-- ---------------------------------------------------------------------------
-- 1. A Basic club cannot grant HealthKit sync, whoever asks
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));

select throws_ok(
  format($q$insert into athlete_consents (org_id, athlete_id, purpose, granted_at, notice_version)
            values (%L, %L, 'healthkit_sync', now(), '2026.1')$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2')),
  '42501',
  null,
  'an athlete on a Basic club cannot grant HealthKit sync, even straight to PostgREST'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));

select throws_ok(
  format($q$insert into athlete_consents (org_id, athlete_id, purpose, granted_at, notice_version)
            values (%L, %L, 'healthkit_sync', now(), '2026.1')$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2')),
  '42501',
  null,
  'nor can an admin record one on their behalf -- the tier gate is not a role gate'
);

-- ---------------------------------------------------------------------------
-- 2. leaderboard_visibility is not a paid feature and must be unaffected
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));

select lives_ok(
  format($q$insert into athlete_consents (org_id, athlete_id, purpose, granted_at, notice_version)
            values (%L, %L, 'leaderboard_visibility', now(), '2026.1')$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2')),
  'the under-18 leaderboard opt-in still works on Basic: it was never a paid feature'
);

-- ---------------------------------------------------------------------------
-- 3. THE ONE THAT MATTERS. Withdrawal is permitted on Basic.
--
-- build_org grants athlete_1 healthkit_sync. That club is on Basic. The athlete must be
-- able to revoke it, and healthkit.ts revokes by setting withdrawn_at ONLY -- granted_at
-- stays. A predicate reading granted_at alone would refuse this.
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select is(
  tests.rows_affected(
    format($q$update athlete_consents set withdrawn_at = now()
              where athlete_id = %L and purpose = 'healthkit_sync'$q$,
           tests.uid('orga', 'athlete_1')))::int,
  1,
  'a Basic club athlete CAN withdraw an existing HealthKit consent -- consent that cannot be withdrawn is not consent'
);

-- ---------------------------------------------------------------------------
-- 4. ...but cannot turn it back on while the club is Basic
-- ---------------------------------------------------------------------------

select throws_ok(
  format($q$update athlete_consents set granted_at = now(), withdrawn_at = null
            where athlete_id = %L and purpose = 'healthkit_sync'$q$,
         tests.uid('orga', 'athlete_1')),
  '42501',
  null,
  'withdrawal is not a loophole: re-granting on Basic is refused'
);

-- ---------------------------------------------------------------------------
-- 5. A Premium club is unaffected
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orgb', 'user_athlete_2'));

select lives_ok(
  format($q$insert into athlete_consents (org_id, athlete_id, purpose, granted_at, notice_version)
            values (%L, %L, 'healthkit_sync', now(), '2026.1')$q$,
         tests.uid('orgb', 'org'), tests.uid('orgb', 'athlete_2')),
  'a Premium club athlete grants HealthKit sync exactly as before'
);

select is(
  (select auth_org_is_premium()),
  true,
  'auth_org_is_premium() is true inside a Premium club'
);

-- ---------------------------------------------------------------------------
-- 6. The helper fails CLOSED
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select auth_org_is_premium()), false, 'and false inside a Basic club');

select tests.clear_jwt();
select is(
  (select auth_org_is_premium()),
  false,
  'no claims at all resolves to Basic, never Premium: a tier check must fail closed'
);

-- The predicate itself, with no premium claim in scope.
select is(consent_write_allowed('leaderboard_visibility', now(), null), true,
          'predicate: another purpose is always allowed');
select is(consent_write_allowed('healthkit_sync', null, null), true,
          'predicate: a row that grants nothing is allowed');
select is(consent_write_allowed('healthkit_sync', now(), now()), true,
          'predicate: a withdrawn row is allowed -- this is the withdrawal path');
select is(consent_write_allowed('healthkit_sync', now(), null), false,
          'predicate: an ACTIVE grant is the only thing refused');

-- ---------------------------------------------------------------------------
-- 7. Reading is not gated, and a downgrade destroys no record
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- count(*), the idiom every other file in this suite uses, rather than
-- isnt_empty(): nothing else here calls it, so it is not proven available.
select is(
  (select count(*) from athlete_consents
    where athlete_id = tests.uid('orga', 'athlete_1') and purpose = 'healthkit_sync'),
  1::bigint,
  'the consent record survives on Basic and is still readable: a downgrade must not erase what was agreed'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));

select cmp_ok(
  (select count(*) from athlete_consents where org_id = tests.uid('orga', 'org')),
  '>=',
  1::bigint,
  'an admin can still read consents on Basic -- reading was never the paid part'
);

select * from finish();
rollback;
