-- 310_default_thresholds_test.sql
--
-- public.default_threshold_set() and public.seed_default_thresholds(uuid),
-- migration 0059. The starter threshold set a brand-new club begins with, and the
-- one function that applies it.
--
-- Why this file exists at all
--   Before 0059 nothing in the schema ever inserted a `thresholds` row for a real
--   organisation, so a new club's flag engine (0052) had no rules and raised nothing,
--   permanently and silently. 0059 adds a callable provisioner. A callable provisioner
--   that inserts rows into a tenant-scoped table is a permission surface, so per
--   CLAUDE.md §5 it is tested before it is trusted.
--
-- Which rules this asserts — the intended behaviour, stated before the assertions
--   Coach: the only role that may apply the set, and only to their OWN organisation.
--     This mirrors thresholds_coach_insert (0012) exactly, and deliberately so —
--     seed_default_thresholds() is SECURITY INVOKER precisely so that policy, and not a
--     second hand-rolled check, is the gate. These tests are therefore as much a test of
--     "the function did not accidentally acquire definer rights" as of the policy.
--   Medical, admin, athlete: no access. "Set thresholds" is coach-only in
--     01-roles-and-permissions.md §2, and 04-data-model.md §17.12 repeats that medical
--     has no threshold access. A role that cannot insert a threshold by hand must not be
--     able to insert five through a function.
--   Cross-org: orgb's coach naming orga's org_id inserts nothing into orga. This is
--     CLAUDE.md rule 1, and it is the assertion that would catch a careless future
--     `security definer` added to this function — under definer rights RLS would no
--     longer apply and this call would silently succeed.
--   Idempotence: an organisation that already has any threshold row gets 0 rows and no
--     change, so the function can never top up, duplicate, or reinstate rules a coach
--     deleted on purpose.
--   A RETIRED rule counts as configuration, not as absence. This is the inverse of what
--     the first version of this file asserted ("soft deletes count as absent"), and the
--     inversion is the point: archiveThreshold() retires a rule by setting deleted_at —
--     there is no delete grant on this table — so a club whose coach cleared every rule
--     on purpose reads as "has none live", never as "never had any". Under the old
--     `deleted_at is null` guard the owner-run backfill in 0059 would have handed that
--     club five live rules overnight with no human involved. Section 6 is the regression
--     test for the function and section 9a for the backfill's own predicate; section 5
--     proves the genuinely-never-configured club is still provisionable.
--   No rule in the set can flag a brand-new club that has submitted nothing. Section 9
--     runs the real 0052/0053 evaluator over a freshly-provisioned organisation whose
--     athletes have no entries of any kind and asserts zero flags — and then switches on
--     the one rule that ships inactive and asserts the storm IS real, which is why it
--     ships inactive. That pair is the whole argument for the is_active column in
--     default_threshold_set(), stated as a test rather than as a comment.
--   Section 0's club is built directly, before the session drops to `authenticated`, and
--     sections 9a-9c run as the owner: the flag engine is SECURITY DEFINER with execute
--     revoked from authenticated (0052), and the backfill predicate is written from the
--     identity 0059's DO block actually runs under. Same pattern as
--     270_evaluate_daily_thresholds_test.sql.
--   The set itself: exactly five rules, all marked source='default', on exactly the five
--     metric keys migration 0052's evaluator supports. That last assertion is the one
--     that fails loudly if someone adds a sixth default on a metric the engine cannot
--     evaluate — a rule that would look configured and never fire.
--
-- Fixture note
--   tests.build_org() gives every organisation ONE threshold already
--   (000_setup_test_helpers.sql:368), so orga and orgb both start in the
--   "already configured" state, and — since a retired row now counts as configuration —
--   they stay that way even after a coach retires it. The genuinely-unconfigured club
--   this file needs for the happy path therefore cannot be produced through the UI's own
--   soft-delete path at all; it is built directly (section 6), which is honest about the
--   fact that the only way into that state is never having been in any other.

begin;
select * from no_plan();

select tests.fixtures();


-- ===========================================================================
-- 0. A club that has NEVER had a threshold row.
--
-- Built directly, as the migration owner, before the session drops to `authenticated`.
-- It cannot be built any other way: tests.build_org() gives every organisation a
-- threshold, and the only removal path this schema offers is archiveThreshold()'s soft
-- delete, which — correctly, per 0059's correction (c) — leaves the row and therefore
-- leaves the club configured for good. "Never configured" is a state a club can only
-- start in, so this fixture starts one there.
--
-- Two athletes and nothing else: no wellness entries, no training entries, no flags.
-- That is 0059's own worst case (a club that onboarded this morning), and it is the
-- population section 8 turns the real flag engine loose on.
-- ===========================================================================

insert into public.organisations (id, name, sport, timezone)
values (tests.uid('newclub', 'org'), 'Fixture New Club', 'rugby_union', 'Europe/London');

insert into public.users (id, org_id, email, full_name, status) values
  (tests.uid('newclub','user_coach'),   tests.uid('newclub','org'),
   'newclub.coach@fixture.example',   'New Coach',   'active'),
  (tests.uid('newclub','user_medical'), tests.uid('newclub','org'),
   'newclub.medical@fixture.example', 'New Physio',  'active'),
  (tests.uid('newclub','user_admin'),   tests.uid('newclub','org'),
   'newclub.admin@fixture.example',   'New Admin',   'active'),
  (tests.uid('newclub','user_athlete'), tests.uid('newclub','org'),
   'newclub.athlete@fixture.example', 'New Athlete', 'active');

insert into public.user_roles (org_id, user_id, role) values
  (tests.uid('newclub','org'), tests.uid('newclub','user_coach'),   'coach'),
  (tests.uid('newclub','org'), tests.uid('newclub','user_medical'), 'medic'),
  (tests.uid('newclub','org'), tests.uid('newclub','user_admin'),   'sport_scientist'),
  (tests.uid('newclub','org'), tests.uid('newclub','user_athlete'), 'athlete');

insert into public.athletes (id, org_id, user_id, first_name, last_name, date_of_birth, status)
values
  (tests.uid('newclub','athlete_1'), tests.uid('newclub','org'),
   tests.uid('newclub','user_athlete'), 'Newly', 'Signed', date '2003-03-03', 'active'),
  (tests.uid('newclub','athlete_2'), tests.uid('newclub','org'),
   null, 'Also', 'New', date '2001-11-11', 'active');


set local role authenticated;


-- ===========================================================================
-- 1. default_threshold_set(): the product opinion, not tenant data
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select is(
  (select count(*)::int from public.default_threshold_set()),
  5,
  'default_threshold_set() returns exactly five starter rules'
);

-- The load-bearing assertion of this file. These five metric keys are the complete list
-- migration 0052's _threshold_metric_value() knows how to evaluate. A default on any
-- other key would be a rule that is configured, visible in the UI, and silently
-- unevaluable forever.
-- Compared as a sorted text[] rather than with set_eq(), which nothing else in this
-- suite uses and which has to infer a column type from an untyped VALUES list.
select is(
  (select array_agg(metric order by metric) from public.default_threshold_set()),
  array['compliance.wellness_7d', 'load.acwr', 'wellness.readiness_score',
        'wellness.sleep_hours', 'wellness.soreness']::text[],
  'every default rule sits on a metric the 0052 evaluator actually supports'
);

-- 04-data-model.md §10: "personal_rolling ... is the recommended default for a new
-- organisation". Two of the five are personal_rolling — the two whose comparisons
-- (z_score, pct_change_below) genuinely evaluate against a baseline. The three absolute
-- ones are absolute for a stated reason (soreness is a fixed 1-5 self-report, compliance
-- is a count, ACWR is a flat cutoff), which is checked here so a future edit cannot
-- quietly flip them.
select is(
  (select count(*)::int from public.default_threshold_set()
    where baseline_type = 'personal_rolling'),
  2,
  'the two defaults that actually evaluate against a baseline are the personal_rolling ones'
);

-- 0059 correction (b). `above`/`below` are flat comparisons in 0052's
-- _threshold_breach_on_day: they never read the mean or the SD. A non-absolute
-- baseline_type on such a rule changes nothing about when it trips and only gates it
-- behind min_baseline_observations, silently — which is exactly what the ACWR default
-- used to do for an athlete's first 14 ACWR observations. No default may ship in that
-- shape again.
select is(
  (select count(*)::int from public.default_threshold_set()
    where comparison in ('above', 'below') and baseline_type <> 'absolute'),
  0,
  'no flat-comparison default claims a baseline it does not evaluate'
);

select is(
  (select min_baseline_observations from public.default_threshold_set()
    where metric = 'load.acwr'),
  0,
  'the ACWR default carries no baseline gate — under `above` that only ever delayed it silently'
);

-- The description is shipped into every club's thresholds table and read by a coach on
-- /settings/thresholds. The old one ("Seven to twenty eight day EWMA load ratio above own
-- 1SD band") described a z_score rule against a personal band, which this row has never
-- been. A description that names a personalised band while the rule applies a fixed
-- cutoff is worse than none.
select ok(
  (select description like '%1.30%' and description not like '%1SD%'
     from public.default_threshold_set() where metric = 'load.acwr'),
  'the ACWR description states the fixed 1.30 cutoff the rule actually applies'
);

-- 0059 correction (a). compliance.wellness_7d is a COUNT, so a club that has never
-- submitted anything evaluates to 0, not to "no observation" — 0 < 4 breaches for every
-- athlete on every day of the club's pre-history, and no parameter on the row can tell
-- that apart from a squad that stopped logging. It therefore ships switched off, and it
-- is the only rule in the set that does. Section 9 proves both halves against the real
-- engine.
select is(
  (select array_agg(name order by name) from public.default_threshold_set()
    where not is_active),
  array['Wellness compliance low']::text[],
  'exactly one default ships switched off, and it is the compliance count rule'
);

select is(
  (select count(*)::int from public.default_threshold_set() where is_active),
  4,
  'the other four ship live'
);

-- A personal_rolling rule with min_baseline_observations 0 would fire against a baseline
-- built from one data point, which is 0006's own named failure mode ("makes a new
-- athlete look alarming in week one"). No default may ship in that state.
select is(
  (select count(*)::int from public.default_threshold_set()
    where baseline_type = 'personal_rolling' and min_baseline_observations < 10),
  0,
  'no personal_rolling default can fire against a thin baseline'
);

-- Athletes are not staff. notify_roles must never carry 'athlete' — a flag reaches the
-- athlete through athlete_visible_at after acknowledgement (carve-out 2), never by being
-- notified directly off a threshold.
select is(
  (select count(*)::int from public.default_threshold_set()
    where 'athlete' = any(notify_roles)),
  0,
  'no default notifies an athlete directly'
);


-- ===========================================================================
-- 2. The idempotence guard: an already-configured club is left alone
-- ===========================================================================

-- orga arrives from the fixture with one threshold, so it is "configured".
select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('orga','org') and deleted_at is null),
  1,
  'orga starts with the single fixture threshold'
);

select is(
  public.seed_default_thresholds(tests.uid('orga','org')),
  0,
  'a club that already has a threshold gets 0 rows, not a top-up'
);

select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('orga','org') and deleted_at is null),
  1,
  'and nothing was actually written'
);


-- ===========================================================================
-- 3. Wrong role: medical, admin and athlete cannot provision, in any org
--
--    Each of these is the RLS policy thresholds_coach_insert refusing, surfaced
--    through the function. 42501 rather than a quiet zero-row insert is the point:
--    a policy violation on an INSERT ... SELECT raises, it does not skip rows.
--
--    Aimed at the never-configured club from section 0, deliberately. Against orga the
--    idempotence guard would refuse every caller first and each case would return 0 for
--    the wrong reason, passing while proving nothing — and since a retired rule now
--    counts as configuration (0059 correction (c)), retiring orga's fixture row no
--    longer opens that door. Only a club that has never had a threshold reaches the
--    insert, so only that club can test who is allowed to perform it.
-- ===========================================================================

select tests.set_jwt(tests.uid('newclub', 'user_medical'));
select throws_ok(
  format($q$select public.seed_default_thresholds(%L)$q$, tests.uid('newclub','org')),
  '42501',
  null,
  'medical cannot provision defaults — coach-only, per 01-roles-and-permissions.md §2'
);

/* The negative control that used to sit here asserted that an admin was
   refused. 0063 renames that role to sport_scientist, which docs/access-matrix.md
   §1 gives everything, so the refusal became a permission. It has not been
   deleted: it moved to the end of this file, as a positive control, because
   asserting it HERE would leave a row behind and every count below is written
   against the state this file builds in order. */

select tests.set_jwt(tests.uid('newclub', 'user_athlete'));
select throws_ok(
  format($q$select public.seed_default_thresholds(%L)$q$, tests.uid('newclub','org')),
  '42501',
  null,
  'an athlete cannot provision defaults'
);


-- ===========================================================================
-- 4. Cross-tenant: another club's coach cannot provision this one
--
--    CLAUDE.md rule 1. This is also the canary for SECURITY DEFINER creeping onto
--    seed_default_thresholds() in a later edit: under definer rights RLS would stop
--    applying and this insert would succeed.
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select throws_ok(
  format($q$select public.seed_default_thresholds(%L)$q$, tests.uid('newclub','org')),
  '42501',
  null,
  'orgb coach naming another club''s id is refused by RLS, not by arithmetic inside the function'
);

select tests.set_jwt(tests.uid('newclub', 'user_coach'));
select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('newclub','org')),
  0,
  'and the new club still has no thresholds at all after every refused attempt'
);


-- ===========================================================================
-- 5. The happy path: the new club's own coach provisions it
-- ===========================================================================

select is(
  public.seed_default_thresholds(tests.uid('newclub','org')),
  5,
  'the club''s own coach provisions the five defaults'
);

select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('newclub','org') and deleted_at is null
      and source = 'default'),
  5,
  'all five land marked source = default, which is what the enum value has always meant'
);

select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('newclub','org') and deleted_at is null
      and created_by = tests.uid('newclub','user_coach')),
  5,
  'created_by is the coach who applied them, resolved from the JWT and not from any argument'
);

-- The is_active flags survive the insert: four live rules and the compliance rule off.
-- A default set that silently arrived all-active would put the day-one flag storm back.
select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('newclub','org') and deleted_at is null and is_active),
  4,
  'four of the five arrive live'
);

select is(
  (select array_agg(name) from public.thresholds
    where org_id = tests.uid('newclub','org') and deleted_at is null and not is_active),
  array['Wellness compliance low']::text[],
  'and the compliance rule arrives switched off, ready for a coach to turn on'
);

-- Now that the club is configured, the guard closes behind us.
select is(
  public.seed_default_thresholds(tests.uid('newclub','org')),
  0,
  'calling twice is a no-op — the function cannot duplicate a set it already applied'
);

select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('newclub','org') and deleted_at is null),
  5,
  'still five, not ten'
);


-- ===========================================================================
-- 6. A club that retired every rule on purpose is NOT re-provisioned
--
--    0059 correction (c), and the case the earlier `deleted_at is null` guard got
--    wrong. archiveThreshold() (src/lib/queries/thresholds.ts) retires a rule by setting
--    deleted_at — there is no delete grant on this table at all — so "no live rules" is
--    a decision somebody made, not an empty club. Under the old guard this club read as
--    never-configured, and the owner-run backfill at the foot of 0059 would have handed
--    it five live rules overnight with nobody asking for them. Section 9a pins the
--    backfill half; this is the function half.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$update thresholds set deleted_at = now(), is_active = false
             where org_id = %L$q$, tests.uid('orga','org')),
  'orga coach retires every threshold the club has, through the same soft-delete path the UI uses'
);

select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('orga','org') and deleted_at is null),
  0,
  'orga now has no live thresholds'
);

select is(
  public.seed_default_thresholds(tests.uid('orga','org')),
  0,
  'and gets 0 back — a retired rule is a decision, not an absence, so nothing is reinstated'
);

select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('orga','org') and deleted_at is null),
  0,
  'the club stays as its coach left it: no live rules'
);

select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('orga','org') and deleted_at is not null),
  1,
  'and the retired rule is still there, still retired — CLAUDE.md rule 4'
);


-- ===========================================================================
-- 7. orgb was never touched by any of the above
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is(
  (select count(*)::int from public.thresholds
    where org_id = tests.uid('orgb','org') and deleted_at is null),
  1,
  'orgb still has exactly its own fixture threshold and none of the new club''s defaults'
);


-- ===========================================================================
-- 8. Argument hygiene
-- ===========================================================================

-- Four-arg form with the SQLSTATE, matching 231_gym_log_revisions_test.sql: pgTAP's
-- two- and three-arg throws_ok() have to guess whether the second argument is a
-- SQLSTATE or a message, and a bare `raise exception` is P0001.
select throws_ok(
  $q$select public.seed_default_thresholds(null::uuid)$q$,
  'P0001',
  'seed_default_thresholds requires an organisation id',
  'a null org id is rejected outright rather than silently doing nothing'
);


-- ===========================================================================
-- 9. What the defaults actually DO on a brand-new club, run through the real engine
--
--    Back to the migration owner for this section. evaluate_daily_thresholds_for_org()
--    is SECURITY DEFINER with execute revoked from authenticated (0052), and
--    270_evaluate_daily_thresholds_test.sql calls it exactly this way. The backfill
--    predicate below also needs owner visibility across organisations, which is precisely
--    the identity the DO block in 0059 runs under.
-- ===========================================================================

reset role;

-- --- 9a. The backfill cannot re-seed a club that retired its rules ---------------
-- Written as the migration's own predicate, so this test fails if the DO block's WHERE
-- clause is ever loosened back.
select is(
  (select count(*)::int
     from public.organisations org
    where org.id = tests.uid('orga','org')
      and not exists (select 1 from public.thresholds t where t.org_id = org.id)),
  0,
  'the club that retired every rule does not match 0059''s backfill predicate'
);

-- The same club against the predicate 0059 originally shipped. This is the regression
-- itself, pinned: under `deleted_at is null` the backfill WOULD have matched this club
-- and re-seeded it, with no human action anywhere in the loop.
select is(
  (select count(*)::int
     from public.organisations org
    where org.id = tests.uid('orga','org')
      and not exists (select 1 from public.thresholds t
                       where t.org_id = org.id and t.deleted_at is null)),
  1,
  'and it would have matched the earlier `deleted_at is null` predicate — the defect, kept visible'
);

-- --- 9b. No flag storm on day one ------------------------------------------------
-- The new club has the full default set (section 5) and two athletes who have submitted
-- nothing at all — no wellness entry, no training entry, no GPS. This is the sweep that
-- runs at 04:30 on the club's first night.
select is(
  public.evaluate_daily_thresholds_for_org(tests.uid('newclub','org'), current_date),
  0,
  'a brand-new club with the default set and nothing submitted raises no flags on its first sweep'
);

select is(
  (select count(*)::int from public.flags where org_id = tests.uid('newclub','org')),
  0,
  'and not one flag row exists for it'
);

-- --- 9c. Why the compliance rule ships off, demonstrated rather than asserted ------
-- Switch on the one rule that ships inactive, change nothing else, and re-run the same
-- sweep. Every athlete is flagged for entries they have had no opportunity to make:
-- compliance.wellness_7d is a count, so "never submitted" reads as 0, and 0 < 4. This is
-- the storm 0059 correction (a) exists to prevent, and it is the reason the rule cannot
-- ship live no matter what its consecutive_days or min_baseline_observations say.
update public.thresholds set is_active = true
 where org_id = tests.uid('newclub','org') and metric = 'compliance.wellness_7d';

select is(
  public.evaluate_daily_thresholds_for_org(tests.uid('newclub','org'), current_date),
  2,
  'switched on, that rule flags every athlete in the squad on day one — one each, out of nothing'
);

select is(
  (select count(*)::int from public.flags
    where org_id = tests.uid('newclub','org') and metric <> 'compliance.wellness_7d'),
  0,
  'the other four defaults stay silent: a missing entry is a gap, not a breach (0053)'
);


-- The moved control. 0068 puts the sport scientist alongside the coach on the
-- thresholds write, per 3.6's "Thresholds | VECD | VECD | V | V | X", so this
-- role provisions defaults now. It runs last because provisioning is exactly
-- what the assertions above check has NOT happened yet.
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$select public.seed_default_thresholds(%L)$q$, tests.uid('orga','org')),
  'a sport scientist CAN provision default thresholds'
);

select * from finish();
rollback;
