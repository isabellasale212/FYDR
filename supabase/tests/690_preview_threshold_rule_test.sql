-- PATTERN-S8 C6 (2026-09-13): "a 28-day preview of how many athletes a rule
-- would have flagged, writing nothing."
--
-- WHAT 0113 ADDS: preview_threshold_rule(...) and preview_threshold(id) —
-- security-definer reads that run 0052's own _threshold_breach_on_day over
-- the trailing N local days for a rule that need not exist, returning one
-- row per athlete who would have been flagged with the number of days, and
-- the in-scope count for the denominator; a single null-athlete row when
-- nobody. Cooldown is ignored. Sport scientist and coach only; empty for
-- anyone else; nothing is written.

begin;
select * from no_plan();

select tests.fixtures();

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');

-- The fixture holds one wellness row per athlete yesterday: a1 slept 7.5h,
-- a2 slept 6.2h. Every rule below is absolute so the baseline gate is off.

-- 1. the coach previews an unsaved rule: sleep below 7h flags a2 alone
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*)::int from flags where org_id = tests.uid('orga', 'org') and metric = 'wellness.sleep_hours'),
  1, 'before: the fixture holds one sleep flag'
);
select is(
  (select count(*)::int from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 1, 0, null, 28) where athlete_id is not null),
  1, 'sleep below 7h over 28 days: one athlete would have been flagged'
);
select is(
  (select athlete_id from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 1, 0, null, 28) where athlete_id is not null),
  tests.uid('orga', 'athlete_2'), 'and it is the athlete who slept 6.2h'
);
select is(
  (select breach_days from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 1, 0, null, 28) where athlete_id is not null),
  1, 'on one day — the one day with an entry'
);
select is(
  (select in_scope from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 1, 0, null, 28) limit 1),
  (select count(*)::int from athletes where org_id = tests.uid('orga', 'org') and deleted_at is null and status <> 'left_club'),
  'the denominator is every live athlete in the org'
);

-- 2. a line nobody crosses: one null row carrying the denominator, never no rows
select is(
  (select count(*)::int from public.preview_threshold_rule('wellness.sleep_hours', 'below', 5, 'absolute', null, 1, 0, null, 28)),
  1, 'nobody flagged: exactly one row'
);
select is(
  (select athlete_id from public.preview_threshold_rule('wellness.sleep_hours', 'below', 5, 'absolute', null, 1, 0, null, 28)),
  null::uuid, 'with no athlete'
);
select cmp_ok(
  (select in_scope from public.preview_threshold_rule('wellness.sleep_hours', 'below', 5, 'absolute', null, 1, 0, null, 28)),
  '>', 0, 'and the denominator still there, so the screen can say "0 of N"'
);

-- 3. consecutive days are gap-tolerant, exactly as the engine's (0053): a
--    two-day rule with one breaching entry and a gap beside it still fires,
--    once, on the window that holds the entry; the all-gap windows never do
select is(
  (select breach_days from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 2, 0, null, 28) where athlete_id = tests.uid('orga', 'athlete_2')),
  1, 'a two-day rule with one entry and a gap fires on one window, as the engine would — a gap is neither a breach nor a reset'
);
select is(
  (select count(*)::int from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 2, 0, null, 28) where athlete_id is not null),
  1, 'and still only the athlete who breached'
);

-- 4. a window outside 1..90 is refused, not silently clamped
select throws_ok(
  $q$select * from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 1, 0, null, 400)$q$,
  'P0001', 'preview_window_out_of_range', 'a 400-day window is refused'
);

-- 5. nothing is written: the flags table holds exactly what the fixture put
--    there (one sleep flag, flg2), and no more after every preview above
select is(
  (select count(*)::int from flags where org_id = tests.uid('orga', 'org') and metric = 'wellness.sleep_hours'),
  1, 'the one fixture sleep flag, and no row written by any preview above'
);

-- 6. the saved rule, by id: the fixture's readiness z-score rule needs 10
--    baseline observations and has one entry, so it previews nobody, with
--    the denominator
select is(
  (select count(*)::int from public.preview_threshold(tests.uid('orga', 'threshold'), 28)),
  1, 'a saved rule previews through its own row'
);
select is(
  (select athlete_id from public.preview_threshold(tests.uid('orga', 'threshold'), 28)),
  null::uuid, 'the z-score rule with one observation flags nobody — the baseline gate holds in the preview as in the engine'
);

-- 7. another org's rule id: nothing, not an error
select is(
  (select count(*)::int from public.preview_threshold(tests.uid('orgb', 'threshold'), 28)),
  0, 'a rule in another club previews as nothing'
);

-- 8. the medic, who reads thresholds but does not configure them, gets nothing
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*)::int from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 1, 0, null, 28)),
  0, 'the medic gets an empty preview'
);

-- 9. the sport scientist may
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*)::int from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 1, 0, null, 28) where athlete_id is not null),
  1, 'the sport scientist previews'
);

-- 10. anonymous: nothing
select tests.clear_jwt();
select is(
  (select count(*)::int from public.preview_threshold_rule('wellness.sleep_hours', 'below', 7, 'absolute', null, 1, 0, null, 28)),
  0, 'anonymous gets nothing'
);

select * from finish();
rollback;
