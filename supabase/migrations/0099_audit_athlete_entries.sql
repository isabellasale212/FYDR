-- The other three ADR-005 immutable entries: the gaps that are actually there.
--
-- WHAT I GOT WRONG FIRST, recorded because the wrong version was written and
-- applied to scratch before a test caught it. Measuring pg_trigger showed these
-- three tables carry NO audit triggers, and I read that as "corrections are not
-- audited" and wrote trigger-based correction auditing for all three. They are
-- audited — just not by a trigger. revise_wellness_entry and
-- revise_training_entry write an `entry_revision.created` event in-transaction
-- (0058, restated in 0075), and have since 0058. The first version of this
-- migration would have written a SECOND audit row for every wellness and
-- training correction, and none of the assertions in 540 would have noticed;
-- what noticed was a subquery returning two rows where the test expected one.
--
-- THE MEASURED STATE, which is what this migration is built against:
--
--   table                correction        delete      truncate
--   wellness_entries     entry_revision    NOTHING     NOTHING
--   training_entries     entry_revision    NOTHING     NOTHING
--   nutrition_checkins   NOTHING           NOTHING     NOTHING
--
-- So there are three real gaps, and correction auditing is only one of them and
-- only on one table.
--
-- 1. NUTRITION CHECK-IN CORRECTIONS ARE NOT AUDITED AT ALL. revise_nutrition_checkin
--    was written in the same migration series as the other two and simply never
--    got the audit call. It is closed here by giving it the SAME event the other
--    two write, rather than a new trigger and a new action name: one correction
--    should be one row under one name whichever entry it was, and a second
--    vocabulary for the third table would make the log harder to read, not
--    safer. A trigger would also cover revisions made below the app, which the
--    RPC path does not — but that is equally untrue of wellness and training
--    today, so a trigger here would buy coverage on one table out of three while
--    costing consistency on all of them. The destructive case below is covered
--    by a trigger, which is where that robustness actually matters.
--
-- 2. NOTHING RECORDS A DELETE, on any of the three. authenticated holds INSERT
--    and SELECT only; service_role holds DELETE and TRUNCATE. So these rows can
--    only be removed from below the app, and that left no trace — the same shape
--    as the 2026-09-07 incident 0085's header records, and the same shape as the
--    two rows removed from production by hand on 2026-09-09. On scratch that is
--    1,028 wellness entries, 772 training entries and 71 check-ins: the athlete-
--    entered record of how 29 people slept, ached, trained and ate.
--
-- 3. AND NOTHING REFUSES A TRUNCATE, which would empty all of it past every row
--    trigger in one statement. 0098 took this decision for the gym logs and 0007
--    took it for audit_log first.
--
-- NO CASCADE REACHES THESE THREE, so there is no via_cascade flag here. Every
-- foreign key on all three is ON DELETE NO ACTION, checked in pg_constraint,
-- including training_entries -> sessions: deleting a session that holds entries
-- is REFUSED, not cascaded. gym needed the flag only because
-- gym_set_logs.gym_session_log_id is ON DELETE CASCADE. A flag that is always
-- false invites a reader to trust a distinction the data cannot make.
--
-- NUMBERS AND FLAGS CARRY THEIR VALUES; FREE TEXT CARRIES ONLY ITS NAME AND
-- LENGTH. The rule 0096 set, applied to the one free-text field each table has:
-- wellness_entries.comment, training_entries.comment, nutrition_checkins.note.
-- Each is an athlete writing in their own words about their own body, and
-- audit_log is sport_scientist-readable while clinical data is separately gated.
-- A deleted note is therefore not recoverable from the audit log, which is the
-- trade rather than an oversight.
--
--   KNOWN INCONSISTENCY, DELIBERATELY NOT RESOLVED HERE. `entry_revision.created`
--   does NOT follow that rule: it records `{"comment": {"from": "...", "to": "..."}}`
--   with both texts in full. So after this migration a corrected comment is
--   readable in audit_log and a deleted one is not. That is a real disclosure
--   question about an audit event that has shipped since 0058, and narrowing it
--   would remove evidence that exists today — a decision to take deliberately
--   and separately, not as a side effect of closing a delete gap. Raised rather
--   than silently changed or silently copied.
--
-- soreness_areas IS recorded, and that is a deliberate line: body area is already
-- staff-visible by decision (coach, sport scientist and S&C see body area,
-- status, restrictions and expected return; diagnosis and mechanism stay
-- medical). Self-reported soreness on a wellness form is the same tier.
--
-- THIS DEPENDS ON A PROPERTY OF *OTHER* TRIGGERS. readiness_score (wellness) and
-- session_load (training) are computed by triggers on these same tables, and
-- both are BEFORE INSERT — measured in pg_trigger, not assumed; an earlier note
-- in this session had both down as AFTER INSERT and was wrong. The delete audit
-- reads the stored row, so it captures them either way; 540 pins the values so a
-- change to those triggers fails a test rather than quietly changing the log.
--
-- WHAT THIS STILL DOES NOT COVER: a superuser connection bypasses triggers as
-- completely as it bypasses the app. 0085 records that limit and it is unchanged.
--
-- TO REVERSE: drop the six triggers named at the foot of this file, then
--   drop function public.audit_entry_delete();
--   drop function public.athlete_entry_no_truncate();
--   drop function public.athlete_entry_fields(text);
-- and restore revise_nutrition_checkin from 0010.

-- The first version of this migration put correction triggers on all three
-- tables. They are dropped explicitly rather than just removed from this file,
-- so a database that already ran that version converges instead of keeping a
-- duplicate writer nothing references any more.
drop trigger if exists wellness_entries_correction_audit on public.wellness_entries;
drop trigger if exists training_entries_correction_audit on public.training_entries;
drop trigger if exists nutrition_checkins_correction_audit on public.nutrition_checkins;
drop function if exists public.audit_entry_correction();

-- ---------------------------------------------------------------------------
-- 1. A check-in correction writes the same event the other two entries write.
--    Body copied from 0010 unchanged except for the audit call at the end; the
--    permission rule (athlete-only, no staff write path — 04-data-model.md
--    §17.15 property 2) is untouched.
-- ---------------------------------------------------------------------------
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
  v_after    jsonb;
  v_changes  jsonb := '{}'::jsonb;
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

  /* THE PART 0010 NEVER HAD, and 0058 never added. The other two revise_*
     functions have written this event since 0058; this one silently did not, so a check-in could be changed
     from "no" to "yes" with nothing recorded anywhere but the revision chain
     itself — which says a correction happened and not what it changed.

     `answer` carries its value: it is one of three fixed words, it is not free
     text, and it discloses nothing a reader of the nutrition screen cannot
     already see. `note` is named and never quoted, which is where this
     deliberately DIVERGES from the wellness and training events — see this
     migration's header on that inconsistency. The two are built by hand rather
     than by the key loop those functions use, because this RPC takes typed
     arguments instead of a jsonb payload. */
  select to_jsonb(t) into v_after from public.nutrition_checkins t where t.id = v_new_id;
  if (to_jsonb(v_original) -> 'answer') is distinct from (v_after -> 'answer') then
    v_changes := v_changes || jsonb_build_object(
      'answer', jsonb_build_object('from', to_jsonb(v_original) -> 'answer', 'to', v_after -> 'answer'));
  end if;
  if (to_jsonb(v_original) -> 'note') is distinct from (v_after -> 'note') then
    v_changes := v_changes || jsonb_build_object(
      'note', jsonb_build_object(
        'from_length', coalesce(length(v_original.note), 0),
        'to_length',   coalesce(length(v_after ->> 'note'), 0)));
  end if;

  perform public.write_audit_event(
    'entry_revision.created',
    'nutrition_checkin',
    v_new_id,
    v_original.athlete_id,
    jsonb_build_object(
      'domain',      'nutrition',
      'week_start',  v_original.week_start,
      'superseded',  v_original.id,
      'changed',     v_changes
    )
  );

  return v_new_id;
end;
$$;

grant execute on function public.revise_nutrition_checkin(
  uuid, uuid, public.nutrition_checkin_answer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The fields that matter, per table. One place, so nothing drifts.
-- ---------------------------------------------------------------------------
create or replace function public.athlete_entry_fields(p_table text)
returns table (content text[], free_text text)
language sql
immutable
as $$
  select case p_table
    when 'wellness_entries' then array['sleep_hours','sleep_quality','fatigue','soreness',
                                       'soreness_areas','stress','mood','resting_hr',
                                       'body_mass_kg','readiness_score','entry_date']
    when 'training_entries' then array['rpe','duration_min','session_load','session_id','entry_date']
    when 'nutrition_checkins' then array['answer','protein_target_g','nutrition_target_id',
                                         'week_start','iso_year','iso_week']
    end,
    case p_table
      when 'nutrition_checkins' then 'note'
      else 'comment'
    end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Deletes: one row per removed entry, carrying what was destroyed.
--    A trigger rather than an RPC change, because the whole point is to catch
--    what happens below the app, where no RPC runs.
-- ---------------------------------------------------------------------------
create or replace function public.audit_entry_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old     jsonb := to_jsonb(old);
  v_content text[];
  v_free    text;
  v_removed jsonb;
begin
  select f.content, f.free_text into v_content, v_free
  from public.athlete_entry_fields(tg_table_name) f;

  select coalesce(jsonb_object_agg(k, v_old -> k), '{}'::jsonb) into v_removed
  from unnest(v_content) k;

  v_removed := v_removed || jsonb_build_object(
    'submitted_at',   v_old ->> 'submitted_at',
    'revision_of',    v_old ->> 'revision_of',
    'superseded_by',  v_old ->> 'superseded_by',
    'source',         v_old ->> 'source',
    /* Presence and length, never the text. See the header. */
    v_free || '_present', (v_old ->> v_free) is not null,
    v_free || '_length',  coalesce(length(v_old ->> v_free), 0));

  insert into public.audit_log (
    org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata, ip_address
  )
  values (
    nullif(v_old ->> 'org_id', '')::uuid,
    public.auth_user_id(),
    public.audit_acting_role(),
    tg_table_name || '.delete',
    tg_table_name,
    nullif(v_old ->> 'id', '')::uuid,
    nullif(v_old ->> 'athlete_id', '')::uuid,
    jsonb_build_object('removed', v_removed),
    public.audit_client_ip()
  );
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. And a truncate cannot walk past it. Statement-level BEFORE TRUNCATE, which
--    holds against service_role in a way no revoke would.
--    scripts/reset-scratch.mjs derives its lift list from pg_trigger since 0098,
--    so these three need no edit there.
-- ---------------------------------------------------------------------------
create or replace function public.athlete_entry_no_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'truncate is not permitted on %: 0099 audits every row deleted from it, and a truncate fires no row triggers',
    tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists wellness_entries_delete_audit on public.wellness_entries;
create trigger wellness_entries_delete_audit
  after delete on public.wellness_entries
  for each row execute function public.audit_entry_delete();
drop trigger if exists wellness_entries_no_truncate on public.wellness_entries;
create trigger wellness_entries_no_truncate
  before truncate on public.wellness_entries
  for each statement execute function public.athlete_entry_no_truncate();

drop trigger if exists training_entries_delete_audit on public.training_entries;
create trigger training_entries_delete_audit
  after delete on public.training_entries
  for each row execute function public.audit_entry_delete();
drop trigger if exists training_entries_no_truncate on public.training_entries;
create trigger training_entries_no_truncate
  before truncate on public.training_entries
  for each statement execute function public.athlete_entry_no_truncate();

drop trigger if exists nutrition_checkins_delete_audit on public.nutrition_checkins;
create trigger nutrition_checkins_delete_audit
  after delete on public.nutrition_checkins
  for each row execute function public.audit_entry_delete();
drop trigger if exists nutrition_checkins_no_truncate on public.nutrition_checkins;
create trigger nutrition_checkins_no_truncate
  before truncate on public.nutrition_checkins
  for each statement execute function public.athlete_entry_no_truncate();
