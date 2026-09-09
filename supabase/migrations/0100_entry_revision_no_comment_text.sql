-- entry_revision.created stops carrying the text of a comment.
--
-- THE INCONSISTENCY 0099 RAISED AND DELIBERATELY DID NOT RESOLVE, decided
-- 2026-09-09. Since 0058, correcting a wellness or training entry has recorded
--
--   {"comment": {"from": "Slept badly, hamstring tight", "to": "..."}}
--
-- with both texts in full, in audit_log, which sport_scientist can read. That is
-- an athlete describing their own body in their own words, and CLAUDE.md §2 rule
-- 3 gates clinical detail separately from availability. 0096 took the opposite
-- decision for gym comments and 0099 followed it for everything it added, which
-- left the schema saying two different things about the same kind of field: a
-- CORRECTED comment was readable and a DELETED one was not.
--
-- After this, both are recorded the same way: the field is NAMED so a reader
-- knows the text was rewritten and by whom, and MEASURED so they know how much
-- changed, but never quoted.
--
--   {"comment": {"from_length": 45, "to_length": 12}}
--
-- WHAT THIS COSTS, said plainly because it is a real loss and not a free win. A
-- coach who rewrites an athlete's comment now leaves no record of what the
-- athlete originally wrote. The revision chain still holds the superseded ROW,
-- so the original comment is recoverable from wellness_entries itself — this
-- narrows the audit log, not the data. The case it genuinely cannot answer is a
-- correction followed by a delete, where 0099 keeps only the length too. That is
-- the same trade 0096 made for gym.
--
-- WHY THE BODIES LOOK RETYPED AND ARE NOT. Both were generated from
-- pg_get_functiondef() against the live definition and edited programmatically:
-- one declare line, one lookup after begin, and one branch inside the existing
-- key loop, asserted as the ONLY changes by 560. That is the method 0075 used
-- and for its reason: a hand-copied hundred-line SECURITY DEFINER body is a
-- place to introduce a bug nothing would catch. Everything else in these two
-- functions -- the staff-only rule from 0075, the linear-chain check, the
-- deferred-FK forward reference, the 8192-byte overflow branch -- is byte-for-
-- byte what was deployed.
--
-- WHICH FIELD IS FREE TEXT is read from 0099's athlete_entry_fields(), not
-- hard-coded here, so the correction path and the delete path cannot disagree
-- about it and a future free-text column is added in one place.
--
-- EXISTING ROWS ARE NOT TOUCHED. This changes the writer, not the history.
-- audit_log has no update or delete path by design (0007), so redacting rows
-- already written is not something a migration should quietly do; the count of
-- affected rows on each database is reported alongside this change instead.
--
-- TO REVERSE: restore both functions from 0075.

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
  /* Which field is free text is defined ONCE, in 0099's athlete_entry_fields(),
     so this function and the delete audit cannot disagree about it — and a
     future free-text column is added in one place rather than three. */
  v_free     text;
begin
  select f.free_text into v_free from public.athlete_entry_fields('wellness_entries') f;

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
        if v_key = v_free then
          /* The one field that does not carry its value. See this migration's
             header: an athlete describing their own body, in a table
             sport_scientist can read. Named and measured, never quoted. */
          v_changes := v_changes || jsonb_build_object(
            v_key, jsonb_build_object(
              'from_length', coalesce(length(v_before ->> v_key), 0),
              'to_length',   coalesce(length(v_after  ->> v_key), 0)));
        else
          v_changes := v_changes || jsonb_build_object(
            v_key, jsonb_build_object('from', v_before -> v_key, 'to', v_after -> v_key));
        end if;
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
  /* Which field is free text is defined ONCE, in 0099's athlete_entry_fields(),
     so this function and the delete audit cannot disagree about it — and a
     future free-text column is added in one place rather than three. */
  v_free     text;
begin
  select f.free_text into v_free from public.athlete_entry_fields('training_entries') f;

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
        if v_key = v_free then
          /* The one field that does not carry its value. See this migration's
             header: an athlete describing their own body, in a table
             sport_scientist can read. Named and measured, never quoted. */
          v_changes := v_changes || jsonb_build_object(
            v_key, jsonb_build_object(
              'from_length', coalesce(length(v_before ->> v_key), 0),
              'to_length',   coalesce(length(v_after  ->> v_key), 0)));
        else
          v_changes := v_changes || jsonb_build_object(
            v_key, jsonb_build_object('from', v_before -> v_key, 'to', v_after -> v_key));
        end if;
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
