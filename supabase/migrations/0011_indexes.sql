-- 0011_indexes.sql
--
-- What this does
--   Creates the minimum index set for the Phase 0 tables.
--
-- Which spec sections this implements
--   04-data-model.md §15 (indexing: the minimum set)
--   04-data-model.md §17.11 and §17.13 (indexes for thresholds, flags and teams)
--
-- The rule
--   "Add more when a query proves slow, not speculatively." 04-data-model.md §15. Every
--   index below is either the tenancy index that every RLS predicate uses, or the leading
--   column of an access pattern named in a screen specification.
--
-- Uniqueness constraints that carry meaning rather than performance live with their tables
-- in 0002 to 0006: seasons_one_current, team_allocations_one_team_per_week,
-- wellness_entries_one_live_per_day, training_entries_one_live_per_session,
-- nutrition_checkins_one_live_per_week and availability_one_open_per_athlete.

-- ---------------------------------------------------------------------------
-- Tenancy: every club data table. Every RLS policy opens with org_id = auth_org_id(),
-- so this is the index the entire access control layer reads through.
-- ---------------------------------------------------------------------------

create index on users              (org_id) where deleted_at is null;
create index on user_roles         (org_id);
create index on user_roles         (user_id);
create index on athletes           (org_id) where deleted_at is null;
create index on athlete_consents   (org_id);
create index on groups             (org_id) where deleted_at is null;
create index on group_memberships  (org_id);
create index on seasons            (org_id) where deleted_at is null;
create index on fixtures           (org_id) where deleted_at is null;
create index on sessions           (org_id) where deleted_at is null;
create index on session_participants (org_id);
create index on session_attendance (org_id);
create index on week_templates     (org_id) where deleted_at is null;
create index on teams              (org_id) where deleted_at is null;
create index on team_allocations   (org_id) where deleted_at is null;
create index on wellness_entries   (org_id);
create index on training_entries   (org_id);
create index on nutrition_checkins (org_id) where deleted_at is null;
create index on injuries           (org_id) where deleted_at is null;
create index on injury_clinical    (org_id);
create index on availability       (org_id);
create index on thresholds         (org_id) where deleted_at is null;
create index on threshold_revisions (org_id);
create index on flags              (org_id);
create index on flag_actions       (org_id);
create index on compliance_expectations (org_id);
create index on notification_preferences (org_id);
create index on push_tokens        (org_id);

-- ---------------------------------------------------------------------------
-- Time series: the dominant access pattern on every athlete facing screen and every
-- baseline computation.
-- ---------------------------------------------------------------------------

create index on wellness_entries   (athlete_id, entry_date desc);
create index on training_entries   (athlete_id, entry_date desc);
create index on nutrition_checkins (athlete_id, week_start desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------------

create index on sessions  (org_id, starts_at);
create index on sessions  (fixture_id);
create index on fixtures  (org_id, kickoff_at);
create index on session_participants (session_id);
create index on session_participants (athlete_id) where athlete_id is not null;
create index on session_participants (group_id)   where group_id   is not null;
create index on session_attendance (athlete_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Teams and allocations, 04-data-model.md §17.13
-- ---------------------------------------------------------------------------

create unique index teams_unique_name
  on teams (org_id,
            coalesce(season_id, '00000000-0000-0000-0000-000000000000'::uuid),
            lower(name))
  where deleted_at is null;

create index on teams (org_id, rank) where deleted_at is null and status = 'active';
create index on athletes (default_team_id) where deleted_at is null;

create index on team_allocations (org_id, week_start) where deleted_at is null;
create index on team_allocations (team_id, week_start)
  where deleted_at is null and superseded_by is null;
create index on team_allocations (athlete_id, week_start desc) where deleted_at is null;
create index on team_allocations (fixture_id) where deleted_at is null;
-- The draft board query: what has this coach started and not published.
create index on team_allocations (org_id, week_start)
  where status = 'draft' and deleted_at is null and superseded_by is null;

-- ---------------------------------------------------------------------------
-- Injury and availability
-- ---------------------------------------------------------------------------

create index on injuries (athlete_id, onset_date desc) where deleted_at is null;
create index on injuries (org_id, status) where deleted_at is null and status <> 'closed';
-- Current status lookup. The partial unique index on (athlete_id) where effective_to is
-- null already serves this; this one covers the history read on an athlete profile.
create index on availability (athlete_id, effective_from desc);
create index on availability (injury_id) where injury_id is not null;

-- ---------------------------------------------------------------------------
-- Flags: the dashboard query, 04-data-model.md §15
-- ---------------------------------------------------------------------------

create index on flags (org_id, status, flag_date desc)
  where status in ('raised', 'notified');
create index on flags (athlete_id, flag_date desc);
create index on flags (threshold_id, flag_date desc);
create index on flag_actions (flag_id, taken_at desc);
create index on threshold_revisions (threshold_id, created_at desc);
create index on thresholds (org_id, domain) where is_active and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Compliance: the squad compliance screen reads a day at a time.
-- ---------------------------------------------------------------------------

create index on compliance_expectations (org_id, expectation_date, domain);
create index on compliance_expectations (athlete_id, expectation_date desc);

-- ---------------------------------------------------------------------------
-- Group membership as at a date, 04-data-model.md §15
-- ---------------------------------------------------------------------------

create index on group_memberships (group_id, athlete_id) where removed_at is null;
create index on group_memberships (athlete_id) where removed_at is null;

-- ---------------------------------------------------------------------------
-- Children's Code work queues, 04-data-model.md §17.16. Do not index computed age: it
-- changes every day and the index would be wrong by definition.
-- ---------------------------------------------------------------------------

create index on athletes (org_id)
  where activation_blocked_reason is not null and deleted_at is null;

create index on athletes (org_id)
  where parental_consent_recorded_at is null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Audit, 04-data-model.md §15
-- ---------------------------------------------------------------------------

create index on audit_log (org_id, occurred_at desc);
create index on audit_log (athlete_id, occurred_at desc);
create index on audit_log (action, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create index on notification_preferences (user_id);
create index on push_tokens (user_id) where is_active;
