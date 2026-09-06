-- Correcting an entry, and acting on a flag, become per-row rules.
--
-- Two decisions from 2026-09-06, and they need two different SHAPES. Every
-- access rule in this schema so far has been "which roles", answerable with a
-- role set. Neither of these is:
--
--   1. The S&C may raise a flag but may NOT edit a wellness entry or an RPE
--      score. That is still a role question, and it is the smaller half.
--   2. The nutritionist may edit a flag only when it involves nutrition
--      information. That is a role AND ROW question: the same person may act on
--      one row and not the one beside it, decided by that row's own domain. No
--      role set can express it, which is why the policy below carries an OR
--      rather than a longer ARRAY.
--
-- WHY THE RPCs CHANGE TOO. revise_wellness_entry and revise_training_entry both
-- count all five staff roles as staff (0065), and training_entries.rpe is where
-- an RPE score lives. So the S&C can correct both today, through the panel on
-- the player profile and through the RPC directly. Narrowing the panel alone
-- would leave the second door open, and the RPC is the authorisation --
-- CLAUDE.md §2 rule 2 -- so the RPC is what has to change.
--
-- The two function bodies below are byte-identical to what is deployed except
-- for the one role array in each. They were generated from
-- pg_get_functiondef() rather than retyped, because a hand-copied 100-line
-- SECURITY DEFINER body is a place to introduce a bug that nothing would catch.
--
-- flag_actions gets the same rule as flags, via the parent row. Without it the
-- nutritionist could not dismiss a gym flag but could still file the audit
-- record saying they had.

CREATE OR REPLACE FUNCTION public.revise_wellness_entry(p_original_id uuid, p_new_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org      uuid := public.auth_org_id();
  v_original public.wellness_entries;
  v_is_staff boolean := public.auth_has_any_role(array['coach','medic','sport_scientist']::public.app_role[]);
  v_new_id   uuid;
  v_before   jsonb;
  v_after    jsonb;
  v_changes  jsonb := '{}'::jsonb;
  v_key      text;
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_original
  from public.wellness_entries
  where id = p_original_id
    and org_id = v_org
    and superseded_by is null;      -- check 1 (tenancy) and check 3 (linear chain)

  if v_original.id is null then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  -- check 2, narrowed by this migration. Was: athlete-themselves OR staff.
  -- The athlete branch is gone entirely — an athlete calling this for their own
  -- entry now gets the same not_permitted as anyone else. Deliberately checked
  -- AFTER the row lookup so that a staff caller and an athlete caller cannot
  -- distinguish "wrong id" from "not allowed" by timing the two error paths any
  -- differently than 0010 already did.
  if not v_is_staff then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- Close the original first. The partial unique index permits one live row per
  -- athlete per day, so the new revision cannot land until this one is closed. The
  -- foreign key on superseded_by is deferred, which is what makes forward
  -- referencing p_new_id legal.
  update public.wellness_entries
     set superseded_by = p_new_id
   where id = p_original_id;

  -- check 4: identity columns come from the original, never from p_payload.
  -- `source` is copied too, unchanged from 0010: a coach fixing a mis-typed sleep
  -- value does not turn the athlete's self_report into a staff observation. What the
  -- row carries about who did the correcting is created_by, which is the acting
  -- staff user. Both facts matter and they are stored in the two columns that mean
  -- them, rather than one being overwritten to imply the other.
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

  -- The audit event. See this migration's header for why it lives here rather than in
  -- the caller. Same transaction as the insert: no committed correction is unaudited.
  v_before := to_jsonb(v_original);
  select to_jsonb(w) into v_after from public.wellness_entries w where w.id = v_new_id;

  -- Only the keys the caller actually sent, and only those that actually moved. Driven
  -- off the payload rather than a hand-written field list so a column added to the
  -- insert above cannot quietly stop being audited; `v_before ? v_key` discards any key
  -- that is not a real column, so a caller cannot pad audit_log with invented fields.
  -- The typeof guard is not defensive padding: jsonb_object_keys RAISES on a scalar,
  -- where every other read of p_payload above degrades to null. A caller passing
  -- '"oops"'::jsonb would otherwise write the revision and then fail on the audit, which
  -- is the one shape of failure this whole change exists to prevent.
  if jsonb_typeof(p_payload) = 'object' then
    for v_key in select t.k from jsonb_object_keys(p_payload) as t(k)
    loop
      if v_before ? v_key and (v_before -> v_key) is distinct from (v_after -> v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('from', v_before -> v_key, 'to', v_after -> v_key));
      end if;
    end loop;
  end if;

  -- 04-data-model.md §13 caps metadata at 16 KB with a check constraint, and `comment`
  -- alone can be 1000 characters twice over. Well short of the cap in practice; if it is
  -- ever reached the event still gets written, carrying which fields changed but not
  -- their old values, because an unwritable audit row would abort a legitimate
  -- correction.
  if pg_column_size(v_changes) > 8192 then
    v_changes := jsonb_build_object(
      'fields',         (select jsonb_agg(t.k) from jsonb_object_keys(v_changes) as t(k)),
      'values_omitted', true);
  end if;

  perform public.write_audit_event(
    'entry_revision.created',
    'wellness_entry',
    v_new_id,
    v_original.athlete_id,
    jsonb_build_object(
      'domain',      'wellness',
      'entry_date',  v_original.entry_date,
      'superseded',  v_original.id,
      'changed',     v_changes
    )
  );

  return v_new_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.revise_training_entry(p_original_id uuid, p_new_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org      uuid := public.auth_org_id();
  v_original public.training_entries;
  v_is_staff boolean := public.auth_has_any_role(array['coach','medic','sport_scientist']::public.app_role[]);
  v_new_id   uuid;
  v_before   jsonb;
  v_after    jsonb;
  v_changes  jsonb := '{}'::jsonb;
  v_key      text;
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

  -- Same narrowing as revise_wellness_entry above; see that function for the
  -- reasoning, which applies here unchanged.
  if not v_is_staff then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- Close the original first, for the same reason as revise_wellness_entry.
  update public.training_entries
     set superseded_by = p_new_id
   where id = p_original_id;

  -- session_load is not written here on purpose: the training_entries_session_load
  -- trigger (0010) recomputes rpe x duration_min on the inserted row, so a corrected
  -- RPE or duration produces a corrected load without this function knowing the
  -- formula. Unchanged from 0010, restated because a reader of a coach-facing
  -- correction naturally asks where the load went.
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

  -- The same in-transaction audit event as revise_wellness_entry; see that function and
  -- this migration's header for the reasoning, which applies here unchanged.
  --
  -- One difference worth naming: session_load is recomputed by a trigger and is NOT a
  -- payload key, so it never appears in `changed`. The audit records what the coach
  -- asked to change (rpe, duration_min); the derived load that followed is on the row.
  v_before := to_jsonb(v_original);
  select to_jsonb(t) into v_after from public.training_entries t where t.id = v_new_id;

  -- The typeof guard is not defensive padding: jsonb_object_keys RAISES on a scalar,
  -- where every other read of p_payload above degrades to null. A caller passing
  -- '"oops"'::jsonb would otherwise write the revision and then fail on the audit, which
  -- is the one shape of failure this whole change exists to prevent.
  if jsonb_typeof(p_payload) = 'object' then
    for v_key in select t.k from jsonb_object_keys(p_payload) as t(k)
    loop
      if v_before ? v_key and (v_before -> v_key) is distinct from (v_after -> v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('from', v_before -> v_key, 'to', v_after -> v_key));
      end if;
    end loop;
  end if;

  if pg_column_size(v_changes) > 8192 then
    v_changes := jsonb_build_object(
      'fields',         (select jsonb_agg(t.k) from jsonb_object_keys(v_changes) as t(k)),
      'values_omitted', true);
  end if;

  perform public.write_audit_event(
    'entry_revision.created',
    'training_entry',
    v_new_id,
    v_original.athlete_id,
    jsonb_build_object(
      'domain',      'training',
      'entry_date',  v_original.entry_date,
      'session_id',  v_original.session_id,
      'superseded',  v_original.id,
      'changed',     v_changes
    )
  );

  return v_new_id;
end;
$function$;




-- ---------------------------------------------------------------------------
-- The per-row half.
-- ---------------------------------------------------------------------------

drop policy if exists flags_staff_update on public.flags;
create policy flags_staff_update on public.flags
  for update to authenticated
  using (
    org_id = auth_org_id()
    and (
      auth_has_any_role(ARRAY[
        'sport_scientist'::app_role,
        'coach'::app_role,
        'medic'::app_role,
        'strength_conditioning'::app_role
      ])
      or (
        auth_has_any_role(ARRAY['nutritionist'::app_role])
        and domain = 'nutrition'::flag_domain
      )
    )
  );

-- No explicit WITH CHECK, deliberately: for UPDATE, Postgres reuses USING when
-- WITH CHECK is absent. That is the behaviour wanted here, and it closes the
-- obvious escape -- a nutritionist cannot rewrite a wellness flag's domain to
-- 'nutrition' and then edit it, because the NEW row is tested by the same
-- expression. Spelling out a WITH CHECK that merely repeated USING would invite
-- somebody to "simplify" one of the two later and split them apart.

drop policy if exists flag_actions_staff_insert on public.flag_actions;
create policy flag_actions_staff_insert on public.flag_actions
  for insert to authenticated
  with check (
    org_id = auth_org_id()
    and taken_by = auth_user_id()
    and (
      auth_has_any_role(ARRAY[
        'sport_scientist'::app_role,
        'coach'::app_role,
        'medic'::app_role,
        'strength_conditioning'::app_role
      ])
      or (
        auth_has_any_role(ARRAY['nutritionist'::app_role])
        and exists (
          select 1 from public.flags f
           where f.id = flag_actions.flag_id
             and f.org_id = auth_org_id()
             and f.domain = 'nutrition'::flag_domain
        )
      )
    )
  );
