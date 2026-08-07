-- 020_cross_tenant_test.sql
--
-- THE PHASE 0 EXIT GATE.
--
-- For every table that holds club data, for each of the four roles, set the JWT claims to
-- one organisation and attempt to read the other organisation's rows. Assert zero. Then do
-- it again in the opposite direction, because a boundary that holds one way and not the
-- other is not a boundary.
--
-- Which spec sections this implements
--   01-roles-and-permissions.md §6: "Cross-organisation isolation. Absolute. There is no
--     legitimate cross-organisation read in Fydr... an automated test suite must attempt,
--     for every table, to read another organisation's rows as each of the four roles, and
--     assert zero rows returned. This suite runs in CI and blocks merge on failure. It is
--     the only test suite that is mandatory."
--   CONTRACT.md, definition of done for Phase 0
--   10-roadmap.md §3 exit criteria
--
-- Two things that make this suite worth trusting rather than merely green
--   1. The table list is enumerated from the catalogue, not typed out. Add a table with an
--      org_id column and it is in this suite on the next run whether you remembered or not.
--   2. Every role block carries POSITIVE controls as well. A suite that only asserts zero
--      passes just as happily when every policy denies everything and the product is
--      broken. The positive controls are what tell the two apart.

begin;
select * from no_plan();

select tests.fixtures();

-- From here the session is an ordinary application user. Nothing below runs with the
-- privileges the fixtures were created with.
set local role authenticated;

-- ---------------------------------------------------------------------------
-- COACH in organisation A reading organisation B
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select is(
  tests.count_rows_for_org(t, tests.uid('orgb', 'org')), 0::bigint,
  format('%s: coach in org A reads zero rows of org B', t)
)
from tests.club_tables() t;

select is(
  (select count(*) from organisations where id = tests.uid('orgb', 'org')),
  0::bigint,
  'organisations: coach in org A reads zero rows of org B'
);

-- ---------------------------------------------------------------------------
-- MEDICAL in organisation A reading organisation B
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_medical'));

select is(
  tests.count_rows_for_org(t, tests.uid('orgb', 'org')), 0::bigint,
  format('%s: medical in org A reads zero rows of org B', t)
)
from tests.club_tables() t;

select is(
  (select count(*) from organisations where id = tests.uid('orgb', 'org')),
  0::bigint,
  'organisations: medical in org A reads zero rows of org B'
);

-- ---------------------------------------------------------------------------
-- ADMIN in organisation A reading organisation B
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_admin'));

select is(
  tests.count_rows_for_org(t, tests.uid('orgb', 'org')), 0::bigint,
  format('%s: admin in org A reads zero rows of org B', t)
)
from tests.club_tables() t;

select is(
  (select count(*) from organisations where id = tests.uid('orgb', 'org')),
  0::bigint,
  'organisations: admin in org A reads zero rows of org B'
);

-- ---------------------------------------------------------------------------
-- ATHLETE in organisation A reading organisation B
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select is(
  tests.count_rows_for_org(t, tests.uid('orgb', 'org')), 0::bigint,
  format('%s: athlete in org A reads zero rows of org B', t)
)
from tests.club_tables() t;

select is(
  (select count(*) from organisations where id = tests.uid('orgb', 'org')),
  0::bigint,
  'organisations: athlete in org A reads zero rows of org B'
);

-- ---------------------------------------------------------------------------
-- COACH in organisation B reading organisation A
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orgb', 'user_coach'));

select is(
  tests.count_rows_for_org(t, tests.uid('orga', 'org')), 0::bigint,
  format('%s: coach in org B reads zero rows of org A', t)
)
from tests.club_tables() t;

select is(
  (select count(*) from organisations where id = tests.uid('orga', 'org')),
  0::bigint,
  'organisations: coach in org B reads zero rows of org A'
);

-- ---------------------------------------------------------------------------
-- MEDICAL in organisation B reading organisation A
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orgb', 'user_medical'));

select is(
  tests.count_rows_for_org(t, tests.uid('orga', 'org')), 0::bigint,
  format('%s: medical in org B reads zero rows of org A', t)
)
from tests.club_tables() t;

select is(
  (select count(*) from organisations where id = tests.uid('orga', 'org')),
  0::bigint,
  'organisations: medical in org B reads zero rows of org A'
);

-- ---------------------------------------------------------------------------
-- ADMIN in organisation B reading organisation A
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orgb', 'user_admin'));

select is(
  tests.count_rows_for_org(t, tests.uid('orga', 'org')), 0::bigint,
  format('%s: admin in org B reads zero rows of org A', t)
)
from tests.club_tables() t;

select is(
  (select count(*) from organisations where id = tests.uid('orga', 'org')),
  0::bigint,
  'organisations: admin in org B reads zero rows of org A'
);

-- ---------------------------------------------------------------------------
-- ATHLETE in organisation B reading organisation A
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orgb', 'user_athlete_1'));

select is(
  tests.count_rows_for_org(t, tests.uid('orga', 'org')), 0::bigint,
  format('%s: athlete in org B reads zero rows of org A', t)
)
from tests.club_tables() t;

select is(
  (select count(*) from organisations where id = tests.uid('orga', 'org')),
  0::bigint,
  'organisations: athlete in org B reads zero rows of org A'
);

-- ---------------------------------------------------------------------------
-- Positive controls. Testing the test: if these fail, the zero-row assertions above are
-- passing for the wrong reason.
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select cmp_ok(tests.count_rows_for_org('wellness_entries', tests.uid('orga', 'org')),
              '>', 0::bigint,
              'positive control: a coach DOES read their own organisation wellness entries');
select cmp_ok(tests.count_rows_for_org('injuries', tests.uid('orga', 'org')),
              '>', 0::bigint,
              'positive control: a coach DOES read their own organisation injuries');
select cmp_ok(tests.count_rows_for_org('availability', tests.uid('orga', 'org')),
              '>', 0::bigint,
              'positive control: a coach DOES read their own organisation availability');
select cmp_ok(tests.count_rows_for_org('thresholds', tests.uid('orga', 'org')),
              '>', 0::bigint,
              'positive control: a coach DOES read their own organisation thresholds');
select is((select count(*) from organisations), 1::bigint,
          'positive control: a coach sees exactly one organisation, their own');

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select cmp_ok(tests.count_rows_for_org('injury_clinical', tests.uid('orga', 'org')),
              '>', 0::bigint,
              'positive control: medical DOES read their own organisation clinical detail');

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select cmp_ok(tests.count_rows_for_org('audit_log', tests.uid('orga', 'org')),
              '>', 0::bigint,
              'positive control: an admin DOES read their own organisation audit log');

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(tests.count_rows_for_org('wellness_entries', tests.uid('orga', 'org')), 1::bigint,
          'positive control: an athlete reads exactly their own wellness entry, not the squad');
select cmp_ok(tests.count_rows_for_org('sessions', tests.uid('orga', 'org')),
              '>', 0::bigint,
              'positive control: an athlete DOES read their own organisation schedule');


-- ---------------------------------------------------------------------------
-- Cross tenant WRITES. Reading is the headline risk; writing into another club is worse.
-- ---------------------------------------------------------------------------

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select throws_ok(
  format($q$insert into sessions (org_id, season_id, session_type, title, starts_at, status)
            values (%L, %L, 'training', 'Injected', now(), 'planned')$q$,
         tests.uid('orgb', 'org'), tests.uid('orgb', 'season')),
  '42501',
  null,
  'a coach in org A cannot insert a session into org B'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));

select throws_ok(
  format($q$insert into availability (org_id, athlete_id, status, set_by)
            values (%L, %L, 'available', %L)$q$,
         tests.uid('orgb', 'org'), tests.uid('orgb', 'athlete_1'),
         tests.uid('orga', 'user_medical')),
  '42501',
  null,
  'medical in org A cannot set availability for an athlete in org B'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select throws_ok(
  format($q$insert into wellness_entries (org_id, athlete_id, entry_date, sleep_hours,
                                          source, created_by)
            values (%L, %L, current_date, 8.0, 'self_report', %L)$q$,
         tests.uid('orgb', 'org'), tests.uid('orgb', 'athlete_1'),
         tests.uid('orga', 'user_athlete_1')),
  '42501',
  null,
  'an athlete in org A cannot insert a wellness entry into org B'
);

select throws_ok(
  format($q$insert into nutrition_checkins (org_id, athlete_id, week_start, iso_year,
                                            iso_week, answer, source, created_by)
            values (%L, %L, date_trunc('week', current_date - 7)::date,
                    extract(isoyear from current_date - 7)::int,
                    extract(week    from current_date - 7)::int,
                    'yes', 'self_report', %L)$q$,
         tests.uid('orgb', 'org'), tests.uid('orgb', 'athlete_1'),
         tests.uid('orga', 'user_athlete_1')),
  '42501',
  null,
  'an athlete in org A cannot post a nutrition check in against an athlete in org B'
);


-- ---------------------------------------------------------------------------
-- An unauthenticated caller reads nothing at all, from any table.
-- ---------------------------------------------------------------------------

select tests.clear_jwt();

select is(
  tests.count_rows_for_org(t, tests.uid('orga', 'org')), 0::bigint,
  format('%s: a caller with no claims reads zero rows', t)
)
from tests.club_tables() t;


select * from finish();
rollback;
