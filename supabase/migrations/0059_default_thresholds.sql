-- 0059_default_thresholds.sql
--
-- What this does
--   Gives a brand-new organisation a way to get the proven starter set of thresholds
--   instead of an empty /settings/thresholds screen.
--
-- The question this answers, and the answer as found
--   Coach, verbatim: "is the setting page threshold window do we have general default
--   thresholds for each club to use and start with?" Investigated before writing anything.
--   The answer was NO, and it is worse than "no defaults": it is a silent dead end.
--     * No migration anywhere inserts into `thresholds`. Grepped all of supabase/migrations
--       for `insert into ... thresholds`: zero hits. 0006 creates the table, 0010 only adds
--       its updated_at trigger, 0011 its indexes, 0012/0013 its policies and grants.
--     * The only threshold rows that have ever existed are hand-written demo data:
--       supabase/seed.sql:713 (five rules for demo org A) and seed.sql:1029 (a single rule
--       for demo org B), plus one row per test org in tests/000_setup_test_helpers.sql:368.
--       All three are one-time fixtures keyed to hard-coded org UUIDs. None of them is a
--       mechanism; none of them runs for a real club.
--     * There is no organisation-creation code path in the application at all — grep for an
--       insert into `organisations` across src/ returns nothing — so there was no place a
--       default set could have been provisioned even by accident.
--   Consequence, which is the part that actually matters: `thresholds` is the ONLY input
--   that makes migration 0052's evaluate_daily_thresholds_for_org() do anything. A club
--   with zero thresholds has a nightly sweep that runs, finds no rules, and raises no
--   flags — forever, silently, with a Flags screen that looks healthy because it is empty.
--   The club would have to hand-author five rules from `/settings/thresholds/new` before
--   the flag engine, the dashboard flag panel, and the athlete-facing flag notice do
--   anything at all. Nobody is told this.
--
-- Which spec sections this implements
--   04-data-model.md §10 — "personal_rolling ... is the recommended default for a new
--     organisation", which is the doc already asserting a default set exists conceptually.
--   0006_thresholds_flags_compliance.sql's own header repeats that sentence verbatim.
--   The `threshold_source` enum (0001) has had a 'default' value since day one, and until
--   this migration NOTHING in the schema could ever legitimately produce one — the value
--   existed for a mechanism that was never built. This is that mechanism.
--
-- Where the numbers come from: copied, not invented
--   Every value below is lifted verbatim from supabase/seed.sql:713-741, the five rules
--   already running against demo org A. They were deliberately NOT re-derived here. Two
--   independent reasons to trust exactly this set rather than a fresh one:
--     1. They are the set the product has actually been demoed and reasoned about with.
--     2. They are, exactly and with nothing left over, the five metrics migration 0052's
--        `_threshold_metric_value()` knows how to evaluate — `wellness.readiness_score`,
--        `wellness.sleep_hours`, `wellness.soreness`, `load.acwr`, `compliance.wellness_7d`.
--        A sixth invented rule on any other metric key would be a threshold the engine
--        silently cannot evaluate. The engine's supported-metric list and this default set
--        are the same list, which is the strongest available evidence that this IS the
--        intended starter set rather than one club's preferences.
--   The one deliberate deviation from the seed AS FIRST WRITTEN: `source` is 'default' on
--   all five rows. The seed marks the soreness and compliance rules 'custom', which cannot
--   be right for rows a club never authored — that looks like seed-authoring drift, and a
--   set handed to a club by Fydr is what `threshold_source = 'default'` means.
--   Three further deviations were then forced by review, because "the demo club runs it"
--   turned out not to be evidence that a rule is safe as a DEFAULT for a club with no
--   history at all: the ACWR row's baseline_type and description, and the compliance
--   row's is_active and description. All three are argued out in the corrections section
--   below. Every comparison, cutoff value, consecutive_days, severity and notify_roles is
--   still the demo club's.
--
-- ---------------------------------------------------------------------------------------
-- Judgement call 1: a callable function, NOT a trigger on organisations
-- ---------------------------------------------------------------------------------------
--   The obvious design is `create trigger after insert on organisations`, so every new club
--   is provisioned with no one having to remember. It was rejected, on evidence, because in
--   this repo it is not additive — it retroactively changes the meaning of every existing
--   organisation insert:
--     * tests/000_setup_test_helpers.sql:279 inserts an organisation inside build_org(),
--       then inserts exactly ONE threshold and two flags with known ids. A trigger would
--       silently give every test organisation in the whole pgTAP suite five extra threshold
--       rows it does not expect, on the shared fixture every tenancy test builds on.
--     * seed.sql would produce 10 thresholds for demo org A (5 from the trigger + its own
--       5) and 6 for org B (5 + its own 1), changing the demo dashboard and the flag counts
--       the screens are tuned against.
--   The brief for this work explicitly permitted either shape ("either at org creation or
--   as a callable backfill for orgs with none"), and the environment this was built in
--   forbids running the test suite, so a change whose blast radius lands squarely on the
--   fixture that every tenancy test shares, and which cannot be verified here, is not a
--   change to make on judgement alone. Recorded rather than quietly skipped: the trigger is
--   the better long-term shape and should be revisited by someone who can run
--   `npm run test:tenancy` and fix the two fixtures in the same pass.
--
-- ---------------------------------------------------------------------------------------
-- Judgement call 2: SECURITY INVOKER, deliberately, not SECURITY DEFINER
-- ---------------------------------------------------------------------------------------
--   Migration 0052's functions are SECURITY DEFINER because they read every athlete's
--   wellness and training data across an organisation on a cron identity that has no JWT.
--   Nothing like that is true here. seed_default_thresholds() writes rows the caller is
--   ALREADY allowed to write: `thresholds_coach_insert` (0012) is
--   `with check (org_id = auth_org_id() and auth_has_any_role(['coach']))`.
--   Leaving it SECURITY INVOKER means the tenancy gate on this function IS that policy —
--   the same one `createThreshold()` in src/lib/queries/thresholds.ts already goes through —
--   rather than a second, hand-rolled `if auth_org_id() <> p_org_id` check that could drift
--   from it. A coach passing another organisation's uuid is rejected by RLS, not by my
--   arithmetic, so CLAUDE.md rule 1 holds by construction and rule 2 holds because
--   auth_has_any_role() resolves the role from the verified JWT server-side and never from
--   anything the client sent. There is deliberately no explicit role check in the body: a
--   second gate that can disagree with the first is a liability, not defence in depth. The
--   cost is that a non-coach gets a raw `42501 row-level security` error rather than a
--   friendly sentence; the calling code translates it (thresholds.ts), which is the right
--   layer for wording.
--   service_role (the backfill / onboarding path) bypasses RLS as it does everywhere else.
--
-- ---------------------------------------------------------------------------------------
-- Judgement call 3: all-or-nothing, and no threshold_revisions rows
-- ---------------------------------------------------------------------------------------
--   The function refuses to act on an organisation that already has ANY threshold row —
--   live, inactive or retired — and returns 0 rather than raising. It is therefore
--   idempotent and cannot ever top up, merge into, or duplicate a set a club has begun
--   configuring — the failure mode worth designing against is a coach who deleted some or
--   all of the defaults on purpose getting them silently reinstated. "Never had a
--   threshold row" is the only unambiguous state; anything else is somebody's decision and
--   is left alone. (This paragraph originally said "non-deleted", which made a club that
--   retired every rule look unconfigured and re-seedable. That was the defect corrected in
--   (c) below — the reasoning was right and the predicate did not match it.)
--   seed.sql writes a threshold_revisions row per default ("Created from the club default
--   set at onboarding"). This function does not, on purpose: `createThreshold()` in
--   src/lib/queries/thresholds.ts does not write revisions either, thresholds.ts's own
--   header records that the revision/recalibration machinery is cut from this build, and
--   0052's header confirms nothing in the app has ever written that table. Emitting
--   revision rows only from this one path would make threshold_revisions look populated
--   when it is not, which is worse than it being consistently empty.
--
-- ---------------------------------------------------------------------------------------
-- Corrections made after review, BEFORE this migration was ever applied anywhere
-- ---------------------------------------------------------------------------------------
--   This file is edited in place rather than followed by an 0060, because it has not been
--   applied to any database: it is still an untracked working-tree file (`git ls-files`
--   returns nothing for it), and no Supabase CLI, psql or Docker exists in the environment
--   it was written in, so there is no path by which it could have run. CLAUDE.md §5's
--   "never rewrite an applied migration" is not engaged. If that ever stops being true,
--   the three changes below have to become a new migration instead — and note that
--   default_threshold_set()'s RETURN TYPE changed (a new `is_active` column), which
--   `create or replace function` cannot do to a function that already exists.
--
--   (a) 'Wellness compliance low' now ships INACTIVE (is_active = false).
--       The defect: as an active rule this fires on every athlete in a brand-new club on
--       the first nightly sweep. `compliance.wellness_7d` is `count(*)` over
--       wellness_entries (0052's _threshold_metric_raw), so on a club that has never
--       submitted anything it evaluates to 0 — a real, non-null observation of "fewer
--       than four", not a gap — and 0 < 4 breaches for every athlete, every day, forever
--       until four entries accumulate in a rolling week.
--       Why neither of the two obvious gates fixes it, checked against the engine rather
--       than assumed:
--         * min_baseline_observations cannot help. _threshold_baseline counts NON-NULL
--           daily values, and this metric is never null — a day before the club existed
--           still yields 0. `n` therefore equals baseline_days for a brand-new club
--           exactly as it does for a two-year-old one, so any gate value up to 28 is
--           satisfied on day one. (It is also skipped outright while baseline_type is
--           'absolute'.)
--         * consecutive_days cannot help either, for the same reason: every trailing day
--           of a club's pre-history evaluates to 0 and therefore breaches, so a 3-day or
--           a 14-day window is satisfied on day one just as a 1-day window is. 0053's
--           gap tolerance does not rescue it — a gap is a NULL value, and this metric
--           has none.
--       There is no combination of this rule's own parameters that distinguishes "has
--       stopped logging" from "has not started logging", because the metric itself does
--       not. The honest fix inside this migration's remit (which is "which thresholds
--       exist and their parameters", never the 0052/0053 evaluator) is to ship the rule
--       switched off: it is still in the starter set, still visible on
--       /settings/thresholds, one click from live via ThresholdRow's Activate button, and
--       it cannot raise anything until a coach decides the squad has been logging long
--       enough for absence to mean something. The description says so in the same words.
--       The real repair belongs in the engine and is a follow-up: _threshold_metric_raw
--       should return NULL, not 0, for compliance.wellness_7d when the athlete has no
--       wellness history at all before the window — at which point this rule can ship
--       active with a min_baseline_observations gate that actually bites. Deliberately
--       not done here: it changes the meaning of a metric for every existing threshold in
--       every club, which is a bigger blast radius than a default set is allowed to have.
--
--   (b) 'Acute chronic ratio high' is now baseline_type 'absolute', and its description
--       says what it does.
--       The defect was twofold. The row paired an `above 1.30` comparison — which 0052
--       evaluates as a flat `v_value > 1.30`, never consulting a mean or an SD — with
--       baseline_type 'personal_rolling' and min_baseline_observations 14. The only
--       effect of that pairing was the gate at 0053's line ~119, which applies to
--       below/above rules too: the rule was silently unable to fire until the athlete had
--       14 non-null daily ACWR observations, which nothing in the UI said. And the
--       shipped description, copied from seed.sql, read "Seven to twenty eight day EWMA
--       load ratio above own 1SD band" — a sentence describing a z_score rule against a
--       personal band, which is not what any part of this row did.
--       Fixed by making the row coherent in the direction it already behaved: an absolute
--       cutoff at 1.30, baseline_days null, min_baseline_observations 0, with a
--       description that states the cutoff. New clubs are still protected, and by a
--       stronger gate than the one removed: _threshold_acwr_value returns NULL unless at
--       least 21 of the trailing 28 days carry a training entry (ACWR_MIN_DAYS_WITH_DATA,
--       0052), so this rule cannot produce a value at all — let alone a flag — until a
--       club has roughly a month of real training load. The cost is that flags.
--       expected_value now records 1.30 (the cutoff) instead of the athlete's rolling
--       mean, which for an absolute rule is the more honest of the two.
--       The alternative — keeping personal_rolling and changing the comparison to a
--       positive z_score so the old sentence became true — was rejected: it would replace
--       a well-established absolute cutoff every screen in the app already quotes
--       (findActiveAcwrThreshold in thresholds.ts, audit finding S1) with a personalised
--       band nobody has asked for, in the same change that was supposed to fix a lie.
--
--   (c) The idempotence guard and the backfill now treat a SOFT-DELETED rule as
--       configuration, not as absence.
--       The defect: the guard was `deleted_at is null`, and archiveThreshold() retires a
--       rule by setting deleted_at (there is no delete grant on this table at all). So an
--       organisation whose coach deliberately retired every rule read as "never
--       configured", and the backfill DO block at the foot of this file — which runs as
--       the migration owner with RLS off, across every organisation, with no human
--       involved — would hand it five live rules and a flag engine that starts raising
--       the flags that coach had switched off. Judgement call 3 above claimed this could
--       never happen; it was true of a coach who deleted four of five and false of a
--       coach who deleted all five, which is the worse of the two cases.
--       Fixed by asking whether the organisation has ANY threshold row, retired or not.
--       "Never had a rule" and "has no live rules" are genuinely different states and the
--       schema does record the difference — a retired rule is still a row. Note this is
--       also what makes the guard correct under RLS: thresholds_coach_select (0012) has
--       no deleted_at predicate, so a coach sees their own club's retired rows and the
--       SECURITY INVOKER guard therefore sees exactly what the owner-run backfill sees.
--       The consequence, stated rather than hidden: a club that retired everything can no
--       longer be re-provisioned by this function, by design. It authors a rule from
--       /settings/thresholds/new instead, which is a deliberate act rather than a silent
--       reinstatement. docs/screens/thresholds.md's "how do we tell a rule you never had
--       from a rule you removed, which the schema does not currently record" is corrected
--       in the same change: it does record it.
-- ---------------------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- The default set itself, as data.
--
-- A set-returning function rather than a table, because this is Fydr's product
-- opinion shipped with the schema, not club-editable state — there is no
-- org_id here and never should be, so it would fail CLAUDE.md rule 1 as a
-- table. Being one function also means the values live in exactly one place:
-- seed_default_thresholds() below reads them, and any future org-creation
-- trigger reads the same rows rather than a second copy that drifts.
-- ---------------------------------------------------------------------------

create or replace function public.default_threshold_set()
returns table (
  name                      text,
  description               text,
  domain                    public.flag_domain,
  metric                    text,
  comparison                public.threshold_comparison,
  value                     numeric(10,3),
  baseline_type             public.baseline_type,
  baseline_days             int,
  consecutive_days          int,
  min_baseline_observations int,
  cooldown_days             int,
  severity                  public.flag_severity,
  notify_roles              public.app_role[],
  -- Not every starter rule can be safely live on a club's first day. See correction (a)
  -- in this file's header: 'Wellness compliance low' ships switched off because its
  -- metric cannot tell a squad that has stopped logging from one that has not started.
  is_active                 boolean
)
language sql
immutable
set search_path = public
as $$
  values
    -- The headline rule. z_score against the athlete's own 28-day norm rather than an
    -- absolute readiness number, which is 04-data-model.md §10's whole argument: "an
    -- athlete who consistently sleeps 6.5 hours is not in trouble, an athlete who normally
    -- sleeps 8.5 and slept 6.5 is." consecutive_days 2 so one bad night is not an alert.
    ('Readiness below personal norm',
     'Composite readiness more than 1.5 SD below own 28 day norm',
     'wellness'::public.flag_domain, 'wellness.readiness_score',
     'z_score'::public.threshold_comparison, -1.5::numeric(10,3),
     'personal_rolling'::public.baseline_type, 28, 2, 10, 3,
     'high'::public.flag_severity, '{coach,medical}'::public.app_role[], true),

    ('Sleep dropped',
     'Sleep more than 20 per cent below own 28 day mean, two days running',
     'wellness'::public.flag_domain, 'wellness.sleep_hours',
     'pct_change_below'::public.threshold_comparison, 20::numeric(10,3),
     'personal_rolling'::public.baseline_type, 28, 2, 10, 3,
     'medium'::public.flag_severity, '{coach}'::public.app_role[], true),

    -- Absolute, not personal_rolling, and correctly so: soreness is a 1-5 self-report where
    -- 2-or-below means the same thing for every athlete. baseline_days null and
    -- min_baseline_observations 0 because an absolute rule needs no baseline to be valid.
    -- Safe to ship live in a club's first week despite that, unlike the compliance rule
    -- below: a day with no wellness entry has no soreness value at all, so 0053 treats it
    -- as a gap and the rule needs three REAL self-reports at 2-or-below before it fires.
    ('Soreness elevated',
     'Soreness at 2 or below for three days running',
     'wellness'::public.flag_domain, 'wellness.soreness',
     'below'::public.threshold_comparison, 2::numeric(10,3),
     'absolute'::public.baseline_type, null, 3, 0, 2,
     'medium'::public.flag_severity, '{coach,medical}'::public.app_role[], true),

    -- Absolute, matching what 0052 actually evaluates: `above` is a flat comparison
    -- against this row's own value and never reads a mean or an SD, whatever
    -- baseline_type says. The original row said 'personal_rolling' with
    -- min_baseline_observations 14, which changed nothing about the trip condition and
    -- only made the rule silently dormant for an athlete's first 14 ACWR observations —
    -- see correction (b) in this file's header, and the description, which used to
    -- describe a personal 1SD band this rule has never evaluated.
    -- The new-club protection this looks like it loses, it never had: ACWR itself is
    -- suppressed (NULL, not an estimate) until 21 of the trailing 28 days carry a
    -- training entry, 0052's _threshold_acwr_value, so there is no value to compare
    -- against 1.30 until a club has about a month of real load behind it.
    ('Acute chronic ratio high',
     'Acute:chronic workload ratio above 1.30 — the trailing 7 day load against the 28 day average',
     'gps'::public.flag_domain, 'load.acwr',
     'above'::public.threshold_comparison, 1.30::numeric(10,3),
     'absolute'::public.baseline_type, null, 1, 0, 3,
     'high'::public.flag_severity, '{coach}'::public.app_role[], true),

    -- Low severity and a 7-day cooldown on purpose. A missing wellness entry is an
    -- administrative problem, not a health one, and raising it daily at medium is the
    -- alert-fatigue mechanism 03-flows.md §5 warns about.
    -- SHIPS INACTIVE, and this is the one rule in the set that does. compliance.wellness_7d
    -- is a count, so "no entries" reads as 0 rather than as no observation, and 0 breaches
    -- "below 4" on every day of a club's pre-history. No parameter on this row can tell a
    -- squad that stopped logging from one that has not started — not
    -- min_baseline_observations (the metric is never null, so the count is always full),
    -- not consecutive_days (every prior day breaches too), not 0053's gap tolerance
    -- (there are no gaps in a count). Correction (a) in the header has the whole
    -- argument, including the engine-side follow-up that would let it ship live.
    ('Wellness compliance low',
     'Fewer than four wellness submissions in the last seven days. Starts switched off: '
     'turn it on once the squad has been logging for a couple of weeks, or it will flag '
     'everyone for the entries they had no chance to make yet.',
     'compliance'::public.flag_domain, 'compliance.wellness_7d',
     'below'::public.threshold_comparison, 4::numeric(10,3),
     'absolute'::public.baseline_type, null, 1, 0, 7,
     'low'::public.flag_severity, '{coach}'::public.app_role[], false);
$$;

comment on function public.default_threshold_set() is
  'Fydr''s starter threshold set: the five rules a club begins with, four of them live and '
  '''Wellness compliance low'' switched off until a coach turns it on (its metric is a '
  'count, so it cannot tell a squad that stopped logging from one that has not started). '
  'Values are the demo club''s, on exactly the five metrics migration 0052''s evaluator '
  'supports. Pure constants, no org data. Applied to an organisation by '
  'public.seed_default_thresholds().';


-- ---------------------------------------------------------------------------
-- Applying the set to one organisation.
--
-- Returns the number of rows inserted: 5 on an organisation that has never had
-- a threshold row, 0 on one that has any — live, inactive, or retired. Safe to
-- call repeatedly. See judgement calls 2 and 3 in this file's header for why it
-- is SECURITY INVOKER and why it refuses to top up a partially-configured club,
-- and correction (c) for why a retired rule counts as configuration.
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_thresholds(p_org_id uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if p_org_id is null then
    raise exception 'seed_default_thresholds requires an organisation id';
  end if;

  -- The guard. ANY threshold row, retired or live: a soft-deleted rule is a rule this
  -- club once had and a coach removed on purpose (archiveThreshold() sets deleted_at —
  -- there is no delete grant on this table at all), and reinstating it behind their back
  -- is the one outcome this function exists to be incapable of. See correction (c) in
  -- this file's header for why the earlier `deleted_at is null` version was wrong, and
  -- wrong most dangerously in the owner-run backfill at the foot of this file.
  --
  -- It is also a SELECT the caller can actually run: under RLS a coach sees their own
  -- organisation's thresholds and nobody else's (thresholds_coach_select, which has no
  -- deleted_at predicate, so retired rows are visible to them exactly as they are to the
  -- backfill), so for any caller not entitled to this org this returns no rows and the
  -- insert below is then rejected by thresholds_coach_insert. Fail-closed either way.
  if exists (
    select 1 from public.thresholds
     where org_id = p_org_id
  ) then
    return 0;
  end if;

  insert into public.thresholds (
    org_id, name, description, domain, metric, comparison, value,
    baseline_type, baseline_days, consecutive_days, min_baseline_observations,
    cooldown_days, severity, notify_roles, is_active, source, created_by
  )
  select
    p_org_id, d.name, d.description, d.domain, d.metric, d.comparison, d.value,
    d.baseline_type, d.baseline_days, d.consecutive_days, d.min_baseline_observations,
    d.cooldown_days, d.severity, d.notify_roles, d.is_active,
    -- See the header: 'default' is what these rows are, and the enum value has existed
    -- since 0001 waiting for exactly this producer.
    'default'::public.threshold_source,
    -- Null for the service_role / backfill path, which has no JWT and therefore no user.
    -- thresholds.created_by is nullable and this is honest: no person authored these.
    public.auth_user_id()
  from public.default_threshold_set() d;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.seed_default_thresholds(uuid) is
  'Give an organisation Fydr''s starter threshold set (public.default_threshold_set()). '
  'Returns the number of rows inserted, or 0 if the organisation has ANY threshold row at '
  'all, retired ones included — it never tops up or duplicates a configured set, and never '
  'reinstates rules a coach deleted on purpose. Only a club that has never had a threshold '
  'can be provisioned. SECURITY INVOKER on purpose: the tenancy and role gate is the '
  'existing thresholds_coach_insert RLS policy, not a second check inside this function.';


-- ---------------------------------------------------------------------------
-- Grants.
--
-- default_threshold_set() must be executable by `authenticated`, unlike every
-- function in 0052: because seed_default_thresholds() is SECURITY INVOKER, it
-- runs as the calling coach and that coach needs execute on the function it
-- calls. This is safe in a way 0052's helpers were not — it takes no arguments,
-- reads no table, and returns the same five constant rows to everyone, so
-- there is no tenancy surface to protect. anon gets nothing: an unauthenticated
-- caller has no business enumerating product configuration.
-- ---------------------------------------------------------------------------

revoke execute on function public.default_threshold_set() from public;
revoke execute on function public.default_threshold_set() from anon;
grant  execute on function public.default_threshold_set() to authenticated, service_role;

revoke execute on function public.seed_default_thresholds(uuid) from public;
revoke execute on function public.seed_default_thresholds(uuid) from anon;
grant  execute on function public.seed_default_thresholds(uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Backfill: any organisation that exists right now and has NEVER had a
-- threshold row — not one that has none live.
--
-- Runs as the migration owner, so RLS does not apply and every organisation is
-- visible, and no human is involved in any of it. That is exactly why the
-- predicate here matters more than the one inside the function: a club whose
-- coach retired every rule on purpose used to match `no live thresholds`, and
-- this loop would have handed it five active rules and a flag engine that
-- starts raising the flags they switched off, overnight, with no action and no
-- notice. It now matches only organisations with no threshold row at all, which
-- is the one unambiguous "never configured" state. Correction (c) in this
-- file's header.
--
-- Still deliberately a no-op in the two situations that matter locally: on a
-- fresh database no organisations exist yet at migration time (seed.sql runs
-- after migrations), and on the dev database both demo orgs already have their
-- seeded thresholds. It exists for the real case — a club created out of band
-- before this migration landed, which today has a permanently silent flag
-- engine and has never made a decision about thresholds either way.
-- ---------------------------------------------------------------------------

do $$
declare
  o record;
  n integer := 0;
begin
  for o in
    select id from public.organisations org
     where not exists (
       select 1 from public.thresholds t
        where t.org_id = org.id
     )
  loop
    n := n + public.seed_default_thresholds(o.id);
  end loop;
  raise notice 'default thresholds backfill: % rows inserted', n;
end $$;
