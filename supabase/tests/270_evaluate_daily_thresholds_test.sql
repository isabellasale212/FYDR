-- 270_evaluate_daily_thresholds_test.sql
--
-- public.evaluate_daily_thresholds_for_org(org, date) — migrations 0052 and 0053. The
-- windowed threshold sweep 05-architecture.md §7's job table already named but that,
-- until 0052, had no evaluation mechanism anywhere in the schema: every flag in the app
-- was hand-inserted (seed data, tests.build_org() below, or a demo script). thresholds
-- and flags both already have a complete, working UI sitting on a schema nothing had
-- ever written to automatically.
--
-- Written BEFORE the migration, per CLAUDE.md §5. Updated for 0053's fix (gap-tolerant
-- consecutive_days, per screens/thresholds.md edge case 8) with two new cases: a real
-- gap inside a genuine consecutive-day breach still fires (section 6b below), and a
-- real non-breaching value (not a gap) still correctly resets the run — already covered
-- by the shape 3 near-miss case in section 6, whose assertion text now says so.
--
-- All synthetic data in this file is anchored at least 200 days before current_date, far
-- from tests.build_org()'s own fixture dates (current_date - 1, current_date, and
-- current_date - 7), so nothing here collides with the base fixture's rows, and every
-- scenario below gets its own freshly-created athlete (never a1/a2) so that no scenario's
-- flags or cooldown state can leak into another's — except the two tests that
-- deliberately exercise cross-threshold and cross-org interaction (sections 8 and 9).
--
-- flags.raised_at defaults to now() (real wall-clock time), same as every flag this
-- function itself writes — it is never backdated by the function. The cooldown test
-- (section 7) is the one place this file needs a flag with a specific LOCAL raised date
-- in the past, so it inserts that one flag directly rather than going through the
-- function, exactly as 000_setup_test_helpers.sql's own fixtures insert flags directly.
--
-- What this file asserts, and why
--   1-5. Each of the 5 real comparison x baseline_type shapes (z_score/personal_rolling,
--        pct_change_below/personal_rolling, below/absolute x2 metrics, above/
--        personal_rolling) fires on a genuine breach and does not fire on a near miss,
--        using the exact real thresholds.md ground truth in this migration's own brief.
--        Shape 3's near miss is also the "genuine non-breach resets the run" case: its
--        middle day is a REAL wellness_entries row that does not breach, not a gap.
--   6. min_baseline_observations: an athlete with too little history never fires, even
--      with an extreme value, on the SAME threshold row that fires for a well-baselined
--      athlete in the same call — proving the gate is genuinely per-athlete.
--   6b. Gap tolerance (migration 0053): a genuine 2-consecutive-day breach with NO
--       wellness_entries row at all on one of the two days still fires, with the gap
--       correctly not counted as a breach itself, and staff_note records the real
--       "N of the last M days, with G missing" detail from screens/thresholds.md edge
--       case 8's own worked example.
--   7. cooldown_days: a second real breach inside the cooldown window raises nothing; one
--      after the window expires does.
--   8. Idempotency: the same org+date evaluated twice inserts each real flag once.
--   9. Cross-tenant isolation, including the two-organisation case (the same metric, two
--      different consecutive_days, evaluated independently) and a corrupted
--      group_memberships row that names an org B athlete under an org A group.

begin;
select * from no_plan();

select tests.fixtures();

-- ===========================================================================
-- Section 0: shared ids and reference dates.
--
-- V_DAY is 250 days before today — comfortably clear of every date
-- tests.build_org() writes to (current_date - 7 .. current_date). V_ACWR_DAY is its own,
-- further-back anchor because ACWR needs ~95 days of runway before the day evaluated.
-- ===========================================================================

-- (No set_config needed: current_date is stable for the whole transaction, so every
-- offset below is just written as a literal arithmetic expression on it.)

-- ===========================================================================
-- Section 1: SHAPE 1 — z_score / personal_rolling. "Readiness below personal norm",
-- the real ground truth threshold #1 (and #6's org A copy): value -1.500, baseline_days
-- 28, consecutive_days 2, min_baseline_observations 10, cooldown_days 3, severity high.
-- ===========================================================================

insert into public.thresholds
  (id, org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
   consecutive_days, min_baseline_observations, cooldown_days, severity, created_by)
values
  (tests.uid('orga', 'thr_readiness'), tests.uid('orga', 'org'), 'Test: readiness dip',
   'wellness', 'wellness.readiness_score', 'z_score', -1.5, 'personal_rolling', 28,
   2, 10, 3, 'high', tests.uid('orga', 'user_coach'));

insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values
  (tests.uid('orga', 'athlete_readiness'), tests.uid('orga', 'org'),
   'Test', 'Readiness', date '2000-01-01', 'active'),
  (tests.uid('orga', 'athlete_newbie'), tests.uid('orga', 'org'),
   'Test', 'Newbie', date '2004-01-01', 'active');

-- 28 days of clean alternating baseline (readiness 80/76, mean ~78, real variance) for
-- the well-baselined athlete, spanning both the fire day's own window and the near-miss
-- day's window 40 days later, so one bulk insert covers both sub-tests.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
select
  tests.uid('orga', 'org'), tests.uid('orga', 'athlete_readiness'), gs::date,
  7.5, case when (gs::date - date '2000-01-01') % 2 = 0 then 4 else 3 end, 4, 4, 4, 4,
  'self_report', tests.uid('orga', 'user_coach')
from generate_series(
  -- Starts 5 days earlier than the fire day's own 28-day baseline window needs, so that
  -- current_date - 251's window (which does NOT get to count current_date - 250's own
  -- breach value, unlike the fire day's window one day later) still has >= 10
  -- observations on its own.
  (current_date - 265)::timestamp, (current_date - 172)::timestamp, interval '1 day'
) as gs
where gs::date not in (current_date - 251, current_date - 250,
                        current_date - 211, current_date - 210,
                        current_date - 231, current_date - 230);

-- Fire day: both current_date - 251 and current_date - 250 breach (readiness 40, an
-- extreme dip — all five 1-5 sliders at 2).
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_readiness'), current_date - 251,
   6.0, 2, 2, 2, 2, 2, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_readiness'), current_date - 250,
   6.0, 2, 2, 2, 2, 2, 'self_report', tests.uid('orga', 'user_coach'));

-- Near-miss day: only the LAST of the two required days breaches (current_date - 210);
-- the day before it (current_date - 211) is a normal, non-breaching value.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_readiness'), current_date - 211,
   7.5, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_readiness'), current_date - 210,
   6.0, 2, 2, 2, 2, 2, 'self_report', tests.uid('orga', 'user_coach'));

-- athlete_newbie: only 5 baseline observations (fewer than min_baseline_observations),
-- placed just before the same two-day breach window, plus the same extreme dip values.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
select
  tests.uid('orga', 'org'), tests.uid('orga', 'athlete_newbie'), gs::date,
  7.5, case when (gs::date - date '2000-01-01') % 2 = 0 then 4 else 3 end, 4, 4, 4, 4,
  'self_report', tests.uid('orga', 'user_coach')
from generate_series(
  (current_date - 260)::timestamp, (current_date - 256)::timestamp, interval '1 day'
) as gs;

insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_newbie'), current_date - 251,
   6.0, 2, 2, 2, 2, 2, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_newbie'), current_date - 250,
   6.0, 2, 2, 2, 2, 2, 'self_report', tests.uid('orga', 'user_coach'));

-- Gap tolerance (migration 0053, screens/thresholds.md edge case 8): a genuine 2-
-- consecutive-day breach on thr_readiness (the SAME threshold row as the fire day
-- above, proving the fix is genuinely per-threshold-row too), but with NO
-- wellness_entries row at all on current_date - 231 — a true gap, not a normal value.
-- Only current_date - 230 gets a real breach row. Under the OLD strict reading this
-- would not have fired (the missing day would have read as "not breached"); under the
-- fixed gap-tolerant reading it does, because the gap is skipped rather than treated as
-- a reset — exactly the "athlete dodges a flag by skipping a submission" loophole 0053
-- closes.
--
-- A DEDICATED athlete (athlete_readiness_gap), not athlete_readiness itself: cooldown
-- is keyed on (threshold_id, athlete_id) and counted from the prior flag's raised_at,
-- which the function always stamps as now() — the REAL wall-clock day, regardless of
-- how far in the synthetic past flag_date is. athlete_readiness already picked up a
-- real thr_readiness flag from the fire-day test above (flag_date current_date - 250,
-- raised_at effectively today), so evaluating that SAME athlete for ANY earlier
-- synthetic date would read as centuries inside a 3-day cooldown and be blocked for the
-- wrong reason. A fresh athlete with no prior flag sidesteps that entirely, matching
-- every other scenario in this file's own "never reuse an athlete across scenarios"
-- rule stated at the top.
insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values (tests.uid('orga', 'athlete_readiness_gap'), tests.uid('orga', 'org'),
        'Test', 'ReadinessGap', date '2000-01-01', 'active');

insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
select
  tests.uid('orga', 'org'), tests.uid('orga', 'athlete_readiness_gap'), gs::date,
  7.5, case when (gs::date - date '2000-01-01') % 2 = 0 then 4 else 3 end, 4, 4, 4, 4,
  'self_report', tests.uid('orga', 'user_coach')
from generate_series(
  (current_date - 265)::timestamp, (current_date - 172)::timestamp, interval '1 day'
) as gs
where gs::date not in (current_date - 231, current_date - 230);

-- current_date - 231 is deliberately absent (a real gap, not an accidental
-- double-insert); only current_date - 230 gets a real breach row.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_readiness_gap'), current_date - 230,
   6.0, 2, 2, 2, 2, 2, 'self_report', tests.uid('orga', 'user_coach'));


-- ===========================================================================
-- Section 2: SHAPE 2 — pct_change_below / personal_rolling. "Sleep dropped", real
-- ground truth #2: value 20.000 (percent), baseline_days 28, consecutive_days 2,
-- min_baseline_observations 10, cooldown_days 3, severity medium.
-- ===========================================================================

insert into public.thresholds
  (id, org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
   consecutive_days, min_baseline_observations, cooldown_days, severity, created_by)
values
  (tests.uid('orga', 'thr_sleep'), tests.uid('orga', 'org'), 'Test: sleep dropped',
   'wellness', 'wellness.sleep_hours', 'pct_change_below', 20.0, 'personal_rolling', 28,
   2, 10, 3, 'medium', tests.uid('orga', 'user_coach'));

insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values (tests.uid('orga', 'athlete_sleep'), tests.uid('orga', 'org'),
        'Test', 'Sleep', date '2001-01-01', 'active');

-- Constant 8.0h baseline (pct_change needs only a mean, no variance), covering both the
-- fire window and the near-miss window 40 days later.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
select
  tests.uid('orga', 'org'), tests.uid('orga', 'athlete_sleep'), gs::date,
  8.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')
from generate_series(
  -- Same 5-day head start as the readiness scenario above, for the same reason.
  (current_date - 265)::timestamp, (current_date - 172)::timestamp, interval '1 day'
) as gs
where gs::date not in (current_date - 251, current_date - 250,
                        current_date - 211, current_date - 210);

-- Fire: both days drop to 6.0h, a 25% fall — comfortably past the 20% cutoff.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_sleep'), current_date - 251,
   6.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_sleep'), current_date - 250,
   6.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach'));

-- Near-miss: only the last day drops far enough (6.0h); the day before it drops only to
-- 7.5h, a 6.25% fall, well short of 20%.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_sleep'), current_date - 211,
   7.5, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_sleep'), current_date - 210,
   6.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach'));


-- ===========================================================================
-- Section 3: SHAPE 3 — below / absolute, wellness domain. "Soreness elevated", real
-- ground truth #3: value 2.000, no baseline, consecutive_days 3,
-- min_baseline_observations 0, cooldown_days 2, severity medium. Also the "genuine
-- non-breach still resets the run" case: the near-miss below has a REAL
-- wellness_entries row on the middle day (soreness = 4, not sore), not a gap — under
-- migration 0053's gap-tolerant reading a real non-breaching value still correctly
-- breaks the run; only a genuinely MISSING entry is skipped (see section 6b's dedicated
-- gap test on thr_readiness for that case).
-- ===========================================================================

insert into public.thresholds
  (id, org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
   consecutive_days, min_baseline_observations, cooldown_days, severity, created_by)
values
  (tests.uid('orga', 'thr_soreness'), tests.uid('orga', 'org'), 'Test: soreness elevated',
   'wellness', 'wellness.soreness', 'below', 2.0, 'absolute', null,
   3, 0, 2, 'medium', tests.uid('orga', 'user_coach'));

insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values (tests.uid('orga', 'athlete_soreness'), tests.uid('orga', 'org'),
        'Test', 'Soreness', date '2002-01-01', 'active');

-- Fire: three genuinely consecutive breach days (soreness = 1, below the cutoff of 2).
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_soreness'), current_date - 252,
   7.0, 4, 4, 1, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_soreness'), current_date - 251,
   7.0, 4, 4, 1, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_soreness'), current_date - 250,
   7.0, 4, 4, 1, 4, 4, 'self_report', tests.uid('orga', 'user_coach'));

-- Near-miss: breach, NORMAL, breach — the middle day of the 3-day window has a REAL
-- entry (soreness = 4, not sore) that does not breach. Not a gap, so it genuinely
-- breaks the run even under the gap-tolerant reading.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_soreness'), current_date - 212,
   7.0, 4, 4, 1, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_soreness'), current_date - 211,
   7.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_soreness'), current_date - 210,
   7.0, 4, 4, 1, 4, 4, 'self_report', tests.uid('orga', 'user_coach'));


-- ===========================================================================
-- Section 4: SHAPE 4 — above / personal_rolling, absolute-cutoff-with-baseline-context.
-- "Acute chronic ratio high", real ground truth #4: value 1.300, baseline_days 28,
-- consecutive_days 1, min_baseline_observations 14, cooldown_days 3, severity high.
-- load.acwr is computed fresh from training_entries, never stored — see migration 0052's
-- header for the exact port of src/lib/acwr.ts's computeAcwr().
-- ===========================================================================

insert into public.thresholds
  (id, org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
   consecutive_days, min_baseline_observations, cooldown_days, severity, created_by)
values
  (tests.uid('orga', 'thr_acwr'), tests.uid('orga', 'org'), 'Test: ACWR high',
   'gps', 'load.acwr', 'above', 1.3, 'personal_rolling', 28,
   1, 14, 3, 'high', tests.uid('orga', 'user_coach'));

insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values (tests.uid('orga', 'athlete_acwr'), tests.uid('orga', 'org'),
        'Test', 'Acwr', date '2000-06-01', 'active');

-- ~135 days of steady daily load (rpe 5 x 60 min = 300), which gives every one of the
-- 28 baseline days before EITHER test day a full, non-suppressed ACWR of its own
-- (steady-state ratio 1.0), satisfying min_baseline_observations without itself ever
-- looking like a breach. The two test days themselves are excluded here and inserted
-- separately below with a spike, so the INSERT trigger (0010) computes their
-- session_load correctly — it only fires on INSERT, not UPDATE.
insert into public.training_entries
  (org_id, athlete_id, entry_date, rpe, duration_min, source, created_by)
select
  tests.uid('orga', 'org'), tests.uid('orga', 'athlete_acwr'), gs::date, 5.0, 60,
  'self_report', tests.uid('orga', 'user_coach')
from generate_series(
  (current_date - 545)::timestamp, (current_date - 411)::timestamp, interval '1 day'
) as gs
where gs::date not in (current_date - 450, current_date - 410);

-- Fire day (current_date - 450): one spike to rpe 10 x 150 min = 1500. acute (trailing 7
-- days) = 6*300 + 1500 = 3300; chronic (trailing 28 days)/4 = (27*300 + 1500)/4 = 2400;
-- acwr = 3300/2400 = 1.375, above the 1.3 cutoff.
insert into public.training_entries
  (org_id, athlete_id, entry_date, rpe, duration_min, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_acwr'), current_date - 450,
   10.0, 150, 'self_report', tests.uid('orga', 'user_coach'));

-- Near-miss day (current_date - 410, 40 days later, well clear of the fire day's own
-- chronic/baseline windows): a smaller spike, rpe 8 x 150 = 1200. acute = 1800 + 1200 =
-- 3000; chronic/4 = (8100 + 1200)/4 = 2325; acwr = 3000/2325 = 1.29, under 1.3.
insert into public.training_entries
  (org_id, athlete_id, entry_date, rpe, duration_min, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_acwr'), current_date - 410,
   8.0, 150, 'self_report', tests.uid('orga', 'user_coach'));


-- ===========================================================================
-- Section 5: SHAPE 5 — below / absolute, compliance domain. "Wellness compliance low",
-- real ground truth #5: value 4.000 (a raw count, no baseline), consecutive_days 1,
-- min_baseline_observations 0, cooldown_days 7, severity low.
-- ===========================================================================

insert into public.thresholds
  (id, org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
   consecutive_days, min_baseline_observations, cooldown_days, severity, created_by)
values
  (tests.uid('orga', 'thr_compliance'), tests.uid('orga', 'org'),
   'Test: wellness compliance low', 'compliance', 'compliance.wellness_7d', 'below', 4.0,
   'absolute', null, 1, 0, 7, 'low', tests.uid('orga', 'user_coach'));

insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values (tests.uid('orga', 'athlete_compliance'), tests.uid('orga', 'org'),
        'Test', 'Compliance', date '2003-01-01', 'active');

-- Fire day (current_date - 250): only 2 real entries in the trailing 7 days
-- [current_date - 256, current_date - 250], below the cutoff of 4.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_compliance'), current_date - 253,
   7.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_compliance'), current_date - 250,
   7.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach'));

-- Near-miss day (current_date - 210): 5 real entries in the trailing 7 days
-- [current_date - 216, current_date - 210], not below the cutoff.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_compliance'), current_date - 216,
   7.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_compliance'), current_date - 215,
   7.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_compliance'), current_date - 214,
   7.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_compliance'), current_date - 213,
   7.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach')),
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_compliance'), current_date - 210,
   7.0, 4, 4, 4, 4, 4, 'self_report', tests.uid('orga', 'user_coach'));


-- ===========================================================================
-- Section 6: run the fire day for org A (current_date - 250) and assert every shape
-- above fires (or is correctly blocked) simultaneously, matching how the real cron
-- entrypoint calls this function once per org per day.
-- ===========================================================================

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness')
      and flag_date     = current_date - 250),
  0,
  'sanity: no readiness flag exists before the function has run'
);

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 250);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness')
      and flag_date     = current_date - 250),
  1,
  'shape 1 (z_score / personal_rolling): fires on 2 genuine consecutive breach days'
);

select is(
  (select observed_value from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness')
      and flag_date     = current_date - 250),
  40.000,
  'the flag records the real observed readiness_score for the day evaluated'
);

select ok(
  (select expected_value from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness')
      and flag_date     = current_date - 250) between 70 and 82,
  'expected_value is the athlete''s own personal_rolling baseline mean (~78), not the -1.5 z-score cutoff itself'
);

select is(
  (select staff_note from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness')
      and flag_date     = current_date - 250),
  null,
  'staff_note is left null when the consecutive-day window had no gap (migration 0053)'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_newbie')),
  0,
  'min_baseline_observations: the SAME threshold row never fires for an athlete with too little history, however extreme the value'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_sleep')
      and athlete_id   = tests.uid('orga', 'athlete_sleep')
      and flag_date     = current_date - 250),
  1,
  'shape 2 (pct_change_below / personal_rolling): fires on a genuine >=20% 2-day sleep drop'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_soreness')
      and athlete_id   = tests.uid('orga', 'athlete_soreness')
      and flag_date     = current_date - 250),
  1,
  'shape 3 (below / absolute, wellness): fires on 3 genuinely consecutive breach days'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_compliance')
      and athlete_id   = tests.uid('orga', 'athlete_compliance')
      and flag_date     = current_date - 250),
  1,
  'shape 5 (below / absolute, compliance count): fires when the trailing 7-day count is below the cutoff'
);


-- ===========================================================================
-- Section 6c: gap tolerance (migration 0053). thr_readiness again, current_date - 230,
-- where current_date - 231 has NO wellness_entries row at all (a true gap) and only
-- current_date - 230 has a real breach. Under the pre-0053 strict reading this would
-- NOT have fired; the fix closes that "skip a submission to dodge the flag" loophole.
-- ===========================================================================

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness_gap')
      and flag_date     = current_date - 230),
  0,
  'sanity: no flag exists for the gap-tolerance day before the function has run'
);

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 230);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness_gap')
      and flag_date     = current_date - 230),
  1,
  'gap tolerance: a genuine 2-consecutive-day breach with ONE day genuinely missing (not just non-breaching) still fires'
);

select is(
  (select staff_note from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness_gap')
      and flag_date     = current_date - 230),
  'Breached on 1 of the last 2 days, with 1 day missing.',
  'staff_note records screens/thresholds.md edge case 8''s own worded example, with the real counts'
);


-- ===========================================================================
-- Section 7 (part 1): idempotency. Running the SAME org+date again inserts nothing new
-- for any of the flags just raised.
-- ===========================================================================

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 250);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness')
      and flag_date     = current_date - 250),
  1,
  'idempotency: a second call for the same org+date does not duplicate the readiness flag'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_sleep')
      and athlete_id   = tests.uid('orga', 'athlete_sleep')
      and flag_date     = current_date - 250),
  1,
  'idempotency: a second call for the same org+date does not duplicate the sleep flag'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_soreness')
      and athlete_id   = tests.uid('orga', 'athlete_soreness')
      and flag_date     = current_date - 250),
  1,
  'idempotency: a second call for the same org+date does not duplicate the soreness flag'
);

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 230);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness_gap')
      and flag_date     = current_date - 230),
  1,
  'idempotency: a second call for the gap-tolerance day does not duplicate that flag either'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_compliance')
      and athlete_id   = tests.uid('orga', 'athlete_compliance')
      and flag_date     = current_date - 250),
  1,
  'idempotency: a second call for the same org+date does not duplicate the compliance flag'
);


-- ===========================================================================
-- Section 6b: the near-miss day (current_date - 210) for each of shapes 1, 2, 3, 5 —
-- none of these fire.
-- ===========================================================================

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 210);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness')
      and flag_date     = current_date - 210),
  0,
  'shape 1 near miss: a breach on only the LAST of the 2 required days does not fire'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_sleep')
      and athlete_id   = tests.uid('orga', 'athlete_sleep')
      and flag_date     = current_date - 210),
  0,
  'shape 2 near miss: a 6.25% sleep drop the day before a 25% drop does not satisfy 2 consecutive days'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_soreness')
      and athlete_id   = tests.uid('orga', 'athlete_soreness')
      and flag_date     = current_date - 210),
  0,
  'shape 3 near miss: a REAL non-breaching value in the MIDDLE of the 3-day window (not a gap) still correctly breaks the run'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_compliance')
      and athlete_id   = tests.uid('orga', 'athlete_compliance')
      and flag_date     = current_date - 210),
  0,
  'shape 5 near miss: 5 real entries in the trailing 7 days is not below the cutoff of 4'
);


-- ===========================================================================
-- Section 4b: ACWR fire and near-miss, its own dates.
-- ===========================================================================

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 450);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_acwr')
      and athlete_id   = tests.uid('orga', 'athlete_acwr')
      and flag_date     = current_date - 450),
  1,
  'shape 4 (above / personal_rolling, ACWR): fires when the raw ratio exceeds 1.3, gated on 14+ baseline observations'
);

select ok(
  (select expected_value from public.flags
    where threshold_id = tests.uid('orga', 'thr_acwr')
      and athlete_id   = tests.uid('orga', 'athlete_acwr')
      and flag_date     = current_date - 450) between 0.9 and 1.1,
  'ACWR expected_value is the athlete''s own personal_rolling baseline mean (~1.0 steady state), recorded as context, not the trip condition'
);

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 410);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_acwr')
      and athlete_id   = tests.uid('orga', 'athlete_acwr')
      and flag_date     = current_date - 410),
  0,
  'shape 4 near miss: a ratio of 1.29 does not clear the 1.3 cutoff'
);


-- ===========================================================================
-- Section 7 (part 2): cooldown_days. A flag is inserted directly (not through the
-- function) with a specific LOCAL raised date, exactly like
-- tests.build_org()'s own flags fixture, because the function always stamps raised_at =
-- now() and this test needs to control how many local days have elapsed since.
-- ===========================================================================

insert into public.thresholds
  (id, org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
   consecutive_days, min_baseline_observations, cooldown_days, severity, created_by)
values
  (tests.uid('orga', 'thr_cooldown'), tests.uid('orga', 'org'), 'Test: cooldown',
   'wellness', 'wellness.soreness', 'below', 2.0, 'absolute', null,
   1, 0, 3, 'medium', tests.uid('orga', 'user_coach'));

insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values (tests.uid('orga', 'athlete_cooldown'), tests.uid('orga', 'org'),
        'Test', 'Cooldown', date '2001-06-01', 'active');

-- A prior flag, raised_at set so its LOCAL (Europe/London) calendar date is
-- current_date - 252 — 2 days before the breach day tested next.
insert into public.flags
  (org_id, athlete_id, threshold_id, domain, metric, observed_value, expected_value,
   flag_date, severity, status, raised_at)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_cooldown'),
   tests.uid('orga', 'thr_cooldown'), 'wellness', 'wellness.soreness', 1.0, 2.0,
   current_date - 252, 'medium', 'raised',
   ((current_date - 252)::timestamp + time '12:00') at time zone 'Europe/London');

insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_cooldown'), current_date - 250,
   7.0, 4, 4, 1, 4, 4, 'self_report', tests.uid('orga', 'user_coach'));

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 250);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_cooldown')
      and athlete_id   = tests.uid('orga', 'athlete_cooldown')),
  1,
  'cooldown_days: a fresh real breach 2 days after the prior flag (cooldown 3) raises nothing new'
);

-- A breach well outside the cooldown window (10 days after the original flag).
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_cooldown'), current_date - 240,
   7.0, 4, 4, 1, 4, 4, 'self_report', tests.uid('orga', 'user_coach'));

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 240);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_cooldown')
      and athlete_id   = tests.uid('orga', 'athlete_cooldown')),
  2,
  'cooldown_days: a real breach after the cooldown window expires raises a new flag'
);


-- ===========================================================================
-- Section 9: cross-tenant isolation, including the two-organisation case (item 6 in
-- this migration's ground truth) and a corrupted group_memberships row.
-- ===========================================================================

-- 9a. The two-organisation case: org B's OWN base fixture threshold
-- (tests.uid('orgb','threshold')) is the same shape as org A's "Readiness below personal
-- norm" but with consecutive_days = 1 by default (tests.build_org() never overrides it).
-- A single breach day — which was NOT enough for org A's 2-day rule above — fires here.
insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values (tests.uid('orgb', 'athlete_1day'), tests.uid('orgb', 'org'),
        'Test', 'OneDay', date '2000-01-01', 'active');

insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
select
  tests.uid('orgb', 'org'), tests.uid('orgb', 'athlete_1day'), gs::date,
  7.5, case when (gs::date - date '2000-01-01') % 2 = 0 then 4 else 3 end, 4, 4, 4, 4,
  'self_report', tests.uid('orgb', 'user_coach')
from generate_series(
  (current_date - 260)::timestamp, (current_date - 251)::timestamp, interval '1 day'
) as gs;

insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, source, created_by)
values
  (tests.uid('orgb', 'org'), tests.uid('orgb', 'athlete_1day'), current_date - 250,
   6.0, 2, 2, 2, 2, 2, 'self_report', tests.uid('orgb', 'user_coach'));

select is(
  (select count(*)::int from public.flags
    where org_id = tests.uid('orga', 'org')
      and athlete_id = tests.uid('orgb', 'athlete_1day')),
  0,
  'org A''s evaluation runs above never touched org B''s athlete'
);

select public.evaluate_daily_thresholds_for_org(tests.uid('orgb', 'org'), current_date - 250);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orgb', 'threshold')
      and athlete_id   = tests.uid('orgb', 'athlete_1day')
      and flag_date     = current_date - 250),
  1,
  'the two-organisation case: the SAME single breach day that was a near miss for org A''s 2-day rule fires org B''s own 1-day copy of the same metric'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_readiness')
      and athlete_id   = tests.uid('orga', 'athlete_readiness')
      and flag_date     = current_date - 250),
  1,
  'evaluating org B afterwards left org A''s earlier flags exactly as they were'
);

-- 9b. A corrupted group_memberships row naming an org B athlete under an org A group.
-- The population query is scoped to public.athletes where org_id = the org being
-- evaluated FIRST; group membership can only narrow that set further, never widen it
-- across a tenancy boundary, however the membership rows are corrupted.
insert into public.group_memberships (org_id, group_id, athlete_id)
values (tests.uid('orga', 'org'), tests.uid('orga', 'group'), tests.uid('orgb', 'athlete_1'));

insert into public.thresholds
  (id, org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
   consecutive_days, min_baseline_observations, cooldown_days, severity,
   applies_to_group_id, created_by)
values
  (tests.uid('orga', 'thr_group_scoped'), tests.uid('orga', 'org'),
   'Test: group-scoped soreness', 'wellness', 'wellness.soreness', 'below', 5.0,
   'absolute', null, 1, 0, 0, 'low', tests.uid('orga', 'group'),
   tests.uid('orga', 'user_coach'));

select public.evaluate_daily_thresholds_for_org(tests.uid('orga', 'org'), current_date - 1);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_group_scoped')
      and athlete_id   = tests.uid('orgb', 'athlete_1')),
  0,
  'a group_memberships row that names an org B athlete under an org A group is never evaluated for org A — the population is org-scoped first, group-narrowed second'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga', 'thr_group_scoped')
      and athlete_id   = tests.uid('orga', 'athlete_1')),
  1,
  'the same group-scoped threshold correctly fires for org A''s own real group member'
);

select * from finish();
rollback;
