-- 0107_nutrition_checkin_correct_once.sql
--
-- ATH-ADULT-08 C1 — approved on the decision sheet 2026-09-12 (Isabella), from
-- the data-architecture approach's "Nutrition can be corrected ONCE by the
-- athlete, creating a revision."
--
-- WHAT WAS TRUE. revise_nutrition_checkin (0010, rewritten in 0099 for the
-- audit event) refused a superseded, deleted or foreign original and nothing
-- else: a revision could itself be revised without limit. The athlete app
-- therefore could not honestly caption the answered state "You can correct
-- this once after you submit", and the board's spent state — "You have used
-- your one correction for this check-in" — had nothing to stand on. The
-- check-in is the one entry an athlete may change themselves (there is no
-- staff write path at all), so the limit is the only thing that keeps the
-- record a record rather than a preference that drifts.
--
-- THE CHANGE. One new refusal in the function, after the ownership check:
-- if the live row being revised carries revision_of, raise
-- entry_already_corrected. Its own error name, distinct from
-- entry_not_revisable, so the app can tell "you have used your correction"
-- from "this row has moved since you opened it". The body below is 0099's
-- verbatim otherwise — the audit event, the ownership rule and the
-- close-then-insert order are untouched. Test: 630_nutrition_checkin_correct_once_test.sql.
--
-- The chain the app reads is unchanged: one live row per athlete per week
-- (nutrition_checkins_one_live_per_week), at most one superseded row behind it
-- from now on; existing deeper chains (none on scratch or production as of
-- this migration — a second correction was never offered by the UI) are left
-- as they are.

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

  -- ONCE. The live row being revised is itself a revision: the athlete has
  -- already used their one correction for this week. Its own error name, so
  -- the app can say so rather than "the window has closed" (0107).
  if v_original.revision_of is not null then
    raise exception 'entry_already_corrected' using errcode = 'P0001';
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
