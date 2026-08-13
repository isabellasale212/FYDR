-- 0042_coach_noninjury_availability.sql
--
-- What this does
--   Adds two narrow, additive RLS policies to availability: a coach may insert a
--   row, and update (close) one, but only when it is not linked to an injury and
--   carries a real, non-injury reason category. Every other rule 0012 wrote for
--   this table — medical's own insert and update policies, the athlete and staff
--   select policies, the absence of any delete policy — is untouched.
--
-- Which spec sections this implements
--   ADR-008 (docs/decisions/adr-008-coach-non-injury-availability.md) — read that
--   file for the full reasoning and the alternatives considered. This comment is
--   the short version.
--   01-roles-and-permissions.md §2 and §4, both updated in the same commit to
--   record the narrowed rule.
--   Audit governance finding 2 / gameplan 2.6.
--
-- The gap this closes
--   0005/0012 gate ALL availability writes to the medical role, without exception,
--   on the reasoning that availability is "medically determined"
--   (CLAUDE.md §6 vocabulary). That reasoning holds for an injury. It does not hold
--   for a player who is unavailable this week because he has exams, is on
--   representative honours elsewhere, or is out for a personal reason — none of
--   that is a medical fact, and routing it through medical staff either produces a
--   fabricated injury record for a player who was never hurt, or means the absence
--   simply never gets recorded, both of which the audit caught happening. The
--   schema was never the blocker: availability.injury_id has always been nullable
--   and reason_category has carried non-injury values ('illness', 'personal',
--   'suspension', 'load_management') since 0001. The blocker was purely the RLS
--   layer, and it was deliberate — 0012's own comment says "There is no coach
--   insert policy on this table. Not a restricted one, not one gated on a column:
--   none." This migration is the first column-gated one, and it exists because the
--   thing it protects — the clinical/injury boundary — is not what a non-injury
--   absence touches at all.
--
-- What stays protected, unconditionally
--   1. injury_clinical: no change. Still ONE POLICY. FOR ALL. MEDICAL ONLY.
--   2. injuries: no change. Coach still cannot create or edit an injury record.
--   3. Any availability row linked to an injury (injury_id is not null): the new
--      coach policies' USING/WITH CHECK clauses require injury_id is null, so a
--      row with an injury behind it is invisible to a coach's insert or update
--      under these policies, exactly as it already was.
--   4. Any row whose reason_category is 'injury', even with injury_id left blank
--      (a medical staff member typing the reason and forgetting to link the
--      record, which the app should not allow but RLS should not assume it
--      prevents): reason_category is distinct from 'injury' is required too, so
--      that case is excluded on its own, independent of injury_id.
--   5. A blank reason_category on INSERT: reason_category is not null is
--      required there, so a coach cannot open a new interval with nothing
--      recorded about why. This is what keeps the existing pgTAP assertion in
--      030_medical_and_entry_rules_test.sql — "a COACH cannot insert into
--      availability, even in their own organisation", whose insert statement
--      never sets reason_category — true. See 200_coach_noninjury_availability_
--      test.sql for the full positive-and-negative set this migration is
--      written against.
--
-- Why UPDATE does NOT also require reason_category is not null
--   The ordinary, unremarkable state of an athlete who has never had an
--   availability event worth recording is a single open row with status
--   'available' and reason_category null — that is what every existing
--   medical-authored "clear" row looks like (setAvailability always inserts a
--   fresh row on the way back to available, and the reason field is not shown
--   for that status). A coach has to be able to close THAT row to open their
--   own non-injury interval, or this feature cannot be used on any athlete
--   who has not already had a reasoned availability event — which is most of
--   a squad. So the update policy's bar is lower than the insert policy's:
--   not linked to an injury and not itself reasoned 'injury', full stop,
--   regardless of whether a reason is present at all. It still cannot reach
--   an injury-linked row, which is the boundary that matters.
--
--   This is narrower than 0012's "no coach insert policy... not one gated on
--   a column: none" only in the sense that it now exists at all; it is not
--   narrower than what 030's OLD update assertion checked in practice, which
--   used a table-wide UPDATE with no WHERE clause and happened to hit only
--   the fixture's one injury-linked row. That old assertion is edited in the
--   same commit as this migration, scoped to the injury-linked row by name
--   rather than by "the whole table happens to contain nothing else yet" —
--   because after this migration the table legitimately does contain
--   something else. See the edit to 030's section 3 for the reasoning at the
--   point it was changed.
--
-- set_by = auth_user_id() on the insert policy
--   Matches availability_medical_insert's own check exactly, for the same
--   reason: a coach cannot author a row and attribute it to someone else.

create policy availability_coach_insert_noninjury on public.availability for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach']::app_role[])
    and set_by = auth_user_id()
    and injury_id is null
    and reason_category is not null
    and reason_category is distinct from 'injury'::availability_reason
  );

comment on policy availability_coach_insert_noninjury on public.availability is
  'ADR-008. A coach may open a new availability interval only when it is not '
  'linked to an injury and carries a real, non-injury reason. Medical retains '
  'full, unconditional insert access via availability_medical_insert (0012).';

create policy availability_coach_update_noninjury on public.availability for update
  to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach']::app_role[])
    and injury_id is null
    and reason_category is distinct from 'injury'::availability_reason
  )
  with check (
    org_id = auth_org_id()
    and injury_id is null
    and reason_category is distinct from 'injury'::availability_reason
  );

comment on policy availability_coach_update_noninjury on public.availability is
  'ADR-008. Exists so a coach can close the interval they opened (set '
  'effective_to), matching why availability_medical_update (0012) exists, and '
  'so they can close an athlete''s ordinary reasonless "available" row on the '
  'way to opening their own non-injury one — see this migration''s header for '
  'why that case has to be allowed. A row linked to an injury, or itself '
  'reasoned ''injury'', is invisible to this policy in both the USING and WITH '
  'CHECK clause, so a coach cannot use update to reach into, or launder a row '
  'into, the clinical boundary.';

-- No coach delete policy. Matches every other rule on this table: nobody deletes
-- an availability row, coach or medical. 0012's own comment on this table.
