-- 0118_org_collects_rpe.sql
--
-- The RPE package, change one (Isabella, 2026-09-13, decision batch "RPE
-- stays"): RPE becomes a club setting. When it is off, every dependent
-- surface says so rather than showing an empty column or a zero
-- (docs/decisions/absence-rule.md: setting-driven absence keeps the
-- destination and carries an off state naming the setting and who can
-- change it).
--
-- What this does
--   organisations.collects_rpe boolean not null default true — the switch,
--   the sport scientist's (the existing organisations update policy is the
--   gate; no new policy). ON is the default because every club so far
--   collects it and the base tier's only load measure rests on it.
--
--   generate_compliance_expectations (0044's body, verbatim but for two
--   lines): a club with collects_rpe = false writes NO training_rpe
--   expectation — the compliance denominator is honest at the source, and the
--   compliance report states which entry types it counted (the addendum's
--   rule). Wellness and gym expectations are untouched. Expectations already
--   written before a club switches off stay as history; the report's window
--   simply reads fewer expected rows from the day the switch is thrown.
--
-- What this does not do
--   It does not refuse a training_entries write: the athlete app stops
--   offering the rating (Today lists no RPE task, /rpe/<session> shows the
--   off state), and a club that switches back on loses nothing. Entries
--   written while on are history either way.

alter table public.organisations add column collects_rpe boolean not null default true;

comment on column public.organisations.collects_rpe is
  'The RPE club setting (migration 0118, 2026-09-13). false: athletes are not asked to rate sessions, no training_rpe compliance expectation is written, and the training load report, the compliance figure, the dashboard''s RPE track, the effort leaderboards and the analytics load presets show their off state naming this setting. The sport scientist''s to change, at Settings > Club.';

create or replace function public.generate_compliance_expectations(
  p_org_id uuid,
  p_date   date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_tz   text;
  v_collects_rpe boolean;
  v_inserted integer := 0;
  v_n        integer;
begin
  select timezone, collects_rpe into v_org_tz, v_collects_rpe
  from public.organisations
  where id = p_org_id and deleted_at is null;

  if v_org_tz is null then
    raise exception 'org_not_found: %', p_org_id using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------------
  -- Wellness: one row per active athlete, unconditional on the schedule. See this
  -- migration's own header for why this diverges from 03-flows.md's rest-day language.
  -- ---------------------------------------------------------------------------
  insert into public.compliance_expectations
    (org_id, athlete_id, expectation_date, domain, session_id, is_required)
  select p_org_id, a.id, p_date, 'wellness'::public.compliance_domain, null, true
  from public.athletes a
  where a.org_id = p_org_id
    and a.deleted_at is null
    and a.status <> 'left_club'
    and not exists (
      select 1 from public.compliance_expectations ce
      where ce.athlete_id = a.id
        and ce.expectation_date = p_date
        and ce.domain = 'wellness'
        and ce.session_id is null
    );
  get diagnostics v_n = row_count;
  v_inserted := v_inserted + v_n;

  -- ---------------------------------------------------------------------------
  -- training_rpe and gym: strictly schedule-driven. day_sessions is this organisation's
  -- non-cancelled, non-deleted sessions falling on p_date in the ORGANISATION'S OWN LOCAL
  -- CALENDAR DAY (starts_at at time zone v_org_tz, not a bare UTC ::date cast — the same
  -- timezone correctness the fix plan's Batch 2 items ask for on the read side, applied
  -- here on the write side from the start). resolved is the participant set per session,
  -- copied from session-detail.md's own CTE. candidates is the union of both domains'
  -- expectation rows before the single anti-joined insert below.
  -- ---------------------------------------------------------------------------
  with day_sessions as (
    select s.id, s.session_type, s.requires_rpe, s.starts_at
    from public.sessions s
    where s.org_id = p_org_id
      and s.deleted_at is null
      and s.status <> 'cancelled'
      and (s.starts_at at time zone v_org_tz)::date = p_date
  ),
  resolved as (
    -- Zero participant rows means the whole squad.
    select ds.id as session_id, ds.session_type, ds.requires_rpe, a.id as athlete_id
    from day_sessions ds
    join public.athletes a
      on a.org_id = p_org_id and a.deleted_at is null and a.status <> 'left_club'
    where not exists (
      select 1 from public.session_participants sp where sp.session_id = ds.id
    )
    union
    select ds.id, ds.session_type, ds.requires_rpe,
           coalesce(sp.athlete_id, gm.athlete_id) as athlete_id
    from day_sessions ds
    join public.session_participants sp on sp.session_id = ds.id
    left join public.group_memberships gm
      on gm.group_id = sp.group_id
     and gm.added_at <= ds.starts_at
     and (gm.removed_at is null or gm.removed_at > ds.starts_at)
    where coalesce(sp.athlete_id, gm.athlete_id) is not null
  ),
  candidates as (
    -- 0118: a club that does not collect session RPE expects no rating of
    -- anybody, so no training_rpe expectation is written — the compliance
    -- denominator is honest by construction, not by a filter downstream.
    select athlete_id, 'training_rpe'::public.compliance_domain as domain, session_id
    from resolved
    where requires_rpe and coalesce(v_collects_rpe, true)
    union
    select athlete_id, 'gym'::public.compliance_domain, session_id
    from resolved
    where session_type = 'gym'
  )
  insert into public.compliance_expectations
    (org_id, athlete_id, expectation_date, domain, session_id, is_required)
  select p_org_id, c.athlete_id, p_date, c.domain, c.session_id, true
  from candidates c
  where not exists (
    select 1 from public.compliance_expectations ce
    where ce.athlete_id = c.athlete_id
      and ce.expectation_date = p_date
      and ce.domain = c.domain
      and ce.session_id is not distinct from c.session_id
  );
  get diagnostics v_n = row_count;
  v_inserted := v_inserted + v_n;

  return v_inserted;
end;
$$;

-- CREATE OR REPLACE keeps the function's existing ACL, but the revokes are
-- repeated so a reader of this file sees the same discipline 0044 states.
revoke execute on function public.generate_compliance_expectations(uuid, date) from public;
revoke execute on function public.generate_compliance_expectations(uuid, date) from anon;
revoke execute on function public.generate_compliance_expectations(uuid, date) from authenticated;
