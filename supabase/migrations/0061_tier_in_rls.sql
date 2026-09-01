-- 0061_tier_in_rls.sql
--
-- Puts subscription tier into RLS for the first time.
--
-- Why this exists
--   docs/12-product-tiers.md §8 has always said: "Every tier rule that protects revenue
--   must exist server-side, in RLS or in an Edge Function, and the client check must be a
--   mirror of it rather than the thing itself." That was not true. Before this migration
--   `tier` appeared in NO policy anywhere in this directory -- grep returned only
--   comments. Every tier gate in the product lives in requireStaff()'s callers, which is a
--   real control against anything going through the app and nothing at all against a
--   request made straight to PostgREST with the user's own JWT, because RLS is the only
--   thing in that path.
--
--   The live consequence was the Apple Health toggle. HealthkitConsentToggle writes
--   athlete_consents through the BROWSER Supabase client, so on Basic the app withheld
--   the control and the database happily accepted the row anyway.
--
-- Scope, and what is deliberately NOT here
--   Only the healthkit_sync consent. Specifically NOT gps_records: a downgraded club must
--   still be able to answer a subject access request, and queries/sarPackAssembly.ts reads
--   gps_records to build one. GDPR Article 15 is not a plan feature, and a tier predicate
--   on that table would turn a billing state into a refusal to disclose someone's own
--   data. Leaderboards are likewise left alone -- 0056's gps.* metrics are gated in the
--   app, and the honest fix there is tier inside compute_leaderboard, not a policy that
--   would also hide a board's history from the club that created it.
--
-- What it does NOT do to existing rows
--   Nothing. Policies govern writes from here on. A club that granted HealthKit while on
--   Premium and later downgraded keeps the row, and the sync itself is switched off in the
--   app, not by deleting a consent record. Retroactively revoking a recorded consent would
--   destroy the audit trail that makes the consent meaningful.
--
-- The rule that must not be broken by this file
--   WITHDRAWAL IS ALWAYS PERMITTED, on any tier. Consent that cannot be withdrawn is not
--   consent. That is why the predicate lands in WITH CHECK and never in USING, and why it
--   passes any row that is not an ACTIVE grant.
--
-- Which spec sections this implements
--   12-product-tiers.md §8 (technical enforcement), §9.x (the plan preview)
--   09-security-and-compliance.md (consent is the athlete's)
--   CLAUDE.md §2 rule 2 (never trust a client value) and §5 (test before the rule:
--     supabase/tests/330_tier_rls_test.sql)

-- ---------------------------------------------------------------------------
-- The tier helper, in the shape of the auth_* helpers in 0010
-- ---------------------------------------------------------------------------

-- A table read, unlike auth_org_id(). It has to be: tier is not in the JWT, and putting
-- it there would mean an upgrade did not take effect until every token refreshed. Reading
-- organisations is the price of the change being immediate. Modelled on
-- auth_org_timezone(), which reads the same row for the same reason.
--
-- Defaults to FALSE, so an absent org, an absent claim, or an anon caller is Basic. A
-- tier check must fail closed: the failure mode of guessing "premium" is giving away the
-- product, and the failure mode of guessing "basic" is a support ticket.
create or replace function public.auth_org_is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select o.tier = 'performance' from public.organisations o where o.id = public.auth_org_id()),
    false
  );
$$;

comment on function public.auth_org_is_premium() is
  'True when the caller''s organisation is on the Premium tier. Reads organisations.tier, '
  'not the JWT, so an upgrade applies immediately. Fails closed to Basic. 12-product-tiers.md §8.';

grant execute on function public.auth_org_is_premium() to authenticated, anon, service_role;

-- One predicate, used by all four write policies below, so they cannot drift apart.
--
-- Permits everything except an ACTIVE HealthKit grant on a Basic club:
--   * any other purpose (leaderboard_visibility is not a paid feature)
--   * a row that grants nothing (granted_at is null)
--   * a row that has been withdrawn (withdrawn_at is not null) -- the withdrawal path,
--     which queries/healthkit.ts performs by setting withdrawn_at and LEAVING granted_at
--     in place. If this checked granted_at alone, a Basic athlete could never withdraw.
create or replace function public.consent_write_allowed(
  p_purpose      public.consent_purpose,
  p_granted_at   timestamptz,
  p_withdrawn_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_purpose <> 'healthkit_sync'
      or p_granted_at is null
      or p_withdrawn_at is not null
      or public.auth_org_is_premium();
$$;

comment on function public.consent_write_allowed(public.consent_purpose, timestamptz, timestamptz) is
  'Guards athlete_consents writes by tier. Only an ACTIVE healthkit_sync grant is gated; '
  'withdrawal is permitted on every tier, because consent that cannot be withdrawn is not consent.';

grant execute on function public.consent_write_allowed(public.consent_purpose, timestamptz, timestamptz)
  to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Re-state the four athlete_consents WRITE policies from 0012 §5, with the
-- predicate added. 0012 is not edited (CLAUDE.md §5: migrations are additive);
-- these are dropped and recreated here so the whole policy is visible in one
-- place rather than reconstructed from two files.
--
-- The two SELECT policies are untouched. Reading a consent is not a paid
-- feature, and an admin must still be able to see what was granted and when.
-- ---------------------------------------------------------------------------

drop policy if exists athlete_consents_self_insert on public.athlete_consents;
create policy athlete_consents_self_insert on public.athlete_consents for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and athlete_id = auth_athlete_id()
    and public.consent_write_allowed(purpose, granted_at, withdrawn_at)
  );

-- Predicate in WITH CHECK only, never USING: USING decides which existing rows the
-- athlete may touch, and narrowing it would take away the withdrawal.
drop policy if exists athlete_consents_self_update on public.athlete_consents;
create policy athlete_consents_self_update on public.athlete_consents for update
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id())
  with check (
    org_id = auth_org_id()
    and athlete_id = auth_athlete_id()
    and public.consent_write_allowed(purpose, granted_at, withdrawn_at)
  );

drop policy if exists athlete_consents_admin_write on public.athlete_consents;
create policy athlete_consents_admin_write on public.athlete_consents for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['admin']::app_role[])
    and public.consent_write_allowed(purpose, granted_at, withdrawn_at)
  );

drop policy if exists athlete_consents_admin_update on public.athlete_consents;
create policy athlete_consents_admin_update on public.athlete_consents for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]))
  with check (
    org_id = auth_org_id()
    and public.consent_write_allowed(purpose, granted_at, withdrawn_at)
  );
