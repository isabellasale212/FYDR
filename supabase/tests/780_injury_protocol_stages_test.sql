-- 780 — PATTERN-S3 C3, migration 0123: return-to-play stages as data.

begin;
select * from no_plan();

select tests.fixtures();
insert into injuries (id, org_id, athlete_id, body_area, side, onset_date, status, reported_by)
values (tests.uid('orga','injury_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'), 'knee', 'left', current_date, 'rehab', tests.uid('orga','user_medical'));
update availability set effective_to = now() where athlete_id = tests.uid('orga','athlete_1') and effective_to is null;
insert into availability (org_id, athlete_id, status, restrictions, reason_category, injury_id, set_by)
values (tests.uid('orga','org'), tests.uid('orga','athlete_1'), 'modified', array['no contact'], 'injury', tests.uid('orga','injury_1'), tests.uid('orga','user_medical'));

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary');

-- only the medic opens a protocol
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(format($$select public.open_injury_protocol(%L, 6)$$, tests.uid('orga','injury_1')), '42501', null, 'a coach cannot open a protocol');
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(format($$select public.open_injury_protocol(%L, 6)$$, tests.uid('orga','injury_1')), 'the medic opens a six-stage protocol');
select is((select to_stage from injury_stage_events where injury_id = tests.uid('orga','injury_1') order by seq desc limit 1), 0, 'stage 0: opened, not yet on a stage');
select is((select current_stage from injury_protocols where injury_id = tests.uid('orga','injury_1')), 0, 'and the protocol row says so');

-- advancing: one stage, a clean line, the confirmation
select throws_ok(format($$select public.move_injury_stage(%L, 1, '', true, null)$$, tests.uid('orga','injury_1')), 'P0001', 'restriction_line_required', 'advancing needs a rewritten restriction line');
select throws_ok(format($$select public.move_injury_stage(%L, 1, 'Stage 1 of the ACL protocol', true, null)$$, tests.uid('orga','injury_1')), 'P0001', 'restriction_line_required', 'and the line may not name a protocol, a stage or a diagnosis');
select throws_ok(format($$select public.move_injury_stage(%L, 1, 'Straight-line running only', false, null)$$, tests.uid('orga','injury_1')), 'P0001', 'criteria_not_reviewed', 'and the criteria must be confirmed reviewed');
select lives_ok(format($$select public.move_injury_stage(%L, 1, 'Straight-line running only', true, null)$$, tests.uid('orga','injury_1')), 'advance to stage 1');
select is((select restrictions[1] from availability where athlete_id = tests.uid('orga','athlete_1') and effective_to is null), 'Straight-line running only', 'the open availability row carries the rewritten line — what the coach and the athlete read');
select is((select athlete_seen_at from availability where athlete_id = tests.uid('orga','athlete_1') and effective_to is null), null, 'and its read flag is clear, so Today tells the athlete once more (C1)');
select is((select set_by from availability where athlete_id = tests.uid('orga','athlete_1') and effective_to is null), tests.uid('orga','user_medical'), 'set by the medic who moved the stage');
select is((select count(*)::int from availability where athlete_id = tests.uid('orga','athlete_1') and injury_id = tests.uid('orga','injury_1')), 2, 'the ledger holds it: the old row is closed and a new one opened, never a rewrite (C7)');
select is((select restrictions[1] from availability where athlete_id = tests.uid('orga','athlete_1') and injury_id = tests.uid('orga','injury_1') and effective_to is not null), 'no contact', 'the closed row keeps the line it had');
select is((select status::text || '/' || reason_category::text from availability where athlete_id = tests.uid('orga','athlete_1') and effective_to is null), 'modified/injury', 'the new row carries the same status and reason');
select throws_ok(format($$select public.move_injury_stage(%L, 3, 'Change of direction at half pace', true, null)$$, tests.uid('orga','injury_1')), 'P0001', 'reason_required', 'a jump of two needs a reason');
select lives_ok(format($$select public.move_injury_stage(%L, 3, 'Change of direction at half pace', true, 'Cleared two stages at the same session after the specialist review')$$, tests.uid('orga','injury_1')), 'with one it lands');
select throws_ok(format($$select public.move_injury_stage(%L, 2, null, false, null)$$, tests.uid('orga','injury_1')), 'P0001', 'reason_required', 'going back needs a reason too');
select lives_ok(format($$select public.move_injury_stage(%L, 2, null, false, 'Swelling returned after Tuesday')$$, tests.uid('orga','injury_1')), 'and lands with one, leaving the restriction line as it was');
select is((select restrictions[1] from availability where athlete_id = tests.uid('orga','athlete_1') and effective_to is null), 'Change of direction at half pace', 'a move without a line does not blank the line');
select is((select current_stage from injury_protocols where injury_id = tests.uid('orga','injury_1')), 2, 'the protocol row carries the current stage: 2');
select is((select array_agg(to_stage order by seq) from injury_stage_events where injury_id = tests.uid('orga','injury_1')), array[0, 1, 3, 2], 'the ledger in order of seq: 0, 1, 3, 2');
select throws_ok(format($$select public.move_injury_stage(%L, 7, 'x', true, 'past the end')$$, tests.uid('orga','injury_1')), 'P0001', 'stage_out_of_range', 'no stage past the protocol''s end');
select is((select count(*)::int from injury_stage_events where injury_id = tests.uid('orga','injury_1')), 4, 'four events: opened, 1, 3, 2 — append-only');
select is((select count(*)::int from injury_timeline_event where injury_id = tests.uid('orga','injury_1') and type = 'stage_change'), 3, 'three stage_change timeline events');

-- who reads: the medic and the athlete; never the coach or the S&C
select is((select count(*)::int from injury_stage_events where injury_id = tests.uid('orga','injury_1')), 4, 'the medic reads the events');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select count(*)::int from injury_stage_events where injury_id = tests.uid('orga','injury_1')), 4, 'the athlete reads their own');
select is((select total_stages from injury_protocols where injury_id = tests.uid('orga','injury_1')), 6, 'and the protocol');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from injury_stage_events), 0, 'a coach reads no stage event');
select is((select count(*)::int from injury_protocols), 0, 'nor a protocol');
select throws_ok(format($$select public.move_injury_stage(%L, 4, 'x', true, null)$$, tests.uid('orga','injury_1')), '42501', null, 'nor moves a stage');
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select is((select count(*)::int from injury_stage_events), 0, 'the S&C reads none either');
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is((select count(*)::int from injury_stage_events), 0, 'another athlete reads none');
select tests.clear_jwt();
reset role;

select * from finish();
rollback;
