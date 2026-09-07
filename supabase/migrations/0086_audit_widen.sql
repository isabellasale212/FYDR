-- Widen the audit triggers to seven more tables, and teach the function two
-- row shapes it has not met before.
--
-- 0085 proved the pattern on injuries, injury_clinical and availability. This
-- is the next set from the sweep, chosen as the write paths a club would
-- actually be asked about: who is on the roster, what they consented to, their
-- body composition and test history, what they were prescribed, whether they
-- were selected, and who holds which role.
--
-- TWO SHAPES THE FUNCTION DID NOT HANDLE, and neither would have failed loudly.
-- Both would have written an audit row with a null where the useful value goes,
-- which is the failure mode 0085's header warned about for injury_clinical.
--
--   athletes    has no athlete_id column, because the row IS the athlete. The
--               function would have recorded null for the one field that says
--               who the record is about. Its own `id` is the athlete id.
--   user_roles  has no athlete_id either, and correctly so: a role grant is
--               not about an athlete. But audit_log has no column for "the user
--               this concerns", so without help the row would say somebody's
--               roles changed without saying whose, or to what — in the table
--               that grants privilege, which the policy-replacement guard
--               already flagged as carrying zero refusal assertions.
--
-- SO METADATA GAINS AN IDENTITY ALLOWLIST, and the allowlist is the point. The
-- disclosure rule from 0085 stands unchanged: metadata records WHICH fields
-- changed, never their values, because audit_log is sport-scientist readable
-- and clinical detail is separately gated. `user_id` and `role` are copied by
-- name because they are identity and authorisation facts rather than content —
-- who was granted what. Nothing else may be added here without the same
-- argument, which is why it is an explicit list and not a heuristic about
-- column types.

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
  v_identity   jsonb;
  v_metadata   jsonb;
  v_action     text;
begin
  v_entity  := nullif(coalesce(v_row ->> 'id', v_row ->> 'injury_id'), '')::uuid;
  v_athlete := nullif(v_row ->> 'athlete_id', '')::uuid;

  -- The row IS the athlete: athletes.id is the athlete id, and without this the
  -- one field saying who a roster change concerns would be null.
  if v_athlete is null and tg_table_name = 'athletes' then
    v_athlete := nullif(v_row ->> 'id', '')::uuid;
  end if;

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

  -- Identity, never content. See the header: this list is deliberately short
  -- and deliberately explicit.
  select coalesce(jsonb_object_agg(k, v_row -> k), '{}'::jsonb)
    into v_identity
  from unnest(array['user_id', 'role']) k
  where v_row ? k;

  v_metadata := v_identity
    || case when tg_op = 'UPDATE' then jsonb_build_object('changed', to_jsonb(v_changed)) else '{}'::jsonb end;

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
    v_metadata,
    public.audit_client_ip()
  );

  return coalesce(new, old);
end;
$$;

-- AFTER and FOR EACH ROW, for the same reasons as 0085: a write refused by RLS
-- or a constraint never leaves a row claiming it happened, and a multi-row
-- update is not collapsed into one entry.
drop trigger if exists athletes_audit on public.athletes;
create trigger athletes_audit
  after insert or update or delete on public.athletes
  for each row execute function public.audit_row_change();

drop trigger if exists athlete_consents_audit on public.athlete_consents;
create trigger athlete_consents_audit
  after insert or update or delete on public.athlete_consents
  for each row execute function public.audit_row_change();

drop trigger if exists body_composition_audit on public.body_composition;
create trigger body_composition_audit
  after insert or update or delete on public.body_composition
  for each row execute function public.audit_row_change();

drop trigger if exists test_results_audit on public.test_results;
create trigger test_results_audit
  after insert or update or delete on public.test_results
  for each row execute function public.audit_row_change();

drop trigger if exists programme_assignments_audit on public.programme_assignments;
create trigger programme_assignments_audit
  after insert or update or delete on public.programme_assignments
  for each row execute function public.audit_row_change();

drop trigger if exists team_allocations_audit on public.team_allocations;
create trigger team_allocations_audit
  after insert or update or delete on public.team_allocations
  for each row execute function public.audit_row_change();

drop trigger if exists user_roles_audit on public.user_roles;
create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function public.audit_row_change();
