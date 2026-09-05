-- ---------------------------------------------------------------------------
-- 0071: a medic may edit an athlete's biographical details.
--
-- Straight from the specification's own front page, edit 1 of 2026-09-04,
-- resolving D-26: "Medics can now edit an athlete's biographical details, the
-- same as coaches. Previously coach-only, medics were explicitly excluded."
--
-- Found on the first reading of the clean spec after it was placed in docs/,
-- and it made docs/spec-gaps.md G-37 bigger than it was first written. That
-- entry said the sport scientist could not reach the edit control although the
-- policy allowed it. In fact TWO roles were missing and in opposite directions:
--
--   the medic           allowed by the spec, refused by this policy
--   the sport scientist allowed by this policy, refused by the screen
--
-- So it was never a UI-only fix. The screen is corrected in the same commit and
-- both now resolve from ATHLETE_BIO_EDIT in lib/access.ts.
--
-- INSERT is untouched. Creating an athlete is Screen 63, which the build
-- handoff makes sport-scientist-only and which does not exist yet; editing a
-- record and creating one are different rows in §3.1 and stay different here.
--
-- Generated as 0065 to 0070 were: the installed definition read back from
-- pg_policies with exactly one role array replaced, asserted at generation.
-- ---------------------------------------------------------------------------

drop policy if exists athletes_manage_update on public.athletes;
create policy athletes_manage_update on public.athletes
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role])))
  with check ((org_id = auth_org_id()));