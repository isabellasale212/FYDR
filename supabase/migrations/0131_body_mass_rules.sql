-- 0131_body_mass_rules.sql
--
-- What this does
--   The body mass rulings — docs/decisions/body-mass-rule.md (Isabella,
--   15 September 2026): the choices 0128 made without a rule, settled. 0128 was
--   applied to scratch only, so this is a follow-up migration rather than an
--   edit to it. Section numbers below are the decision's own.
--
--   §1  Only the club's weigh-in counts. _threshold_metric_raw for body.mass_kg
--       reads body_composition alone; the athlete's check-in figure
--       (wellness_entries.body_mass_kg) is not a source. Two sets of scales
--       rarely agree, and a week of each reads as a change that did not happen.
--   §2  One weigh-in per athlete per day, at the table: a partial unique index
--       on (athlete_id, measured_on) over live rows. Three weigh-ins in one
--       afternoon are measurement noise, not three observations.
--   §3  Correcting a weigh-in: EDITED on the day it was taken and not after (a
--       trigger — the refusal is loud); DELETED by a sport scientist at any
--       time, and by the other three logging roles on the day it was logged
--       (0084's window, kept), through delete_weigh_in(), which soft-deletes
--       and writes the audit row. Soft, because CLAUDE.md §2 rule 4: athlete
--       data is never hard-deleted — 0084's same-day hard delete was the one
--       exception and it ends here; its DELETE grant and policy go.
--   §4  The rule speaks after four weigh-ins spanning at least 21 days. A new
--       column, thresholds.min_baseline_span_days; _threshold_baseline reports
--       the span of the days it averaged and _threshold_breach_on_day gates on
--       it as it gates on the count. The floor (4 observations, 21 days) is
--       applied to every body.mass_kg rule by a trigger — the editor does not
--       carry either number for this metric, and a club may raise them, never
--       lower them. Backfilled onto the rules already on record.
--   §5  No code: the coach sees no body mass, the 12 September rule stands.
--   §6  No change: the four logging roles (0073) are the ruling's four.
--   §7  The athlete sees the day's weigh-in in their app: body_composition_self_
--       select already exists (0024); it now excludes deleted rows, and the Me
--       page reads it (application side).
--   §8  flag_actions is gated by the flag it hangs from: its policies join
--       flags, so a note under a flag the caller cannot read is a note the
--       caller cannot read or write. Free text has no value column, so "down to
--       82kg since the Ashcombe game" was a body weight handed to the coach
--       through the one door 0128 left open.
--
--   Existing rows with two live weigh-ins on one day (a typo re-entered under
--   0128's "latest wins") are resolved before the unique index: every row but
--   the latest logged is soft-deleted, with no deleted_by (no person did it),
--   and the audit trigger records the update.
--
-- Tests: supabase/tests/850_body_mass_rules_test.sql (written first);
-- 830_body_mass_threshold_test.sql updated for §1 (the check-in cases flip).


-- ===========================================================================
-- §2, §3: the columns, the duplicates, the index, live-rows-only reads
-- ===========================================================================

alter table public.body_composition
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.users(id);

comment on column public.body_composition.deleted_at is
  'Soft delete (0131): set by delete_weigh_in(), never by a plain update. A deleted weigh-in '
  'is out of every read and every baseline; the row stays for the audit and the record.';
comment on column public.body_composition.deleted_by is
  'Who deleted it — a sport scientist at any time, another logging role on the day it was '
  'logged. Null when a migration resolved a same-day duplicate.';

-- Same-day duplicates: keep the latest logged, retire the rest.
update public.body_composition bc
   set deleted_at = now(), deleted_by = null
 where bc.deleted_at is null
   and exists (
     select 1 from public.body_composition b2
      where b2.athlete_id = bc.athlete_id
        and b2.measured_on = bc.measured_on
        and b2.deleted_at is null
        and b2.id <> bc.id
        and (b2.created_at > bc.created_at or (b2.created_at = bc.created_at and b2.id > bc.id))
   );

create unique index body_composition_one_per_day
  on public.body_composition (athlete_id, measured_on)
  where deleted_at is null;

comment on index public.body_composition_one_per_day is
  'One weigh-in per athlete per day (body-mass-rule.md §2). A deleted one does not block re-logging.';

drop policy if exists body_composition_staff_select on public.body_composition;
create policy body_composition_staff_select on public.body_composition
  as permissive
  for select
  to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning','nutritionist']::app_role[])
    and deleted_at is null
  );

drop policy if exists body_composition_self_select on public.body_composition;
create policy body_composition_self_select on public.body_composition
  as permissive
  for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id() and deleted_at is null);

-- The update policy (0073) stays as it is for the four roles; the trigger
-- below is what narrows WHEN. It gains `deleted_at is null` so a deleted row
-- cannot be edited back to life by anyone.
drop policy if exists body_composition_staff_update on public.body_composition;
create policy body_composition_staff_update on public.body_composition
  as permissive
  for update
  to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(array['sport_scientist','medic','strength_conditioning','nutritionist']::app_role[])
    and deleted_at is null
  )
  with check (org_id = auth_org_id());

-- ===========================================================================
-- §3: the edit window, loud
-- ===========================================================================

create or replace function public.body_composition_edit_window()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tz text;
begin
  -- A soft delete is not an edit. delete_weigh_in() announces itself through a
  -- transaction-local setting naming the row; any other change to deleted_at
  -- is refused, whoever makes it.
  if new.deleted_at is distinct from old.deleted_at or new.deleted_by is distinct from old.deleted_by then
    if current_setting('fydr.weigh_in_delete', true) is distinct from old.id::text then
      raise exception 'weigh_in_delete_via_function' using errcode = 'P0001',
        hint = 'Use delete_weigh_in(id).';
    end if;
    return new;
  end if;

  -- An edit: the day it was taken, in the organisation's own zone, and not
  -- after. The refusal is an exception, not a silent no-op — a screen that
  -- lets somebody press Save has to be told.
  select timezone into v_tz from public.organisations where id = old.org_id;
  if old.measured_on <> (now() at time zone coalesce(v_tz, 'UTC'))::date then
    raise exception 'weigh_in_edit_window_closed' using errcode = 'P0001',
      hint = 'A weigh-in can be edited on the day it was taken. A sport scientist can delete it.';
  end if;
  return new;
end;
$$;

drop trigger if exists body_composition_edit_window on public.body_composition;
create trigger body_composition_edit_window
  before update on public.body_composition
  for each row execute function public.body_composition_edit_window();

-- ===========================================================================
-- §3: the delete — soft, permitted by role and age, audited by name
-- ===========================================================================

create or replace function public.delete_weigh_in(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   public.body_composition%rowtype;
  v_tz    text;
  v_ss    boolean;
  v_today date;
begin
  select * into v_row
    from public.body_composition
   where id = p_id and org_id = public.auth_org_id() and deleted_at is null;
  if not found then
    raise exception 'weigh_in_not_found' using errcode = 'P0001';
  end if;

  v_tz    := public.auth_org_timezone();
  v_today := (now() at time zone v_tz)::date;
  v_ss    := public.auth_has_any_role(array['sport_scientist']::app_role[]);

  -- The sport scientist, any time. The medic, S&C and nutritionist: only a
  -- weigh-in logged today (created_at, not measured_on — 0084's reasoning: the
  -- window is about when it was typed, so a backdated entry is deletable on
  -- the day it was entered and permanent after, like any other). Nobody else.
  if not (
    v_ss
    or (
      public.auth_has_any_role(array['medic','strength_conditioning','nutritionist']::app_role[])
      and (v_row.created_at at time zone v_tz)::date = v_today
    )
  ) then
    raise exception 'weigh_in_delete_not_permitted' using errcode = 'P0001';
  end if;

  perform set_config('fydr.weigh_in_delete', p_id::text, true);
  update public.body_composition
     set deleted_at = now(), deleted_by = public.auth_user_id()
   where id = p_id;
  perform set_config('fydr.weigh_in_delete', '', true);

  -- Audited like every other correction, by name: what day it described, when
  -- it was logged, and whether it was the sport scientist's any-time delete.
  -- The value is not written (0085's disclosure rule for audit_log).
  perform public.write_audit_event(
    'body_composition.delete', 'body_composition', p_id, v_row.athlete_id,
    jsonb_build_object('measured_on', v_row.measured_on, 'logged_at', v_row.created_at, 'any_time', v_ss)
  );
end;
$$;

comment on function public.delete_weigh_in(uuid) is
  'Soft-deletes one weigh-in (body-mass-rule.md §3): the sport scientist at any time; the medic, '
  'S&C and nutritionist on the day it was logged. Audited as body_composition.delete. 0131.';

revoke execute on function public.delete_weigh_in(uuid) from public;
revoke execute on function public.delete_weigh_in(uuid) from anon;
grant execute on function public.delete_weigh_in(uuid) to authenticated;

-- 0084's hard delete ends: the grant and its policy.
drop policy if exists body_composition_same_day_delete on public.body_composition;
revoke delete on public.body_composition from authenticated;

-- ===========================================================================
-- §1: the source
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
    when 'body.mass_kg' then (
      -- The day's club weigh-in, and nothing else (body-mass-rule.md §1): the
      -- check-in figure 0128 fell back to is not a source. One live row per
      -- day since 0131, so no ordering is needed; a deleted row is no figure.
      select bc.body_mass_kg
      from public.body_composition bc
      where bc.athlete_id = p_athlete_id
        and bc.measured_on = p_date
        and bc.deleted_at is null
        and bc.body_mass_kg is not null
      limit 1
    )
    else null
  end;
$$;

revoke execute on function public._threshold_metric_raw(uuid, text, date) from public;
revoke execute on function public._threshold_metric_raw(uuid, text, date) from anon;
revoke execute on function public._threshold_metric_raw(uuid, text, date) from authenticated;

-- ===========================================================================
-- §4: the floor — four weigh-ins spanning at least 21 days
-- ===========================================================================

alter table public.thresholds
  add column min_baseline_span_days int not null default 0
  constraint thresholds_min_baseline_span_days_nonneg check (min_baseline_span_days >= 0);

comment on column public.thresholds.min_baseline_span_days is
  'The baseline''s observations must span at least this many days (first to last) before the '
  'rule may fire — beside min_baseline_observations, which counts them. 0 for every rule but '
  'body mass, where the floor is 21 (body-mass-rule.md §4): four figures from one training '
  'week are one phase of one week, not a normal range.';

-- The baseline now reports the span of the days it averaged. The extra column
-- is invisible to the two callers that select mean, sd and n by name. A
-- return type cannot be changed in place, so the function is dropped and
-- re-created; nothing depends on it at the catalogue level (its callers are
-- SQL and plpgsql bodies, which Postgres does not track).
drop function if exists public._threshold_baseline(uuid, text, date, int);
create function public._threshold_baseline(
  p_athlete_id    uuid,
  p_metric        text,
  p_date          date,
  p_baseline_days int
)
returns table(mean numeric, sd numeric, n int, span_days int)
language sql
stable
set search_path = public
as $$
  select avg(v), stddev_samp(v), count(v)::int,
         coalesce((max(d) filter (where v is not null) - min(d) filter (where v is not null)), 0)::int
  from (
    select gs::date as d, public._threshold_metric_raw(p_athlete_id, p_metric, gs::date) as v
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

-- 0053's evaluator, with the span gate beside the count gate. Everything else
-- is 0053's, unchanged.
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
  v_span  int;
  v_z     numeric;
begin
  v_value := public._threshold_metric_raw(p_athlete_id, p_threshold.metric, p_date);

  -- No observation that day at all: a GAP, not a breach and not a genuine
  -- non-breach either (0053).
  if v_value is null then
    return null;
  end if;

  if p_threshold.baseline_type <> 'absolute' then
    if p_threshold.baseline_type = 'personal_rolling' then
      select b.mean, b.sd, b.n, b.span_days into v_mean, v_sd, v_n, v_span
      from public._threshold_baseline(
        p_athlete_id, p_threshold.metric, p_date,
        coalesce(p_threshold.baseline_days, 28)
      ) b;
    else
      -- squad_mean: not implemented (0052). n = 0 blocks it below.
      v_mean := null;
      v_sd   := null;
      v_n    := 0;
      v_span := 0;
    end if;

    -- The count gate (0052), and the span gate (0131, body-mass-rule.md §4):
    -- a real value exists this day, so a gate failure is FALSE, never NULL.
    if coalesce(v_n, 0) < p_threshold.min_baseline_observations then
      return false;
    end if;
    if coalesce(v_span, 0) < coalesce(p_threshold.min_baseline_span_days, 0) then
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

-- The floor, applied to every body-mass rule at the table: a club may set the
-- count or the span higher, never lower, and the editor (which carries neither
-- for this metric) never has to know.
create or replace function public.thresholds_body_mass_floor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.metric = 'body.mass_kg' then
    new.min_baseline_observations := greatest(coalesce(new.min_baseline_observations, 0), 4);
    new.min_baseline_span_days    := greatest(coalesce(new.min_baseline_span_days, 0), 21);
  end if;
  return new;
end;
$$;

drop trigger if exists thresholds_body_mass_floor on public.thresholds;
create trigger thresholds_body_mass_floor
  before insert or update on public.thresholds
  for each row execute function public.thresholds_body_mass_floor();

-- Backfill: every body-mass rule already on record, live or retired.
update public.thresholds
   set min_baseline_span_days = greatest(min_baseline_span_days, 21),
       min_baseline_observations = greatest(min_baseline_observations, 4)
 where metric = 'body.mass_kg';

-- The preview builds its rule in memory (0113/0128) and must carry the floor
-- too, or a body-mass preview would answer without it. Same body as 0128's,
-- one line added.
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
  -- 0128: the coach does not see body mass at all (access-matrix §3.2).
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
  -- 0131: the body-mass floor the table applies to a saved rule (body-mass-rule.md §4).
  if p_metric = 'body.mass_kg' then
    t.min_baseline_observations := greatest(t.min_baseline_observations, 4);
    t.min_baseline_span_days    := 21;
  else
    t.min_baseline_span_days    := 0;
  end if;

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
  'when nobody. Sport scientist and coach of the caller''s own org; empty for anyone else. Migration '
  '0113; 0128 withholds body mass from the coach; 0131 applies the body-mass floor.';

revoke execute on function public.preview_threshold_rule(text, public.threshold_comparison, numeric, public.baseline_type, int, int, int, uuid, int) from public;
revoke execute on function public.preview_threshold_rule(text, public.threshold_comparison, numeric, public.baseline_type, int, int, int, uuid, int) from anon;
grant execute on function public.preview_threshold_rule(text, public.threshold_comparison, numeric, public.baseline_type, int, int, int, uuid, int) to authenticated;

-- ===========================================================================
-- §8: flag_actions is gated by the flag it hangs from
-- ===========================================================================

-- The join runs under the caller's own read of flags, so whatever flags'
-- policies withhold (0128: body mass from anyone outside BODY_MASS_VIEW), the
-- notes under it are withheld the same way — and a future rule that narrows
-- flags narrows these with it, with no second list to keep.
drop policy if exists flag_actions_staff_select on public.flag_actions;
create policy flag_actions_staff_select on public.flag_actions
  as permissive
  for select
  to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning','nutritionist']::app_role[])
    and exists (select 1 from public.flags f where f.id = flag_actions.flag_id)
  );

-- 0075's shape, kept — the nutritionist writes under a nutrition flag only —
-- with the join applied to everyone: whatever role you hold, the flag has to
-- be one you can read.
drop policy if exists flag_actions_staff_insert on public.flag_actions;
create policy flag_actions_staff_insert on public.flag_actions
  as permissive
  for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and taken_by = auth_user_id()
    and exists (select 1 from public.flags f where f.id = flag_actions.flag_id and f.org_id = auth_org_id())
    and (
      auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning']::app_role[])
      or (
        auth_has_any_role(array['nutritionist']::app_role[])
        and exists (
          select 1 from public.flags f
           where f.id = flag_actions.flag_id
             and f.org_id = auth_org_id()
             and f.domain = 'nutrition'::flag_domain
        )
      )
    )
  );
