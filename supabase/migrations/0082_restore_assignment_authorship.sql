-- Restores the rehab-authorship rule that 0080 dropped, and keeps the sign-off.
--
-- WHAT WENT WRONG. 0080 needed to add one clause to programme_assignments_update
-- and did it with `drop policy` + `create policy`, writing a fresh WITH CHECK
-- that contained only the new clause. The old one went with it:
--
--   (SS or S&C) may update a NON-rehab assignment
--   (SS or medic) may update a REHAB assignment
--
-- which is 0022's rehab exclusivity, last restated by 0070. Dropping it hands a
-- coach and a nutritionist UPDATE on a rehab assignment. Nothing caught it: the
-- pgTAP written alongside 0080 asserted the rule being ADDED and never the rule
-- being REPLACED, and a policy that is too permissive fails no test that only
-- checks the permitted path. Found by reading 0070 before pushing to production,
-- which is the only reason it never got there.
--
-- WHY THE OBVIOUS FIX IS WRONG. Simply AND-ing the old predicate back breaks the
-- feature 0080 exists for. The medic signs off a block the S&C drafted, and that
-- block is a GYM programme -- so the authorship rule refuses the medic, who is
-- neither SS nor S&C on a non-rehab assignment. The two rules genuinely conflict
-- on exactly one row shape.
--
-- So the medic gets a narrow exception, scoped to assignments that carry an
-- injury_id -- which only exist because an S&C proposed one. It is not a general
-- widening: a medic still cannot touch an ordinary gym assignment, exactly as
-- before.
--
-- Net effect against production as it stands at 0078: the authorship rule is
-- unchanged, plus a medic may act on injury-linked assignments, plus making an
-- injury-linked assignment live requires a medic.

drop policy if exists programme_assignments_update on public.programme_assignments;
create policy programme_assignments_update on public.programme_assignments
  for update to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY[
      'sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role,
      'strength_conditioning'::app_role, 'nutritionist'::app_role
    ])
  )
  with check (
    org_id = auth_org_id()
    and (
      /* 0022 / 0070, restored verbatim: who may author a change to an
         assignment at all, by the type of the programme it points at. */
      exists (
        select 1
        from programmes p
        where p.id = programme_assignments.programme_id
          and p.org_id = auth_org_id()
          and (
            (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role])
              and p.programme_type <> 'rehab'::programme_type)
            or (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role])
              and p.programme_type = 'rehab'::programme_type)
          )
      )
      /* The sign-off. Narrow on purpose: injury_id is only ever set by the
         propose path, so this admits the medic to those rows and to no others. */
      or (injury_id is not null and auth_has_any_role(ARRAY['medic'::app_role]))
    )
    /* 0080's rule, unchanged: an injury-linked assignment goes live only for a
       medic. Kept as its own conjunct so it applies to every branch above. */
    and (
      injury_id is null
      or status <> 'active'::assignment_status
      or auth_has_any_role(ARRAY['medic'::app_role])
    )
  );
