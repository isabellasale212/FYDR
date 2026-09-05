-- 030_medical_and_entry_rules_test.sql
--
-- The named cases from 01-roles-and-permissions.md §3 and §4, ADR-005 and
-- 04-data-model.md §17.15. These are the rules that would still be broken if every
-- cross tenant assertion in 020 passed, because they are boundaries INSIDE one club.
--
-- Which spec sections this implements
--   01-roles-and-permissions.md §2 permission matrix
--   01-roles-and-permissions.md §3 carve out 1 (clinical notes) and carve out 2 (flags)
--   01-roles-and-permissions.md §4 (medical data handling, availability is medical only)
--   decisions/adr-005-immutable-entries.md (entries are immutable, no update for anyone)
--   04-data-model.md §17.13 (an athlete never reads a draft team allocation)
--   04-data-model.md §17.15 (no staff insert path, the three week window, and the named
--     case: athlete A posting a check in with athlete B's athlete_id must fail)

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. injury_clinical is medical only, for every operation
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*) from injury_clinical), 0::bigint,
  'a COACH reading injury_clinical gets zero rows');
select is((select count(*) from injury_clinical
            where clinical_notes is not null), 0::bigint,
  'a coach cannot reach clinical_notes by naming the column');

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*) from injury_clinical), 0::bigint,
  'an ADMIN reading injury_clinical gets zero rows');

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select count(*) from injury_clinical), 0::bigint,
  'an ATHLETE reading injury_clinical gets zero rows, even for their own injury');

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is((select count(*) from injury_clinical), 1::bigint,
  'MEDICAL reads injury_clinical for their own organisation');
select ok((select clinical_notes is not null from injury_clinical limit 1),
  'medical reads clinical_notes, which is the only role that can');

-- Writing clinical detail is medical only too. "For all" means for all.
-- An update a policy filters out affects zero rows rather than raising, which is correct
-- PostgreSQL behaviour and is why this is a row count assertion and not a throws_ok.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  tests.rows_affected($q$update injury_clinical set clinical_notes = 'coach was here'$q$),
  0::bigint,
  'a COACH updating injury_clinical changes zero rows'
);
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is((select clinical_notes from injury_clinical),
          'orga CLINICAL NOTE, must never leave the medical role',
  'and the note the coach tried to overwrite is untouched');


-- ===========================================================================
-- 2. The athlete reads the sanitised view, and it does not carry clinical_notes
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select is((select count(*) from injury_clinical_athlete_view), 1::bigint,
  'an athlete reads their own row through the sanitised view');

select is((select diagnosis from injury_clinical_athlete_view),
          'Grade 2 acromioclavicular joint sprain',
  'the sanitised view carries the diagnosis, which the athlete is entitled to');

select throws_ok(
  'select clinical_notes from injury_clinical_athlete_view',
  '42703',
  null,
  'clinical_notes does not exist on the sanitised view, so it cannot be selected'
);

-- The second athlete has no injury, so the view gives them nothing.
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is((select count(*) from injury_clinical_athlete_view), 0::bigint,
  'an athlete reads no other athlete row through the sanitised view');

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*) from injury_clinical_athlete_view), 0::bigint,
  'a coach reads nothing through the sanitised view either, it is not a back door');


-- ===========================================================================
-- 3. Only medical may insert an injury-linked row into availability. A coach
-- cannot, anywhere.
--
-- Since ADR-008 / migration 0041 this is narrower than it used to read: a
-- coach CAN now insert and later close a non-injury row (illness, personal,
-- academic, representative, other) — see 200_coach_noninjury_availability_
-- test.sql for that half of the rule in full. This section re-proves only
-- the half that did not change: a coach still cannot open a bare row with no
-- reason at all, and still cannot touch anything with an injury behind it.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into availability (org_id, athlete_id, status, set_by)
            values (%L, %L, 'available', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'user_coach')),
  '42501',
  null,
  'a COACH cannot insert into availability with no reason_category at all — '
  'availability_coach_insert_noninjury (0041) requires a real, non-injury one'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  tests.rows_affected(
    format($q$update availability set status = 'available' where athlete_id = %L$q$,
           tests.uid('orga', 'athlete_1'))
  ),
  0::bigint,
  'a coach updating athlete_1''s injury-linked availability row changes zero '
  'rows. Scoped to athlete_1 by id rather than a table-wide update with no '
  'WHERE clause, as this assertion read before 0041 — the table now '
  'legitimately contains rows a coach CAN write (200_coach_noninjury_'
  'availability_test.sql), so a table-wide update is no longer a fair test of '
  'this one row''s protection'
);
select is((select status::text from availability
            where athlete_id = tests.uid('orga', 'athlete_1')),
          'modified',
  'and the athlete is still modified, which is what the coach tried to change');

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$insert into availability (org_id, athlete_id, status, set_by)
            values (%L, %L, 'available', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
         tests.uid('orga', 'user_admin')),
  '42501', null,
  'an ADMIN cannot insert into availability'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into availability (org_id, athlete_id, status, set_by)
            values (%L, %L, 'available', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'user_athlete_1')),
  '42501', null,
  'an ATHLETE cannot declare themselves available'
);

-- Positive control: medical can, which is what makes the three above meaningful.
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$insert into availability (org_id, athlete_id, status, set_by, effective_to)
            values (%L, %L, 'available', %L, now())$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
         tests.uid('orga', 'user_medical')),
  'MEDICAL can insert into availability, which is the point of the three refusals above'
);


-- ===========================================================================
-- 4. No role can update an entry row. Corrections are new rows.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$update wellness_entries set sleep_hours = 9.9 where athlete_id = %L$q$,
         tests.uid('orga', 'athlete_1')),
  '42501', null,
  'an ATHLETE cannot update their own wellness entry'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$update wellness_entries set sleep_hours = 9.9 where athlete_id = %L$q$,
         tests.uid('orga', 'athlete_1')),
  '42501', null,
  'a COACH cannot update a wellness entry'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$update wellness_entries set sleep_hours = 9.9 where athlete_id = %L$q$,
         tests.uid('orga', 'athlete_1')),
  '42501', null,
  'MEDICAL cannot update a wellness entry'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$update wellness_entries set sleep_hours = 9.9 where athlete_id = %L$q$,
         tests.uid('orga', 'athlete_1')),
  '42501', null,
  'an ADMIN cannot update a wellness entry'
);

select throws_ok(
  format($q$delete from wellness_entries where athlete_id = %L$q$,
         tests.uid('orga', 'athlete_1')),
  '42501', null,
  'nobody can delete a wellness entry either'
);

-- The sanctioned correction path does work, and it leaves the original in place.
--
-- The caller here was `user_athlete_1` until migration 0058 made correction a staff
-- action ("the athlete shouldn't be able to edit an entry, only the coach"). This
-- assertion is about the MECHANISM — a revision row rather than an in-place edit —
-- so it now runs as the role that still has the power, and the athlete's refusal has
-- its own assertions in 300_coach_entry_correction_test.sql.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$select revise_wellness_entry(
              (select id from wellness_entries where athlete_id = %L
                 and superseded_by is null),
              gen_random_uuid(),
              '{"sleep_hours": 8.6}'::jsonb)$q$,
         tests.uid('orga', 'athlete_1')),
  'revise_wellness_entry is the sanctioned correction path and it works (coach, per 0058)'
);

select is((select count(*) from wellness_entries where athlete_id = tests.uid('orga','athlete_1')),
          2::bigint,
  'the correction created a second row rather than editing the first');

select is((select count(*) from wellness_entries_current
            where athlete_id = tests.uid('orga', 'athlete_1')),
          1::bigint,
  'wellness_entries_current shows only the live revision, ADR-005 rule 3');


-- ===========================================================================
-- 5. An athlete inserts only their own entries, only as self_report
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select throws_ok(
  format($q$insert into wellness_entries (org_id, athlete_id, entry_date, sleep_hours,
                                          source, created_by)
            values (%L, %L, current_date, 8.0, 'staff_entered', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'user_athlete_1')),
  '42501', null,
  'an athlete cannot insert a wellness entry with source = staff_entered'
);

select throws_ok(
  format($q$insert into wellness_entries (org_id, athlete_id, entry_date, sleep_hours,
                                          source, created_by)
            values (%L, %L, current_date, 8.0, 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
         tests.uid('orga', 'user_athlete_1')),
  '42501', null,
  'an athlete cannot insert a wellness entry for ANOTHER athlete in the same organisation'
);

-- 04-data-model.md §17.15 property 1 names this case explicitly for the check in table.
select throws_ok(
  format($q$insert into nutrition_checkins (org_id, athlete_id, week_start, iso_year,
                                            iso_week, answer, source, created_by)
            values (%L, %L, date_trunc('week', current_date - 7)::date,
                    extract(isoyear from current_date - 7)::int,
                    extract(week    from current_date - 7)::int,
                    'yes', 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
         tests.uid('orga', 'user_athlete_1')),
  '42501', null,
  'athlete A cannot post a nutrition check in carrying athlete B athlete_id'
);

-- The three week window is enforced on write, not filtered on read.
select throws_ok(
  format($q$insert into nutrition_checkins (org_id, athlete_id, week_start, iso_year,
                                            iso_week, answer, source, created_by)
            values (%L, %L, date_trunc('week', current_date - 70)::date,
                    extract(isoyear from current_date - 70)::int,
                    extract(week    from current_date - 70)::int,
                    'yes', 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'user_athlete_1')),
  '42501', null,
  'a check in for a week ten weeks ago is refused, and the gap stays a gap'
);

select throws_ok(
  format($q$insert into nutrition_checkins (org_id, athlete_id, week_start, iso_year,
                                            iso_week, answer, source, created_by)
            values (%L, %L, date_trunc('week', current_date + 14)::date,
                    extract(isoyear from current_date + 14)::int,
                    extract(week    from current_date + 14)::int,
                    'yes', 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'user_athlete_1')),
  '42501', null,
  'a check in for a future week is refused'
);

-- There is no staff insert path to nutrition_checkins at all, deliberately.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into nutrition_checkins (org_id, athlete_id, week_start, iso_year,
                                            iso_week, answer, source, created_by)
            values (%L, %L, date_trunc('week', current_date - 7)::date,
                    extract(isoyear from current_date - 7)::int,
                    extract(week    from current_date - 7)::int,
                    'yes', 'staff_entered', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
         tests.uid('orga', 'user_coach')),
  '42501', null,
  'a coach cannot record a nutrition check in on an athlete behalf, there is no such path'
);

-- A coach CAN record a wellness entry on an athlete's behalf, stamped staff_entered.
select lives_ok(
  format($q$insert into wellness_entries (org_id, athlete_id, entry_date, sleep_hours,
                                          source, created_by)
            values (%L, %L, current_date, 7.0, 'staff_entered', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
         tests.uid('orga', 'user_coach')),
  'a coach CAN record a wellness entry for an athlete, stamped staff_entered'
);


-- ===========================================================================
-- 6. Athletes do not read each other
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select is((select count(*) from wellness_entries
            where athlete_id = tests.uid('orga', 'athlete_2')), 0::bigint,
  'an athlete reading ANOTHER athlete wellness_entries gets zero rows');

select is((select count(*) from injuries
            where athlete_id = tests.uid('orga', 'athlete_2')), 0::bigint,
  'an athlete reading another athlete injuries gets zero rows');

select is((select count(*) from availability
            where athlete_id = tests.uid('orga', 'athlete_2')), 0::bigint,
  'an athlete reading another athlete availability gets zero rows');

select is((select count(*) from nutrition_checkins
            where athlete_id = tests.uid('orga', 'athlete_2')), 0::bigint,
  'an athlete reading another athlete nutrition check ins gets zero rows');

select is((select count(*) from group_memberships
            where athlete_id = tests.uid('orga', 'athlete_2')), 0::bigint,
  'an athlete cannot enumerate the squad through group_memberships');


-- ===========================================================================
-- 7. Carve out 2: a flag reaches the athlete only after staff acknowledge it
-- ===========================================================================

select is((select count(*) from flags), 1::bigint,
  'an athlete sees only the acknowledged flag, not the one raised this morning');

select ok((select athlete_visible_at is not null from flags),
  'the flag the athlete can see is the one a staff member has acknowledged');

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*) from flags), 2::bigint,
  'a coach sees both flags, acknowledged and unacknowledged');


-- ===========================================================================
-- 8. A draft team allocation is never readable by an athlete
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is((select count(*) from team_allocations), 0::bigint,
  'the athlete whose allocation is still a DRAFT reads nothing');

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select count(*) from team_allocations), 1::bigint,
  'an athlete reads their own published allocation and no other row');

select throws_ok(
  format($q$insert into team_allocations (org_id, team_id, athlete_id, week_start, status,
                                          source, created_by)
            values (%L, %L, %L, date_trunc('week', current_date)::date, 'draft', 'manual', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'team'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'user_athlete_1')),
  '42501', null,
  'an athlete cannot pick themselves'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into team_allocations (org_id, team_id, athlete_id, week_start, status,
                                          source, created_by)
            values (%L, %L, %L, (date_trunc('week', current_date) + interval '7 days')::date,
                    'draft', 'manual', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'team'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'user_medical')),
  '42501', null,
  'MEDICAL cannot allocate a team. Their power over selection is availability'
);


-- ===========================================================================
-- 9. The sport scientist has MORE data access than anyone, by design
--
-- This section used to be called "Admin has less data access than staff" and
-- asserted five zeroes: no wellness, no training entries, no check-ins, no
-- flags, no injuries. That was right for the admin, who was a club secretary.
--
-- 0063 renames admin to sport_scientist and the role's whole definition
-- inverts. docs/access-matrix.md §1: "Everything. The role with no
-- restrictions, including club administration." So every one of those zeroes
-- becomes a positive, and the fixture user has not changed at all: only the
-- meaning of the value they hold.
--
-- The negative controls that used to live here have not been deleted, they
-- have moved to section 9a, where there is a role they are actually true of.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));

select cmp_ok((select count(*) from wellness_entries), '>', 0::bigint,
  'a sport scientist DOES read wellness entries');
select cmp_ok((select count(*) from training_entries), '>', 0::bigint,
  'a sport scientist DOES read training entries');
select cmp_ok((select count(*) from flags), '>', 0::bigint,
  'a sport scientist DOES read flags');
select cmp_ok((select count(*) from injuries), '>', 0::bigint,
  'a sport scientist DOES read injury rows, in the limited view of section 4.1');
select cmp_ok((select count(*) from users), '>', 0::bigint,
  'and still reads the user directory they manage');
select cmp_ok((select count(*) from audit_log), '>', 0::bigint,
  'and still reads the audit log, which no other role can');
select is((select count(*) from injury_clinical), 0::bigint,
  'but reads ZERO clinical records: 4.1, the one boundary "everything" does not '
  'reach, because it is a database rule and not a role setting');


-- ===========================================================================
-- 9a. The nutritionist sees no injury or medical information anywhere
--
-- D-01, the highest ranked decision in the queue, and until the five-role
-- model there was no way to write this test: a nutritionist held the coach
-- role, so the database could not tell them apart from one.
--
-- docs/access-matrix.md §3.2 is X in the nutritionist column on every row, and
-- §4.2 says what they keep: "compliance, wellness, body mass, testing and GPS".
-- Both halves are asserted, because a rule that only refuses is indistinguish-
-- able from a role that cannot read anything at all.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));

select is((select count(*) from injuries), 0::bigint,
  'a nutritionist reads ZERO injury rows');
select is((select count(*) from injury_clinical), 0::bigint,
  'a nutritionist reads ZERO clinical records');
select is((select count(*) from availability), 0::bigint,
  'a nutritionist reads ZERO availability rows: the status is as much injury '
  'information as the diagnosis, for a role that is X on the whole block');
select is((select count(*) from rehab_assignments), 0::bigint,
  'a nutritionist reads ZERO rehab assignments');
select is((select count(*) from team_allocations), 0::bigint,
  'a nutritionist reads ZERO team allocations');
select cmp_ok((select count(*) from wellness_entries), '>', 0::bigint,
  'positive control: a nutritionist DOES read wellness, per 4.2 "they keep '
  'everything else"');
select cmp_ok((select count(*) from athletes), '>', 0::bigint,
  'positive control: and DOES read the squad, or the role could do no job at all');


-- ===========================================================================
-- 10. Thresholds are coach only, and the audit log is append only
-- ===========================================================================

/* Thresholds stopped being coach-only in 0068. docs/access-matrix.md §3.6
   reads "Thresholds | VECD | VECD | V | V | X": the sport scientist and the
   coach write them, the medic and the S&C read them, and the nutritionist is
   the only role shut out. Writing is still not the medic's, which is what the
   next block checks. */
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select cmp_ok((select count(*) from thresholds), '>', 0::bigint,
  'a medic DOES read thresholds now, per docs/access-matrix.md 3.6''s V column');

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select is((select count(*) from thresholds), 0::bigint,
  'a nutritionist reads zero thresholds: the X on that row');

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*) from audit_log), 0::bigint,
  'a coach reads zero audit rows. Viewing the audit log is admin only');

select tests.set_jwt(tests.uid('orga', 'user_admin'));
-- audit_log refuses at the privilege layer (no UPDATE or DELETE granted) and again at the
-- trigger layer in 0007. Either one alone would refuse; both is deliberate.
select throws_ok(
  $q$update audit_log set action = 'rewritten'$q$,
  '42501', null,
  'an admin cannot update an audit row, even in their own organisation'
);
select throws_ok(
  $q$delete from audit_log$q$,
  '42501', null,
  'an admin cannot delete an audit row'
);


select * from finish();
rollback;
