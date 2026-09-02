-- 340_assigned_sessions_by_week_test.sql
--
-- Migration 0062: resolve_my_assigned_sessions_by_week. CLAUDE.md §5 makes the test for a
-- permission rule mandatory, and this function is security definer over three tables an
-- athlete has no select on at all (programmes, programme_blocks, programme_sessions), so
-- the guard is the entire safety story.
--
-- What it proves
--   1. An athlete reads their OWN assigned counts.
--   2. An athlete passing another athlete's id gets an empty set, not that athlete's
--      programme. A definer function that trusted its argument would be a squad-wide
--      programme leak through a single rpc call.
--   3. A user in another org gets nothing, even for an athlete id that really exists.
--   4. The calendar-week to programme-week mapping is right, including the roll from the
--      end of one block into the start of the next.
--   5. Past the last block the answer is ZERO, not a repeat of week 1. This is the one
--      place the schema does not state the answer, so it is pinned here: a programme with
--      a defined duration that has run out assigns nothing.
--   6. A duplicate assignment path (direct AND group, to the same programme) counts each
--      session ONCE. Migration 0038 records this shape occurring in real data.
--   7. A suspended assignment contributes nothing.
--   8. Nutrition programmes are excluded — they carry no sessions to log against.
--
-- Which spec sections this implements
--   Fydr Athlete App.dc.html 23k ("of 14 assigned")
--   implementation spec §9 rule 2 (every aggregate states its denominator)
--   CLAUDE.md §2 rule 1 (org_id on every read), §2 rule 2 (roles resolved server-side)

begin;
select * from no_plan();

select tests.fixtures();

-- ===========================================================================
-- Build a two-block programme: block 1 runs 2 weeks, block 2 runs 2 weeks.
-- Week 1 has two sessions, week 2 has three, block 2 week 1 has one.
-- ===========================================================================
select tests.set_jwt(tests.uid('orga', 'user_coach'));

select lives_ok(format($q$
  insert into programmes (id, org_id, name, programme_type, status, created_by)
  values (%L, %L, 'Pre-season', 'gym', 'active', %L)$q$,
  tests.uid('orga','p1'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'coach creates the gym programme');

select lives_ok(format($q$
  insert into programme_blocks (id, org_id, programme_id, name, sequence, duration_weeks)
  values (%L, %L, %L, 'Accumulation', 1, 2), (%L, %L, %L, 'Intensification', 2, 2)$q$,
  tests.uid('orga','b1'), tests.uid('orga','org'), tests.uid('orga','p1'),
  tests.uid('orga','b2'), tests.uid('orga','org'), tests.uid('orga','p1')),
  'two blocks, two weeks each');

select lives_ok(format($q$
  insert into programme_sessions (org_id, block_id, name, week_number, day_number, sequence)
  values (%L, %L, 'Lower A', 1, 1, 1),
         (%L, %L, 'Upper A', 1, 3, 2),
         (%L, %L, 'Lower B', 2, 1, 1),
         (%L, %L, 'Upper B', 2, 3, 2),
         (%L, %L, 'Power',   2, 5, 3),
         (%L, %L, 'Peak',    1, 1, 1)$q$,
  tests.uid('orga','org'), tests.uid('orga','b1'),
  tests.uid('orga','org'), tests.uid('orga','b1'),
  tests.uid('orga','org'), tests.uid('orga','b1'),
  tests.uid('orga','org'), tests.uid('orga','b1'),
  tests.uid('orga','org'), tests.uid('orga','b1'),
  tests.uid('orga','org'), tests.uid('orga','b2')),
  'block 1 week 1 has 2 sessions, week 2 has 3; block 2 week 1 has 1');

-- Anchored to a known Monday so the arithmetic below is readable.
select lives_ok(format($q$
  insert into programme_assignments (org_id, programme_id, athlete_id, starts_on, assigned_by)
  values (%L, %L, %L, date '2026-01-05', %L)$q$,
  tests.uid('orga','org'), tests.uid('orga','p1'), tests.uid('orga','athlete_1'),
  tests.uid('orga','user_coach')),
  'assigned to athlete_1 from Monday 5 Jan 2026');


-- ===========================================================================
-- 4 + 5. The mapping, and what happens after the programme runs out
-- ===========================================================================
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select is(
  (select array_agg(assigned order by week_start)
   from resolve_my_assigned_sessions_by_week(
          tests.uid('orga','athlete_1'), date '2026-01-05', date '2026-02-08')),
  array[2, 3, 1, 0, 0],
  'w/c 5 Jan = block1 wk1 (2), 12 Jan = block1 wk2 (3), 19 Jan = block2 wk1 (1), '
  '26 Jan = block2 wk2 (0 sessions authored), 2 Feb = past the last block (0, not a repeat)'
);

select is(
  (select count(*)::int
   from resolve_my_assigned_sessions_by_week(
          tests.uid('orga','athlete_1'), date '2026-01-05', date '2026-01-05')),
  1,
  'a one-day window still returns the week that contains it'
);

select is(
  (select assigned
   from resolve_my_assigned_sessions_by_week(
          tests.uid('orga','athlete_1'), date '2025-12-01', date '2025-12-07')),
  0,
  'a week BEFORE the assignment starts assigns nothing'
);


-- ===========================================================================
-- 1 + 2. The guard: own id yes, another athlete's id no
-- ===========================================================================
select isnt_empty(
  format($q$select * from resolve_my_assigned_sessions_by_week(%L, date '2026-01-05', date '2026-01-11')$q$,
         tests.uid('orga','athlete_1')),
  'an athlete reads their own assigned counts'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is_empty(
  format($q$select * from resolve_my_assigned_sessions_by_week(%L, date '2026-01-05', date '2026-01-11')$q$,
         tests.uid('orga','athlete_1')),
  'athlete_2 passing athlete_1''s id gets NOTHING — the argument is not trusted'
);


-- ===========================================================================
-- 3. Cross-tenant
-- ===========================================================================
select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is_empty(
  format($q$select * from resolve_my_assigned_sessions_by_week(%L, date '2026-01-05', date '2026-01-11')
            where assigned > 0$q$,
         tests.uid('orga','athlete_1')),
  'a coach in another org sees no assigned work for an athlete of org A'
);


-- ===========================================================================
-- 6. A duplicate assignment path must not double count
-- ===========================================================================
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(format($q$
  insert into groups (id, org_id, name, created_by) values (%L, %L, 'Forwards', %L)$q$,
  tests.uid('orga','grp'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'a group exists');
select lives_ok(format($q$
  insert into group_memberships (org_id, group_id, athlete_id) values (%L, %L, %L)$q$,
  tests.uid('orga','org'), tests.uid('orga','grp'), tests.uid('orga','athlete_1')),
  'athlete_1 is in it');
select lives_ok(format($q$
  insert into programme_assignments (org_id, programme_id, group_id, starts_on, assigned_by)
  values (%L, %L, %L, date '2026-01-05', %L)$q$,
  tests.uid('orga','org'), tests.uid('orga','p1'), tests.uid('orga','grp'),
  tests.uid('orga','user_coach')),
  'the SAME programme is also assigned to the group — the 0038 shape');

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select assigned
   from resolve_my_assigned_sessions_by_week(
          tests.uid('orga','athlete_1'), date '2026-01-05', date '2026-01-11')),
  2,
  'still 2, not 4 — count distinct, because two assignment paths are not two programmes'
);


-- ===========================================================================
-- 7. A suspended assignment asks for nothing
-- ===========================================================================
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(format($q$
  update programme_assignments set status = 'suspended'
  where org_id = %L and programme_id = %L$q$,
  tests.uid('orga','org'), tests.uid('orga','p1')),
  'both assignments are suspended');

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select assigned
   from resolve_my_assigned_sessions_by_week(
          tests.uid('orga','athlete_1'), date '2026-01-05', date '2026-01-11')),
  0,
  'a suspended assignment contributes nothing — it is not asking for the work'
);


-- ===========================================================================
-- 8. Nutrition programmes are not gym work
-- ===========================================================================
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(format($q$
  insert into programmes (id, org_id, name, programme_type, status, created_by)
  values (%L, %L, 'Fuelling', 'nutrition', 'active', %L)$q$,
  tests.uid('orga','pn'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'a nutrition programme exists');
select lives_ok(format($q$
  insert into programme_blocks (id, org_id, programme_id, name, sequence, duration_weeks)
  values (%L, %L, %L, 'Base', 1, 4)$q$,
  tests.uid('orga','bn'), tests.uid('orga','org'), tests.uid('orga','pn')),
  'with a block');
select lives_ok(format($q$
  insert into programme_sessions (org_id, block_id, name, week_number, day_number, sequence)
  values (%L, %L, 'Weekly review', 1, 1, 1)$q$,
  tests.uid('orga','org'), tests.uid('orga','bn')),
  'and a session on it');
select lives_ok(format($q$
  insert into programme_assignments (org_id, programme_id, athlete_id, starts_on, assigned_by)
  values (%L, %L, %L, date '2026-01-05', %L)$q$,
  tests.uid('orga','org'), tests.uid('orga','pn'), tests.uid('orga','athlete_1'),
  tests.uid('orga','user_coach')),
  'assigned to athlete_1');

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select assigned
   from resolve_my_assigned_sessions_by_week(
          tests.uid('orga','athlete_1'), date '2026-01-05', date '2026-01-11')),
  0,
  'nutrition sessions do not inflate a GYM denominator — nothing is logged against them'
);

select * from finish();
rollback;
