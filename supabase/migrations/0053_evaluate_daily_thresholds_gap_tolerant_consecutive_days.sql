-- 0053_evaluate_daily_thresholds_gap_tolerant_consecutive_days.sql
--
-- What this fixes
--   0052's own header documented, at length, a deliberate deviation from
--   screens/thresholds.md edge case 8: that migration's consecutive_days check required
--   EVERY one of the trailing N local calendar days to independently breach, treating a
--   day with no submission the same as a day with a genuine non-breaching value (both
--   "not breached", both breaking the run). Re-reviewed after 0052 shipped: edge case 8
--   is not a hypothetical or an oversight, it is a specific, reasoned rule with its own
--   worked example —
--
--     "A gap is not a breach and it is not a reset either. The run continues across the
--     gap if the values either side both breach, and the flag states it: 'Breached on 2
--     of the last 3 days, with 1 day missing.' Treating a missing entry as a non-breach
--     would let an athlete break a run by not submitting, which rewards non-compliance."
--
--   That is a real gaming loophole in 0052's strict version: an athlete having a rough
--   patch (two genuinely bad wellness days either side of one skipped submission) could
--   dodge threshold #1 ("Readiness below personal norm", consecutive_days = 2) simply by
--   not logging on the day in between — the exact behaviour the doc's own last sentence
--   warns against rewarding. This migration implements the documented rule instead.
--
-- The actual fix
--   _threshold_breach_on_day now returns a NULLABLE boolean rather than a plain one:
--     NULL  — no observation for this metric on this day at all (a gap). Neither a
--             breach nor a genuine non-breach; the caller skips it entirely.
--     TRUE  — a real observation that breaches.
--     FALSE — a real observation that does NOT breach. This is not a gap and still
--             genuinely resets the run, exactly as it did in 0052 — only a missing
--             entry is now gap-tolerant, not a real value that simply falls short.
--   evaluate_daily_thresholds_for_org's consecutive-day loop now: skips NULL days
--   entirely (does not count them for or against); requires at least one real
--   observation somewhere in the window (an all-gap window cannot fire on zero
--   evidence — that is not in the doc and is not this migration's invention, it is the
--   obvious floor under "the run continues across the gap IF THE VALUES EITHER SIDE
--   BOTH BREACH"); and still exits immediately on the first genuine (non-gap)
--   non-breach, which is the "not a reset either... unless the values don't breach"
--   half of the same rule.
--
-- min_baseline_observations gate failures are NOT treated as gaps
--   A day whose raw value exists but whose personal_rolling baseline has too little
--   history (the min_baseline_observations gate in _threshold_breach_on_day) still
--   returns FALSE, not NULL. That is a deliberate, narrower reading than the coordinator
--   review asked for: the ask was specifically about "a day with NO entry for that
--   metric at all", i.e. a genuinely missing submission. A day where the athlete DID
--   submit but the gate blocks evaluation is not a missing entry — treating it as a
--   skippable gap would let a rule "reach past" a data-insufficient day in a way the
--   doc's own example (which is about a MISSING entry, not a gated one) does not
--   describe. Recorded here rather than silently deciding; a real product call if it
--   turns out to matter for a real threshold, which none active today exercise (every
--   real personal_rolling threshold's fire/near-miss windows in the pgTAP suite have
--   comfortably more than min_baseline_observations of real history).
--
-- staff_note: the doc's own exact copy pattern, on the existing column
--   flags.staff_note already exists (0047_flags_staff_note.sql) and is nullable free
--   text, used elsewhere as optional context — no new column. When the window this
--   migration evaluated had 1 or more gap days, the inserted flag's staff_note is set to
--   screens/thresholds.md edge case 8's own worded example, generated from the real
--   counts: 'Breached on <n> of the last <consecutive_days> days, with <gaps> day(s)
--   missing.' When there was no gap, staff_note is left null, matching how every other
--   flag this function writes already leaves it — nothing invents a note where the doc
--   gives no example sentence.
--
-- Nothing else in 0052 changes
--   The metric value sources, comparison semantics, min_baseline_observations gate
--   itself, expected_value rule, cooldown_days, idempotency key, population/scoping,
--   security discipline, squad_mean deferral and threshold_revision_id null are all
--   unchanged — only the consecutive_days window logic and the new staff_note. Per
--   CLAUDE.md §5 ("migrations are additive, never rewrite an applied migration"), this
--   is a new migration that `create or replace function`s the two functions 0052
--   defined, the same pattern 0029 already used in this repo to fix a bug in 0028.

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

  -- No observation that day at all: a GAP, not a breach and not a genuine non-breach
  -- either. NULL, not FALSE — the caller (evaluate_daily_thresholds_for_org) now skips
  -- a NULL day entirely rather than letting it reset a consecutive-day run. Migration
  -- 0053's header explains why this changed from 0052's plain FALSE.
  if v_value is null then
    return null;
  end if;

  if p_threshold.baseline_type <> 'absolute' then
    if p_threshold.baseline_type = 'personal_rolling' then
      select b.mean, b.sd, b.n into v_mean, v_sd, v_n
      from public._threshold_baseline(
        p_athlete_id, p_threshold.metric, p_date,
        coalesce(p_threshold.baseline_days, 28)
      ) b;
    else
      -- squad_mean: not implemented. See migration 0052's header. n = 0 means the
      -- gate immediately below always blocks it from firing.
      v_mean := null;
      v_sd   := null;
      v_n    := 0;
    end if;

    -- Applies whenever baseline_type <> 'absolute', including below/above rules, per
    -- describeThreshold()'s own comment quoted in migration 0052's header. A real value
    -- exists this day, so a gate failure here is FALSE (a genuine block), never NULL —
    -- this migration's header explains why that is a narrower case than a missing entry.
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

comment on function public._threshold_breach_on_day(public.thresholds, uuid, date) is
  'Tri-state per-day breach check for one threshold/athlete/day: NULL = no observation '
  'that day (a gap, skipped by the caller, never a breach or a reset); TRUE = a real '
  'breach; FALSE = a real observation that does not breach (still resets a consecutive-'
  'day run). Migration 0053, fixing 0052''s stricter all-days-must-breach reading per '
  'screens/thresholds.md edge case 8.';

revoke execute on function public._threshold_breach_on_day(public.thresholds, uuid, date) from public;
revoke execute on function public._threshold_breach_on_day(public.thresholds, uuid, date) from anon;
revoke execute on function public._threshold_breach_on_day(public.thresholds, uuid, date) from authenticated;


-- ===========================================================================
-- evaluate_daily_thresholds_for_org, with the gap-tolerant consecutive_days window and
-- the new staff_note. Everything else is byte-for-byte the same as 0052.
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
  v_any_data    boolean;
  v_all_breach  boolean;
  v_data_days   int;
  v_gap_days    int;
  v_day_state   boolean;
  v_check_day   date;
  v_i           int;
  v_in_cooldown boolean;
  v_observed    numeric;
  v_expected    numeric;
  v_staff_note  text;
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
      -- consecutive_days, gap-tolerant per screens/thresholds.md edge case 8 (migration
      -- 0053): every day in the trailing N-day window that HAS an observation must
      -- breach; a day with no observation at all is skipped, neither breach nor reset;
      -- at least one real observation must exist somewhere in the window, or there is
      -- no evidence to fire on. Re-derived fresh per day; nothing cached.
      v_any_data   := false;
      v_all_breach := true;
      v_data_days  := 0;

      for v_i in 0 .. (t.consecutive_days - 1) loop
        v_check_day := p_local_date - v_i;
        v_day_state := public._threshold_breach_on_day(t, a.id, v_check_day);

        if v_day_state is null then
          continue;  -- a gap: skip, does not affect the run either way
        end if;

        v_any_data  := true;
        v_data_days := v_data_days + 1;

        if not v_day_state then
          -- A real, non-breaching observation. Not a gap — genuinely breaks the run.
          v_all_breach := false;
          exit;
        end if;
      end loop;

      if not v_any_data or not v_all_breach then
        continue;
      end if;

      -- cooldown_days: counted from the prior flag's raised_at in the ORG'S OWN local
      -- calendar, regardless of that prior flag's current status. See 0052's header.
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

      -- staff_note: screens/thresholds.md edge case 8's own worded example, generated
      -- from the real counts. Null when the window had no gap, same as every other flag.
      v_gap_days := t.consecutive_days - v_data_days;
      if v_gap_days > 0 then
        v_staff_note := format(
          'Breached on %s of the last %s days, with %s day%s missing.',
          v_data_days, t.consecutive_days, v_gap_days,
          case when v_gap_days = 1 then '' else 's' end
        );
      else
        v_staff_note := null;
      end if;

      insert into public.flags
        (org_id, athlete_id, threshold_id, domain, metric, observed_value, expected_value,
         flag_date, severity, status, raised_at, staff_note)
      values
        (p_org_id, a.id, t.id, t.domain, t.metric, v_observed, v_expected,
         p_local_date, t.severity, 'raised', now(), v_staff_note)
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
  '(threshold_id, athlete_id, flag_date)), gap-tolerant on consecutive_days per screens/'
  'thresholds.md edge case 8 (migration 0053), callable directly for a backfill or a '
  'test, or from evaluate_daily_thresholds_nightly(). Returns the count of flags '
  'actually inserted. See 0052 and 0053''s headers for every decision.';

revoke execute on function public.evaluate_daily_thresholds_for_org(uuid, date) from public;
revoke execute on function public.evaluate_daily_thresholds_for_org(uuid, date) from anon;
revoke execute on function public.evaluate_daily_thresholds_for_org(uuid, date) from authenticated;
