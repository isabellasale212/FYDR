-- 590_notification_mute_restore_test.sql
--
-- §0z, decided by Isabella 2026-09-11: "Turn notifications back on" restores
-- each type to its state before muting — not all-on. Migration 0103 moves the
-- pair into two functions, mute_notifications / unmute_notifications, and this
-- file is the three-case guard the decision asked for, plus the edges:
--
--   1. a type the athlete had OFF before muting is still off after un-muting
--   2. a type that was ON comes back on
--   3. mute, turn one chip on by hand, un-mute: that chip stays on (the
--      athlete's newer intent wins over the snapshot)
--   4. a type never touched (no row) is created muted and restored to
--      "inherit" (null), never to true
--   5. pressing Mute twice does not overwrite the snapshot with "off"
--   6. own rows only: another user's rows are untouched and unreadable
--
-- The single-chip write that clears the snapshot (case 3) is what
-- setNotificationChannel does — reproduced here as the same upsert.

begin;
select * from no_plan();

select tests.fixtures();

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged for the assertions below');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- The athlete's state before muting: one type explicitly off, one explicitly
-- on (the fixture already holds athlete.wellness.prompt push = true; its
-- email is set on here), one on for push only (email left inheriting), one
-- never touched.
insert into notification_preferences (org_id, user_id, notification_id, push_enabled, email_enabled) values
  (tests.uid('orga', 'org'), tests.uid('orga', 'user_athlete_1'), 'athlete.weekly.summary',   false, false),
  (tests.uid('orga', 'org'), tests.uid('orga', 'user_athlete_1'), 'athlete.rpe.prompt',       true,  null);
update notification_preferences set email_enabled = true
 where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.wellness.prompt';

-- ===========================================================================
-- Mute
-- ===========================================================================
select is(
  mute_notifications(array['athlete.weekly.summary', 'athlete.wellness.prompt', 'athlete.rpe.prompt', 'athlete.gym.reminder']),
  3,
  'mute_notifications snapshots the three existing rows (returns how many it silenced)'
);

select is(
  (select count(*)::int from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1')
      and notification_id in ('athlete.weekly.summary', 'athlete.wellness.prompt', 'athlete.rpe.prompt', 'athlete.gym.reminder')
      and push_enabled = false and email_enabled = false and muted_at is not null),
  4,
  'all four are off and marked muted, including the never-touched type, which now has a row'
);

select is(
  (select pre_mute_push from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.wellness.prompt'),
  true,
  'the snapshot recorded that wellness push was on'
);
select is(
  (select pre_mute_push from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.weekly.summary'),
  false,
  'and that the weekly summary was off'
);
select ok(
  (select pre_mute_email is null from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.rpe.prompt'),
  'and that the RPE prompt''s email was inheriting (null), not on'
);
select ok(
  (select pre_mute_push is null and pre_mute_email is null from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.gym.reminder'),
  'the never-touched type''s snapshot is "inherit" on both channels'
);

-- ===========================================================================
-- 5. Pressing Mute again does not record "off" as the state to restore
-- ===========================================================================
select is(
  mute_notifications(array['athlete.wellness.prompt']),
  0,
  'a second mute silences nothing new'
);
select is(
  (select pre_mute_push from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.wellness.prompt'),
  true,
  'and the wellness snapshot still says on'
);

-- ===========================================================================
-- 3. A chip changed by hand while muted is the athlete's newer intent
-- ===========================================================================
-- The same upsert setNotificationChannel makes: the channel value, and the
-- snapshot cleared for that row.
insert into notification_preferences (org_id, user_id, notification_id, push_enabled, pre_mute_push, pre_mute_email, muted_at)
values (tests.uid('orga', 'org'), tests.uid('orga', 'user_athlete_1'), 'athlete.rpe.prompt', true, null, null, null)
on conflict (user_id, notification_id) do update
  set push_enabled = excluded.push_enabled,
      pre_mute_push = null, pre_mute_email = null, muted_at = null;

select ok(
  (select muted_at is null and push_enabled = true from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.rpe.prompt'),
  'turning RPE push on by hand clears its snapshot and marker'
);

-- ===========================================================================
-- Un-mute: cases 1, 2, 3 and 4 together
-- ===========================================================================
select results_eq(
  $q$select notification_id, push_enabled, email_enabled
       from unmute_notifications(array['athlete.weekly.summary', 'athlete.wellness.prompt', 'athlete.rpe.prompt', 'athlete.gym.reminder'])
      order by notification_id$q$,
  $q$values ('athlete.gym.reminder', null::boolean, null::boolean),
            ('athlete.weekly.summary', false, false),
            ('athlete.wellness.prompt', true, true)$q$,
  'unmute restores exactly the recorded states and returns them — the by-hand RPE row is not in the result'
);

select is(
  (select push_enabled from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.weekly.summary'),
  false,
  '1. the weekly summary, off before muting, is still off'
);
select is(
  (select push_enabled from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.wellness.prompt'),
  true,
  '2. the wellness prompt, on before muting, is on again'
);
select is(
  (select push_enabled from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.rpe.prompt'),
  true,
  '3. the RPE prompt the athlete turned on by hand while muted is still on'
);
select ok(
  (select push_enabled is null and email_enabled is null from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.gym.reminder'),
  '4. the never-touched type is back to inheriting — not forced on'
);
select is(
  (select count(*)::int from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and muted_at is not null),
  0,
  'and no row is marked muted any more'
);
select is(
  (select count(*)::int from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1')
      and (pre_mute_push is not null or pre_mute_email is not null)),
  0,
  'every snapshot is cleared'
);

-- ===========================================================================
-- 6. Own rows only
-- ===========================================================================
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  mute_notifications(array['athlete.wellness.prompt']),
  0,
  'athlete_2 muting touches none of athlete_1''s rows (0 silenced; the insert path makes athlete_2''s own)'
);
select is(
  (select count(*)::int from notification_preferences
    where notification_id = 'athlete.wellness.prompt' and muted_at is not null),
  1,
  'exactly one row is muted, and RLS shows athlete_2 only their own'
);
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select muted_at from notification_preferences
    where user_id = tests.uid('orga', 'user_athlete_1') and notification_id = 'athlete.wellness.prompt'),
  null,
  'athlete_1''s wellness row is untouched by athlete_2''s mute'
);

select * from finish();
rollback;
