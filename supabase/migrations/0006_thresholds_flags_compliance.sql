-- 0006_thresholds_flags_compliance.sql
--
-- What this does
--   Creates thresholds, threshold_revisions, flags, flag_actions and
--   compliance_expectations.
--
-- Which spec sections this implements
--   04-data-model.md §10 (thresholds and flags, baseline types)
--   04-data-model.md §11 (compliance: derived, but the expectation is stored)
--   04-data-model.md §17.6 (threshold revisions, and pinning a flag to the rule that
--                           raised it)
--   01-roles-and-permissions.md §3 carve out 2 (a flag is visible to the athlete only
--                           after a staff member has acknowledged it)

-- ---------------------------------------------------------------------------
-- thresholds
--
-- Baseline types, 04-data-model.md §10:
--   absolute         crosses a fixed number, "sleep below 6 hours"
--   personal_rolling against the athlete's own rolling mean over baseline_days
--   squad_mean       against the squad average for that day
-- personal_rolling is the one that matters and is the recommended default for a new
-- organisation. Absolute thresholds generate noise on habitually short sleepers and miss
-- the athlete who has actually changed.
-- ---------------------------------------------------------------------------

create table thresholds (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id),
  name          text not null,
  description   text,
  domain        flag_domain not null,
  -- A metric key. metric_definitions, the shared catalogue in 04-data-model.md §17.4, is
  -- Phase 2 and lands with analytics and leaderboards, so no foreign key is declared yet.
  metric        text not null,
  comparison    threshold_comparison not null,
  value         numeric(10,3) not null,
  baseline_type baseline_type not null default 'absolute',
  baseline_days int default 28,
  -- Must breach N days running before a flag is raised.
  consecutive_days int not null default 1,
  -- Stops a personal_rolling threshold firing against a baseline built from two data
  -- points, which is the failure mode that makes a new athlete look alarming in week one.
  min_baseline_observations int not null default 10,
  -- Stops a persistent condition raising an identical flag every day, which is the
  -- mechanism behind the alert fatigue argument in 03-flows.md §5.
  cooldown_days int not null default 3,
  severity      flag_severity not null default 'medium',
  applies_to_group_id uuid references groups(id),
  notify_roles  app_role[] not null default '{coach}',
  source        threshold_source not null default 'custom',
  is_active     boolean not null default true,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  check (baseline_days is null or baseline_days between 1 and 365),
  check (consecutive_days between 1 and 30),
  check (min_baseline_observations >= 0),
  check (cooldown_days >= 0)
);


-- ---------------------------------------------------------------------------
-- threshold_revisions, 04-data-model.md §17.6
--
-- A threshold is edited over a season. Without pinning each flag to the rule version that
-- raised it, a flag from June cannot be explained in September, and recalibration
-- statistics compare rules that are not the same rule.
-- ---------------------------------------------------------------------------

create table threshold_revisions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id),
  threshold_id  uuid not null references thresholds(id) on delete cascade,
  before        jsonb,               -- null on create
  after         jsonb not null,
  change_reason text,
  changed_by    uuid not null references users(id),
  created_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- flags
-- ---------------------------------------------------------------------------

create table flags (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id),
  athlete_id     uuid not null references athletes(id),
  threshold_id   uuid references thresholds(id),
  -- Nullable only for rows created before threshold revisions existed. Every new flag
  -- pins the rule version that raised it. 04-data-model.md §17.6.
  threshold_revision_id uuid references threshold_revisions(id),
  domain         flag_domain not null,
  metric         text not null,
  observed_value numeric(10,3),
  expected_value numeric(10,3),
  flag_date      date not null,
  severity       flag_severity not null,
  status         flag_status not null default 'raised',
  raised_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references users(id),
  resolved_at    timestamptz,
  -- 01-roles-and-permissions.md §3 carve out 2. Set when a staff member acknowledges.
  -- An athlete should learn "your sleep has dropped for four days, we have adjusted your
  -- load" from a coach, not from a red badge at 06:00. The RLS policy in 0012 keys the
  -- athlete's read on this column being non null, so the rule is enforced in the database
  -- and not by a client that forgets to filter.
  athlete_visible_at timestamptz,
  created_at     timestamptz not null default now(),

  check (acknowledged_at is null or acknowledged_by is not null)
);


-- ---------------------------------------------------------------------------
-- flag_actions
-- ---------------------------------------------------------------------------

create table flag_actions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id),
  flag_id        uuid not null references flags(id) on delete cascade,
  action_type    flag_action_type not null,
  note           text,
  dismiss_reason text,
  taken_by       uuid not null references users(id),
  taken_at       timestamptz not null default now(),

  check (action_type <> 'dismissed' or dismiss_reason is not null)
);


-- ---------------------------------------------------------------------------
-- compliance_expectations, 04-data-model.md §11
--
-- Compliance is derived, not stored, but the expectation is stored. Expectations are
-- generated nightly from the schedule and the week template for the following day, and
-- compliance is then matched entries over expectations.
--
-- Waivers exist so absence is not punished as non-compliance. An athlete on leave, or
-- unavailable through injury with wellness not required, has the expectation WAIVED with a
-- reason rather than deleted, so the denominator tells the truth about what was asked.
-- ---------------------------------------------------------------------------

create table compliance_expectations (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id),
  athlete_id       uuid not null references athletes(id),
  expectation_date date not null,
  -- 'nutrition' is a value of compliance_domain and is never generated. The weekly check
  -- in is deliberately not a compliance domain, 04-data-model.md §17.15.
  domain           compliance_domain not null,
  session_id       uuid references sessions(id),
  is_required      boolean not null default true,
  waived_reason    text,
  created_at       timestamptz not null default now(),
  unique (athlete_id, expectation_date, domain, session_id),

  -- A waived expectation is one that is not required. Keeping the two facts from
  -- disagreeing stops a waiver silently counting against an athlete.
  check (waived_reason is null or is_required = false)
);

comment on table compliance_expectations is
  'The stored half of compliance. Never generated for domain = nutrition: nothing is '
  'logged and a missed weekly check in is not non-compliance.';
