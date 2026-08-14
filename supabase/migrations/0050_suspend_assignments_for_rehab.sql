-- 0050_suspend_assignments_for_rehab.sql
--
-- What this fixes
--   CLAUDE.md §6's rehab exception ("assigning a rehab programme suspends the
--   athlete's active gym assignment rather than cancelling it") has never actually
--   worked, for the one case it exists to handle. lib/queries/programmes.ts's
--   assignProgramme() suspends the athlete's other active programme_assignments
--   rows with a plain client UPDATE before inserting the new rehab row. Migration
--   0022's programme_assignments_update policy's WITH CHECK requires, for a
--   medical actor, that the row being written resolves to programme_type = 'rehab'
--   via its own programme_id — correct for medical editing a rehab assignment
--   directly, wrong here: the row being suspended is the athlete's EXISTING
--   non-rehab (gym/conditioning/nutrition) assignment, whose programme_id is
--   unchanged by the suspend. WITH CHECK evaluates false for a medical actor on
--   that row every time, so the UPDATE is rejected by RLS and assignProgramme()
--   never reaches its own INSERT — a real, verified defect: the only interaction
--   this feature exists for (rehab suspending an existing non-rehab assignment)
--   is unconditionally broken, and only "works" when the athlete has no
--   pre-existing active assignment at all, i.e. exactly the case where the
--   suspend step is a no-op.
--
-- Why a function, not a looser policy
--   Loosening programme_assignments_update's WITH CHECK to let medical write any
--   non-rehab row would reopen the exact gap migration 0022 closed (medical
--   editing a coach-owned gym/conditioning/nutrition assignment at will) — RLS's
--   WITH CHECK also has no OLD row to compare against, so "only status and
--   suspended_reason changed, nothing else" cannot be expressed as a row-level
--   policy at all, loose or narrow. A SECURITY DEFINER function is this
--   codebase's own established shape for exactly this situation (narrow, audited
--   write RLS can't safely express — revise_gym_set_log/revise_gym_session_log,
--   migration 0045): it does the one specific thing assignProgramme() needs,
--   checks its own precondition (the programme being assigned really is a rehab
--   programme in this org), and touches only status/suspended_reason on rows it
--   is not otherwise permitted to write.

create or replace function public.suspend_assignments_for_rehab(
  p_athlete_id         uuid,
  p_rehab_programme_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.auth_has_any_role(array['medical']::public.app_role[]) then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- The one precondition that keeps this narrow: it only ever suspends
  -- anything when p_rehab_programme_id genuinely is a rehab programme in
  -- the caller's own org — never a general-purpose "medical may suspend
  -- any assignment" escape hatch.
  if not exists (
    select 1 from public.programmes p
    where p.id = p_rehab_programme_id
      and p.org_id = v_org
      and p.programme_type = 'rehab'
      and p.deleted_at is null
  ) then
    raise exception 'not_a_rehab_programme' using errcode = 'P0001';
  end if;

  update public.programme_assignments
     set status = 'suspended', suspended_reason = 'Rehab programme assigned'
   where org_id = v_org
     and athlete_id = p_athlete_id
     and status = 'active'
     and programme_id <> p_rehab_programme_id;
end;
$$;

revoke all on function public.suspend_assignments_for_rehab(uuid, uuid) from public;
grant execute on function public.suspend_assignments_for_rehab(uuid, uuid) to authenticated;
