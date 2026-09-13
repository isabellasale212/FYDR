-- 0113_preview_threshold_rule.sql
--
-- PATTERN-S8 C6 (2026-09-13): "a 28-day preview of how many athletes a rule
-- would have flagged, writing nothing."
--
-- What this does
--   preview_threshold_rule(...) runs 0052/0053's own per-day evaluator,
--   _threshold_breach_on_day, over the trailing N local calendar days for a
--   rule that need not exist as a row yet — the caller hands in the rule's
--   fields, a thresholds%rowtype is assembled in memory, and the same
--   gap-tolerant consecutive-day walk evaluate_daily_thresholds_for_org
--   performs (0053: a day with no observation is skipped, a real
--   non-breach ends the run, at least one observation must exist) is
--   performed here for every athlete the rule would apply to. It returns one
--   row per athlete who would have been flagged on at least one day, with
--   the count of days, plus the scope the caller needs for a denominator.
--   It writes nothing: STABLE, no insert, cooldown deliberately ignored (a
--   preview answers "would this line catch them", not "how many rows would
--   the engine write"; the screen says so).
--
--   preview_threshold(p_threshold_id, p_days) is the same for a rule that
--   exists, read from its row.
--
-- Why the same helper and not a copy
--   The point of a preview is that it agrees with the engine. Both read
--   _threshold_breach_on_day, so a rule that previews 4 athletes is a rule
--   that the nightly sweep would flag 4 athletes for (cooldown aside).
--
-- Who may call it
--   SECURITY DEFINER, because the helpers it needs revoke execute from
--   authenticated (0052). Scoped to auth_org_id() and gated to the roles
--   that configure thresholds (sport_scientist, coach — access-matrix §3.6,
--   THRESHOLD_EDIT in lib/access.ts); anyone else gets an empty result, not
--   an error, because a preview is a read the screen does not offer them.
--   Athletes are the org's live ones, status <> 'left_club', the group
--   scope honoured exactly as 0052 honours it.

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


-- The same for a rule that exists, read from its own row (the list's
-- "Preview 28 days" on each rule).
create or replace function public.preview_threshold(
  p_threshold_id uuid,
  p_days         int default 28
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
  t public.thresholds%rowtype;
begin
  select * into t
  from public.thresholds th
  where th.id = p_threshold_id
    and th.org_id = public.auth_org_id()
    and th.deleted_at is null;
  if not found then
    return;
  end if;
  return query
    select * from public.preview_threshold_rule(
      t.metric, t.comparison, t.value, t.baseline_type, t.baseline_days,
      t.consecutive_days, t.min_baseline_observations, t.applies_to_group_id, p_days
    );
end;
$$;

comment on function public.preview_threshold(uuid, int) is
  'PATTERN-S8 C6: preview_threshold_rule for a saved rule, by id, within the caller''s org. Migration 0113.';

revoke execute on function public.preview_threshold(uuid, int) from public;
revoke execute on function public.preview_threshold(uuid, int) from anon;
grant execute on function public.preview_threshold(uuid, int) to authenticated;
