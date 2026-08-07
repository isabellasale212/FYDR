-- 0001_extensions_and_enums.sql
--
-- What this does
--   Installs the extensions Fydr depends on, creates the database roles the rest of the
--   migrations grant to, and defines every Postgres enum type used by the Phase 0 schema.
--
-- Which spec sections this implements
--   04-data-model.md §1 (conventions: enums are Postgres enum types, never free text)
--   04-data-model.md §3, §4, §5, §9, §10, §11, §17.6, §17.13, §17.15, §17.16
--   05-architecture.md §5 (the roles the claims model and the auth hook depend on)
--   10-roadmap.md §3 (Phase 0: "every Postgres enum type")
--
-- Scope note
--   Phase 0 only. Enums belonging exclusively to programmes, gym logging, testing, GPS,
--   leaderboards, analytics, reports, exports and nutrition guidance content are Phase 2
--   and Phase 3 and are deliberately absent. Adding an enum later is a one line migration;
--   adding it now and leaving it unused is noise in a schema that has to be readable.

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------

-- citext backs users.email, which must be case insensitive per 04-data-model.md §3.
create extension if not exists citext;

-- pgcrypto is present on Supabase and provides gen_random_uuid() on servers older than
-- Postgres 13. Harmless where the built in function already exists.
create extension if not exists pgcrypto;


-- ---------------------------------------------------------------------------
-- 2. Database roles
--
-- Supabase creates anon, authenticated, service_role and supabase_auth_admin as part of
-- project provisioning. This block exists so that the same migrations apply cleanly to a
-- bare Postgres 15 used by CI and by the pgTAP suite, where they do not exist.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 3. Tenancy and identity enums, 04-data-model.md §3
-- ---------------------------------------------------------------------------

-- The sport a club plays. 04-data-model.md §3 gives the column as org_sport with the
-- comment "rugby_union, rugby_league, football..." and never enumerates the full set.
-- These are the values the product is sold into at v1. Extending an enum is additive.
create type org_sport as enum (
  'rugby_union', 'rugby_league', 'football', 'netball', 'hockey',
  'cricket', 'basketball', 'athletics', 'other'
);

-- 12-product-tiers.md: two tiers at v1.
create type subscription_tier as enum ('core', 'performance');

create type user_status as enum ('invited', 'active', 'suspended', 'deactivated');

-- The four roles, and only four. 01-roles-and-permissions.md §1: roles are additive per
-- user, so a coach who is also a physio holds two rows, not a fifth role value.
create type app_role as enum ('athlete', 'coach', 'medical', 'admin');

create type dominant_side as enum ('left', 'right', 'both');

create type athlete_status as enum ('active', 'injured_long_term', 'left_club');

-- 04-data-model.md §17.13 is explicit that group_type does not gain a 'team' value.
-- Teams are a separate table so there is exactly one place a team is defined.
create type group_type as enum ('positional', 'training', 'rehab', 'age', 'custom');

-- G-11, screens/onboarding.md §3. The genuinely optional processing, and only that.
-- 'nutrition_photo' was specified and removed before first migration: athletes do not log
-- nutrition, so no meal photograph is ever captured.
create type consent_purpose as enum ('healthkit_sync', 'leaderboard_visibility');

-- 04-data-model.md §17.16. Recorded by an admin against a club process. There is no
-- parent login, per 09-security-and-compliance.md §4.7.
create type parental_consent_method as enum (
  'club_registration_form', 'written_confirmation', 'in_person', 'not_required'
);


-- ---------------------------------------------------------------------------
-- 4. Schedule enums, 04-data-model.md §4 and §17.13
-- ---------------------------------------------------------------------------

create type home_away as enum ('home', 'away', 'neutral');

create type fixture_importance as enum ('friendly', 'normal', 'key', 'cup_final');

create type fixture_status as enum ('scheduled', 'played', 'postponed', 'cancelled');

create type session_type as enum (
  'training', 'gym', 'match', 'testing', 'recovery', 'meeting', 'rehab'
);

create type session_status as enum ('planned', 'completed', 'cancelled');

create type attendance_status as enum ('full', 'modified', 'absent', 'excused');

-- 04-data-model.md §17.13
create type team_status as enum ('active', 'dormant', 'archived');

create type team_allocation_status as enum ('draft', 'published', 'withdrawn');

create type team_allocation_source as enum (
  'manual', 'copied_from_week', 'default_team', 'import'
);


-- ---------------------------------------------------------------------------
-- 5. Athlete submitted data enums, 04-data-model.md §5 and §17.15
-- ---------------------------------------------------------------------------

-- Provenance. Every entry row carries where it came from, which is what lets a coach
-- entered value be told apart from a self report in analysis and in an export.
create type data_source as enum (
  'self_report', 'staff_entered', 'device_sync', 'file_import', 'vendor_api', 'computed'
);

-- 04-data-model.md §17.15. One question, once a week, three permitted answers.
-- The ordinal encoding used by analytics lives in metric_definitions, not in storage.
create type nutrition_checkin_answer as enum ('yes', 'roughly', 'no');


-- ---------------------------------------------------------------------------
-- 6. Injury and availability enums, 04-data-model.md §9
-- ---------------------------------------------------------------------------

-- body_area is referenced throughout screens/injury-record.md and screens/wellness-entry.md
-- as "the body_area enum" and its values are never listed in the specification. These are
-- the areas a rugby physio records against. Enum values are additive.
create type body_area as enum (
  'head', 'neck', 'shoulder', 'upper_arm', 'elbow', 'forearm', 'wrist', 'hand',
  'chest', 'upper_back', 'lower_back', 'abdomen', 'hip', 'groin',
  'quadriceps', 'hamstring', 'knee', 'calf', 'achilles', 'ankle', 'foot', 'other'
);

create type body_side as enum ('left', 'right', 'bilateral');

create type injury_status as enum ('open', 'rehab', 'return_to_play', 'closed');

create type injury_severity as enum ('minor', 'moderate', 'severe');

create type occurrence_context as enum ('training', 'match', 'gym', 'other', 'unknown');

create type availability_status as enum ('available', 'modified', 'unavailable');

create type availability_reason as enum (
  'injury', 'illness', 'personal', 'suspension', 'load_management'
);


-- ---------------------------------------------------------------------------
-- 7. Threshold, flag and compliance enums, 04-data-model.md §10, §11, §17.6
-- ---------------------------------------------------------------------------

-- 'nutrition' is retained in flag_domain because thresholds.md and metric_definitions
-- reference it. No flag of that domain is generated at v1: nothing is logged.
create type flag_domain as enum (
  'wellness', 'gym', 'gps', 'nutrition', 'compliance', 'testing'
);

create type threshold_comparison as enum (
  'below', 'above', 'pct_change_below', 'pct_change_above', 'z_score'
);

-- personal_rolling is the one that matters: an athlete who always sleeps 6.5 hours is not
-- in trouble, an athlete who normally sleeps 8.5 and slept 6.5 is. 04-data-model.md §10.
create type baseline_type as enum ('absolute', 'personal_rolling', 'squad_mean');

create type flag_severity as enum ('low', 'medium', 'high');

create type flag_status as enum (
  'raised', 'notified', 'acknowledged', 'actioned', 'monitoring', 'resolved', 'dismissed'
);

create type flag_action_type as enum (
  'note', 'load_adjusted', 'referred_medical', 'athlete_spoken_to', 'dismissed'
);

-- 04-data-model.md §17.6
create type threshold_source as enum ('default', 'custom', 'recalibrated');

-- 04-data-model.md §11. 'nutrition' is retained in the enum and is never generated:
-- O-11 removed daily logging and O-890 added a weekly check in that is deliberately not a
-- compliance domain. See screens/nutrition-checkin.md.
create type compliance_domain as enum ('wellness', 'training_rpe', 'gym', 'nutrition');
