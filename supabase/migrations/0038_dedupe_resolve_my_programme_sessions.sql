-- 0038_dedupe_resolve_my_programme_sessions.sql
--
-- What this fixes
--   resolve_my_programme_sessions (migration 0021) joins through
--   programme_assignments and matches a row per assignment path
--   (pa.athlete_id = the athlete, OR the athlete is in pa.group_id) —
--   correct when an athlete reaches a programme through exactly one path,
--   wrong the moment they reach it through both at once. That became a
--   real, live case this session: James Barnes has a real individual
--   assignment to "Pre-season strength" (predates this session) and a
--   real Forwards group assignment to the same programme (added this
--   session, deliberately alongside the individual one, not replacing
--   it — see the gym programme rebuild's own commit). The query returns
--   one row per matching assignment, so his real programme screen showed
--   "Lower A" and "Power" twice each — found live, touring the deployed
--   athlete app signed in as him, not by reasoning about the SQL first.
--
-- The fix
--   select distinct. Every column already selected is either identical
--   across an athlete's duplicate assignment rows (it's the same
--   programme/block/session either way) or is what the ordering is on,
--   so distinct + the existing order by need no other change. A
--   coach/medical caller passing an arbitrary athlete id is unaffected —
--   this was never a security boundary, just a join that could return an
--   honest duplicate.

create or replace function public.resolve_my_programme_sessions(p_athlete_id uuid)
returns table (
  programme_id         uuid,
  programme_name       text,
  programme_type       programme_type,
  block_name           text,
  block_sequence       int,
  session_id           uuid,
  session_name         text,
  week_number          int,
  day_number           int,
  md_offset            int,
  session_sequence     int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_athlete uuid;
begin
  if auth_has_any_role(array['coach','medical']::app_role[]) then
    v_athlete := p_athlete_id;
  elsif auth_has_any_role(array['athlete']::app_role[]) and auth_athlete_id() = p_athlete_id then
    v_athlete := p_athlete_id;
  else
    v_athlete := null;
  end if;

  if v_athlete is null then
    return;
  end if;

  return query
  select distinct p.id, p.name, p.programme_type, b.name, b.sequence,
         s.id, s.name, s.week_number, s.day_number, s.md_offset, s.sequence
  from programme_assignments pa
  join programmes p on p.id = pa.programme_id
  join programme_blocks b on b.programme_id = p.id
  join programme_sessions s on s.block_id = b.id
  where pa.org_id = auth_org_id()
    and pa.status = 'active'
    and (
      pa.athlete_id = v_athlete
      or (pa.group_id is not null and exists (
            select 1 from group_memberships gm
            where gm.athlete_id = v_athlete
              and gm.group_id = pa.group_id
              and gm.removed_at is null))
    )
  order by b.sequence, s.week_number, s.sequence;
end;
$$;
