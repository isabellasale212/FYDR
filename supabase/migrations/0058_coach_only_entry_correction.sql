-- 0058_coach_only_entry_correction.sql
--
-- What this does
--   Narrows who may call revise_wellness_entry and revise_training_entry from
--   "the athlete concerned, OR coach/medical" (0010, lines 512-515 and 584-587) to
--   "coach or medical only". Nothing else about ADR-005 changes: an entry is still
--   never updated in place, a correction is still a new row plus a superseded_by
--   stamp on the old one, and the identity columns are still copied from the
--   original rather than taken from the payload.
--
-- Why
--   The club's coach, verbatim: "the athlete shouldnt be able to edit an entry only
--   the coach should be able to do it on the system". Correction becomes a staff
--   action, performed from the player profile (squad/[athleteId]).
--
--   This is the same concern ADR-005 §Context item 3 already records — "an athlete
--   who sleeps four hours and then finds out a coach is looking will edit it if they
--   can. Editable self-report is not self-report, it is self-presentation." The
--   revision chain made that visible; this makes it impossible.
--
-- Why it is enforced HERE and not only in the UI
--   CLAUDE.md §2 rule 2: a client-side check hides UI, it never authorises. The
--   athlete forms that offered "Correct this entry" are being removed in the same
--   change, but removing a link does not remove the RPC — an athlete's own session
--   can still call it directly. The gate has to live in the function, which is the
--   only write path that can stamp superseded_by at all.
--
-- What was considered and NOT done: a same-day self-correction window
--   The obvious middle ground is "the athlete may still fix a mis-tap on the day
--   they submitted it; after that only staff can". It is genuinely attractive —
--   nearly every real athlete correction is a fat-finger caught within minutes, and
--   an athlete who cannot fix a wrong number either stops submitting or submits
--   noise. It is NOT implemented, for two reasons:
--
--     1. It is not what the club asked for, and inventing product behaviour on
--        their behalf is exactly what CLAUDE.md §5 forbids. The club's instruction
--        was unambiguous.
--     2. It does not actually close ADR-005 §Context item 3 for wellness, which is
--        the domain the club cares about: a coach reads the morning check-ins the
--        same morning they are submitted, so a same-day window leaves the
--        self-presentation case wide open.
--
--   If the club later wants it, the change is one predicate: replace the
--   `v_is_staff` guard below with
--       (v_is_staff or (v_original.athlete_id = v_athlete
--                       and v_original.entry_date
--                           = (now() at time zone public.auth_org_timezone())::date))
--   in both functions. It is deliberately written as a single named boolean so that
--   edit is a one-liner rather than a rewrite. Recorded as O-29 in ADR-005.
--
-- The correction is audited, and that is not decoration
--   Both functions now write an `entry_revision.created` row through write_audit_event
--   before returning. It is inside the function on purpose, for the same reason the
--   permission guard is: an audit event a caller can decline to send is not evidence.
--   The client cannot bypass it, cannot forge the actor (write_audit_event takes org and
--   actor from the caller's own claims), and cannot commit the revision without it — it
--   is the same transaction, so an audit failure rolls the correction back.
--
--   This closes a real inversion that shipped in the first cut of this cluster: expanding
--   the revision history wrote `entry_revision.view` (entryRevisions.ts) while the write
--   that CHANGED an athlete's self-reported number wrote nothing at all. Reading was
--   evidence and rewriting was silent. ADR-005 O-28 was closed partly on the strength of
--   an audit clause; this is the half of it that matters. The `.view` event stays — it is
--   O-28's own third clause and it is what lets an athlete's chain be visible without a
--   coach reading it invisibly — but it is no longer the only one.
--
--   The metadata records what actually changed and what it changed FROM, keyed by column
--   and derived generically from the payload rather than field by field, so a future
--   column added to the insert list cannot silently fall out of the audit trail. Only
--   keys the caller sent AND that really moved are recorded: a coach fixing soreness does
--   not produce an audit row claiming they touched sleep. 04-data-model.md §13's 16 KB
--   metadata ceiling is a hard check constraint, so the diff is dropped to a key list if
--   it ever approaches it — an oversized correction must still be auditable, and losing
--   the before-values is better than losing the event.
--
-- Domains this does NOT touch, and why
--   revise_nutrition_checkin and revise_gym_set_log / revise_gym_session_log stay
--   athlete-only. That is not an oversight, it is 0045's own rule: "A correction
--   function cannot grant a permission the base table never had." nutrition_checkins
--   has NO staff insert policy at all (0012 §11: "A coach guessing whether a player
--   hit their protein target is not a self report"), and gym_set_logs has no staff
--   write path of any kind. Closing the athlete path there without first building a
--   staff one would leave those two domains uncorrectable by anybody, which is worse
--   than the asymmetry. See docs/decisions/adr-005-immutable-entries.md §"Who may
--   correct what" for the table.
--
-- Migration shape
--   create or replace on both functions. Additive per CLAUDE.md §5: 0010 is not
--   rewritten, and the bodies below are 0010's verbatim except for the guard.

-- ===========================================================================
-- revise_wellness_entry
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
  v_original public.wellness_entries;
  v_is_staff boolean := public.auth_has_any_role(array['coach','medical']::public.app_role[]);
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
$$;

comment on function public.revise_wellness_entry(uuid, uuid, jsonb) is
  'ADR-005 correction path for wellness_entries. COACH or MEDICAL only since 0058 '
  '(the club asked for correction to be a staff action); athletes get not_permitted. '
  'Never an update: closes the original and inserts a revision. Writes an '
  'entry_revision.created audit event, in-transaction, carrying the prior values of '
  'whatever changed.';

-- ===========================================================================
-- revise_training_entry
-- ===========================================================================
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
  v_original public.training_entries;
  v_is_staff boolean := public.auth_has_any_role(array['coach','medical']::public.app_role[]);
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
$$;

comment on function public.revise_training_entry(uuid, uuid, jsonb) is
  'ADR-005 correction path for training_entries (RPE). COACH or MEDICAL only since '
  '0058; athletes get not_permitted. Never an update. Writes an entry_revision.created '
  'audit event, in-transaction, carrying the prior values of whatever changed.';
