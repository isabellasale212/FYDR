-- Who may write the schedule, asserted from the refusing side.
--
-- WHY THIS FILE EXISTS. G-33 narrowed scheduling to the sport scientist and the
-- coach — "Medic loses scheduling, including week templates" — and 0070/0073
-- enforce it. But the suite only ever proved the permitted path, so nothing
-- anywhere asserted that a medic CANNOT create a session. /schedule then shipped
-- with no role check at all: every staff role got the Edit toggle, + Session,
-- + Fixture, Apply template and Publish to athletes, and the refusal happened at
-- the database, out of sight of the person clicking. This is the database half.
--
-- BOTH REFUSAL SHAPES APPEAR HERE, and the difference is the whole reason this
-- file is worth reading. INSERT is gated in WITH CHECK, so a refused insert
-- RAISES 42501. UPDATE is gated in USING, so a refused update raises NOTHING —
-- it matches no row and reports success. throws_ok would be the wrong assertion
-- for the second, and would pass only if the GRANT were missing, which is a
-- different fact. The updates below are asserted as a count of affected rows,
-- with a positive control first so a zero means filtering and not an empty table.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. Sessions — INSERT, which raises
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into sessions (id, org_id, season_id, session_type, title, starts_at, duration_min)
            values (%L, %L, %L, 'training', 'Coach session', now() + interval '1 day', 60)$q$,
         tests.uid('orga','sess_coach'), tests.uid('orga','org'), tests.uid('orga','season')),
  'the COACH creates a session — the positive control, so the refusals below are the rule and not a broken insert'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into sessions (org_id, season_id, session_type, title, starts_at, duration_min)
            values (%L, %L, 'training', 'SS session', now() + interval '1 day', 60)$q$,
         tests.uid('orga','org'), tests.uid('orga','season')),
  'and so does the sport scientist'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into sessions (org_id, season_id, session_type, title, starts_at, duration_min)
            values (%L, %L, 'training', 'Medic session', now() + interval '1 day', 60)$q$,
         tests.uid('orga','org'), tests.uid('orga','season')),
  '42501', null,
  'the MEDIC cannot — G-33, the medic loses scheduling. The /schedule page offered them the control anyway'
);

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select throws_ok(
  format($q$insert into sessions (org_id, season_id, session_type, title, starts_at, duration_min)
            values (%L, %L, 'training', 'Nutritionist session', now() + interval '1 day', 60)$q$,
         tests.uid('orga','org'), tests.uid('orga','season')),
  '42501', null, 'neither can the nutritionist'
);

select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(
  format($q$insert into sessions (org_id, season_id, session_type, title, starts_at, duration_min)
            values (%L, %L, 'training', 'S&C session', now() + interval '1 day', 60)$q$,
         tests.uid('orga','org'), tests.uid('orga','season')),
  '42501', null, 'nor the S&C — programme work is theirs, the training calendar is not'
);


-- ===========================================================================
-- 2. Sessions — UPDATE, which does NOT raise
-- ===========================================================================

/* A data-modifying CTE has to sit at the top level, so the affected-row count
   is captured into a temp table rather than read from a subquery. */
create temp table upd_rows(who text, n bigint);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
with u as (update sessions set title = 'Coach renamed' where id = tests.uid('orga','sess_coach') returning 1)
insert into upd_rows select 'coach', count(*) from u;
select is(
  (select n from upd_rows where who = 'coach'),
  1::bigint,
  'the coach renames the session: one row, the positive control for the zero below'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$update sessions set title = 'Medic renamed' where id = %L$q$, tests.uid('orga','sess_coach')),
  'the medic''s UPDATE raises nothing at all — the USING clause simply matches no row'
);
with u as (update sessions set title = 'Medic renamed' where id = tests.uid('orga','sess_coach') returning 1)
insert into upd_rows select 'medic', count(*) from u;
select is(
  (select n from upd_rows where who = 'medic'),
  0::bigint,
  'and changes ZERO rows. This is the silent shape: the statement succeeds, nothing happens, '
  || 'and a screen that checks only for an error reports the rename as saved'
);
select is(
  (select title from sessions where id = tests.uid('orga','sess_coach')),
  'Coach renamed',
  'the title is still the coach''s — asserted on the row, not on the absence of an error'
);


-- ===========================================================================
-- 3. Week templates, and fixtures, are the SAME two roles
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into week_templates (org_id, name, structure, created_by)
            values (%L, 'Coach template', '{}'::jsonb, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'the coach creates a week template — which is what they could not find the button for'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into week_templates (org_id, name, structure, created_by)
            values (%L, 'Medic template', '{}'::jsonb, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_medical')),
  '42501', null, 'the medic cannot — "including week templates", stated in G-33 and enforced here'
);

/* Fixtures were narrowed to the same two roles by 0073, the migration named
   "writes the matrix never widened". Worth asserting rather than assuming: a
   superseded 0066 definition admits all five, and reading that one instead of
   the current one is exactly the mistake that makes a gate look unnecessary. */
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into fixtures (org_id, season_id, opponent, kickoff_at, home_away)
            values (%L, %L, 'Bath', now() + interval '7 days', 'away')$q$,
         tests.uid('orga','org'), tests.uid('orga','season')),
  'the coach adds a fixture'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into fixtures (org_id, season_id, opponent, kickoff_at, home_away)
            values (%L, %L, 'Exeter', now() + interval '8 days', 'home')$q$,
         tests.uid('orga','org'), tests.uid('orga','season')),
  '42501', null,
  'and the medic cannot, since 0073 — so the + Fixture control belongs behind the same gate as + Session'
);

select * from finish();
rollback;
