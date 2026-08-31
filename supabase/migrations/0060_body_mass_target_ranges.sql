-- 0060_body_mass_target_ranges.sql
--
-- What this does
--   Gives staff somewhere to record the body-mass range they want an athlete to sit
--   in. The client's question was "why can I not set a target weight range?", and the
--   answer was that no such column existed anywhere in this schema: body_composition
--   (migration 0024) stores MEASUREMENTS only — body_mass_kg, body_fat_pct,
--   lean_mass_kg, sum_skinfolds_mm. The design spec's target range and "On target"
--   pill were consequently cut twice, and both cuts are recorded in code
--   (lib/queries/playerProfile.ts and lib/nutritionRules.ts). This migration is the
--   backing column those two comments said did not exist. Both comments are corrected
--   in the same change, because a stale "we cut this, there is no column" note is
--   exactly how the next person re-cuts a feature that now exists.
--
-- The four rules the client gave, and where each one lives
--   1. Staff-set only            -> the insert/update policies below (coach, medical)
--   2. NEVER visible to the athlete -> there is no athlete select policy on this table
--                                      AT ALL, and the table is separate precisely so
--                                      that is enforceable. See the next section.
--   3. A RANGE, low and high      -> target_low_kg and target_high_kg, both NOT NULL,
--                                    with a high > low check. There is deliberately no
--                                    single target_mass_kg column to drift back to.
--   4. NEVER on a leaderboard     -> nothing is added to metric_definitions, and
--                                    320_body_mass_target_ranges_test.sql §6 asserts
--                                    that structurally rather than by convention.
--
-- Why its OWN TABLE — the decision this migration is really about
--   The two obvious homes are both wrong, and wrong in the identical way migration
--   0055 documents for problem_reports. PostgreSQL RLS is ROW-level, not column-level.
--   It cannot hide a column from a role that is allowed the row. And BOTH candidate
--   tables hand the athlete their own row on purpose:
--     * athletes            -> athletes_self_select (migration 0027)
--     * body_composition    -> body_composition_self_select (0024:234-236),
--                              "org_id = auth_org_id() and athlete_id = auth_athlete_id()"
--   So a target_low_kg column on either one is readable by the athlete it is about
--   through a single direct PostgREST column select, whatever the staff UI renders.
--   Rule 2 would then be a promise made by the interface and broken by the database.
--
--   body_composition carries a THIRD leak path on top of RLS, which settles it beyond
--   argument: lib/queries/sarPackAssembly.ts:67 does
--   `admin.from('body_composition').select('*')` with the SERVICE-ROLE client to build
--   the athlete's own subject access pack. A column added there is handed to the
--   athlete automatically, by a code path that bypasses RLS by design and that nobody
--   adding a column would think to check.
--
--   The split is therefore structural, the same one this codebase already makes twice:
--   injuries / injury_clinical (CLAUDE.md rule 3) and problem_reports /
--   problem_report_notes (0055). A different table, a different policy set, never an
--   application-layer filter over a shared row. ADR-007 forbids column-filtered
--   sensitivity inside one table as a general rule.
--
--   SUBJECT ACCESS, stated rather than assumed: this table is NOT added to
--   sarPackAssembly.ts. That follows the client's rule 2 literally, and it is a
--   deliberate choice recorded here rather than an omission — whether a staff-set
--   target range is personal data an athlete may demand under a subject access request
--   is a legal question for the club, not one this migration should answer silently.
--   If the answer ever comes back "yes, disclose it", that is one line in
--   sarPackAssembly.ts plus a conversation with the client, not a schema change.
--
-- Which roles, and why exactly these
--   Coach and medical, for read and for write. Athlete and admin get nothing.
--     Coach: `coach` is the role every S&C and nutrition staff member in this schema
--       actually holds. There is NO `nutritionist` value in app_role — migration 0001
--       defines exactly 'athlete', 'coach', 'medical', 'admin' — and that missing role
--       has already cost this project once. This is not an inference: supabase/seed.sql
--       :87-89 seeds the demo club's nutritionist, Kate Doyle, with the `coach` role and
--       says so in a comment ("There is no nutritionist role: 01-roles-and-permissions
--       .md §1 has four roles and a nutritionist is a coach for authorisation
--       purposes"). Excluding coach would lock out, by name, the one person on the
--       seeded staff list whose job this is.
--     Medical: return-to-play mass management is squarely theirs, and a body-mass
--       target range carries disordered-eating risk that the club physio is the right
--       person to be able to see and correct. Deliberately NOT narrowed to athletes
--       with an open injury the way 0019 narrows medical on nutrition_targets: that
--       narrowing would let a physio set a range during rehab and then be unable to
--       correct it the week the athlete came back, which is worse than not granting it.
--     Together they are exactly the pair that may already write body_composition
--       itself (0024:238-247). Whoever may record the measurement may set the range it
--       is judged against; anything narrower would be incoherent, and anything wider
--       breaks rule 1.
--     Admin: no access, matching every other per-athlete data domain in this schema,
--       and matching the gap migration 0020 had to go back and close for
--       resolve_nutrition_targets.
--
-- History: superseded, never overwritten
--   A target range that moves across a season is a real thing a nutritionist wants to
--   look back on — "what were we asking of him in pre-season?" is a question the data
--   should be able to answer — so this is an effective-dated interval, the same grammar
--   nutrition_targets (0019) and availability already use, and the BOUNDS are immutable
--   once written. Staff may CLOSE a range (effective_to) or retract it (deleted_at);
--   they may not rewrite what it was. A correction is a new row.
--
--   That immutability needs a trigger, not a policy: a WITH CHECK sees only NEW and
--   cannot tell which columns moved. Migration 0040's header states the same
--   constraint, and 0028/0029's enforce_athletes_self_update_columns is the shape
--   copied here — including 0029's hard-won lesson that a trigger fires for SECURITY
--   DEFINER and table-owner writes too, so it must let the service path through
--   explicitly rather than by accident.

create table body_mass_target_ranges (
  id             uuid primary key default gen_random_uuid(),
  -- Rule 1. Also what puts this table into tests.club_tables(), so the cross-tenant
  -- suite sweeps it from the next run whether anyone remembered it or not.
  org_id         uuid not null references organisations(id),
  athlete_id     uuid not null references athletes(id),

  -- Rule 3: a range. Both NOT NULL — a half-open range is not a range, and a nullable
  -- high bound is a single target wearing a range's clothes.
  target_low_kg  numeric(5,2) not null,
  target_high_kg numeric(5,2) not null,

  -- Staff context, the same affordance nutrition_targets.reason gives a personal
  -- macro target ("return to play, energy reduced during limited training"). Staff-only
  -- like every other column here, so it can say what a note shown to the athlete could
  -- not.
  rationale      text,

  -- Rule 1 again, at the row level: forced to the acting user in the WITH CHECK below
  -- rather than trusted from the client, the same way 0055 pins created_by.
  set_by         uuid not null references users(id),
  set_at         timestamptz not null default now(),

  -- The history mechanism. effective_to null means live; one live range per athlete
  -- (unique index below). A new target closes the old row and inserts a new one.
  effective_from date not null default current_date,
  effective_to   date,

  updated_at     timestamptz not null default now(),
  -- Rule 4 (CLAUDE.md): never hard-deleted. Staff may retract a range by setting this;
  -- no authenticated role holds a DELETE privilege, so a hard delete raises 42501.
  deleted_at     timestamptz,

  -- Rule 3, enforced. Strictly greater: a zero-width range is the single number the
  -- client explicitly said not to build.
  constraint body_mass_target_ranges_is_a_range
    check (target_high_kg > target_low_kg),
  -- A plausible human range. Not clinical judgement — a guard against a fat-fingered
  -- decimal point silently becoming a target nobody notices is absurd.
  constraint body_mass_target_ranges_plausible
    check (target_low_kg >= 30.00 and target_high_kg <= 250.00),
  constraint body_mass_target_ranges_interval
    check (effective_to is null or effective_to >= effective_from),
  constraint body_mass_target_ranges_rationale_bounded
    check (rationale is null or (char_length(rationale) <= 500 and btrim(rationale) <> ''))
);

comment on table body_mass_target_ranges is
  'The body-mass range STAFF want an athlete in. Coach and medical only, for read and '
  'write, org-scoped. NEVER visible to the athlete it is about and NEVER rankable: '
  'there is no athlete select policy on this table at all, and no metric_definitions '
  'row points at it, which is what makes both of those structural rather than a UI '
  'convention. Deliberately a separate table rather than a column on athletes or '
  'body_composition, because both of those grant the athlete a row select and RLS is '
  'row-level, not column-level — and because sarPackAssembly.ts select(*)s '
  'body_composition with the service-role client straight into the athlete''s own '
  'subject access pack. Same structural split as injuries/injury_clinical and '
  'problem_reports/problem_report_notes. Effective-dated: the bounds are immutable '
  'once written, a change is a new row, so a season''s target history survives. '
  'Distinct from computeMassBand (lib/nutritionRules.ts), which is where the athlete '
  'HAS been; this is where staff want them.';

comment on column body_mass_target_ranges.target_low_kg is
  'Low bound, kg. Paired with target_high_kg — this table has no single-target column '
  'by design (client rule 3).';
comment on column body_mass_target_ranges.effective_to is
  'Null means live. Closing a range is how a target is changed; the bounds themselves '
  'are immutable (see the guard trigger below).';

-- One live range per athlete. A second open row is a data-integrity bug, not a history
-- entry: history is made by closing the old row, not by leaving two open. Same shape as
-- nutrition_targets_one_live_per_scope (0019).
create unique index body_mass_target_ranges_one_live
  on body_mass_target_ranges (org_id, athlete_id)
  where deleted_at is null and effective_to is null;

-- The profile-page lookup: this athlete's ranges, newest first, which is the order the
-- history is read in.
create index body_mass_target_ranges_athlete
  on body_mass_target_ranges (athlete_id, effective_from desc)
  where deleted_at is null;

create trigger body_mass_target_ranges_set_updated_at
  before update on body_mass_target_ranges
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- The bounds are immutable. A correction is a new row.
--
-- Why a trigger and not a policy: an UPDATE policy's WITH CHECK sees only NEW. It
-- cannot compare against OLD and therefore cannot tell which columns moved — migration
-- 0040's header states the same limitation for its own stamps. Only effective_to and
-- deleted_at (plus updated_at, set by the trigger above) may move.
--
-- The `auth_user_id() is null` escape is 0029's lesson, not decoration: a trigger fires
-- for SECURITY DEFINER helpers, migrations and service-role scripts too, all of which
-- already bypass RLS and grants by design, and 0028 shipped a bug precisely by not
-- letting them through. The audited erasure path needs to be able to write here.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_body_mass_target_range_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No JWT at all: a migration, a fixture, or the audited service-role erasure path.
  -- The same actors RLS already trusts for a full-column write.
  if auth_user_id() is null then
    return new;
  end if;

  if new.org_id          is distinct from old.org_id
     or new.athlete_id     is distinct from old.athlete_id
     or new.target_low_kg  is distinct from old.target_low_kg
     or new.target_high_kg is distinct from old.target_high_kg
     or new.rationale      is distinct from old.rationale
     or new.set_by         is distinct from old.set_by
     or new.set_at         is distinct from old.set_at
     or new.effective_from is distinct from old.effective_from
  then
    raise exception 'body_mass_target_ranges: a target range is not edited in place — close it with effective_to and insert a new row'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger body_mass_target_ranges_immutable
  before update on body_mass_target_ranges
  for each row execute function public.enforce_body_mass_target_range_immutable();


-- ---------------------------------------------------------------------------
-- Privileges and policies
--
-- Revoke first, then grant narrowly, in this same migration — the lesson 0013, 0017
-- and 0019 each record, so 010_rls_coverage_test.sql's "anon holds no privilege"
-- assertion has nothing to find.
--
-- No DELETE for authenticated: CLAUDE.md rule 4. A hard delete raises 42501 rather
-- than quietly matching zero rows, and the test asserts that code.
-- ---------------------------------------------------------------------------

alter table body_mass_target_ranges enable row level security;
revoke all on public.body_mass_target_ranges from public, anon, authenticated;
grant select, insert, update on public.body_mass_target_ranges to authenticated;
grant select, insert, update, delete on public.body_mass_target_ranges to service_role;

-- Read: coach and medical, org-scoped. This is the ONLY select policy on the table, so
-- every other role — the athlete it is about first among them — reads nothing: not the
-- bounds, not the count, not the existence. Client rule 2.
create policy body_mass_target_ranges_staff_select on public.body_mass_target_ranges for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

-- Write: coach and medical, in their own name, against an athlete who really is one of
-- their own organisation's.
--
-- set_by = auth_user_id() is the WITH CHECK, not a trigger, for the reason 0055 gives:
-- an insert has no OLD row, so the row-level check is sufficient and is the whole rule.
--
-- The exists() is the cross-tenant guard org_id alone does not give: without it, orgb's
-- coach could pass their OWN org_id and orga's athlete_id and hang a target range off
-- another organisation's player. The subquery runs as the calling user and is therefore
-- subject to athletes' own RLS, so it resolves only within the caller's org.
create policy body_mass_target_ranges_staff_insert on public.body_mass_target_ranges for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach','medical']::app_role[])
    and set_by = auth_user_id()
    and deleted_at is null
    and exists (
      select 1 from athletes a
      where a.id = athlete_id
        and a.org_id = auth_org_id()
        and a.deleted_at is null
    )
  );

-- Update: the ONLY legitimate updates are closing a range (effective_to) and retracting
-- it (deleted_at). The immutability trigger above is what enforces that; this policy is
-- the tenancy and role half of it.
create policy body_mass_target_ranges_staff_update on public.body_mass_target_ranges for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[]));

-- No delete policy, for anybody. See the header and CLAUDE.md rule 4.

-- Nothing is inserted into metric_definitions. Client rule 4: this is never rankable,
-- and migration 0016's own design is what makes that structural — "leaderboard ->
-- everything" is safe only because "everything" means everything in that catalogue,
-- and leaderboards.metric_key is a foreign key into it. No catalogue row here means no
-- board can name it, and authenticated holds SELECT only on metric_definitions so no
-- client can add one. 320_body_mass_target_ranges_test.sql §6 asserts all four locks.


-- ---------------------------------------------------------------------------
-- Starter data: one range against the demo org's own seeded squad, so the player
-- profile and the nutrition workspace show the target-range affordance in its
-- non-empty state rather than only its empty one.
--
-- Attributed to Kate Doyle (e5e2...000c), the demo club's NUTRITIONIST, who holds the
-- `coach` role — seed.sql:87-89. That is deliberate: the seeded story should show the
-- role grant above doing the job it was granted for, rather than routing a nutrition
-- decision through the head coach to avoid the point.
--
-- The subject is Adam Selby (a71e...0007), the flanker every other seeded story in this
-- project already attaches to (0040's problem report, 0055's triage note). His seeded
-- mass is 104.90 kg, so 103.50-106.50 brackets where he actually is rather than
-- contradicting his own weigh-ins — a target range the demo data can be read against.
--
-- Guarded by a `select ... where exists` on both referenced ids, so this migration is a
-- no-op on any database that does not carry the demo seed. The pgTAP fixtures build
-- their own organisations and must not acquire a stray row from a migration.
-- ---------------------------------------------------------------------------

insert into body_mass_target_ranges
  (id, org_id, athlete_id, target_low_kg, target_high_kg, rationale, set_by, effective_from)
select
  'fb0d0000-0000-4000-8000-000000000001'::uuid,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'a71e0000-0000-4000-8000-000000000007'::uuid,
  103.50,
  106.50,
  'Holding him where he is through the block rather than chasing mass on. Reweigh Monday and Thursday, before breakfast, same scales.',
  'e5e20000-0000-4000-8000-00000000000c'::uuid,
  current_date - 30
where exists (select 1 from athletes  a where a.id = 'a71e0000-0000-4000-8000-000000000007')
  and exists (select 1 from users     u where u.id = 'e5e20000-0000-4000-8000-00000000000c')
on conflict (id) do nothing;
