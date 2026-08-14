-- 0049_mfa_aal2_helper.sql
--
-- What this does
--   Adds public.auth_is_aal2(), the JWT-aal-claim helper 09-security-and-compliance.md
--   §8.1 sketches "alongside those in 04-data-model.md §14". Reads the same
--   request.jwt.claims GUC every other auth_* helper in migration 0010 reads, through the
--   same private public.auth_claims() wrapper, rather than calling Supabase's auth.jwt()
--   directly — one source of truth for "how this app reads a claim", not two.
--
-- What this deliberately does NOT do
--   It does NOT add `and auth_is_aal2()` to a single existing RLS policy. login-security
--   checklist item 3 (MFA) is a large, high-risk change and this migration ships only the
--   safe slice of it: the enrollment UI, the sign-in TOTP challenge, and this helper,
--   inert and unreferenced by any policy.
--
--   Reason, checked before writing this file rather than assumed: supabase/tests/
--   000_setup_test_helpers.sql's tests.set_jwt() — the function every pgTAP fixture in this
--   suite uses to impersonate a staff user — has never set an `aal` claim at all, which
--   means every coach/medical/admin fixture in every one of the ~30 existing test files is,
--   and always has been, effectively aal1. Production matches: as of this migration, zero
--   real staff members in the live database have enrolled a TOTP factor, because the
--   enrollment UI did not exist before this change shipped. Adding `auth_is_aal2()` to
--   `wellness_staff_select` and its siblings today, in the same pass that first makes
--   enrollment possible, would read as "ship MFA" but would actually mean every staff user
--   in production — coach, medical and admin alike, all of them currently unenrolled —
--   loses read access to squad data the moment this migration applies, with no grace
--   period and no warning. That is the exact failure mode CLAUDE.md's non-negotiable rule 1
--   exists to prevent on the tenancy side; this is the same shape of mistake on the
--   authentication side.
--
--   The correct sequencing is: ship enrollment, let staff actually enroll, confirm real
--   coverage, THEN retrofit `auth_is_aal2()` into the staff-scope policies as its own
--   reviewed migration with a rollout plan (a grace period, or a per-organisation cutover,
--   or both). That migration is intentionally not this one. See
--   docs/09-security-and-compliance.md §8.1's implementation note and docs/11-open-questions.md
--   O-323 for the tracked follow-up.
--
-- Which spec section this implements
--   09-security-and-compliance.md §8.1, "Enforcing staff MFA properly" — the helper only.

create or replace function public.auth_is_aal2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_claims() ->> 'aal', 'aal1') = 'aal2';
$$;

comment on function public.auth_is_aal2() is
  'True when the JWT aal claim is aal2 (password + a verified MFA factor completed this '
  'session). Not yet referenced by any RLS policy — see this migration''s own header for '
  'why that is a deliberate, separate follow-up rather than an oversight.';

grant execute on function public.auth_is_aal2() to authenticated, anon, service_role;
