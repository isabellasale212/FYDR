-- The nutritionist reads the censored injury and availability view.
--
-- THIS REVERSES D-01, which is why it is its own migration and not folded into
-- the reports work it belongs to. D-01 read "nutritionist excluded from all
-- injury/availability data, everywhere" and was called the highest-risk item in
-- the build handoff. Decided 2026-09-06: that role sees the same limited view a
-- coach and an S&C already see -- body area, status, restrictions, expected
-- return -- and never a diagnosis.
--
-- WHY THIS IS NOT A NEW REDACTION TIER, and the reason a two-line change is
-- enough. The diagnosis does not live in these tables. It lives in
-- injury_clinical, whose policy is clinical_medical_only and admits the medic
-- alone. That policy is NOT touched here and must not be: it is the thing that
-- makes "never a diagnosis" true of the database rather than true of a page
-- somebody could later change. /reports/injuries is censored by construction
-- for every role that opens it -- injury_clinical is not selected from, not
-- joined to, and not in the Database type the client is built against -- so
-- admitting the nutritionist to the two tables below admits them to exactly the
-- view the coach gets and to nothing else.
--
-- READS ONLY. Every write policy on both tables is left exactly as it stands:
--   injuries INSERT           sport scientist, coach, medic, S&C
--   injuries UPDATE           medic alone (D-35)
--   availability INSERT       coach + sport scientist non-injury, medic clinical
--   availability UPDATE       the same split
-- The nutritionist gains no write anywhere, and neither does anybody else.

drop policy if exists injuries_staff_select on public.injuries;
create policy injuries_staff_select on public.injuries
  for select to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY[
      'sport_scientist'::app_role,
      'coach'::app_role,
      'medic'::app_role,
      'strength_conditioning'::app_role,
      'nutritionist'::app_role
    ])
  );

drop policy if exists availability_staff_select on public.availability;
create policy availability_staff_select on public.availability
  for select to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY[
      'sport_scientist'::app_role,
      'coach'::app_role,
      'medic'::app_role,
      'strength_conditioning'::app_role,
      'nutritionist'::app_role
    ])
  );
