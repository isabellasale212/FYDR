-- 0010_helper_functions_and_triggers.sql
--
-- What this does
--   1. The JWT claim helper functions every RLS policy is built on.
--   2. The Supabase custom access token hook that puts org_id, athlete_id and roles into
--      the token in the first place.
--   3. The maintenance triggers: updated_at, computed readiness and session load, and the
--      claims_version bump that makes a stale token detectable.
--   4. The Children's Code age functions from 04-data-model.md §17.16.
--   5. The two role scoped views that need those functions, including the sanitised
--      clinical view an athlete reads instead of injury_clinical.
--   6. The ADR-005 revision functions, which are the ONLY write path that may stamp
--      superseded_by, because no role has update on an entry table.
--
-- Which spec sections this implements
--   04-data-model.md §14 (helper functions, defined once, stable, security definer)
--   04-data-model.md §17.15 (auth_org_timezone)
--   04-data-model.md §17.16 (athlete_age_years, athlete_is_minor, athlete_age_view)
--   05-architecture.md §5 (the claim model and the hook, verbatim signature)
--   decisions/adr-005-immutable-entries.md (revise_*)
--
-- The rule these functions exist to satisfy
--   CONTRACT.md rule 2 and CLAUDE.md §2 rule 2: roles come from the JWT custom claim,
--   never from a client value, NEVER from a table read inside a policy. Querying
--   user_roles inside every policy causes recursive policy evaluation and destroys query
--   planning. Not one function below reads user_roles.

-- ===========================================================================
-- 1. JWT claim helpers
--
-- All five read only from request.jwt.claims. They are marked stable so the planner may
-- call them once per statement, and security definer so their behaviour cannot be altered
-- by a caller's search_path.
-- ===========================================================================

-- The raw claim object, or an empty object when there is no authenticated session.
-- Private helper: not granted to anon or authenticated.
create or replace function public.auth_claims()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function public.auth_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(public.auth_claims() ->> 'sub', '')::uuid;
$$;

create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(public.auth_claims() #>> '{app_metadata,org_id}', '')::uuid;
$$;

create or replace function public.auth_athlete_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(public.auth_claims() #>> '{app_metadata,athlete_id}', '')::uuid;
$$;

-- Unknown role strings are dropped rather than raising. A token carrying a role this
-- build does not know about must fail closed, not fail loudly in the middle of a policy.
create or replace function public.auth_roles()
returns public.app_role[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array(
      select r::public.app_role
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(public.auth_claims() #> '{app_metadata,roles}') = 'array'
            then public.auth_claims() #> '{app_metadata,roles}'
          else '[]'::jsonb
        end
      ) as t(r)
      where r in ('athlete', 'coach', 'medical', 'admin')
    ),
    '{}'::public.app_role[]
  );
$$;

create or replace function public.auth_has_any_role(p public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_roles() && p;
$$;

-- 04-data-model.md §17.15. Needed by the nutrition check in window policy, which is
-- expressed in the organisation's timezone rather than the server's.
create or replace function public.auth_org_timezone()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select o.timezone from public.organisations o where o.id = public.auth_org_id()),
    'Europe/London'
  );
$$;

comment on function public.auth_org_id() is
  'org_id from the JWT app_metadata claim. Never a table read. 04-data-model.md §14.';

revoke all on function public.auth_claims() from public, anon, authenticated;
grant execute on function public.auth_user_id()      to authenticated, anon, service_role;
grant execute on function public.auth_org_id()       to authenticated, anon, service_role;
grant execute on function public.auth_athlete_id()   to authenticated, anon, service_role;
grant execute on function public.auth_roles()        to authenticated, anon, service_role;
grant execute on function public.auth_has_any_role(public.app_role[])
                                                     to authenticated, anon, service_role;
grant execute on function public.auth_org_timezone() to authenticated, anon, service_role;


-- ===========================================================================
-- 2. The Supabase custom access token hook, 05-architecture.md §5
--
-- Runs inside Supabase Auth on every access token issue. The signature is the one
-- Supabase calls: one jsonb argument named event, returning jsonb. It must live in a
-- schema supabase_auth_admin can reach and must not be executable by application roles.
-- ===========================================================================

create schema if not exists auth_hooks;

create or replace function auth_hooks.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth_hooks
as $$
declare
  v_claims     jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_user_id    uuid  := (event ->> 'user_id')::uuid;
  v_org_id     uuid;
  v_roles      text[];
  v_athlete_id uuid;
  v_cv         int;
  v_status     public.user_status;
begin
  select u.org_id, u.status, u.claims_version
    into v_org_id, v_status, v_cv
  from public.users u
  where u.id = v_user_id
    and u.deleted_at is null;

  -- Unknown or deactivated user: issue a token with no authority at all. Every policy
  -- opens with org_id = auth_org_id(), so a null org_id matches nothing anywhere.
  if v_org_id is null or v_status in ('suspended', 'deactivated') then
    return jsonb_set(
      event,
      '{claims,app_metadata}',
      jsonb_build_object('org_id', null, 'roles', '[]'::jsonb, 'athlete_id', null, 'cv', 0),
      true
    );
  end if;

  select coalesce(array_agg(ur.role::text order by ur.role), '{}')
    into v_roles
  from public.user_roles ur
  where ur.user_id = v_user_id;

  select a.id into v_athlete_id
  from public.athletes a
  where a.user_id = v_user_id
    and a.deleted_at is null;

  v_claims := jsonb_set(v_claims, '{app_metadata}', jsonb_build_object(
    'org_id',     v_org_id,
    'roles',      to_jsonb(v_roles),
    'athlete_id', v_athlete_id,
    'cv',         coalesce(v_cv, 1)
  ), true);

  return jsonb_set(event, '{claims}', v_claims, true);
end;
$$;

grant usage on schema auth_hooks to supabase_auth_admin;
grant execute on function auth_hooks.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function auth_hooks.custom_access_token_hook(jsonb)
  from authenticated, anon, public;
grant select on public.users, public.user_roles, public.athletes to supabase_auth_admin;


-- ===========================================================================
-- 3. Maintenance triggers
-- ===========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organisations', 'users', 'athletes', 'athlete_consents', 'groups',
    'seasons', 'fixtures', 'sessions', 'week_templates', 'teams', 'team_allocations',
    'nutrition_checkins', 'injuries', 'injury_clinical', 'thresholds',
    'notification_preferences', 'push_tokens'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end $$;

-- readiness_score, 04-data-model.md §5:
--   (sleep_quality + fatigue + soreness + stress + mood) / 25 * 100
-- Missing components are excluded and the divisor adjusts, so an athlete who skipped one
-- slider still gets a comparable number rather than a depressed one. Flat unweighted sum
-- for v1; configurable per organisation weights are O-10.
create or replace function public.wellness_compute_readiness()
returns trigger
language plpgsql
as $$
declare
  v_sum   int := 0;
  v_count int := 0;
begin
  if new.sleep_quality is not null then
    v_sum := v_sum + new.sleep_quality; v_count := v_count + 1;
  end if;
  if new.fatigue is not null then
    v_sum := v_sum + new.fatigue;       v_count := v_count + 1;
  end if;
  if new.soreness is not null then
    v_sum := v_sum + new.soreness;      v_count := v_count + 1;
  end if;
  if new.stress is not null then
    v_sum := v_sum + new.stress;        v_count := v_count + 1;
  end if;
  if new.mood is not null then
    v_sum := v_sum + new.mood;          v_count := v_count + 1;
  end if;

  if v_count = 0 then
    new.readiness_score := null;        -- blank where data is missing, never zero
  else
    new.readiness_score := round((v_sum::numeric / (v_count * 5)) * 100, 2);
  end if;

  return new;
end;
$$;

create trigger wellness_entries_readiness
  before insert on public.wellness_entries
  for each row execute function public.wellness_compute_readiness();

-- session_load = rpe * duration_min, 04-data-model.md §5.
create or replace function public.training_compute_session_load()
returns trigger
language plpgsql
as $$
begin
  new.session_load := round(new.rpe * new.duration_min, 1);
  return new;
end;
$$;

create trigger training_entries_session_load
  before insert on public.training_entries
  for each row execute function public.training_compute_session_load();

-- 05-architecture.md §5 "Claim staleness". A role change bumps the version, the client is
-- told to refresh, and destructive operations compare the token's cv against this column.
create or replace function public.bump_claims_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set claims_version = claims_version + 1
   where id = coalesce(new.user_id, old.user_id);
  return null;
end;
$$;

create trigger user_roles_bump_claims_version
  after insert or update or delete on public.user_roles
  for each row execute function public.bump_claims_version();


-- ===========================================================================
-- 4. Children's Code age functions, 04-data-model.md §17.16
--
-- Minority is DERIVED, never stored. A stored is_minor boolean is correct until midnight
-- on a birthday, at which point it silently becomes a lie and nothing notices.
-- ===========================================================================

-- stable, not immutable: it depends on the clock, which is exactly why the result must
-- never be persisted, indexed, or used in a generated column.
create or replace function public.athlete_age_years(p_dob date, p_at date default current_date)
returns int
language sql
stable
as $$
  select case when p_dob is null then null
              else extract(year from age(p_at, p_dob))::int end;
$$;

-- The null case defaults to true deliberately. An athlete with no date of birth cannot be
-- invited or activated (athletes_dob_required_when_linked), so the only way to reach this
-- with a null is a data path that should not exist. Applying the stricter defaults costs a
-- leaderboard entry; the other failure puts a fifteen year old on a public ranking.
create or replace function public.athlete_is_minor(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when a.date_of_birth is null then true
    else public.athlete_age_years(a.date_of_birth) < 18
  end
  from public.athletes a
  where a.id = p_athlete_id;
$$;

comment on function public.athlete_is_minor(uuid) is
  'security definer because policies and views call it for athletes the caller may not be '
  'able to read a full row for. It exposes one boolean about one athlete id, nothing else.';

grant execute on function public.athlete_age_years(date, date) to authenticated, service_role;
grant execute on function public.athlete_is_minor(uuid)         to authenticated, service_role;


-- ===========================================================================
-- 5. Role scoped views
-- ===========================================================================

-- 04-data-model.md §17.16. Deliberately security_invoker so the athletes policies apply:
-- a view is the classic way an RLS policy gets bypassed by accident, and this one must not
-- be that. It exists so a screen that only needs to know whether protections apply never
-- receives date_of_birth.
create or replace view public.athlete_age_view with (security_invoker = true) as
  select a.id     as athlete_id,
         a.org_id,
         public.athlete_age_years(a.date_of_birth) as age_years,
         (public.athlete_age_years(a.date_of_birth) < 18
           or a.date_of_birth is null) as is_minor,
         (public.athlete_age_years(a.date_of_birth) < 13
           or a.date_of_birth is null) as is_under_13
  from public.athletes a
  where a.deleted_at is null;

grant select on public.athlete_age_view to authenticated;


-- ---------------------------------------------------------------------------
-- injury_clinical_athlete_view
--
-- The ONE deliberate definer rights view in the schema, and the reason is the rule in
-- 01-roles-and-permissions.md §4 read together with CONTRACT.md rule 3.
--
-- 04-data-model.md §14 sketches an athlete select policy on injury_clinical itself and
-- then notes "athlete visible columns are exposed through a view that excludes
-- clinical_notes". Those two cannot both hold: a select policy on the base table lets an
-- athlete run "select clinical_notes from injury_clinical" directly through PostgREST, and
-- column privileges cannot help because coach, medical, athlete and admin all connect as
-- the single database role authenticated.
--
-- So the athlete gets NO policy on injury_clinical. The table is medical only for every
-- operation, which is what CONTRACT.md rule 3 and the exit gate test require. This view is
-- the athlete's only path to their own non note clinical detail, and because there is no
-- underlying policy for it to inherit it runs with the owner's rights and carries its own
-- predicates instead:
--
--   org_id = auth_org_id()          the tenancy predicate, exactly as a policy would
--   a.user_id = auth_user_id()      the subject predicate, checked against the JWT and not
--                                   against anything the caller can supply
--
-- A coach has no athlete row and therefore matches nothing. A user in another organisation
-- matches nothing. clinical_notes is not in the select list, so no column privilege, join
-- or "select *" reaches it.
--
-- security_barrier stops a user supplied volatile function in a WHERE clause being pushed
-- below the view's own predicates and leaking rows it filters out.
--
-- 01-roles-and-permissions.md §4, athlete column:
--   mechanism yes, diagnosis yes, imaging and referrals yes, treatment record partial,
--   clinical notes NO.
-- ---------------------------------------------------------------------------

create or replace view public.injury_clinical_athlete_view
  with (security_barrier = true) as
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
         -- clinical_notes is absent. It is absent here and nowhere else in the product.
  from public.injury_clinical ic
  join public.injuries i on i.id = ic.injury_id
  join public.athletes a on a.id = i.athlete_id
  where ic.org_id  = public.auth_org_id()
    and i.org_id   = public.auth_org_id()
    and a.org_id   = public.auth_org_id()
    and a.user_id  = public.auth_user_id()
    and a.user_id is not null
    and a.deleted_at is null
    and i.deleted_at is null;

comment on view public.injury_clinical_athlete_view is
  'The only athlete readable path to clinical detail. Excludes clinical_notes. Owner '
  'rights by design, with its own org and subject predicates. 01-roles-and-permissions '
  'md §4 carve out 1 and CONTRACT.md rule 3.';

grant select on public.injury_clinical_athlete_view to authenticated;


-- ===========================================================================
-- 6. Revision functions, ADR-005
--
-- No role has update on an entry table, so stamping superseded_by is impossible from a
-- client. These functions are the only write path that can do it.
--
-- ADR-005 writes revise_wellness_entry as security invoker. It cannot be: with no update
-- policy on wellness_entries, an invoker rights update matches zero rows and the chain is
-- never closed. They are therefore security definer, and each one performs, in place of
-- RLS, exactly the check the policies would have performed (05-architecture.md §5 rule 3
-- applies the same discipline to service_role code):
--
--   1. the original row is in the caller's organisation
--   2. the caller is that athlete, or holds coach or medical in that organisation
--   3. only the current revision may be revised, so chains stay linear
--   4. org_id, athlete_id and entry_date are copied, never taken from the payload, so a
--      revision can never move an entry to another day, athlete or club
-- ===========================================================================

create or replace function public.revise_wellness_entry(
  p_original_id uuid,
  p_new_id      uuid,
  p_payload     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid := public.auth_org_id();
  v_athlete  uuid := public.auth_athlete_id();
  v_original public.wellness_entries;
  v_new_id   uuid;
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_original
  from public.wellness_entries
  where id = p_original_id
    and org_id = v_org
    and superseded_by is null;      -- check 1 and check 3

  if v_original.id is null then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  -- check 2
  if not (v_original.athlete_id = v_athlete
          or public.auth_has_any_role(array['coach','medical']::public.app_role[])) then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- Close the original first. The partial unique index permits one live row per athlete
  -- per day, so the new revision cannot land until this one is closed. The foreign key on
  -- superseded_by is deferred, which is what makes forward referencing p_new_id legal.
  update public.wellness_entries
     set superseded_by = p_new_id
   where id = p_original_id;

  -- check 4: identity columns come from the original, never from p_payload
  insert into public.wellness_entries (
    id, org_id, athlete_id, entry_date,
    sleep_hours, sleep_quality, fatigue, soreness, soreness_areas,
    stress, mood, resting_hr, body_mass_kg, comment,
    source, submitted_at, revision_of, created_by
  )
  values (
    p_new_id, v_original.org_id, v_original.athlete_id, v_original.entry_date,
    coalesce((p_payload ->> 'sleep_hours')::numeric,  v_original.sleep_hours),
    coalesce((p_payload ->> 'sleep_quality')::int,    v_original.sleep_quality),
    coalesce((p_payload ->> 'fatigue')::int,          v_original.fatigue),
    coalesce((p_payload ->> 'soreness')::int,         v_original.soreness),
    coalesce(
      case when jsonb_typeof(p_payload -> 'soreness_areas') = 'array'
           then array(select jsonb_array_elements_text(p_payload -> 'soreness_areas'))
      end, v_original.soreness_areas),
    coalesce((p_payload ->> 'stress')::int,           v_original.stress),
    coalesce((p_payload ->> 'mood')::int,             v_original.mood),
    coalesce((p_payload ->> 'resting_hr')::int,       v_original.resting_hr),
    coalesce((p_payload ->> 'body_mass_kg')::numeric, v_original.body_mass_kg),
    coalesce( p_payload ->> 'comment',                v_original.comment),
    v_original.source, now(), v_original.id, public.auth_user_id()
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.revise_training_entry(
  p_original_id uuid,
  p_new_id      uuid,
  p_payload     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid := public.auth_org_id();
  v_athlete  uuid := public.auth_athlete_id();
  v_original public.training_entries;
  v_new_id   uuid;
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_original
  from public.training_entries
  where id = p_original_id
    and org_id = v_org
    and superseded_by is null;

  if v_original.id is null then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  if not (v_original.athlete_id = v_athlete
          or public.auth_has_any_role(array['coach','medical']::public.app_role[])) then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- Close the original first, for the same reason as revise_wellness_entry.
  update public.training_entries
     set superseded_by = p_new_id
   where id = p_original_id;

  insert into public.training_entries (
    id, org_id, athlete_id, session_id, entry_date,
    rpe, duration_min, comment,
    source, submitted_at, revision_of, created_by
  )
  values (
    p_new_id, v_original.org_id, v_original.athlete_id, v_original.session_id,
    v_original.entry_date,
    coalesce((p_payload ->> 'rpe')::numeric,      v_original.rpe),
    coalesce((p_payload ->> 'duration_min')::int, v_original.duration_min),
    coalesce( p_payload ->> 'comment',            v_original.comment),
    v_original.source, now(), v_original.id, public.auth_user_id()
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.revise_nutrition_checkin(
  p_original_id uuid,
  p_new_id      uuid,
  p_answer      public.nutrition_checkin_answer,
  p_note        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid := public.auth_org_id();
  v_athlete  uuid := public.auth_athlete_id();
  v_original public.nutrition_checkins;
  v_new_id   uuid;
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_original
  from public.nutrition_checkins
  where id = p_original_id
    and org_id = v_org
    and superseded_by is null
    and deleted_at is null;

  if v_original.id is null then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  -- Only the athlete may revise a check in. There is no staff write path to this table at
  -- all: a coach guessing whether a player hit their protein target is not a self report.
  -- 04-data-model.md §17.15 property 2.
  if v_original.athlete_id is distinct from v_athlete then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- Close the original first, for the same reason as revise_wellness_entry.
  update public.nutrition_checkins
     set superseded_by = p_new_id
   where id = p_original_id;

  insert into public.nutrition_checkins (
    id, org_id, athlete_id, week_start, iso_year, iso_week,
    answer, note, nutrition_target_id, protein_target_g,
    source, submitted_at, revision_of, created_by
  )
  values (
    p_new_id, v_original.org_id, v_original.athlete_id, v_original.week_start,
    v_original.iso_year, v_original.iso_week,
    p_answer, coalesce(p_note, v_original.note),
    v_original.nutrition_target_id, v_original.protein_target_g,
    v_original.source, now(), v_original.id, public.auth_user_id()
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.revise_wellness_entry(uuid, uuid, jsonb) to authenticated;
grant execute on function public.revise_training_entry(uuid, uuid, jsonb) to authenticated;
grant execute on function public.revise_nutrition_checkin(
  uuid, uuid, public.nutrition_checkin_answer, text) to authenticated;


-- ===========================================================================
-- 7. Audit writer
--
-- audit_log has no update or delete path, so the only thing a writer needs is a safe
-- insert that cannot be pointed at another organisation. security definer so a caller
-- cannot suppress the write by lacking a privilege, with org_id and actor_id taken from
-- the claims rather than from arguments.
-- ===========================================================================

create or replace function public.write_audit_event(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid   default null,
  p_athlete_id  uuid   default null,
  p_metadata    jsonb  default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.audit_log (
    org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata
  )
  values (
    public.auth_org_id(),
    public.auth_user_id(),
    (public.auth_roles())[1],
    p_action, p_entity_type, p_entity_id, p_athlete_id, p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.write_audit_event(text, text, uuid, uuid, jsonb)
  to authenticated;
