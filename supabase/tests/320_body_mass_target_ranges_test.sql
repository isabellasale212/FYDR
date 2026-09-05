-- 320_body_mass_target_ranges_test.sql
--
-- body_mass_target_ranges (migration 0060): the staff-set body-mass target range
-- for one athlete. Written BEFORE the migration, per CLAUDE.md §5 ("write the test
-- for a permission rule before the rule").
--
-- What the client asked for, and the four rules they gave
--   The request was "why can I not set a target weight range?", and the answer was
--   that no such column existed anywhere: body_composition (migration 0024) stores
--   MEASUREMENTS only — body_mass_kg, body_fat_pct, lean_mass_kg, sum_skinfolds_mm.
--   The design spec's target range and "On target" pill were cut twice for exactly
--   that reason (lib/queries/playerProfile.ts and lib/nutritionRules.ts each record
--   the cut). The client then gave four binding rules, and every one of them is an
--   assertion in this file rather than a UI convention:
--     1. Staff-set only            -> §1, athlete and admin inserts throw 42501
--     2. NEVER visible to the athlete -> §2, the section this table exists for
--     3. A RANGE, low and high, not a single number -> §4, two not-null columns and
--        a high > low check; there is deliberately no target_mass_kg column to fall
--        back to
--     4. NEVER on a leaderboard    -> §6, asserted STRUCTURALLY, not by convention
--
-- Why this is its own TABLE, and therefore its own test file
--   The obvious places to put it — athletes, or body_composition — are both wrong,
--   and wrong in the identical way migration 0055 documents for problem_reports.
--   Postgres RLS is ROW-level, not column-level. It cannot hide a column from a role
--   that is allowed the row. And BOTH candidate tables grant the athlete a row:
--     * athletes: athletes_self_select (migration 0027).
--     * body_composition: body_composition_self_select (migration 0024:234-236) —
--       "org_id = auth_org_id() and athlete_id = auth_athlete_id()".
--   So a target_low_kg column on either table is readable by the athlete it is about
--   through one direct PostgREST column select, whatever the staff UI renders. Rule 2
--   would be a lie told by the interface. The split is structural, the same one
--   injuries/injury_clinical uses under CLAUDE.md rule 3 and problem_report_notes
--   uses under 0055: a different table, a different policy set, never an application
--   layer filter.
--
--   §2 below therefore asserts the athlete reads zero BOTH org-wide AND naming their
--   own athlete_id directly, because the second is the exact shape the leak would
--   take and the first alone would not catch it.
--
-- Which roles, and why those
--   Coach and medical read and write. Athlete and admin get nothing at all.
--     Coach: `coach` is the role every S&C and nutrition staff member in this schema
--       actually holds. There is NO `nutritionist` value in app_role (migration 0001:
--       'athlete', 'coach', 'medical', 'admin') — that gap has already cost this
--       project once — so excluding coach would lock out the very person who sets a
--       body-mass target.
--     Medical: return-to-play mass management is squarely medical's, and a body-mass
--       target range carries disordered-eating risk that the club physio is the right
--       person to hold. Deliberately NOT narrowed to athletes with an open injury the
--       way nutrition_targets narrows medical (0019): that narrowing would let a
--       physio set a range during rehab and then be unable to correct it the week the
--       athlete came back, which is worse than not granting it.
--     Both together are exactly the pair that may already write body_composition
--       itself (0024:238-247). Whoever may record the measurement may set the range it
--       is judged against; anything narrower would be incoherent.
--     Admin: no access, matching every other per-athlete data domain and the gap
--       migration 0020 had to close for resolve_nutrition_targets.
--
-- History: superseded, never overwritten
--   A target range that moves across a season is a real thing a nutritionist wants to
--   look back on, so this is an effective-dated interval — the same grammar
--   nutrition_targets (0019) and availability already use — and the BOUNDS are
--   immutable once written. §5 asserts that: a staff member may close a range
--   (effective_to) or soft-delete it (deleted_at), and may not rewrite low, high, the
--   athlete, or the setter. A correction is a new row.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 1. Writing a range: coach and medical only, in their own name
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into body_mass_target_ranges
              (id, org_id, athlete_id, target_low_kg, target_high_kg, rationale, set_by)
            values (%L, %L, %L, 102.00, 105.50, 'Pre-season lean phase, holding front-row mass.', %L)$q$,
         tests.uid('orga','range_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_coach')),
  'a coach sets a body-mass target range for an athlete in their own organisation'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$insert into body_mass_target_ranges
              (id, org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, %L, 116.00, 120.00, %L)$q$,
         tests.uid('orga','range_2'), tests.uid('orga','org'), tests.uid('orga','athlete_2'),
         tests.uid('orga','user_medical')),
  'medical sets a range too — return-to-play mass management, same pair that may write body_composition'
);

-- Rule 1, the athlete half. The subject of the range is the one person who must
-- never be able to author it.
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 95.00, 98.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot set a target range for themselves — staff-set only (client rule 1)'
);

select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 95.00, 98.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'nor for a teammate'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 95.00, 98.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_admin')),
  '42501', null,
  'an admin cannot set a range — admin holds no per-athlete data access (the gap 0020 closed for nutrition_targets)'
);

-- The setter cannot be spoofed: set_by = auth_user_id() is enforced in the WITH
-- CHECK, the same way 0055 enforces created_by, not taken on trust from the client.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 99.00, 102.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_medical')),
  '42501', null,
  'a coach cannot attribute a range to the physio — set_by must be the acting user'
);
select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 99.00, 102.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'nor to the athlete it is about'
);


-- ===========================================================================
-- 2. Reads: coach and medical, and NOBODY else.
--
--    This is the section the separate table exists for. Client rule 2: NEVER
--    visible to the athlete. Asserted twice — org-wide, and naming their own
--    athlete_id directly, which is the exact shape a hand-written PostgREST call
--    from the athlete app would take and the only one that catches a row-level
--    leak on a table the athlete is otherwise allowed into.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from body_mass_target_ranges where org_id = tests.uid('orga','org')),
  0::bigint,
  'the athlete reads ZERO target ranges org-wide — client rule 2'
);
select is(
  (select count(*) from body_mass_target_ranges where athlete_id = tests.uid('orga','athlete_1')),
  0::bigint,
  'the athlete reads zero even when naming their OWN athlete_id directly — the leak a column on athletes or body_composition would have allowed'
);
select is(
  (select count(*) from body_mass_target_ranges
    where athlete_id = tests.uid('orga','athlete_1') and target_low_kg is not null),
  0::bigint,
  'and zero when selecting the bound columns by name, which is what "RLS is row-level, not column-level" means in practice'
);

-- The control, and the proof that §2 is not passing for a trivial reason: the athlete
-- IS granted a row on body_composition, by body_composition_self_select (0024:234-236).
-- That policy is precisely why the target range could not live on that table — RLS
-- being row-level, a target_low_kg column there would have ridden into the athlete's
-- hands on the back of this very policy. It still exists and 0060 does not touch it.
select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'body_composition'
      and policyname = 'body_composition_self_select')::int,
  1,
  'body_composition_self_select still exists — the athlete keeps their own MEASUREMENTS, and it is exactly why the TARGET could not be a column there'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select count(*) from body_mass_target_ranges where org_id = tests.uid('orga','org')),
  0::bigint,
  'a teammate reads zero ranges'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*) from body_mass_target_ranges where org_id = tests.uid('orga','org')),
  0::bigint,
  'an admin reads zero ranges — not the bounds, not the existence'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from body_mass_target_ranges where org_id = tests.uid('orga','org')),
  2::bigint,
  'a coach reads every range in the organisation, including the one the physio set'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*) from body_mass_target_ranges where org_id = tests.uid('orga','org')),
  2::bigint,
  'medical reads every range too, including the one the coach set'
);


-- ===========================================================================
-- 3. It is a RANGE (client rule 3), and a sane one
-- ===========================================================================

select has_column('public', 'body_mass_target_ranges', 'target_low_kg',
  'the low bound is a real column');
select has_column('public', 'body_mass_target_ranges', 'target_high_kg',
  'the high bound is a real column');
select col_not_null('public', 'body_mass_target_ranges', 'target_low_kg',
  'the low bound is NOT NULL — a half range is not a range');
select col_not_null('public', 'body_mass_target_ranges', 'target_high_kg',
  'the high bound is NOT NULL');

-- There is deliberately no single-number column to drift back to. The client was
-- explicit that this is a range, and a nullable target_mass_kg sitting alongside
-- would be re-inventing the thing they said not to build.
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'body_mass_target_ranges'
      and column_name in ('target_mass_kg', 'target_weight_kg', 'target_kg'))::int,
  0,
  'there is NO single-target column on this table — client rule 3, a range and only a range'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 105.00, 102.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_coach')),
  '23514', null,
  'the high bound must exceed the low bound'
);
select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 102.00, 102.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_coach')),
  '23514', null,
  'a zero-width range is refused — that is a single target wearing a range''s clothes'
);
select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 4.00, 400.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_coach')),
  '23514', null,
  'the bounds are held inside a plausible human range — a fat-fingered decimal is not a target'
);

-- One live range per athlete. A second one, uncllosed, is a data-integrity bug, not
-- a history entry: history is made by CLOSING the old row (§5), not by leaving two open.
select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 103.00, 106.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_coach')),
  '23505', null,
  'an athlete has at most ONE live range — a new one requires closing the old'
);


-- ===========================================================================
-- 4. History: the bounds are immutable, the range is superseded
--
--    A staff member may close a range or soft-delete it. They may not rewrite what
--    the range WAS, because a nutritionist looking back over a season needs the
--    old numbers to still be the old numbers.
-- ===========================================================================

select throws_ok(
  format($q$update body_mass_target_ranges set target_low_kg = 90.00 where id = %L$q$,
         tests.uid('orga','range_1')),
  '42501', null,
  'a coach cannot rewrite the low bound in place — a correction is a new row'
);
select throws_ok(
  format($q$update body_mass_target_ranges set target_high_kg = 130.00 where id = %L$q$,
         tests.uid('orga','range_1')),
  '42501', null,
  'nor the high bound'
);
select throws_ok(
  format($q$update body_mass_target_ranges set athlete_id = %L where id = %L$q$,
         tests.uid('orga','athlete_2'), tests.uid('orga','range_1')),
  '42501', null,
  'nor move a range onto a different athlete'
);
select throws_ok(
  format($q$update body_mass_target_ranges set set_by = %L where id = %L$q$,
         tests.uid('orga','user_medical'), tests.uid('orga','range_1')),
  '42501', null,
  'nor re-attribute who set it'
);

-- What a staff member MAY do: close the range, then open a new one. This is the
-- whole history mechanism, and it is the supported path for "the target changed".
select lives_ok(
  format($q$update body_mass_target_ranges set effective_to = current_date where id = %L$q$,
         tests.uid('orga','range_1')),
  'a coach closes a range by setting effective_to — the supported way to change a target'
);
select lives_ok(
  format($q$insert into body_mass_target_ranges
              (id, org_id, athlete_id, target_low_kg, target_high_kg, rationale, set_by,
               effective_from)
            values (%L, %L, %L, 104.00, 107.50, 'In-season, carrying more mass for the scrum.', %L,
                    current_date + 1)$q$,
         tests.uid('orga','range_3'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_coach')),
  'and opens a new one — the closed row no longer blocks the one-live-range index'
);
select is(
  (select count(*) from body_mass_target_ranges
    where athlete_id = tests.uid('orga','athlete_1') and deleted_at is null),
  2::bigint,
  'BOTH rows survive: the season''s target history is readable, not overwritten'
);
select is(
  (select target_low_kg from body_mass_target_ranges where id = tests.uid('orga','range_1')),
  102.00::numeric,
  'and the superseded row still carries the numbers it was set with'
);

-- Soft delete is allowed (it is how a range is retracted); hard delete is not
-- (CLAUDE.md rule 4). Both halves asserted, because only having one is how a
-- retraction affordance turns into a data loss bug.
select lives_ok(
  format($q$update body_mass_target_ranges set deleted_at = now() where id = %L$q$,
         tests.uid('orga','range_3')),
  'a coach may retract a range with a soft delete'
);
select throws_ok(
  format($q$delete from body_mass_target_ranges where id = %L$q$, tests.uid('orga','range_1')),
  '42501', null,
  'nobody holding the authenticated role can hard-delete a range (CLAUDE.md rule 4)'
);
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$delete from body_mass_target_ranges where org_id = %L$q$, tests.uid('orga','org')),
  '42501', null,
  'medical cannot hard-delete either — erasure is the audited service-role path only'
);
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$delete from body_mass_target_ranges where athlete_id = %L$q$,
         tests.uid('orga','athlete_1')),
  '42501', null,
  'and the athlete cannot delete the range set about them, which they cannot read either'
);
-- The athlete's UPDATE is the one refusal in this file that is NOT a 42501, and the
-- difference is worth being explicit about rather than papering over with a throws_ok
-- that would have to be wrong to pass. 0055 gets 42501 on an update because
-- problem_report_notes grants authenticated no UPDATE privilege at all. This table
-- MUST grant it — closing and retracting a range are the two things staff legitimately
-- do — so the privilege check passes for everyone and RLS is the gate. A role the
-- USING clause rejects therefore matches zero rows and the statement succeeds having
-- done nothing, exactly as it already does for an athlete against nutrition_targets or
-- body_composition.
--
-- So the assertion is made on the DATA, not on the error code, which is the stronger
-- claim anyway: the statement is allowed to run and the numbers do not move.
select lives_ok(
  format($q$update body_mass_target_ranges set target_low_kg = 80.00 where athlete_id = %L$q$,
         tests.uid('orga','athlete_1')),
  'an athlete''s update statement is not refused by privilege — the UPDATE grant exists for staff, so RLS is what has to hold'
);
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select target_low_kg from body_mass_target_ranges where id = tests.uid('orga','range_1')),
  102.00::numeric,
  'and it moved NOTHING: the athlete''s update matched zero rows, the bound is untouched'
);
select is(
  (select count(*) from body_mass_target_ranges
    where org_id = tests.uid('orga','org') and target_low_kg = 80.00),
  0::bigint,
  'no row in the organisation carries the value the athlete tried to write'
);
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));


-- ===========================================================================
-- 5. Cross-tenant isolation, both directions
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is(
  (select count(*) from body_mass_target_ranges where org_id = tests.uid('orga','org')),
  0::bigint,
  'orgb''s coach reads zero of orga''s ranges'
);
select is(
  (select count(*) from body_mass_target_ranges where athlete_id = tests.uid('orga','athlete_1')),
  0::bigint,
  'orgb''s coach reads zero naming orga''s athlete id directly'
);

select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 100.00, 103.00, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orgb','user_coach')),
  '42501', null,
  'orgb''s coach cannot set a range on orga''s athlete naming orga''s org_id'
);
select throws_ok(
  format($q$insert into body_mass_target_ranges
              (org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, 100.00, 103.00, %L)$q$,
         tests.uid('orgb','org'), tests.uid('orga','athlete_1'), tests.uid('orgb','user_coach')),
  '42501', null,
  'nor naming orgb''s own org_id — the parent-athlete exists() check cannot find orga''s athlete under orgb'
);

-- The mirror, so the refusals above are tenancy and not a broken policy.
select lives_ok(
  format($q$insert into body_mass_target_ranges
              (id, org_id, athlete_id, target_low_kg, target_high_kg, set_by)
            values (%L, %L, %L, 98.00, 101.00, %L)$q$,
         tests.uid('orgb','range_1'), tests.uid('orgb','org'), tests.uid('orgb','athlete_1'),
         tests.uid('orgb','user_coach')),
  'orgb''s coach sets a range on orgb''s own athlete — the policy works, tenancy is what refused above'
);
select is(
  (select count(*) from body_mass_target_ranges where org_id = tests.uid('orgb','org')),
  1::bigint,
  'orgb''s coach reads exactly their own organisation''s single range'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from body_mass_target_ranges where org_id = tests.uid('orgb','org')),
  0::bigint,
  'and orga''s coach reads none of orgb''s — isolation in both directions'
);

select tests.set_jwt(tests.uid('orgb', 'user_athlete_1'));
select is(
  (select count(*) from body_mass_target_ranges where org_id = tests.uid('orga','org')),
  0::bigint,
  'orgb''s athlete reads zero of orga''s ranges — the cross-tenant and the athlete rule together'
);


-- ===========================================================================
-- 6. IT CAN NEVER BE RANKED — client rule 4, asserted structurally
--
--    Migration 0016 documents why body composition is never leaderboardable: it
--    seeds wellness.body_mass_kg with leaderboard_eligible = false and the reason
--    "Body composition data. Never ranked: see screens/leaderboards.md 'Why body
--    composition must never be leaderboarded'." A target range is strictly worse to
--    rank than a measurement — it publishes what staff privately want an athlete's
--    body to be — so "never" has to be a property of the schema, not a habit.
--
--    0016's own safety argument is that "leaderboard -> everything" is safe because
--    "everything" means "everything in metric_definitions, never an arbitrary column".
--    That gives four independent locks, and this section asserts all four. Any ONE
--    of them failing is a real regression even while the other three hold.
-- ===========================================================================

-- Lock 1. No catalogue row names this table or these columns. compute_leaderboard
-- computes from metric_definitions.source_table; if nothing points here, nothing here
-- is computable.
select is(
  (select count(*) from metric_definitions where source_table = 'body_mass_target_ranges')::int,
  0,
  'no metric_definitions row names body_mass_target_ranges as its source_table'
);
select is(
  (select count(*) from metric_definitions
    where key like '%target_low%' or key like '%target_high%'
       or key like '%target_range%' or label ilike '%target range%')::int,
  0,
  'no metric key or label refers to a body-mass target range at all'
);

-- Lock 2. Nobody signed in can ADD such a catalogue row. The catalogue is seeded by
-- migration and is read-only through the API — 0016's own words, "writable by nobody
-- through the API, the same posture as an enum" — so lock 1 cannot be defeated at
-- runtime by any role.
select is(
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'metric_definitions'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))::int,
  0,
  'authenticated holds no INSERT/UPDATE/DELETE on metric_definitions — lock 1 cannot be unlocked at runtime'
);

-- Lock 3. leaderboards.metric_key is a FOREIGN KEY to metric_definitions(key), so a
-- board naming a metric that does not exist is refused by the database itself, not by
-- an application check somebody can forget. This is the assertion that makes rule 4
-- structural: even a coach with full leaderboard-authoring rights cannot name it.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into leaderboards
              (org_id, name, metric_key, aggregation, population_type, window_type,
               visibility, created_by)
            values (%L, 'Closest to target mass', 'body_composition.target_range', 'latest',
                    'squad', 'all_time', 'published', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  '23503', null,
  'a coach cannot build a leaderboard on a target-range metric — leaderboards.metric_key is a FK into the catalogue and there is no such row'
);
select throws_ok(
  format($q$insert into leaderboards
              (org_id, name, metric_key, aggregation, population_type, window_type,
               visibility, created_by)
            values (%L, 'Target range', 'body_mass_target_ranges', 'latest',
                    'squad', 'all_time', 'staff', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  '23503', null,
  'nor by naming the table itself as the metric key — "everything" means everything in the catalogue, never an arbitrary table'
);

-- Lock 4. Nothing in the database READS this table except its own policies. No
-- function body and no view definition mentions it, so there is no security-definer
-- side door around locks 1-3 — which matters because compute_leaderboard is itself
-- security definer and therefore bypasses the RLS asserted in §2.
-- The one permitted reference is the table's own immutability guard, and only inside
-- the text of its error message — it reads nothing. Every other function in the schema,
-- compute_leaderboard first among them, must not mention the table at all.
select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%body_mass_target_ranges%'
      and p.proname <> 'enforce_body_mass_target_range_immutable')::int,
  0,
  'NO function in public references body_mass_target_ranges except its own guard trigger — compute_leaderboard included, and it is security definer so this is the door that matters'
);
select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'compute_leaderboard'
      and p.prosrc like '%body_mass_target_ranges%')::int,
  0,
  'compute_leaderboard specifically does not name the table — asserted on its own so a rename of the guard cannot hide a regression here'
);
select is(
  (select count(*) from pg_views
    where schemaname = 'public' and definition like '%body_mass_target_ranges%')::int,
  0,
  'and no view exposes it either — a view without security_invoker would bypass §2 entirely'
);

-- The live control for lock 4: compute_leaderboard is present and does compute a
-- board it IS allowed to, so the zero above means "absent from a working function",
-- not "the function does not exist".
select cmp_ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'compute_leaderboard')::int,
  '>=', 1,
  'compute_leaderboard exists — the assertions above are about a real function, not a missing one'
);


-- ===========================================================================
-- 7. The house rules the dynamic suites also sweep, asserted here explicitly
--    so a failure names this table rather than a loop variable.
-- ===========================================================================

select has_column('public', 'body_mass_target_ranges', 'org_id',
  'org_id is present — CLAUDE.md rule 1, and it is what puts this table in tests.club_tables()');
select has_column('public', 'body_mass_target_ranges', 'deleted_at',
  'deleted_at is present — CLAUDE.md rule 4, soft delete only');
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'body_mass_target_ranges'),
  'row level security is enabled'
);
select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'body_mass_target_ranges'
      and cmd = 'DELETE')::int,
  0,
  'there is no DELETE policy at all'
);
select ok(
  (select bool_and(coalesce(qual, '') || coalesce(with_check, '') like '%auth_org_id%')
     from pg_policies
    where schemaname = 'public' and tablename = 'body_mass_target_ranges'),
  'every policy on this table filters on auth_org_id()'
);
-- No policy names the athlete ROLE, and none keys off auth_athlete_id(). Belt and
-- braces on §2: that section proves the athlete reads nothing today; this proves there
-- is no clause of the shape body_composition_self_select uses that could be widened
-- into letting them. The `athlete` token that DOES appear in the insert policy is
-- athlete_id and the athletes table — the parent-row tenancy guard, not a grant.
select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'body_mass_target_ranges'
      and (coalesce(qual, '') || coalesce(with_check, ''))
          like '%''athlete''%')::int,
  0,
  'no policy names the athlete role'
);
select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'body_mass_target_ranges'
      and (coalesce(qual, '') || coalesce(with_check, ''))
          like '%auth_athlete_id%')::int,
  0,
  'and no policy keys off auth_athlete_id() — there is no self-select shape on this table at all'
);
-- Exactly three policies: staff select, staff insert, staff update. Not four, not five.
-- A count is what catches a policy ADDED later; the two assertions above only catch one
-- written in a shape they recognise.
select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'body_mass_target_ranges')::int,
  3,
  'exactly three policies exist on this table — select, insert and update, all staff'
);
select ok(
  (select bool_and(qual like '%coach%' and qual like '%medic%')
     from pg_policies
    where schemaname = 'public' and tablename = 'body_mass_target_ranges'
      and cmd in ('SELECT', 'UPDATE')),
  'every readable-path policy requires coach or medic'
);

select * from finish();
rollback;
