-- An athlete under 18 reads nothing through injury_clinical_athlete_view.
--
-- WHAT CHANGES: one predicate on one view. `and not public.athlete_is_minor(a.id)`
-- is added to the WHERE clause. The column list, the owner rights, the org and
-- subject predicates and the grant to `authenticated` are all unchanged, and
-- `create or replace view` preserves the grant rather than re-issuing it.
--
-- WHY NOW. Tier 2 of the athlete injury work puts a diagnosis on a player's own
-- screen for the first time. Isabella's decision of 2026-09-08 was to build the
-- age gate from the start rather than defer it: there is one minor on the roster
-- today and none of them has an open injury, which is precisely the moment to
-- get it right rather than the moment it stops mattering.
--
-- WHY IT IS IN THE VIEW AND NOT IN THE APPLICATION. A view is where a rule
-- cannot be forgotten by the next consumer, and this view has been read by no
-- code at all until now -- Tier 2 is its first caller, so the rule should exist
-- before the callers do.
--
-- WHY IT CALLS athlete_age_years AND NOT athlete_is_minor, which is the same
-- rule and was the obvious first choice. `athlete_is_minor()` is SECURITY
-- DEFINER with EXECUTE granted to `postgres` and `service_role` only. A view's
-- owner rights cover access to the TABLES it reads; EXECUTE on a function it
-- calls is still checked against the CALLER. So an owner-rights view calling
-- athlete_is_minor fails for `authenticated` exactly as application code would
-- -- confirmed here by writing it that way first and watching test 490 fail with
-- "permission denied for function athlete_is_minor".
--
-- `athlete_age_years(date, date)` is not definer, is executable by
-- `authenticated`, and is what athlete_is_minor itself calls. It is also what
-- `athlete_age_view` uses to expose `is_minor` to athletes today. So this
-- expands the same rule from the same primitive rather than widening any grant.
--
-- THE THRESHOLD NOW APPEARS IN THREE PLACES -- athlete_is_minor, athlete_age_view
-- and here -- and three copies of a number drift. 490 pins them: it asserts that
-- this view's exclusion agrees with athlete_is_minor() for the same athlete, so
-- changing one without the others fails.
--
-- IT FAILS SAFE, AND THAT IS THE HALF THAT MATTERS. A null date of birth fails
-- the `is not null` test and the athlete is excluded, matching athlete_is_minor()
-- which returns TRUE for a null. An athlete whose date of birth was never
-- entered is treated as a minor and shown nothing, rather than as an adult by
-- default. Test 490 asserts that case separately from the sixteen year old,
-- because a gate that opens when it does not know is not a gate.
--
-- WHAT A MINOR SEES INSTEAD IS NOT DECIDED. Nothing is the safe default and it
-- is what this implements; "a reduced version", or "the same, with a guardian
-- present", are live options and either would replace this predicate rather than
-- work around it. 490 is where such a change announces itself.
--
-- NOT NARROWED IN ANY OTHER WAY, deliberately. The view still exposes mechanism,
-- severity, tissue_type, imaging, referral and treatment_plan to an adult
-- athlete, because that permission was decided separately and is not being
-- revisited here. The PRODUCT shows only the diagnosis: Tier 2's query selects
-- one column, and the restraint lives there, in front of a database that remains
-- more permissive than the screen. That gap is intentional and is written down
-- in docs/athlete/spec-gaps.md so it is not mistaken for an oversight.

create or replace view public.injury_clinical_athlete_view as
  select ic.injury_id,
         ic.org_id,
         i.athlete_id,
         ic.diagnosis,
         ic.mechanism,
         ic.severity,
         ic.tissue_type,
         ic.imaging,
         ic.referral,
         ic.treatment_plan,
         ic.updated_at
    from public.injury_clinical ic
    join public.injuries i on i.id = ic.injury_id
    join public.athletes a on a.id = i.athlete_id
   where ic.org_id = public.auth_org_id()
     and i.org_id = public.auth_org_id()
     and a.org_id = public.auth_org_id()
     and a.user_id = public.auth_user_id()
     and a.user_id is not null
     and a.deleted_at is null
     and i.deleted_at is null
     -- Added 0093. `not athlete_is_minor(a.id)` expanded from the primitive
     -- that role can actually execute -- see the header. Fails safe: a null
     -- date of birth fails the first test and the athlete is excluded.
     and a.date_of_birth is not null
     and public.athlete_age_years(a.date_of_birth) >= 18;

comment on view public.injury_clinical_athlete_view is
  'The only athlete readable path to clinical detail. Excludes clinical_notes, and '
  'since 0093 excludes athletes under 18 entirely, failing safe on an unknown date '
  'of birth. Owner rights by design, with its own org and subject predicates. '
  '01-roles-and-permissions md §4 carve out 1 and CONTRACT.md rule 3.';
