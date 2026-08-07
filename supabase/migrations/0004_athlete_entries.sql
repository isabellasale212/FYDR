-- 0004_athlete_entries.sql
--
-- What this does
--   Creates the athlete submitted entry tables that are in Phase 0 scope:
--   wellness_entries, training_entries and nutrition_checkins.
--
-- Which spec sections this implements
--   04-data-model.md §5 (common entry shape, wellness_entries, training_entries)
--   04-data-model.md §17.15 (nutrition_checkins, the weekly one question check in)
--   decisions/adr-005-immutable-entries.md (revision_of and superseded_by on every table)
--
-- Scope note
--   nutrition_entries is dormant (CLAUDE.md rule 8, O-11 resolved 5 August 2026: athletes
--   do not log nutrition) and gym_session_logs and gym_set_logs are Phase 2. Neither is
--   created here. The ONE nutrition thing an athlete submits is the weekly check in below.
--
-- The rule that shapes all three tables
--   CLAUDE.md §2 rule 6 and ADR-005: entries are immutable once submitted. A correction
--   inserts a new row referencing the row it replaces. There are no update grants on these
--   tables for any application role, which is enforced in 0012 by the absence of a policy.
--
-- Scale direction, CONTRACT.md rule 6 and 04-data-model.md §5
--   Every 1 to 5 scale runs 5 = best, INCLUDING soreness, where 5 means not sore. This is
--   counter intuitive and is the single most likely source of an inverted chart bug. It is
--   fixed this way so readiness_score is a simple sum and every chart points one way.

-- ---------------------------------------------------------------------------
-- wellness_entries
-- ---------------------------------------------------------------------------

create table wellness_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id),
  athlete_id    uuid not null references athletes(id),
  entry_date    date not null,

  sleep_hours    numeric(3,1),
  sleep_quality  int,
  fatigue        int,        -- 5 = fresh
  soreness       int,        -- 5 = no soreness
  soreness_areas text[],
  stress         int,        -- 5 = relaxed
  mood           int,        -- 5 = very positive
  resting_hr     int,
  body_mass_kg   numeric(5,2),
  comment        text,

  -- Computed on write by the trigger in 0010. 0 to 100, higher is better.
  readiness_score numeric(5,2),

  source        data_source not null default 'self_report',
  submitted_at  timestamptz not null default now(),
  revision_of   uuid references wellness_entries(id),
  -- deferrable so a revision can be written as "close the old row, then insert the new
  -- one". The partial unique index below permits exactly one live row per athlete per day,
  -- so the close must land first, which means the reference points at a row that does not
  -- exist yet until the statement after it. ADR-005 already requires a client generated
  -- id for idempotency, which is what makes that order possible.
  superseded_by uuid references wellness_entries(id) deferrable initially deferred,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),

  unique (athlete_id, entry_date, revision_of),

  -- Range checks, per 10-roadmap.md §3 "every range check constraint".
  check (sleep_hours   is null or (sleep_hours   >= 0 and sleep_hours <= 14)),
  check (sleep_quality is null or (sleep_quality between 1 and 5)),
  check (fatigue       is null or (fatigue       between 1 and 5)),
  check (soreness      is null or (soreness      between 1 and 5)),
  check (stress        is null or (stress        between 1 and 5)),
  check (mood          is null or (mood          between 1 and 5)),
  check (resting_hr    is null or (resting_hr between 20 and 220)),
  check (body_mass_kg  is null or (body_mass_kg between 30 and 250)),
  check (comment       is null or char_length(comment) <= 1000),
  -- A row may not supersede itself, and a revision may not be its own parent. Chains are
  -- linear, ADR-005 rule 1.
  check (superseded_by is null or superseded_by <> id),
  check (revision_of   is null or revision_of   <> id)
);

-- ADR-005 rule 3: one live revision per athlete per day. The partial index is what makes
-- an offline queue replaying twice safe.
create unique index wellness_entries_one_live_per_day
  on wellness_entries (athlete_id, entry_date) where superseded_by is null;

comment on column wellness_entries.soreness is
  '1 to 5 where 5 = NOT SORE. CONTRACT.md rule 6. Do not invert this in a chart.';


-- ---------------------------------------------------------------------------
-- training_entries
--
-- Session RPE, Borg CR10. 04-data-model.md §5 notes RPE should be collected at least 30
-- minutes after the session ends, because RPE taken immediately is biased by the final
-- drill. That timing is enforced by the notification scheduler, not by the schema.
-- ---------------------------------------------------------------------------

create table training_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id),
  athlete_id    uuid not null references athletes(id),
  session_id    uuid references sessions(id),
  entry_date    date not null,
  rpe           numeric(3,1) not null,
  duration_min  int not null,
  -- rpe * duration_min, computed on write by the trigger in 0010.
  session_load  numeric(8,1),
  comment       text,
  source        data_source not null default 'self_report',
  submitted_at  timestamptz not null default now(),
  revision_of   uuid references training_entries(id),
  -- Deferrable for the same reason as wellness_entries.superseded_by.
  superseded_by uuid references training_entries(id) deferrable initially deferred,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),

  check (rpe between 1 and 10),
  check (duration_min > 0 and duration_min <= 600),
  check (comment is null or char_length(comment) <= 1000),
  check (superseded_by is null or superseded_by <> id),
  check (revision_of   is null or revision_of   <> id)
);

-- One live entry per athlete per session per day. session_id is nullable for ad hoc work,
-- so the index coalesces it to a fixed sentinel rather than letting nulls multiply rows.
create unique index training_entries_one_live_per_session
  on training_entries (athlete_id, entry_date,
                       coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where superseded_by is null;


-- ---------------------------------------------------------------------------
-- nutrition_checkins, 04-data-model.md §17.15
--
-- One question, once a week, three answers: "did you hit your protein target most days
-- this week?". This is NOT daily nutrition logging, which does not exist in Fydr.
-- Missing it is not non-compliance and generates no compliance_expectations row.
-- ---------------------------------------------------------------------------

create table nutrition_checkins (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id),
  athlete_id     uuid not null references athletes(id),

  -- The week being reported on, not the week the answer was given in.
  week_start     date not null,
  -- Stored, not derived at read time, because every staff label and every CSV export says
  -- "week 32", and deriving that in three places is how "week 32" comes to mean two
  -- different weeks either side of a new year. The checks keep the three from disagreeing.
  iso_year       int not null,
  iso_week       int not null,

  answer         nutrition_checkin_answer not null,
  note           text,

  -- Provenance of the question. If a coach raises the protein target in October, an answer
  -- of 'yes' recorded in September did not mean the October number. Both nullable: an
  -- athlete with no target is asked anyway and the null is honest about what they answered
  -- against. The foreign key to nutrition_targets is deliberately absent because that
  -- table is Phase 2 (nutrition-plans.md); the id is retained as a plain uuid so the
  -- reference can be added additively without a data migration.
  nutrition_target_id uuid,
  protein_target_g    numeric(6,1),

  source         data_source not null default 'self_report',
  submitted_at   timestamptz not null default now(),
  revision_of    uuid references nutrition_checkins(id),
  -- Deferrable for the same reason as wellness_entries.superseded_by.
  superseded_by  uuid references nutrition_checkins(id) deferrable initially deferred,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  check (week_start = date_trunc('week', week_start)::date),
  check (iso_year = extract(isoyear from week_start)::int),
  check (iso_week = extract(week    from week_start)::int),
  check (note is null or char_length(note) <= 280),
  check (superseded_by is null or superseded_by <> id),
  check (revision_of   is null or revision_of   <> id)
);

-- One live check in per athlete per week. Enforced by the database rather than the client,
-- because an offline queue replaying twice is the exact race it must survive.
create unique index nutrition_checkins_one_live_per_week
  on nutrition_checkins (athlete_id, week_start)
  where deleted_at is null and superseded_by is null;

comment on table nutrition_checkins is
  'Weekly one question protein check in, 04-data-model.md §17.15. Not daily logging. '
  'Generates no compliance_expectations and is never a compliance score.';
