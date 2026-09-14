-- PATTERN-S3 C1 and C8 (Isabella, 13 September 2026; the Step 1 report in
-- docs/overnight-records-2026-09-13.md).
--
-- C1 — THE READ FLAG. Nothing recorded that an athlete had seen their current
-- status; Today's banner renders the open availability row on every visit
-- with no memory. availability.athlete_seen_at is set on the athlete's own
-- open row by mark_availability_seen() when the status screen is opened; the
-- Today card is emphasised while the row is unseen and goes the first time
-- the screen is opened. A change of status is a new row (the ledger,
-- close-then-insert), so the flag is naturally per change. Not audited: seeing
-- is not an act on the record (the last_seen_at rule, 0093).
--
-- C8 — BODY SITE AND SIDE ARE NOT COACH-VISIBLE, a club setting defaulting
-- to off (decided 2026-09-13). Two halves, both here:
--   1. organisations.coach_sees_injury_site boolean not null default false.
--   2. The database. A coach read injuries.body_area and injuries.side at the
--      table (injuries_staff_select admits every staff role but the
--      nutritionist), so any render rule was a hidden button. The two columns
--      are revoked from `authenticated` at the table and given back only
--      through injuries_staff, a view owned by the schema that scopes rows
--      exactly as the two select policies do (the club's staff, or the
--      athlete's own) and masks the two columns to null for a coach unless
--      the club's setting is on. A coach's direct API read of the table's
--      body_area now fails (42501); of the view returns null. The medic, the
--      sport scientist and the S&C read them as before; the athlete reads
--      their own. Writers are untouched: insert and update grants on the
--      table stay, and RETURNING never named the two columns.
--   Every read that wants the site goes through the view
--   (lib/queries/availability.ts, injuries.ts, reports.ts); reads that
--   never select the two columns keep the table.

-- ---------------------------------------------------------------------------
-- C1
-- ---------------------------------------------------------------------------
alter table public.availability add column athlete_seen_at timestamptz;
-- Rows already in force were told the old way — the availability card has sat
-- on Today the whole time — so they are marked read at their own start rather
-- than announced as "Your status changed" weeks late. Only rows set from here
-- on carry the told card.
update public.availability set athlete_seen_at = effective_from where effective_to is null and athlete_seen_at is null;
comment on column public.availability.athlete_seen_at is
  'When the athlete first opened their status screen while this row was in force. Null: told on Today, not yet read. PATTERN-S3 C1, 0122.';

create or replace function public.mark_availability_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete uuid := public.auth_athlete_id();
  v_org uuid := public.auth_org_id();
begin
  if v_athlete is null or v_org is null then
    raise exception 'no athlete for this session' using errcode = '42501';
  end if;
  update public.availability
     set athlete_seen_at = now()
   where org_id = v_org and athlete_id = v_athlete and effective_to is null and athlete_seen_at is null;
end;
$$;
revoke all on function public.mark_availability_seen() from public;
grant execute on function public.mark_availability_seen() to authenticated;

-- ---------------------------------------------------------------------------
-- C8
-- ---------------------------------------------------------------------------
alter table public.organisations add column coach_sees_injury_site boolean not null default false;
comment on column public.organisations.coach_sees_injury_site is
  'Off (the default): a coach reads the status word, the restriction line and the expected return, never the body site or the side. On: the coach reads the site and side of an open injury too. Enforced by the injuries_staff view; the sport scientist''s switch on Settings › Club. PATTERN-S3 C8, 0122.';

-- Who may read the site: the medic, the sport scientist and the S&C always;
-- a coach only when the club has switched it on. The nutritionist never (0074
-- censored their availability view). Stable, definer, reads the setting from
-- the table so a flip applies at once.
create or replace function public.injury_site_visible()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_has_any_role(array['medic','sport_scientist','strength_conditioning']::public.app_role[])
      or (public.auth_has_any_role(array['coach']::public.app_role[])
          and coalesce((select o.coach_sees_injury_site from public.organisations o where o.id = public.auth_org_id()), false));
$$;
revoke all on function public.injury_site_visible() from public;
grant execute on function public.injury_site_visible() to authenticated, service_role;

-- The two columns leave the table for every signed-in reader. A column-level
-- revoke removes nothing while a table-level SELECT stands, so the table
-- grant goes and every other column is granted back by name; `select *` on
-- injuries now fails for a signed-in reader and every reader names its
-- columns (they all did).
revoke select on public.injuries from authenticated;
grant select (id, org_id, athlete_id, onset_date, status, expected_return, actual_return, session_id, occurred_in, reported_by, created_at, updated_at, deleted_at)
  on public.injuries to authenticated;

-- …and come back through the view. Owned by the schema, so it reads the
-- table with the owner's privileges; the WHERE is the two select policies'
-- own predicate, restated, so the view never widens who sees a row.
create or replace view public.injuries_staff with (security_invoker = false) as
  select i.id, i.org_id, i.athlete_id,
         case when public.injury_site_visible() or i.athlete_id = public.auth_athlete_id() then i.body_area else null end as body_area,
         case when public.injury_site_visible() or i.athlete_id = public.auth_athlete_id() then i.side else null end as side,
         i.onset_date, i.status, i.expected_return, i.actual_return, i.session_id, i.occurred_in, i.reported_by,
         i.created_at, i.updated_at, i.deleted_at
    from public.injuries i
   where i.org_id = public.auth_org_id()
     and (
       i.athlete_id = public.auth_athlete_id()
       or public.auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning','nutritionist']::public.app_role[])
     );

comment on view public.injuries_staff is
  'injuries with body_area and side masked to null for a coach unless organisations.coach_sees_injury_site is on; the athlete reads their own. The only way a signed-in reader reaches the two columns (revoked at the table). Rows: the club''s staff or the athlete''s own, as injuries_staff_select and injuries_self_select. PATTERN-S3 C8, 0122.';
revoke all on public.injuries_staff from public, anon;
grant select on public.injuries_staff to authenticated, service_role;
