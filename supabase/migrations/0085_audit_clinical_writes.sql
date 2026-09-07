-- Audit injuries, injury_clinical and availability at the database, not in the app.
--
-- WHY A TRIGGER AND NOT 105 INSERTS. A sweep on 2026-09-07 found four write
-- paths in this codebase that write to audit_log and 105 that do not, including
-- every one this migration covers: createInjury, updateInjuryFields,
-- upsertClinical and setAvailability. Two facts made "add an insert to each"
-- the wrong answer:
--
--   * The mutations in src/lib/queries run IN THE BROWSER, through the anon
--     key. audit_log's insert policy is `org_id = auth_org_id() AND actor_id =
--     auth_user_id()`, so the row is written by the same client doing the
--     thing: it chooses the action, the metadata, and whether to write at all.
--     A self-reported trail is advisory, and this is the table a club would be
--     asked for if a clinical record were disputed.
--   * 105 call sites is 105 places to forget, and new ones are added weekly.
--
-- A trigger fires whichever path wrote, cannot be skipped by a client, and is
-- one place. It also gets a REAL client address, which the app layer cannot:
-- the browser talks to PostgREST directly, so request.headers carries the
-- visitor rather than a serverless function. That is the exact inverse of the
-- auth.sessions.ip problem fixed the same day, where our own server was the
-- caller and the visitor's address had to be forwarded to be seen at all.
--
-- WHAT THIS DOES NOT COVER, stated because the incident that prompted it was
-- exactly this case: a superuser connection below the application layer
-- bypasses triggers as completely as it bypasses the app. On 2026-09-07 two
-- rows were removed that way and nothing recorded it. Triggers cover strictly
-- more than app code did; they do not cover that.
--
-- Three tables to start, on purpose. The pattern is proved end to end here and
-- widened by table afterwards, rather than fifty tables changed at once on an
-- untested mechanism.

-- ---------------------------------------------------------------------------
-- The actor's role, matching lib/access.ts's actingRole() exactly.
--
-- Roles are additive and audit_log.actor_role takes ONE value, so a choice has
-- to be made. Medic first, then reach: if a clinical write could have been
-- authorised by medical access, that is the fact worth keeping. This list is
-- duplicated from TypeScript deliberately — the trigger cannot call into the
-- app — and the two are asserted equal in scripts/test-audit-triggers.ts so
-- they cannot drift into disagreeing about who did something.
-- ---------------------------------------------------------------------------
create or replace function public.audit_acting_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select r
  from unnest(array[
    'medic', 'sport_scientist', 'coach', 'strength_conditioning', 'nutritionist'
  ]::public.app_role[]) with ordinality as p(r, ord)
  where r = any(public.auth_roles())
  order by p.ord
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- The caller's address, from PostgREST's request.headers GUC.
--
-- The LAST entry of x-forwarded-for, not the first, for the same reason
-- lib/clientAddress.ts takes the last: proxies APPEND the peer they received
-- from, so the rightmost hop was written by the nearest proxy and the leftmost
-- is whatever the client claimed. Taking the first hands the field to the
-- caller, in the one column anybody reads after a suspected intrusion.
--
-- Everything here is defensive: the GUC is absent outside a PostgREST request
-- (a psql session, a cron job, this migration), the header may be missing, and
-- the value may not be an address. Any of those yields null rather than an
-- error, because an audit trigger that can throw is a trigger that can block a
-- clinical write.
-- ---------------------------------------------------------------------------
create or replace function public.audit_client_ip()
returns inet
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
  v_xff     text;
  v_last    text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;
  if v_headers is null then return null; end if;

  v_xff := coalesce(v_headers ->> 'x-real-ip', v_headers ->> 'x-forwarded-for');
  if v_xff is null or btrim(v_xff) = '' then return null; end if;

  v_last := btrim(split_part(v_xff, ',', array_length(string_to_array(v_xff, ','), 1)));
  begin
    return v_last::inet;
  exception when others then
    return null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- The trigger itself, one function for all three tables.
--
-- Generic over the row shape via to_jsonb, because the three tables do not
-- agree on their own keys: injuries and availability have `id` and
-- `athlete_id`; injury_clinical has NEITHER — its primary key is `injury_id`
-- and the athlete is only reachable through the injury. A trigger written
-- against one shape would have silently recorded nulls for the medic-only
-- table, which is the one this exists for.
--
-- metadata carries the CHANGED FIELDS on an update, not the whole row. Two
-- reasons: injury_clinical holds diagnosis, clinical notes and treatment plan,
-- and copying those into a table the sport scientist can read would widen who
-- can see clinical detail — audit_log's select policy is sport_scientist only,
-- and medical data is separately gated (CLAUDE.md rule 3). So the metadata
-- records WHICH fields changed, never their values.
-- ---------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row        jsonb := to_jsonb(coalesce(new, old));
  v_old        jsonb := case when old is null then '{}'::jsonb else to_jsonb(old) end;
  v_entity     uuid;
  v_athlete    uuid;
  v_changed    text[];
  v_action     text;
begin
  v_entity  := nullif(coalesce(v_row ->> 'id', v_row ->> 'injury_id'), '')::uuid;
  v_athlete := nullif(v_row ->> 'athlete_id', '')::uuid;

  -- injury_clinical carries no athlete of its own; the injury it belongs to
  -- does, and attribution to a person is the point of the table.
  if v_athlete is null and (v_row ? 'injury_id') then
    select i.athlete_id into v_athlete
    from public.injuries i
    where i.id = (v_row ->> 'injury_id')::uuid;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key order by key), '{}')
      into v_changed
    from jsonb_each(to_jsonb(new)) n(key, value)
    where v_old -> n.key is distinct from n.value
      and n.key <> 'updated_at';
    -- Nothing but updated_at moved: a no-op write, not an event worth a row.
    if v_changed = '{}'::text[] then return coalesce(new, old); end if;
  end if;

  v_action := tg_table_name || '.' || lower(tg_op);

  insert into public.audit_log (
    org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata, ip_address
  )
  values (
    nullif(v_row ->> 'org_id', '')::uuid,
    public.auth_user_id(),
    public.audit_acting_role(),
    v_action,
    tg_table_name,
    v_entity,
    v_athlete,
    case when tg_op = 'UPDATE' then jsonb_build_object('changed', to_jsonb(v_changed)) else '{}'::jsonb end,
    public.audit_client_ip()
  );

  return coalesce(new, old);
end;
$$;

-- AFTER, so a write that fails its own constraints or RLS never produces an
-- audit row claiming it happened. FOR EACH ROW, so a multi-row update is not
-- collapsed into one entry.
drop trigger if exists injuries_audit on public.injuries;
create trigger injuries_audit
  after insert or update or delete on public.injuries
  for each row execute function public.audit_row_change();

drop trigger if exists injury_clinical_audit on public.injury_clinical;
create trigger injury_clinical_audit
  after insert or update or delete on public.injury_clinical
  for each row execute function public.audit_row_change();

drop trigger if exists availability_audit on public.availability;
create trigger availability_audit
  after insert or update or delete on public.availability
  for each row execute function public.audit_row_change();
