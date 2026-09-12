-- 0106_gym_tonnage_derived.sql
--
-- §0at — decided by Isabella 2026-09-12: "derive gym tonnage from the live
-- sets rather than storing total_volume_kg. One source of truth, nothing to
-- backfill."
--
-- WHAT WAS MEASURED. gym_session_logs.total_volume_kg was written by exactly
-- one path, 0045's revise_gym_set_log (which recomputes it after a
-- correction), and by nothing on ordinary set logging — 0045's own comment
-- said so. On scratch, 41 of 45 complete sessions with live sets carried a
-- null; the 4 with a value were exactly the corrected ones. My data's gym
-- history reads the column and, since absent values became words, said
-- "Not logged" for almost every real session.
--
-- THE FIX. gym_session_logs_current — the view every reader is told to use
-- ("Read this, never the base table", 0045) — now reports total_volume_kg as
-- the sum of the LIVE sets' volume_kg (gym_set_logs, superseded_by is null)
-- over the sets that carry BOTH reps and a load — volume_kg is generated as
-- coalesce(reps,0) × coalesce(load,0), so an unloaded set is a 0 there, and
-- summing it would turn "no load logged" into "0 kg", which is a reading. So
-- the sum is filtered, and a session with no loaded set reads null: an
-- absent number is absent, never 0. Same column name and type, so no reader
-- changes; the same rows 0045's RPC already summed, so a corrected session
-- reads the same number it did.
--
-- The stored column stays on the base table (a column drop is a different
-- kind of change, and 0097's audit snapshot and 0045's grants name it) but is
-- DEAD as a source: nothing reads it through the view, and 0045's recompute
-- now writes a value nobody reads. Documented on the column.
--
-- COST. A correlated sum per row over gym_set_logs (gym_session_log_id) —
-- indexed since 0021. Measured on scratch after applying (see the commit):
-- the whole org's 60-odd live sessions through the view in single-digit ms.
--
-- security_invoker as before: RLS on gym_set_logs applies to the sum, and
-- an athlete sums only their own sets.

drop view if exists public.gym_session_logs_current;
create view public.gym_session_logs_current with (security_invoker = true) as
  select
    l.id,
    l.org_id,
    l.athlete_id,
    l.programme_session_id,
    l.session_id,
    l.entry_date,
    l.started_at,
    l.completed_at,
    l.session_rpe,
    (
      select sum(s.volume_kg)::numeric(10,1)
      from public.gym_set_logs s
      where s.gym_session_log_id = l.id
        and s.superseded_by is null
        and s.reps_completed is not null
        and s.load_kg is not null
    ) as total_volume_kg,
    l.status,
    l.comment,
    l.source,
    l.created_at,
    l.revision_of,
    l.superseded_by
  from public.gym_session_logs l
  where l.superseded_by is null;

comment on view public.gym_session_logs_current is
  'Live session logs only. ADR-005 rule 3. Read this, never the base table. '
  'total_volume_kg is DERIVED here from the live sets (0106, §0at) — the base '
  'column is not a source.';

comment on column public.gym_session_logs.total_volume_kg is
  'DEAD as a source since 0106 (§0at): gym_session_logs_current derives the '
  'session tonnage from the live sets. Written only by 0045''s correction RPC, '
  'read by nothing.';

revoke all on public.gym_session_logs_current from public, anon, authenticated;
grant select on public.gym_session_logs_current to authenticated;
