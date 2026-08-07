-- 0002_tenancy_and_identity.sql
--
-- What this does
--   Creates the tenancy boundary and the identity tables: organisations, users, user_roles,
--   athletes, athlete_consents, groups and group_memberships.
--
-- Which spec sections this implements
--   04-data-model.md §3 (tenancy and identity)
--   04-data-model.md §17.16 (Children's Code: age, minority, parental involvement)
--   05-architecture.md §5 (users.claims_version, which the access token hook reads)
--   20-route-map.md §11 gap G-11 (athlete_consents, which had no create table anywhere)
--   screens/onboarding.md §3 (athletes.preferred_name, the athlete_consents shape)
--
-- Rules this file exists to satisfy
--   CONTRACT.md rule 1: every club data table has org_id.
--   CLAUDE.md §2 rule 4: athlete data is never hard deleted, so deleted_at everywhere.

-- ---------------------------------------------------------------------------
-- organisations, the tenancy boundary
-- ---------------------------------------------------------------------------

create table organisations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  sport         org_sport not null,
  timezone      text not null default 'Europe/London',
  country_code  char(2) not null default 'GB',
  tier          subscription_tier not null default 'core',
  -- Open shape by design: nutrition tolerance bands, export retention, children's
  -- settings. 04-data-model.md §17.3 and §17.7 both write into this object.
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table organisations is
  'A paying customer. One club or team. The tenancy boundary. 04-data-model.md §3.';


-- ---------------------------------------------------------------------------
-- users
--
-- id mirrors auth.users.id. No foreign key to auth.users is declared: 04-data-model.md §3
-- does not declare one, and omitting it keeps these migrations applicable to a bare
-- Postgres for the CI cross tenant suite. The invite redemption Edge Function is the only
-- writer of this table and it creates both rows in one transaction.
-- ---------------------------------------------------------------------------

create table users (
  id            uuid primary key,
  org_id        uuid not null references organisations(id),
  email         citext not null,
  full_name     text not null,
  phone         text,
  avatar_url    text,
  status        user_status not null default 'invited',
  last_seen_at  timestamptz,
  -- 05-architecture.md §5 "Claim staleness". Bumped by trigger whenever user_roles
  -- changes, carried in the JWT as 'cv', and compared server side for destructive
  -- operations so a stale token cannot perform a role change or an export.
  claims_version int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (org_id, email)
);

comment on column users.claims_version is
  'Bumped on any user_roles change. Detects a stale JWT. 05-architecture.md §5.';


-- ---------------------------------------------------------------------------
-- user_roles
--
-- Roles are additive. A user can hold coach and medical at once and gets the union of
-- both permission sets. 01-roles-and-permissions.md §1 design note.
-- ---------------------------------------------------------------------------

create table user_roles (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id),
  user_id    uuid not null references users(id) on delete cascade,
  role       app_role not null,
  granted_by uuid references users(id),
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);


-- ---------------------------------------------------------------------------
-- athletes
--
-- user_id is nullable so staff can add a squad member from a team sheet and start
-- recording against them before that person has downloaded the app. Forcing an account to
-- exist first blocks onboarding on the slowest possible dependency. 04-data-model.md §3.
-- ---------------------------------------------------------------------------

create table athletes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id),
  user_id         uuid unique references users(id),
  first_name      text not null,
  last_name       text not null,
  -- screens/onboarding.md: what the athlete is actually called.
  preferred_name  text,
  date_of_birth   date,
  position        text,
  squad_number    int,
  dominant_side   dominant_side,
  height_cm       numeric(5,1),
  status          athlete_status not null default 'active',
  joined_at       date,
  left_at         date,
  -- O-951 (09-security-and-compliance.md §3) proposes renaming these two to
  -- notice_acknowledged_at and notice_version, because the lawful basis is legitimate
  -- interests rather than consent. Unresolved, so 04-data-model.md §3 names are kept and
  -- the rename is a later additive migration. Granular optional consents live in
  -- athlete_consents below, which is the table G-11 said was missing.
  consent_given_at timestamptz,
  consent_version  text,

  -- 04-data-model.md §17.16, Children's Code. Age assurance record: the club asserts the
  -- date of birth at invite and this is the evidence of who asserted it.
  dob_asserted_by  uuid references users(id),
  dob_asserted_at  timestamptz,
  -- Set when an account cannot be activated for a reason the athlete must not be shown in
  -- raw form. 'under_13' is the only value at v1.
  activation_blocked_reason text,
  -- Parental involvement where the organisation requires it. Recorded by an admin against
  -- a club process. There is no parent login. 09-security-and-compliance.md §4.7.
  parental_consent_recorded_at timestamptz,
  parental_consent_recorded_by uuid references users(id),
  parental_consent_method      parental_consent_method,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- 04-data-model.md §17.16 rule 1. An athlete may exist without a date of birth. An athlete
-- may not be activated without one, because age decides which protections apply and the
-- Code cannot be applied to a child the system has not identified.
alter table athletes
  add constraint athletes_dob_required_when_linked
  check (user_id is null or date_of_birth is not null);

-- 04-data-model.md §17.16 rule 2. Sanity bounds: a date of birth outside these is a typo,
-- not a veteran. current_date makes this non immutable, so it lands NOT VALID and is
-- validated in the same migration, which is the standard additive pattern.
alter table athletes
  add constraint athletes_dob_plausible
  check (date_of_birth is null
         or (date_of_birth > current_date - interval '80 years'
             and date_of_birth < current_date))
  not valid;

alter table athletes validate constraint athletes_dob_plausible;

comment on column athletes.height_cm is
  'Static for a senior squad. Body mass is a time series and is not stored here. O-9.';


-- ---------------------------------------------------------------------------
-- athlete_consents, closing gap G-11 from 20-route-map.md §11
--
-- athletes.consent_given_at and consent_version carry one consent. The Children's Code
-- work in 04-data-model.md §17.16 assumes a set of granular, revocable consents, and
-- screens/onboarding.md §3 specifies the shape. A current state table with a withdrawal
-- timestamp rather than an event log, because withdrawal is prospective and only the
-- current state governs collection. The history lives in audit_log.
-- ---------------------------------------------------------------------------

create table athlete_consents (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id),
  athlete_id     uuid not null references athletes(id) on delete cascade,
  purpose        consent_purpose not null,
  granted_at     timestamptz,
  withdrawn_at   timestamptz,
  -- Ties the grant to the notice text that was actually shown.
  notice_version text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (athlete_id, purpose)
);

comment on table athlete_consents is
  'Granular revocable consents for genuinely optional processing only: HealthKit sync and '
  'leaderboard visibility. Everything else runs on legitimate interests, '
  '09-security-and-compliance.md §3. Closes gap G-11.';


-- ---------------------------------------------------------------------------
-- groups and group_memberships
--
-- Groups filter views, they do not restrict access. 01-roles-and-permissions.md §5.
-- ---------------------------------------------------------------------------

create table groups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id),
  name        text not null,
  description text,
  colour      text,
  group_type  group_type not null default 'custom',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, name)
);

-- History preserving deliberately: "show me the forwards' load in March" must use March's
-- membership, not today's. 04-data-model.md §3.
create table group_memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id),
  group_id   uuid not null references groups(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  added_at   timestamptz not null default now(),
  removed_at timestamptz,
  unique (group_id, athlete_id, added_at)
);
