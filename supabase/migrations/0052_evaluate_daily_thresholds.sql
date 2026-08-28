-- 0052_evaluate_daily_thresholds.sql
--
-- What this does
--   Builds the automated step 05-architecture.md §7's job table already names —
--   `evaluate_daily_thresholds | 30 4 * * * | Edge Function | Thresholds that need a
--   window rather than a single value: consecutive-day breaches, ACWR, compliance-rate
--   rules.` — that has never existed anywhere in this schema. Confirmed by exhaustive
--   search before this migration was scoped: no Edge Functions directory exists in this
--   repo at all, and no `evaluate_daily_thresholds` / `evaluate_threshold_calibration` /
--   `on_entry_inserted` function exists anywhere in supabase/migrations/. Every flag
--   visible in the app today was hand-inserted, either directly into seed data
--   (tests.build_org() in supabase/tests/000_setup_test_helpers.sql does the same for the
--   test suite) or by a demo script. Thresholds and flags both have a complete, working
--   UI (screens/thresholds.md, screens/flags.md) sitting on top of a schema
--   (0006_thresholds_flags_compliance.sql) that nothing had ever written to
--   automatically. This migration is that gap, closed.
--
-- Two functions
--   evaluate_daily_thresholds_for_org(org, date) — the real unit of work. Idempotent,
--   callable directly for a backfill or a test, exactly the same shape as migration
--   0044's own generate_compliance_expectations(org, date).
--   evaluate_daily_thresholds_nightly() — the cron entrypoint. Loops every organisation,
--   evaluates the previous LOCAL calendar day for the ones whose local wall clock has
--   just reached 04:30.
--
-- Why pg_cron, not an Edge Function
--   05-architecture.md §7 itself only reaches for an Edge Function on this row because a
--   *different* real constraint applies to it: "Jobs that need outbound HTTP call an Edge
--   Function through pg_net... Jobs that are pure SQL stay in SQL, because a job that
--   cannot fail on a network is a job that cannot fail." evaluate_daily_thresholds needs
--   no outbound HTTP at all — it reads wellness_entries, training_entries and thresholds
--   and writes flags, all in the same database. Migration 0044 already made exactly this
--   argument for generate_compliance_expectations and it applies here byte for byte:
--   `select extversion from pg_extension where extname = 'pg_cron'` on the live project
--   returns 1.6.4, already installed and already running two real jobs (confirmed live,
--   `select jobname, schedule, active from cron.job`: `generate-compliance-expectations`
--   at `5 * * * *` and `retention-nightly-preview` at `15 2 * * *`, both active). No
--   Supabase CLI is available in this environment to deploy an Edge Function at all, so
--   the Edge Function path in the doc's own row is not just more surface than needed, it
--   is not currently buildable here. A same-database, no-new-surface mechanism with two
--   working precedents already exists one migration away. Recorded here rather than
--   silently deviating, per CLAUDE.md §5.
--
-- Why the actual cron schedule is `30 * * * *` (hourly, at :30), not the literal
-- `30 4 * * *` the doc's Schedule column shows
--   `30 4 * * *` fires exactly once per day, at UTC 04:30, full stop — it cannot ever be
--   "for every organisation whose local wall-clock time is currently 04:30" for more than
--   one timezone at once, which is the actual requirement this migration's own brief
--   states in the same breath. Migration 0044 hit precisely this contradiction for
--   generate_compliance_expectations (whose doc row also now reads `5 * * * *`, not a
--   fixed UTC hour, for the same reason) and resolved it the same way this migration
--   does: an HOURLY tick, gated inside the function by comparing only the organisation's
--   local HOUR against the target (4), which is what actually makes "currently 04:30
--   local" true for a second timezone the day one joins. Checked live before writing
--   this: both currently-seeded organisations (`select id, name, timezone from
--   organisations`) are `Europe/London`, so the literal single-UTC-tick schedule would
--   not visibly misbehave today — but it is the identical latent bug 0044's header
--   already named, not re-introduced here. `docs/05-architecture.md` §7's job table is
--   updated in this same commit, exactly as 0044 updated its own row.
--
-- What "the previous local calendar day" means here
--   `03-flows.md` §1's own words, quoted in the per-entry section of the doc:
--   "evaluate_daily_thresholds at 04:30 re-evaluates the previous day as a sweep". At an
--   org-local 04:30 tick, "the previous day" is `(now() at time zone tz)::date - 1`.
--
-- The per-entry (on-insert, immediate) path is deliberately NOT built here
--   05-architecture.md §7 splits threshold evaluation into two mechanisms on purpose: this
--   windowed sweep, and a separate `on_entry_inserted` trigger + `pg_net` call to an
--   `/evaluate-thresholds` Edge Function for thresholds that need no window at all.
--   Checked live before writing this migration: `select id, name, domain, metric,
--   comparison, baseline_type, consecutive_days, min_baseline_observations from
--   thresholds where is_active = true` returns 6 rows across 2 organisations today, and
--   EVERY one of them needs either a rolling personal baseline (needing history), a
--   multi-day derived value (load.acwr needs a 7-day and a 28-day sum), or
--   consecutive_days > 1 — i.e. every real threshold configured in this database today
--   needs a window. There is currently nothing for the per-entry path to do, and it would
--   also need the pg_net + EDGE_SHARED_SECRET + deployed-Edge-Function surface this
--   migration's own reasoning above says does not exist and is not buildable here. Left
--   unbuilt, said so, same honest-cut discipline 0044 used throughout its own header
--   (see e.g. its "gym... net new versus seed.sql" and "unconditional-daily... a
--   judgement call" sections). A real future migration.
--
-- Metric value sources — verified against the real running code before writing this
--   `wellness.readiness_score`, `wellness.sleep_hours`, `wellness.soreness`: direct
--   columns on wellness_entries. readiness_score is trigger-computed
--   (0010_helper_functions_and_triggers.sql, wellness_compute_readiness — sum of the five
--   1-5 sliders present that day, scaled to 0-100, NULL — never 0 — when nothing was
--   submitted) and is read here, never recomputed.
--   `load.acwr`: not stored anywhere. Ported verbatim from src/lib/acwr.ts's
--   computeAcwr(): acute = sum of training_entries.session_load (itself trigger-computed,
--   rpe * duration_min, migration 0010) over the trailing 7 days inclusive of the day
--   evaluated; chronic = the trailing 28-day sum, divided by 4; acwr = acute / chronic.
--   Suppressed (returns NULL, not zero, not an estimate) unless at least
--   ACWR_MIN_DAYS_WITH_DATA = 21 of the trailing 28 days have a training entry — see
--   _threshold_acwr_value below, same threshold hardcoded from the same TS constant.
--   `compliance.wellness_7d`: a plain count of real wellness_entries rows in the trailing
--   7 days, no baseline — 04-data-model.md §11's compliance model has no baseline concept
--   for a raw entry count.
--
-- Comparison semantics — verified against src/lib/queries/thresholds.ts's
-- describeThreshold() and screens/thresholds.md's own backtest_threshold() reference SQL
--   `below` / `above` are an ABSOLUTE cutoff against the raw value, regardless of
--   baseline_type. describeThreshold()'s own comment states this explicitly and is why
--   the UI never claims an `above` rule is "against the athlete's own average" — it is
--   always the raw value against the threshold's own `value`. Confirmed live:
--   threshold #4 ("Acute chronic ratio high", above 1.3, baseline_type=personal_rolling)
--   fires on raw ACWR > 1.3, full stop; baseline_type there does two OTHER things only
--   (see min_baseline_observations and expected_value below).
--   `pct_change_below` / `pct_change_above`, `z_score`: genuinely evaluate against the
--   athlete's personal_rolling baseline (mean, and stddev_samp for z_score), ported from
--   backtest_threshold()'s own window: the baseline is computed over the trailing
--   baseline_days days ENDING THE DAY BEFORE the day evaluated (never including that
--   day's own value in its own baseline — see _threshold_baseline's generate_series
--   bound of `p_date - 1`, matching backtest_threshold()'s
--   `range between (baseline_days || ' days')::interval preceding and '1 day' preceding`
--   exactly).
--   `z_score` sign handling generalises backtest_threshold()'s reference SQL rather than
--   copying its `<= -abs(p_value)` literally, because that formula only ever evaluates a
--   "below" breach even for a hypothetical positive z-score value, while
--   describeThreshold() already renders BOTH directions ("N standard deviations below" /
--   "...above", keyed off `t.value < 0`). This migration's own breach test matches
--   describeThreshold()'s documented semantics instead: a negative `value` (every real
--   z_score row today, `-1.500`) breaches when z <= value; a positive `value` would
--   breach when z >= value. Not exercised by real data today (every seeded z_score row is
--   negative), recorded here rather than silently picking one reading over the other.
--
-- min_baseline_observations applies whenever baseline_type <> 'absolute' — INCLUDING
-- below/above rules, not only z_score/pct_change
--   describeThreshold()'s own comment: "a non-absolute baseline only (a) gates firing
--   behind min_baseline_observations and (b) supplies the... context recorded on each
--   flag" — for `below`/`above` specifically, because those comparisons never read the
--   baseline for the trip condition itself. This is why threshold #4 (above, personal_
--   rolling, min_baseline_observations=14) still needs 14 real prior baseline
--   observations before it can fire at all, even though its raw comparison is a plain
--   `acwr > 1.3`. Absolute-baseline rows (soreness, compliance.wellness_7d, both
--   min_baseline_observations=0 today) skip this gate entirely, per the same comment.
--
-- expected_value on the resulting flag
--   Matches what describeThreshold() and the flag-card UI already assume it means, since
--   that is what is rendered to a coach today: the threshold's own cutoff `value` when
--   baseline_type = 'absolute' (nothing else to show); the athlete's personal_rolling
--   baseline mean otherwise — INCLUDING for below/above rules, where that mean is
--   "recorded on each flag for context" per describeThreshold()'s own comment, even
--   though it played no part in the trip condition.
--
-- squad_mean baseline_type is not implemented
--   Legal in the editor (screens/thresholds.md's "Legal combinations" table) but, per this
--   migration's own live check above, no active threshold anywhere uses it today.
--   _threshold_breach_on_day treats it as a baseline with zero observations, which means
--   the min_baseline_observations gate always blocks it — it never fires, it never
--   errors, and the gap is honest rather than silent. A real squad_mean implementation
--   (mean and stddev across the whole squad's same-day values, per screens/thresholds.md
--   edge case 3's "requires 5 contributing athletes minimum") is a real follow-up.
--
-- consecutive_days: the strict reading, not screens/thresholds.md edge case 8's
-- gap-tolerant one
--   This migration's own brief states the rule as "the breach condition must hold on
--   every one of the trailing N local calendar days ending on the day being evaluated" —
--   re-derived fresh per day from raw data (_threshold_breach_on_day is called once per
--   day in the window, nothing cached). A day with no submission has no computable value,
--   _threshold_metric_raw returns NULL for it, and _threshold_breach_on_day treats a NULL
--   value as "not breached" for that day, which breaks the streak.
--   screens/thresholds.md edge case 8 describes a DIFFERENT, gap-tolerant rule instead —
--   "a gap is not a breach and it is not a reset either... the run continues across the
--   gap if the values either side both breach" — which is real documented product
--   behaviour this migration does not implement. Recording the disagreement rather than
--   picking silently, per CLAUDE.md §5: the strict reading is what this migration's own
--   task brief specifies and tests, is simpler, and does not reward non-compliance any
--   less honestly than it costs — a genuinely gap-tolerant run-length implementation
--   (screens/thresholds.md's own `runs`/`grp` island technique) is a real follow-up if the
--   product decision is made explicitly rather than assumed here.
--
-- cooldown_days
--   Counted from the prior flag's raised_at, converted to the ORGANISATION'S OWN LOCAL
--   calendar day (not a bare 24h*N interval on the timestamptz, and not UTC), and checked
--   regardless of that prior flag's current status (raised, acknowledged, dismissed,
--   resolved, ...) — 0006's own column comment: "Stops a persistent condition raising an
--   identical flag every day."  cooldown_days = 0 means no cooldown at all: the
--   local-day difference is never negative for a real prior flag, so `< 0` never matches
--   and every fresh breach day is eligible (same-day duplicates are still prevented by
--   the idempotency key below, independently of cooldown).
--
-- Idempotency: (athlete_id, threshold_id, flag_date), the real key
-- 05-architecture.md §7 itself names
--   "...idempotent through a unique key on (athlete_id, threshold_id, flag_date)." flags
--   has never had this constraint at the database level (0006_thresholds_flags_compliance
--   .sql declares no unique constraint on flags at all). Added below as a partial unique
--   index (threshold_id is nullable only for flags raised before threshold_revisions
--   existed, per 0006's own comment — every flag this migration ever writes sets it, so
--   the partial predicate never excludes a row this function itself produces). Checked
--   live before adding it: `select threshold_id, athlete_id, flag_date, count(*) from
--   flags where threshold_id is not null group by 1,2,3 having count(*) > 1` returns zero
--   rows, so the index applies cleanly to the data as it stands. The insert uses `on
--   conflict ... do nothing`, unlike 0044's anti-join workaround, because this key has no
--   nullable column in it — ON CONFLICT works cleanly here where it could not there.
--
-- Population and scoping
--   Same athlete population rule as every other job in this codebase: org_id = the
--   org being evaluated, deleted_at is null, status <> 'left_club'
--   (screens/thresholds.md's own backtest_threshold() population CTE). applies_to_group_id
--   further restricts to current group membership (removed_at is null) when set — screens
--   /thresholds.md edge case 6: "Evaluated at fire time against current membership." Every
--   real threshold today has applies_to_group_id = null (thresholds.ts's own header: "no
--   group-specific targeting in the editor... which is what every seeded threshold
--   already uses"), so this is unexercised by real data but implemented correctly per the
--   column's own purpose rather than ignored.
--
-- security definer, execute revoked from anon and authenticated, on EVERY function below
--   Same discipline as 0044 (see that migration's own header for why `revoke ... from
--   public` alone is not enough on this project's public schema — default privileges
--   grant EXECUTE to anon and authenticated at CREATE FUNCTION time, independent of the
--   PUBLIC pseudo-role). Applied here to every helper function too, not only the two
--   entrypoints: several of them (_threshold_metric_raw, _threshold_baseline,
--   _threshold_acwr_value) take a bare athlete_id with no org_id parameter at all and read
--   real per-athlete wellness/training data, so leaving any one of them reachable through
--   PostgREST's RPC surface by an authenticated user of a DIFFERENT organisation would be
--   a genuine cross-tenant read, not merely an internal-implementation-detail concern. A
--   plain (non-definer) helper called from inside evaluate_daily_thresholds_for_org still
--   executes under that function's already-elevated identity for the duration of the
--   call — SECURITY DEFINER changes current_user for the whole nested call chain, not
--   only the outermost frame — so none of the helpers need their own SECURITY DEFINER to
--   do their job; they are locked down purely so they are never callable any other way.
--
-- threshold_revision_id is left null on every flag this migration writes
--   flags.threshold_revision_id exists for exactly the reason 04-data-model.md §17.6
--   states (pin a flag to the rule version that raised it), but checked live before
--   writing this: no application code anywhere writes threshold_revisions — grep across
--   src/lib/queries turns up nothing, and thresholds.ts's own header already says the
--   recalibration/revision machinery is cut from this build ("no recalibration engine...
--   already cut from Flags for the same reason"). The 6 existing threshold_revisions rows
--   are a one-time seed snapshot, the same pattern 0044's header identified for
--   compliance_expectations before this migration. Populating threshold_revision_id
--   correctly needs a real edit-time revision writer that does not exist yet, so it is
--   left null here rather than pointed at a stale seed row that would misrepresent which
--   rule version actually fired. A real follow-up alongside building the edit-time writer.

-- ===========================================================================
-- Helper: load.acwr, ported verbatim from src/lib/acwr.ts computeAcwr(). Not stored
-- anywhere — computed fresh for whichever local day is being asked about. Defined before
-- _threshold_metric_raw below because check_function_bodies validates a `language sql`
-- function's body against the catalogue at CREATE time (unlike plpgsql, which only
-- compiles on first call), so the function it calls must already exist.
-- ===========================================================================

create or replace function public._threshold_acwr_value(
  p_athlete_id uuid,
  p_date       date
)
returns numeric
language sql
stable
set search_path = public
as $$
  with day_loads as (
    select te.entry_date, sum(te.session_load) as day_load
    from public.training_entries te
    where te.athlete_id = p_athlete_id
      and te.superseded_by is null
      and te.entry_date between (p_date - 27) and p_date
    group by te.entry_date
  ),
  agg as (
    select
      count(*)::int as days_with_data,
      coalesce(sum(day_load) filter (where entry_date >= p_date - 6), 0) as acute,
      sum(day_load) as chronic_sum
    from day_loads
  )
  select case
    -- ACWR_MIN_DAYS_WITH_DATA in src/lib/acwr.ts. Suppressed means NULL, not an
    -- estimate — nothing downstream is allowed to fire on a suppressed value.
    when days_with_data < 21 then null
    when chronic_sum is null or chronic_sum = 0 then null
    else acute / (chronic_sum / 4)
  end
  from agg;
$$;

revoke execute on function public._threshold_acwr_value(uuid, date) from public;
revoke execute on function public._threshold_acwr_value(uuid, date) from anon;
revoke execute on function public._threshold_acwr_value(uuid, date) from authenticated;


-- ===========================================================================
-- Helper: today's raw metric value for one athlete on one local calendar day. NULL means
-- no observation that day (never coerced to 0), which _threshold_breach_on_day treats as
-- "not breached" for that day.
-- ===========================================================================

create or replace function public._threshold_metric_raw(
  p_athlete_id uuid,
  p_metric     text,
  p_date       date
)
returns numeric
language sql
stable
set search_path = public
as $$
  select case p_metric
    when 'wellness.readiness_score' then (
      select we.readiness_score
      from public.wellness_entries we
      where we.athlete_id = p_athlete_id
        and we.entry_date = p_date
        and we.superseded_by is null
    )
    when 'wellness.sleep_hours' then (
      select we.sleep_hours
      from public.wellness_entries we
      where we.athlete_id = p_athlete_id
        and we.entry_date = p_date
        and we.superseded_by is null
    )
    when 'wellness.soreness' then (
      select we.soreness::numeric
      from public.wellness_entries we
      where we.athlete_id = p_athlete_id
        and we.entry_date = p_date
        and we.superseded_by is null
    )
    when 'load.acwr' then
      public._threshold_acwr_value(p_athlete_id, p_date)
    when 'compliance.wellness_7d' then (
      select count(*)::numeric
      from public.wellness_entries we
      where we.athlete_id = p_athlete_id
        and we.entry_date between (p_date - 6) and p_date
        and we.superseded_by is null
    )
    else null
  end;
$$;

revoke execute on function public._threshold_metric_raw(uuid, text, date) from public;
revoke execute on function public._threshold_metric_raw(uuid, text, date) from anon;
revoke execute on function public._threshold_metric_raw(uuid, text, date) from authenticated;


-- ===========================================================================
-- Helper: an athlete's personal_rolling baseline (mean, sample stddev, observation
-- count) for one metric, over the trailing p_baseline_days days ENDING THE DAY BEFORE
-- p_date — p_date's own value is never part of its own baseline. Days with no
-- observation are simply absent from the average, not zero-filled.
-- ===========================================================================

create or replace function public._threshold_baseline(
  p_athlete_id    uuid,
  p_metric        text,
  p_date          date,
  p_baseline_days int
)
returns table(mean numeric, sd numeric, n int)
language sql
stable
set search_path = public
as $$
  select avg(v), stddev_samp(v), count(v)::int
  from (
    select public._threshold_metric_raw(p_athlete_id, p_metric, gs::date) as v
    from generate_series(
      (p_date - p_baseline_days)::timestamp,
      (p_date - 1)::timestamp,
      interval '1 day'
    ) as gs
  ) s;
$$;

revoke execute on function public._threshold_baseline(uuid, text, date, int) from public;
revoke execute on function public._threshold_baseline(uuid, text, date, int) from anon;
revoke execute on function public._threshold_baseline(uuid, text, date, int) from authenticated;


-- ===========================================================================
-- Helper: expected_value for the resulting flag. The threshold's own cutoff for an
-- absolute baseline; the athlete's personal_rolling baseline mean otherwise — including
-- for below/above rules, where the mean is context only, per this migration's own header.
-- ===========================================================================

create or replace function public._threshold_expected_value(
  p_threshold  public.thresholds,
  p_athlete_id uuid,
  p_date       date
)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when p_threshold.baseline_type = 'absolute' then p_threshold.value
    else (
      select b.mean
      from public._threshold_baseline(
        p_athlete_id, p_threshold.metric, p_date,
        coalesce(p_threshold.baseline_days, 28)
      ) b
    )
  end;
$$;

revoke execute on function public._threshold_expected_value(public.thresholds, uuid, date) from public;
revoke execute on function public._threshold_expected_value(public.thresholds, uuid, date) from anon;
revoke execute on function public._threshold_expected_value(public.thresholds, uuid, date) from authenticated;


-- ===========================================================================
-- Helper: does ONE threshold breach on ONE local calendar day for ONE athlete. Re-derived
-- fresh from raw data every call — nothing cached, nothing reused across days.
-- ===========================================================================

create or replace function public._threshold_breach_on_day(
  p_threshold  public.thresholds,
  p_athlete_id uuid,
  p_date       date
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_value numeric;
  v_mean  numeric;
  v_sd    numeric;
  v_n     int;
  v_z     numeric;
begin
  v_value := public._threshold_metric_raw(p_athlete_id, p_threshold.metric, p_date);

  -- No observation that day: never coerced to 0, never treated as a breach.
  if v_value is null then
    return false;
  end if;

  if p_threshold.baseline_type <> 'absolute' then
    if p_threshold.baseline_type = 'personal_rolling' then
      select b.mean, b.sd, b.n into v_mean, v_sd, v_n
      from public._threshold_baseline(
        p_athlete_id, p_threshold.metric, p_date,
        coalesce(p_threshold.baseline_days, 28)
      ) b;
    else
      -- squad_mean: not implemented. See this migration's own header. n = 0 means the
      -- gate immediately below always blocks it from firing.
      v_mean := null;
      v_sd   := null;
      v_n    := 0;
    end if;

    -- Applies whenever baseline_type <> 'absolute', including below/above rules, per
    -- describeThreshold()'s own comment quoted in this migration's header.
    if coalesce(v_n, 0) < p_threshold.min_baseline_observations then
      return false;
    end if;
  end if;

  if p_threshold.comparison = 'below' then
    return v_value < p_threshold.value;
  elsif p_threshold.comparison = 'above' then
    return v_value > p_threshold.value;
  elsif p_threshold.comparison = 'z_score' then
    if v_sd is null or v_sd = 0 then
      return false;
    end if;
    v_z := (v_value - v_mean) / v_sd;
    if p_threshold.value < 0 then
      return v_z <= p_threshold.value;
    else
      return v_z >= p_threshold.value;
    end if;
  elsif p_threshold.comparison = 'pct_change_below' then
    if v_mean is null then
      return false;
    end if;
    return v_value <= v_mean * (1 - p_threshold.value / 100.0);
  elsif p_threshold.comparison = 'pct_change_above' then
    if v_mean is null then
      return false;
    end if;
    return v_value >= v_mean * (1 + p_threshold.value / 100.0);
  else
    return false;
  end if;
end;
$$;

revoke execute on function public._threshold_breach_on_day(public.thresholds, uuid, date) from public;
revoke execute on function public._threshold_breach_on_day(public.thresholds, uuid, date) from anon;
revoke execute on function public._threshold_breach_on_day(public.thresholds, uuid, date) from authenticated;


-- ===========================================================================
-- The idempotency key 05-architecture.md §7 itself names. See this migration's header
-- for why a partial unique index (rather than 0044's NULL-safe anti-join) is the right
-- tool here: threshold_id is never null on a flag this function writes.
-- ===========================================================================

create unique index if not exists flags_threshold_athlete_flagdate_unique
  on public.flags (threshold_id, athlete_id, flag_date)
  where threshold_id is not null;

comment on index public.flags_threshold_athlete_flagdate_unique is
  'The (athlete_id, threshold_id, flag_date) key 05-architecture.md §7 names as the '
  'idempotency guarantee for evaluate_daily_thresholds. Migration 0052.';


-- ===========================================================================
-- The real unit of work. Callable directly for a backfill or a test, same shape as
-- migration 0044's own generate_compliance_expectations(org, date).
-- ===========================================================================

create or replace function public.evaluate_daily_thresholds_for_org(
  p_org_id     uuid,
  p_local_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_tz      text;
  v_inserted    integer := 0;
  t             public.thresholds%rowtype;
  a             record;
  v_all_breach  boolean;
  v_check_day   date;
  v_i           int;
  v_in_cooldown boolean;
  v_observed    numeric;
  v_expected    numeric;
  v_flag_id     uuid;
begin
  select timezone into v_org_tz
  from public.organisations
  where id = p_org_id and deleted_at is null;

  if v_org_tz is null then
    raise exception 'org_not_found: %', p_org_id using errcode = 'P0001';
  end if;

  for t in
    select *
    from public.thresholds
    where org_id = p_org_id
      and is_active = true
      and deleted_at is null
  loop
    for a in
      select ath.id
      from public.athletes ath
      where ath.org_id = p_org_id
        and ath.deleted_at is null
        and ath.status <> 'left_club'
        and (
          t.applies_to_group_id is null
          or exists (
            select 1
            from public.group_memberships gm
            where gm.athlete_id = ath.id
              and gm.group_id = t.applies_to_group_id
              and gm.removed_at is null
          )
        )
    loop
      -- consecutive_days: every one of the trailing N local calendar days ending on
      -- p_local_date must independently breach. Re-derived fresh per day; see header.
      v_all_breach := true;
      for v_i in 0 .. (t.consecutive_days - 1) loop
        v_check_day := p_local_date - v_i;
        if not public._threshold_breach_on_day(t, a.id, v_check_day) then
          v_all_breach := false;
          exit;
        end if;
      end loop;

      if not v_all_breach then
        continue;
      end if;

      -- cooldown_days: counted from the prior flag's raised_at in the ORG'S OWN local
      -- calendar, regardless of that prior flag's current status. See header.
      v_in_cooldown := exists (
        select 1
        from public.flags f
        where f.threshold_id = t.id
          and f.athlete_id = a.id
          and (p_local_date - (f.raised_at at time zone v_org_tz)::date) < t.cooldown_days
      );
      if v_in_cooldown then
        continue;
      end if;

      v_observed := public._threshold_metric_raw(a.id, t.metric, p_local_date);
      v_expected := public._threshold_expected_value(t, a.id, p_local_date);
      v_flag_id  := null;

      insert into public.flags
        (org_id, athlete_id, threshold_id, domain, metric, observed_value, expected_value,
         flag_date, severity, status, raised_at)
      values
        (p_org_id, a.id, t.id, t.domain, t.metric, v_observed, v_expected,
         p_local_date, t.severity, 'raised', now())
      on conflict (threshold_id, athlete_id, flag_date) where threshold_id is not null
        do nothing
      returning id into v_flag_id;

      if v_flag_id is not null then
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

  return v_inserted;
end;
$$;

comment on function public.evaluate_daily_thresholds_for_org(uuid, date) is
  'The windowed threshold sweep 05-architecture.md §7 names. Idempotent (unique index on '
  '(threshold_id, athlete_id, flag_date)), callable directly for a backfill or a test, or '
  'from evaluate_daily_thresholds_nightly() below. Returns the count of flags actually '
  'inserted. Migration 0052 — see its header for every comparison/baseline/consecutive-'
  'day/cooldown decision.';

revoke execute on function public.evaluate_daily_thresholds_for_org(uuid, date) from public;
revoke execute on function public.evaluate_daily_thresholds_for_org(uuid, date) from anon;
revoke execute on function public.evaluate_daily_thresholds_for_org(uuid, date) from authenticated;


-- ===========================================================================
-- The cron entrypoint. See this migration's header for the schedule and the
-- previous-local-day reasoning.
-- ===========================================================================

create or replace function public.evaluate_daily_thresholds_nightly()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org          record;
  v_local_date date;
  v_n          integer;
begin
  for org in select id, timezone from public.organisations where deleted_at is null loop
    if extract(hour from (now() at time zone org.timezone)) = 4 then
      v_local_date := (now() at time zone org.timezone)::date - 1;

      v_n := public.evaluate_daily_thresholds_for_org(org.id, v_local_date);

      insert into public.audit_log
        (org_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
      values (
        org.id, null, null, 'thresholds.evaluated', 'organisation', org.id,
        jsonb_build_object(
          'flag_date', v_local_date, 'flags_inserted', v_n,
          'note', 'Automated nightly sweep. 05-architecture.md §7, migration 0052.'
        )
      );
    end if;
  end loop;
end;
$$;

comment on function public.evaluate_daily_thresholds_nightly() is
  'pg_cron entrypoint, scheduled below at 30 * * * * (hourly, at :30). Acts only for '
  'organisations whose local wall-clock hour is currently 4, evaluating that local '
  'previous day. Migration 0052 header explains why this is an hourly gated tick rather '
  'than the literal single UTC 04:30 the architecture doc''s Schedule column shows.';

revoke execute on function public.evaluate_daily_thresholds_nightly() from public;
revoke execute on function public.evaluate_daily_thresholds_nightly() from anon;
revoke execute on function public.evaluate_daily_thresholds_nightly() from authenticated;

select cron.schedule(
  'evaluate-daily-thresholds',
  '30 * * * *',
  $$select public.evaluate_daily_thresholds_nightly()$$
);
