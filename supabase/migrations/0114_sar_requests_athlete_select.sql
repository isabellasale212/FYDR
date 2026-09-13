-- 0114_sar_requests_athlete_select.sql
--
-- PATTERN-S8 C10 (2026-09-13): subject access on one pattern across the
-- staff side and the athlete side. The athlete side (/me/privacy) tells an
-- athlete what the club holds about them, who sees what, and how to get a
-- copy — and, when a request for their data exists, where it stands: opened
-- when and by whom, due when, waiting on whom, released when. That last
-- part needs the athlete to read their OWN sar_requests rows; until now
-- only the sport scientist and the medic could read the table (0032, its
-- roles since renamed by 0065), so the athlete side could say nothing true
-- about a request that concerned them.
--
-- The policy: an athlete reads a request whose athlete_id is their own
-- (auth_athlete_id(), the same test wellness_athlete_select and every
-- other athlete self-read makes), inside their own org. Read only: an
-- athlete opens no request here (they ask the club, out of band — the
-- self-export was removed 2026-09-13) and changes none. The clinical
-- review rows (sar_clinical_reviews) stay closed to the athlete: what a
-- medic decided to withhold, and why, is exactly what the pack's covering
-- note carries once released, not a live table to watch.

create policy sar_requests_athlete_select on public.sar_requests for select
  to authenticated
  using (org_id = public.auth_org_id() and athlete_id = public.auth_athlete_id());

comment on policy sar_requests_athlete_select on public.sar_requests is
  'PATTERN-S8 C10: an athlete reads the subject access requests that concern them, in their own org. Migration 0114.';
