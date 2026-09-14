-- 0128_body_mass_flaggable.sql
--
-- What this does
--   Body mass becomes a flaggable metric — STAFF-SS-01 D7, ruled by Isabella on
--   2026-09-13 (batch B3): "thresholded on CHANGE OVER TIME, never an absolute
--   value — a registry entry and a threshold row; then both cards fill by
--   themselves." The nutritionist's attention card reads the nutrition domain and
--   the S&C's reads "load and weigh-ins only"; until now no threshold could raise a
--   flag about a weigh-in, so both read "No open flags right now" for ever.
--
--   Five pieces, in the order they appear below:
--   1. The evaluator learns the metric `body.mass_kg` (_threshold_metric_raw).
--   2. The default set gains a sixth rule, "Body mass dropped".
--   3. The thresholds table refuses the absolute shape, and refuses to notify the
--      coach, for that metric.
--   4. flags RLS withholds body-mass flags from the coach.
--   5. The rule preview answers the coach with silence for that metric.
--   Then a backfill: the new default into every organisation that has thresholds
--   but has never had this one.
--
-- The metric key is `body.mass_kg`, not metric_definitions' `wellness.body_mass_kg`
--   metric_definitions (0016) is the leaderboard catalogue and seeds body mass as
--   NEVER rankable, in the wellness domain, from wellness_entries only. This is a
--   different metric: the same quantity read for a different purpose (a flag, not a
--   rank), in a different domain (nutrition, the one the nutritionist may act on
--   and the S&C's dashboard counts alongside load), from two sources. Two purposes,
--   two identifiers, per CLAUDE.md §0.1 — docs/metrics.md MET-043 is the entry, and
--   it says how it differs from MET-005.
--
-- Two sources, and which wins on a day
--   A weigh-in is a body_composition row (lib/queries/dashboard.ts's own definition,
--   the profile's Body weight card, the nutrition workspace). The athlete's own
--   optional figure on the morning check-in is wellness_entries.body_mass_kg (the
--   athlete app's Me page). A club uses one or the other, sometimes both. A change
--   rule needs a series, so the day's figure is the staff weigh-in when there is
--   one and the check-in figure otherwise — a club whose athletes type their own
--   weight is not blind, and a club that weighs on the club scale is not overridden
--   by a home scale on the same day. The known cost: two scales that disagree by
--   a kilo widen the athlete's own band. Recorded on the decision sheet.
--
-- Never absolute, enforced at the table
--   The ruling's "never an absolute value" is a constraint, not a UI convention:
--   thresholds_body_mass_is_a_change requires a pct_change_* or z_score comparison
--   AND a personal_rolling baseline for this metric. (below/above are flat
--   comparisons in 0052's evaluator whatever baseline_type says, so allowing them
--   with a non-absolute baseline would be an absolute rule wearing a baseline.)
--
-- The coach does not see body mass at all
--   access-matrix §3.2, Isabella 12 September 2026 (STAFF-SS-02-05 C9): the profile's
--   Body weight card, the nutrition page's card and the export columns are all
--   withheld from the coach. A flag carrying observed_value 77.4 kg would hand it
--   back. So: flags_staff_select and flags_staff_update exclude metric
--   'body.mass_kg' unless the caller holds one of BODY_MASS_VIEW's four roles
--   (sport scientist, S&C, nutritionist, medic — lib/access.ts), the preview RPC
--   returns nothing for the coach on that metric, and the table refuses a rule that
--   names the coach in notify_roles. Roles are unions: a coach who is also the S&C
--   reads them. The athlete's own read (flags_self_select) is unchanged — it is
--   their weight.
--   NOT gated here, on purpose and recorded on the sheet: flag_actions (a staff note
--   under a flag the coach cannot open — free text, no value column), and the rule
--   itself on /settings/thresholds (a coach reads "Body mass more than 2 per cent
--   below own 28 day mean", which names no athlete and no number of anyone's).
--
-- The backfill
--   seed_default_thresholds() refuses to top up an organisation that has ANY
--   threshold row (0059, correction c: a retired rule was retired on purpose). That
--   reasoning does not reach a rule an organisation has never had: nobody retired
--   it. Every organisation with thresholds and no body.mass_kg rule, live or
--   retired, gets the default, source 'default', created_by null (no person wrote
--   it) — the same shape 0059's own owner-run backfill produced. Isabella's ruling
--   is that the cards fill by themselves; without this they fill for new clubs only.
--
-- Tests: supabase/tests/830_body_mass_threshold_test.sql (written first), and
-- 310_default_thresholds_test.sql updated for six.


-- ===========================================================================
-- 1. The evaluator learns body.mass_kg
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
    when 'body.mass_kg' then coalesce(
      -- The day's weigh-in: the staff-logged body_composition row measured that day
      -- (the latest logged, if a typo was re-entered), else the figure the athlete
      -- typed on that morning's check-in. Migration 0128's header says why both.
      (
        select bc.body_mass_kg
        from public.body_composition bc
        where bc.athlete_id = p_athlete_id
          and bc.measured_on = p_date
          and bc.body_mass_kg is not null
        order by bc.created_at desc
        limit 1
      ),
      (
        select we.body_mass_kg
        from public.wellness_entries we
        where we.athlete_id = p_athlete_id
          and we.entry_date = p_date
          and we.superseded_by is null
      )
    )
    else null
  end;
$$;

revoke execute on function public._threshold_metric_raw(uuid, text, date) from public;
revoke execute on function public._threshold_metric_raw(uuid, text, date) from anon;
revoke execute on function public._threshold_metric_raw(uuid, text, date) from authenticated;


-- ===========================================================================
-- 2. The default set: six rules
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.default_threshold_set()
 RETURNS TABLE(name text, description text, domain flag_domain, metric text, comparison threshold_comparison, value numeric, baseline_type baseline_type, baseline_days integer, consecutive_days integer, min_baseline_observations integer, cooldown_days integer, severity flag_severity, notify_roles app_role[], is_active boolean)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
     'high'::public.flag_severity, '{coach,medic}'::public.app_role[], true),

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
     'medium'::public.flag_severity, '{coach,medic}'::public.app_role[], true),

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
     'low'::public.flag_severity, '{coach}'::public.app_role[], false),

    -- Body mass (STAFF-SS-01 D7, ruled 2026-09-13): a CHANGE against the athlete's own
    -- 28-day mean, never an absolute number — thresholds_body_mass_is_a_change (0128)
    -- refuses the absolute shape at the table. 2 per cent is the drop that reads as
    -- under-fuelling or dehydration rather than scale noise. consecutive_days 1 because
    -- a weigh-in may be weekly: with 0053's gap rule a two-day window over a weekly
    -- weigher holds one observation anyway, so "two running" would mean two things on
    -- two clubs. min_baseline_observations 4: a month of weekly weigh-ins, or four
    -- mornings of check-in figures. cooldown 7 so a lighter fortnight raises one flag,
    -- not seven. Notifies the two roles whose dashboards count it; never the coach,
    -- who does not see body mass at all (access-matrix §3.2) — the table refuses that
    -- too.
    ('Body mass dropped',
     'Body mass more than 2 per cent below own 28 day mean',
     'nutrition'::public.flag_domain, 'body.mass_kg',
     'pct_change_below'::public.threshold_comparison, 2::numeric(10,3),
     'personal_rolling'::public.baseline_type, 28, 1, 4, 7,
     'medium'::public.flag_severity, '{nutritionist,strength_conditioning}'::public.app_role[], true);
$function$
;

comment on function public.default_threshold_set() is
  'Fydr''s starter threshold set: the six rules a club begins with, five of them live and '
  '''Wellness compliance low'' switched off until a coach turns it on (its metric is a '
  'count, so it cannot tell a squad that stopped logging from one that has not started). '
  'Values are the demo club''s, on exactly the six metrics the evaluator supports '
  '(0052, and body.mass_kg from 0128). Pure constants, no org data. Applied to an '
  'organisation by public.seed_default_thresholds().';

comment on function public.seed_default_thresholds(uuid) is
  'Give an organisation Fydr''s starter threshold set (public.default_threshold_set()). '
  'Returns the number of rows inserted, or 0 if the organisation has ANY threshold row at '
  'all, retired ones included — it never tops up or duplicates a configured set, and never '
  'reinstates rules a coach deleted on purpose. Only a club that has never had a threshold '
  'can be provisioned. SECURITY INVOKER on purpose: the tenancy and role gate is the '
  'existing thresholds_coach_insert RLS policy, not a second check inside this function.';


-- ===========================================================================
-- 3. The table refuses the absolute shape, and the coach, for body mass
-- ===========================================================================

alter table public.thresholds
  add constraint thresholds_body_mass_is_a_change check (
    metric <> 'body.mass_kg'
    or (
      comparison in ('pct_change_below', 'pct_change_above', 'z_score')
      and baseline_type = 'personal_rolling'
    )
  );

comment on constraint thresholds_body_mass_is_a_change on public.thresholds is
  'Body mass is thresholded on change over time, never an absolute number (Isabella, '
  '2026-09-13). below/above are flat comparisons whatever baseline_type says, so only a '
  'percentage change or a z-score against the personal_rolling baseline is a change rule.';

alter table public.thresholds
  add constraint thresholds_body_mass_not_to_coach check (
    metric <> 'body.mass_kg'
    or not ('coach'::public.app_role = any(notify_roles))
  );

comment on constraint thresholds_body_mass_not_to_coach on public.thresholds is
  'The coach does not see body mass at all (access-matrix §3.2), so a body-mass rule '
  'cannot name the coach among the roles it notifies.';


-- ===========================================================================
-- 4. flags: the coach reads no body-mass flag
-- ===========================================================================

drop policy if exists flags_staff_select on public.flags;
create policy flags_staff_select on public.flags
  for select to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY[
      'sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role,
      'strength_conditioning'::app_role, 'nutritionist'::app_role
    ])
    and (
      metric <> 'body.mass_kg'
      or auth_has_any_role(ARRAY[
        'sport_scientist'::app_role, 'strength_conditioning'::app_role,
        'nutritionist'::app_role, 'medic'::app_role
      ])
    )
  );

drop policy if exists flags_staff_update on public.flags;
create policy flags_staff_update on public.flags
  for update to authenticated
  using (
    org_id = auth_org_id()
    and (
      auth_has_any_role(ARRAY[
        'sport_scientist'::app_role,
        'coach'::app_role,
        'medic'::app_role,
        'strength_conditioning'::app_role
      ])
      or (
        auth_has_any_role(ARRAY['nutritionist'::app_role])
        and domain = 'nutrition'::flag_domain
      )
    )
    and (
      metric <> 'body.mass_kg'
      or auth_has_any_role(ARRAY[
        'sport_scientist'::app_role, 'strength_conditioning'::app_role,
        'nutritionist'::app_role, 'medic'::app_role
      ])
    )
  );
-- No WITH CHECK, as in 0075: Postgres reuses USING for the new row, so the
-- metric cannot be rewritten to slip past either half.


-- ===========================================================================
-- 5. The preview answers the coach with silence for body mass
-- ===========================================================================

create or replace function public.preview_threshold_rule(
  p_metric                    text,
  p_comparison                public.threshold_comparison,
  p_value                     numeric,
  p_baseline_type             public.baseline_type,
  p_baseline_days             int,
  p_consecutive_days          int,
  p_min_baseline_observations int,
  p_applies_to_group_id       uuid,
  p_days                      int default 28
)
returns table (
  athlete_id   uuid,
  first_name   text,
  last_name    text,
  breach_days  int,
  in_scope     int,
  window_days  int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org     uuid := public.auth_org_id();
  v_tz      text;
  v_today   date;
  t         public.thresholds%rowtype;
  a         record;
  v_i       int;
  v_j       int;
  v_state   boolean;
  v_any     boolean;
  v_all     boolean;
  v_days    int;
  v_scope   int;
  v_emitted boolean := false;
begin
  if v_org is null or not public.auth_has_any_role(array['sport_scientist','coach']::public.app_role[]) then
    return;
  end if;
  -- 0128: a body-mass rule's preview names the athletes whose weight moved. The
  -- coach does not see body mass at all (access-matrix §3.2), so for them the
  -- answer is the same silence a role outside the gate gets.
  if p_metric = 'body.mass_kg'
     and not public.auth_has_any_role(array['sport_scientist','strength_conditioning','nutritionist','medic']::public.app_role[]) then
    return;
  end if;
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'preview_window_out_of_range' using errcode = 'P0001';
  end if;

  select timezone into v_tz from public.organisations where id = v_org and deleted_at is null;
  v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  -- The rule, in memory. Only the columns _threshold_breach_on_day reads.
  t.org_id                    := v_org;
  t.metric                    := p_metric;
  t.comparison                := p_comparison;
  t.value                     := p_value;
  t.baseline_type             := p_baseline_type;
  t.baseline_days             := p_baseline_days;
  t.consecutive_days          := greatest(coalesce(p_consecutive_days, 1), 1);
  t.min_baseline_observations := coalesce(p_min_baseline_observations, 10);
  t.applies_to_group_id       := p_applies_to_group_id;

  select count(*) into v_scope
  from public.athletes ath
  where ath.org_id = v_org
    and ath.deleted_at is null
    and ath.status <> 'left_club'
    and (
      t.applies_to_group_id is null
      or exists (
        select 1 from public.group_memberships gm
        where gm.athlete_id = ath.id
          and gm.group_id = t.applies_to_group_id
          and gm.removed_at is null
      )
    );

  for a in
    select ath.id, ath.first_name, ath.last_name
    from public.athletes ath
    where ath.org_id = v_org
      and ath.deleted_at is null
      and ath.status <> 'left_club'
      and (
        t.applies_to_group_id is null
        or exists (
          select 1 from public.group_memberships gm
          where gm.athlete_id = ath.id
            and gm.group_id = t.applies_to_group_id
            and gm.removed_at is null
        )
      )
    order by ath.last_name, ath.first_name
  loop
    v_days := 0;
    -- Each of the trailing p_days local days, ending yesterday (today is not
    -- complete): the day counts when every one of the rule's consecutive
    -- days ending on it breaches, exactly as the nightly sweep decides it.
    for v_i in 1 .. p_days loop
      v_any := false;
      v_all := true;
      for v_j in 0 .. (t.consecutive_days - 1) loop
        v_state := public._threshold_breach_on_day(t, a.id, v_today - v_i - v_j);
        if v_state is null then
          continue;  -- a gap: neither a breach nor a reset (0053)
        end if;
        v_any := true;
        if not v_state then
          v_all := false;  -- a real non-breach ends the run
          exit;
        end if;
      end loop;
      if v_any and v_all then
        v_days := v_days + 1;
      end if;
    end loop;

    if v_days > 0 then
      athlete_id  := a.id;
      first_name  := a.first_name;
      last_name   := a.last_name;
      breach_days := v_days;
      in_scope    := v_scope;
      window_days := p_days;
      v_emitted   := true;
      return next;
    end if;
  end loop;

  -- Nobody flagged: one row with a null athlete carries the denominator, so
  -- the caller can still say "0 of 30 athletes over 28 days". (Not FOUND —
  -- the athlete loop above sets it.)
  if not v_emitted then
    athlete_id  := null;
    first_name  := null;
    last_name   := null;
    breach_days := 0;
    in_scope    := v_scope;
    window_days := p_days;
    return next;
  end if;
  return;
end;
$$;

comment on function public.preview_threshold_rule(text, public.threshold_comparison, numeric, public.baseline_type, int, int, int, uuid, int) is
  'PATTERN-S8 C6: which athletes a rule (not necessarily saved) would have flagged over the trailing '
  'N local days, by 0052''s own per-day evaluator, cooldown ignored, writing nothing. One row per '
  'flagged athlete with the number of days, carrying the in-scope count; a single null-athlete row '
  'when nobody. Sport scientist and coach of the caller''s own org; empty for anyone else. Migration 0113.';

revoke execute on function public.preview_threshold_rule(text, public.threshold_comparison, numeric, public.baseline_type, int, int, int, uuid, int) from public;
revoke execute on function public.preview_threshold_rule(text, public.threshold_comparison, numeric, public.baseline_type, int, int, int, uuid, int) from anon;
grant execute on function public.preview_threshold_rule(text, public.threshold_comparison, numeric, public.baseline_type, int, int, int, uuid, int) to authenticated;


-- ===========================================================================
-- Backfill: the default into every organisation that has thresholds but has
-- never had this one. Organisations with no threshold row at all are left to
-- seed_default_thresholds(), which now hands them all six.
-- ===========================================================================

insert into public.thresholds (
  org_id, name, description, domain, metric, comparison, value,
  baseline_type, baseline_days, consecutive_days, min_baseline_observations,
  cooldown_days, severity, notify_roles, is_active, source, created_by
)
select
  o.id, d.name, d.description, d.domain, d.metric, d.comparison, d.value,
  d.baseline_type, d.baseline_days, d.consecutive_days, d.min_baseline_observations,
  d.cooldown_days, d.severity, d.notify_roles, d.is_active,
  'default'::public.threshold_source, null
from public.organisations o
cross join public.default_threshold_set() d
where d.metric = 'body.mass_kg'
  and o.deleted_at is null
  and exists (select 1 from public.thresholds t where t.org_id = o.id)
  and not exists (select 1 from public.thresholds t where t.org_id = o.id and t.metric = 'body.mass_kg');
