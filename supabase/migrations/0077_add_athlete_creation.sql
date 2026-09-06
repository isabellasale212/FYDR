-- Screen 63, Add athlete: the two things the schema was missing.
--
-- 1. A SQUAD NUMBER THAT CANNOT BE TAKEN TWICE.
--
-- The screen's spec says a duplicate is "refused with a sentence naming the
-- athlete who already holds it, not a silent overwrite". Nothing in the database
-- enforced that: there was no unique constraint on (org_id, squad_number) at
-- all, so the only check would have been the application's, and an application
-- check cannot survive two people saving at once. The form still does its own
-- check, because it can name the holder and this cannot; but the form is the
-- courtesy and this is the rule.
--
-- Partial on two counts, both deliberate. `deleted_at is null` so a departed
-- athlete's number is free to reissue, which is how squad numbers actually work.
-- `squad_number is not null` so an athlete can be added without one -- the spec
-- makes the number a field, not a requirement, and several existing records have
-- none.
--
-- Verified before adding: 35 live athletes on production and 35 on scratch, zero
-- duplicate (org_id, squad_number) pairs on either. The index cannot fail to
-- build on current data.
--
-- 2. CREATING AN ATHLETE IS THE SPORT SCIENTIST'S.
--
-- athletes_manage_insert admitted the coach as well. Screen 63 §2 is explicit
-- that this is "an administration action, not a coaching one, the same
-- distinction that already keeps Club details and Users restricted to the sport
-- scientist while a coach can still edit an athlete's biographical details once
-- they exist" -- and Appendix A §3.6 puts the row in the administration block.
--
-- So this NARROWS the coach, and it is worth being precise about what that
-- costs: nothing today. No screen and no route in the app inserts an athlete,
-- which is the whole reason screen 63 exists, so the widened policy has never
-- been reachable by anybody. The UPDATE policy is untouched, so a coach keeps
-- editing an athlete's details once the record exists, which is exactly the
-- distinction the spec draws.

create unique index if not exists athletes_org_squad_number_live
  on public.athletes (org_id, squad_number)
  where deleted_at is null and squad_number is not null;

drop policy if exists athletes_manage_insert on public.athletes;
create policy athletes_manage_insert on public.athletes
  for insert to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY['sport_scientist'::app_role])
  );
