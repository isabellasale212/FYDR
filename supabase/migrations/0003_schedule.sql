-- 0003_schedule.sql
--
-- What this does
--   Creates the scheduling spine: seasons, fixtures, sessions, session_participants,
--   session_attendance and week_templates, plus the team structure that hangs off it,
--   teams and team_allocations.
--
-- Which spec sections this implements
--   04-data-model.md §4 (schedule, week templates)
--   04-data-model.md §17.13 (teams and team allocation, and why they are not groups)
--
-- Scope note
--   fixture_selections (gap G-3 in 20-route-map.md §11) is deliberately absent. It is
--   named in §17.13 and referenced by fixture-detail.md but no create table exists
--   anywhere in the specification. team_allocations answers which team, not who starts
--   against who is on the bench, and must not be overloaded to cover for the gap.

-- ---------------------------------------------------------------------------
-- seasons
-- ---------------------------------------------------------------------------

create table seasons (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id),
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_on > starts_on)
);

-- One current season per organisation. A club with two "current" seasons produces two
-- answers to "what is the season to date average", which is a silent corruption.
create unique index seasons_one_current
  on seasons (org_id) where is_current and deleted_at is null;


-- ---------------------------------------------------------------------------
-- fixtures
-- ---------------------------------------------------------------------------

create table fixtures (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id),
  season_id   uuid not null references seasons(id),
  opponent    text not null,
  kickoff_at  timestamptz not null,
  venue       text,
  home_away   home_away not null,
  competition text,
  importance  fixture_importance not null default 'normal',
  status      fixture_status not null default 'scheduled',
  result      text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);


-- ---------------------------------------------------------------------------
-- sessions
--
-- md_offset is stored, not only computed. If a fixture is postponed the historical
-- sessions must keep the MD-n label they were actually planned and executed under.
-- Recomputing it retroactively rewrites history and corrupts every MD-n analysis.
-- 04-data-model.md §4.
-- ---------------------------------------------------------------------------

create table sessions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id),
  season_id    uuid not null references seasons(id),
  fixture_id   uuid references fixtures(id),
  session_type session_type not null,
  title        text not null,
  starts_at    timestamptz not null,
  duration_min int,
  location     text,
  md_offset    int,
  planned_rpe  numeric(3,1),
  planned_load numeric(8,1),
  notes        text,
  requires_wellness  boolean not null default true,
  requires_rpe       boolean not null default true,
  -- DEAD. Nutrition is guidance only, nothing is logged, so nothing can be expected.
  -- Retained so an existing migration does not need reversing. Always false. Never read.
  requires_nutrition boolean not null default false,
  status       session_status not null default 'planned',
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  check (planned_rpe is null or (planned_rpe >= 1 and planned_rpe <= 10)),
  check (duration_min is null or duration_min > 0)
);

comment on column sessions.requires_nutrition is
  'Dead column. CLAUDE.md rule 8: athletes do not log nutrition. Never read, always false.';


-- ---------------------------------------------------------------------------
-- session_participants
--
-- Either one athlete or one whole group, never both and never neither.
-- ---------------------------------------------------------------------------

create table session_participants (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id),
  session_id uuid not null references sessions(id) on delete cascade,
  athlete_id uuid references athletes(id),
  group_id   uuid references groups(id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(athlete_id, group_id) = 1)
);


-- ---------------------------------------------------------------------------
-- session_attendance
-- ---------------------------------------------------------------------------

create table session_attendance (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id),
  session_id      uuid not null references sessions(id) on delete cascade,
  athlete_id      uuid not null references athletes(id),
  attendance      attendance_status not null,
  -- Non clinical. A coach writes "left early, family" here, never a diagnosis.
  modified_reason text,
  recorded_by     uuid references users(id),
  recorded_at     timestamptz not null default now(),
  unique (session_id, athlete_id)
);


-- ---------------------------------------------------------------------------
-- week_templates
--
-- structure is jsonb because the shape is genuinely open: a variable number of days, each
-- with a variable number of sessions. 04-data-model.md §1 permits jsonb exactly here.
-- ---------------------------------------------------------------------------

create table week_templates (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id),
  name       text not null,
  structure  jsonb not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- A jsonb size constraint, per 10-roadmap.md §3 "every jsonb size constraint".
  check (pg_column_size(structure) < 64 * 1024),
  check (jsonb_typeof(structure -> 'days') = 'array')
);


-- ---------------------------------------------------------------------------
-- teams, 04-data-model.md §17.13
--
-- A standing entity in the club: 1st XV, 2nd XV, Colts, Development. Deliberately not
-- group_type = 'team': an athlete is in Forwards and S&C Group A and Under 20 at once,
-- but plays for exactly one team on a given weekend, and that exclusivity cannot be
-- expressed on group_memberships without denormalising group_type onto a hot table.
-- ---------------------------------------------------------------------------

create table teams (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organisations(id),
  season_id           uuid references seasons(id),
  name                text not null,
  short_name          text,
  description         text,
  colour              text,
  -- 1 is the highest team. Drives ordering and the "stepped up" derivation.
  rank                int not null default 0,
  squad_size_starting int,
  squad_size_bench    int,
  status              team_status not null default 'active',
  sort_order          int not null default 0,
  created_by          uuid references users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- An athlete's standing team. Nullable: a new squad member has no team yet, and a club
-- with one team never sets it. 04-data-model.md §17.13.
alter table athletes
  add column default_team_id uuid references teams(id);


-- ---------------------------------------------------------------------------
-- team_allocations
--
-- One athlete allocated to one team for one week. This is the weekly decision, and it is
-- history preserving: a change writes a new row and points the old one at it.
-- ---------------------------------------------------------------------------

create table team_allocations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id),
  team_id         uuid not null references teams(id),
  athlete_id      uuid not null references athletes(id),
  season_id       uuid references seasons(id),
  -- ISO Monday in the organisation timezone. Not every team plays every week, and a club
  -- allocates a 3rd XV for a weekend on which that team has no fixture in Fydr, so the
  -- week is the key and fixture_id is set where a fixture exists.
  week_start      date not null,
  fixture_id      uuid references fixtures(id),
  status          team_allocation_status not null default 'draft',
  source          team_allocation_source not null default 'manual',
  -- Snapshotted so that a later change is visible as a change rather than rewriting what
  -- the coach decided against.
  availability_at_allocation availability_status,
  override_reason text,
  -- Coach authored, coach visible, never a clinical field. Same rule as availability.note.
  note            text,
  published_at    timestamptz,
  published_by    uuid references users(id),
  revision_of     uuid references team_allocations(id),
  superseded_by   uuid references team_allocations(id),
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  check (status <> 'published' or published_at is not null),
  check (availability_at_allocation = 'available' or override_reason is not null
         or availability_at_allocation is null),
  check (week_start = date_trunc('week', week_start)::date)
);

-- The exclusivity rule, and the whole reason this is not group_memberships: an athlete has
-- at most one live allocation for a week. A partial unique index rather than a trigger,
-- deliberately: two coaches allocating the same athlete to two teams at the same moment is
-- the exact race this must survive, and a database constraint is the only thing that does.
create unique index team_allocations_one_team_per_week
  on team_allocations (athlete_id, week_start)
  where deleted_at is null and superseded_by is null and status <> 'withdrawn';
