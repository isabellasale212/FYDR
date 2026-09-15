-- 770 — PATTERN-S3 C1 (the read flag) and C8 (body site and side are not
-- coach-visible; a club setting defaulting to off), migration 0122.

begin;
select * from no_plan();

select tests.fixtures();
-- an open injury for athlete_1 and an availability row set by the medic
insert into injuries (id, org_id, athlete_id, body_area, side, onset_date, status, reported_by)
values (tests.uid('orga','injury_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'), 'knee', 'left', current_date, 'open', tests.uid('orga','user_medical'));
-- the fixture already holds one open row per athlete; close it and set a new one, as the app does
update availability set effective_to = now() where athlete_id = tests.uid('orga','athlete_1') and effective_to is null;
insert into availability (org_id, athlete_id, status, restrictions, reason_category, injury_id, set_by)
values (tests.uid('orga','org'), tests.uid('orga','athlete_1'), 'modified', array['no contact'], 'injury', tests.uid('orga','injury_1'), tests.uid('orga','user_medical'));

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');

-- C8: the setting defaults to off
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select coach_sees_injury_site from organisations where id = tests.uid('orga','org')), false, 'the club setting defaults to off');

-- a coach cannot read the two columns at the table
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok($$select body_area from injuries$$, '42501', null, 'a coach''s direct read of injuries.body_area is refused at the table');
select throws_ok($$select side from injuries$$, '42501', null, 'and of injuries.side');
select lives_ok($$select id, status, expected_return from injuries$$, 'the rest of the row still reads');
select is((select body_area::text from injuries_staff where id = tests.uid('orga','injury_1')), null, 'through the view the coach reads null for the site');
select is((select side::text from injuries_staff where id = tests.uid('orga','injury_1')), null, 'and null for the side');
select is((select status::text from injuries_staff where id = tests.uid('orga','injury_1')), 'open', 'and the status word');
select is(public.injury_site_visible(), false, 'injury_site_visible() is false for a coach while the setting is off');

-- the medic, the sport scientist and the S&C read the site
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is((select body_area::text from injuries_staff where id = tests.uid('orga','injury_1')), 'knee', 'the medic reads the site');
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select body_area::text from injuries_staff where id = tests.uid('orga','injury_1')), 'knee', 'the sport scientist reads the site');
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select is((select side::text from injuries_staff where id = tests.uid('orga','injury_1')), 'left', 'the S&C reads the side');
-- the nutritionist reads no rows of the view? (0074: censored) — the row, not the site
select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select is((select body_area::text from injuries_staff where id = tests.uid('orga','injury_1')), null, 'the nutritionist never reads the site');
-- the athlete reads their own
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select body_area::text from injuries_staff where id = tests.uid('orga','injury_1')), 'knee', 'the athlete reads their own site');
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is((select count(*)::int from injuries_staff where id = tests.uid('orga','injury_1')), 0, 'another athlete reads nothing');
select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is((select count(*)::int from injuries_staff where id = tests.uid('orga','injury_1')), 0, 'another club''s coach reads nothing of this club''s injury');

-- the setting on: the coach reads the site through the view; the table stays closed
select tests.clear_jwt();
reset role;
update organisations set coach_sees_injury_site = true where id = tests.uid('orga','org');
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select body_area::text from injuries_staff where id = tests.uid('orga','injury_1')), 'knee', 'setting on: the coach reads the site through the view');
select throws_ok($$select body_area from injuries$$, '42501', null, 'and still not at the table');

-- C1: the read flag
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select athlete_seen_at from availability where athlete_id = tests.uid('orga','athlete_1') and effective_to is null), null, 'the open row is unseen');
select lives_ok($$select public.mark_availability_seen()$$, 'the athlete opens the status screen');
select isnt((select athlete_seen_at from availability where athlete_id = tests.uid('orga','athlete_1') and effective_to is null), null, 'and the open row is marked seen');
update availability set athlete_seen_at = null where athlete_id = tests.uid('orga','athlete_1');
select isnt((select athlete_seen_at from availability where athlete_id = tests.uid('orga','athlete_1') and effective_to is null), null, 'the athlete''s direct write matches nothing — the function is the path');
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select lives_ok($$select public.mark_availability_seen()$$, 'an athlete with no open row marks nothing, without error');
select tests.clear_jwt();
reset role;
-- Rows in force before 0122 were backfilled as read at their own start; the rows
-- this test's athletes hold are the fixture's, so the count is theirs alone.
select is((select count(*)::int from availability where athlete_seen_at is not null and athlete_id in (tests.uid('orga','athlete_1'), tests.uid('orga','athlete_2'))), 2, 'each athlete marked only their own open row');
-- Within the two fixture organisations (15 Sept 2026, #4): a realistic database
-- holds real athletes who have opened their status screen, and a count over
-- every organisation only passed against an empty one.
select is((select count(*)::int from availability where org_id in (tests.uid('orga','org'), tests.uid('orgb','org')) and athlete_seen_at is not null and athlete_seen_at > effective_from and athlete_id not in (tests.uid('orga','athlete_1'), tests.uid('orga','athlete_2'))), 0, 'and nobody else''s row was touched by the function');

select * from finish();
rollback;
