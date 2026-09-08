-- last_seen_at is bookkeeping, not an event.
--
-- WHAT THIS CHANGES: one line of audit_row_change(). The list of column names
-- excluded from an UPDATE's `changed` metadata goes from ('updated_at') to
-- ('updated_at', 'last_seen_at'). Nothing else in the function moves, and the
-- rest of this file is 0086's text unaltered so the two can be diffed.
--
-- WHY. 0091 attached the audit trigger to `users` on the same morning the
-- sign-in path started writing `users.last_seen_at` -- that column is read by
-- three components and, until today, written by nothing at all, so every account
-- showed "Never signed in". Those two changes are individually right and
-- together wrong: every sign-in would write a `users.update` row saying
-- last_seen_at moved, immediately next to the `auth.signed_in` row recordSignIn
-- already writes, which says the same thing and carries the address, the method
-- and the session id as well. One event, two rows, and the second is the one
-- with nothing on it.
--
-- WHY IT BELONGS IN THE FUNCTION rather than in the application. The
-- application could write last_seen_at through a definer function that skips
-- the trigger, but then the exclusion would live somewhere nobody reading
-- audit_row_change() would find it. The function already refuses to record a
-- write in which only `updated_at` moved, for precisely this reason, and
-- last_seen_at is the same kind of column: written by machinery, never by a
-- person choosing to change it.
--
-- AN EXCLUSION IS A HOLE IN AN AUDIT TRAIL, so test 480 asserts both directions
-- rather than only the quiet one. A sign-in writes no row; suspending an account
-- still writes one; and a write that moves BOTH still records the half a person
-- chose, with the bookkeeping stripped out. That last case is the one an
-- exclusion gets wrong, and it is the reason this is not a `where changed = {}`
-- shortcut. 480 also sweeps every audited table to confirm no `changed` list
-- anywhere names either excluded column, so adding a second name has not become
-- a general licence to drop a third.
--
-- NOT A POLICY CHANGE. No grant, no policy and no trigger attachment moves here.
-- The 26 tables audited as of 0091 are audited exactly as they were.

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
      and n.key not in ('updated_at', 'last_seen_at');
    -- Nothing but bookkeeping moved: a no-op write, not an event worth a row.
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
