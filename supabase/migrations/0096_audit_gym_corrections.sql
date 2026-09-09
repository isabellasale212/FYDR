-- A gym correction leaves a trail, carrying the value that was there and the
-- value that replaced it.
--
-- THE GAP, and how it was found. On 2026-09-09 a set on production read -3 reps
-- and -300.00 kg of volume, and the question "who wrote that, and when" could not
-- be answered from audit_log: it holds ZERO rows mentioning gym, ever, while
-- recording every sign-in, every availability change and every clinical write in
-- the same window. The answer had to be inferred from logged_at timestamps
-- instead. gym_set_logs is the one table in this codebase built specifically
-- around keeping a revision history (0045, ADR-005) and it was the one nobody
-- could ask a question of.
--
-- WHY THIS IS NOT ANOTHER audit_row_change() TRIGGER. Two reasons, and both are
-- about what a correction IS.
--
--   * A revision is two statements — close the original via superseded_by, then
--     insert the new row — so the generic trigger would record it as an UPDATE
--     and an INSERT, two rows for one act, neither of which says what changed.
--     This fires once, on the insert that carries revision_of, and describes the
--     whole correction. The UPDATE half is deliberately NOT audited: it is the
--     same event, and recording it twice makes a reader count two.
--   * The generic function records WHICH FIELDS changed and never their values.
--     That rule exists because the tables it covers hold clinical content and
--     audit_log is sport-scientist readable (0085). It is left completely
--     untouched here — a separate function rather than a widened one, so nothing
--     about injuries or injury_clinical moves.
--
-- WHY VALUES ARE RECORDED HERE, when they are not anywhere else. Reps and load
-- are performance numbers that every audit_log reader can already see on the
-- training report, so writing them into metadata discloses nothing new — and
-- "-3 replaced 8" is the entire fact somebody needs. A changed-fields list would
-- have said `reps_completed` and left tonight's question exactly as unanswerable
-- as no row at all.
--
-- NUMBERS AND FLAGS CARRY THEIR VALUES; FREE TEXT CARRIES ONLY ITS NAME.
-- gym_session_logs.comment is an athlete writing in their own words about how a
-- session went, which is the one field here that can contain something nobody
-- chose to put in a staff-readable table — "hamstring felt tight" is a sentence
-- about their body, not a number about their training. It is in the content list
-- so a change to it is recorded, and out of the valued list so its text is not.
--
-- A REVISION THAT CHANGES NOTHING IS STILL RECORDED, which is the opposite of
-- audit_row_change()'s no-op rule and deliberately so. There, a no-op UPDATE is a
-- write that did nothing. Here, a new row exists that did not exist before:
-- somebody opened the correction panel and saved. Production holds exactly such a
-- row — 8 reps corrected to 8 reps at 10:00:10, thirty-three seconds before the
-- -3 — and it is the strongest single piece of evidence that the panel was being
-- exercised rather than used. metadata carries `"changed": []` for that case.
--
-- WHAT THIS STILL DOES NOT COVER, said plainly rather than discovered later:
--
--   * A DELETE. gym_set_logs grants delete to nobody (0021 grants select/insert/
--     update, 0045 revokes the update), so only a service role or a superuser can
--     remove one, and a superuser connection bypasses triggers as completely as
--     it bypasses the app — 0085's header records that limit and it is unchanged.
--     Auditing service-role deletes is a real question and a separate one.
--   * An ordinary set being logged. The trigger's WHEN clause means an athlete
--     logging five sets writes five gym rows and no audit rows. That is the
--     volume judgement 0088 made for session_participants, applied here: the
--     event worth keeping is a change to a record already on the file.
--   * actor_id when the correction comes from a connection with no JWT. A repair
--     made directly against the database records a null actor, which is honest
--     rather than convenient. There is one such row on production already, from
--     the repair of the -3 itself.

-- ---------------------------------------------------------------------------
-- One function, both gym tables. Generic over the row via to_jsonb for the same
-- reason audit_row_change() is: the two tables do not agree on their own keys.
-- gym_set_logs has no athlete_id at all — the athlete lives on its parent — and
-- gym_session_logs is its own athlete. A function written against one shape would
-- have recorded a null for the field that says who the record is about, which is
-- exactly the failure 0085's header warned about for injury_clinical.
-- ---------------------------------------------------------------------------
create or replace function public.audit_gym_correction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new     jsonb := to_jsonb(new);
  v_old     jsonb;
  v_content text[];
  v_valued  text[];
  v_changed text[];
  v_athlete uuid;
begin
  if tg_table_name = 'gym_set_logs' then
    select to_jsonb(g) into v_old
    from public.gym_set_logs g where g.id = (v_new ->> 'revision_of')::uuid;

    v_content := array['reps_completed', 'load_kg', 'rpe', 'rir', 'side', 'is_warmup'];
    v_valued  := v_content;   -- every correctable field here is a number or a flag

    select s.athlete_id into v_athlete
    from public.gym_session_logs s
    where s.id = (v_new ->> 'gym_session_log_id')::uuid;
  else
    select to_jsonb(g) into v_old
    from public.gym_session_logs g where g.id = (v_new ->> 'revision_of')::uuid;

    v_content := array['session_rpe', 'comment'];
    v_valued  := array['session_rpe'];   -- see the header: free text, name only
    v_athlete := nullif(v_new ->> 'athlete_id', '')::uuid;
  end if;

  v_old := coalesce(v_old, '{}'::jsonb);

  select coalesce(array_agg(k order by k), '{}')
    into v_changed
  from unnest(v_content) k
  where v_old -> k is distinct from v_new -> k;

  insert into public.audit_log (
    org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata, ip_address
  )
  values (
    nullif(v_new ->> 'org_id', '')::uuid,
    public.auth_user_id(),
    public.audit_acting_role(),
    tg_table_name || '.correction',
    tg_table_name,
    nullif(v_new ->> 'id', '')::uuid,
    v_athlete,
    jsonb_build_object('revision_of', v_new ->> 'revision_of')
      || jsonb_build_object('changed', to_jsonb(v_changed))
      || jsonb_build_object(
           'old', (select coalesce(jsonb_object_agg(k, v_old -> k), '{}'::jsonb)
                     from unnest(v_changed) k where k = any(v_valued)),
           'new', (select coalesce(jsonb_object_agg(k, v_new -> k), '{}'::jsonb)
                     from unnest(v_changed) k where k = any(v_valued))),
    public.audit_client_ip()
  );

  return new;
end;
$$;

comment on function public.audit_gym_correction() is
  'Writes one audit_log row per gym revision, carrying the old and new values of '
  'the numeric fields that changed. Separate from audit_row_change() so 0085''s '
  '"field names, never values" rule for the clinical tables is untouched. 0096.';

-- AFTER, for 0085's reason: a write refused by RLS or a constraint must never
-- leave a row claiming it happened. FOR EACH ROW, so a multi-row write is not
-- collapsed into one entry. WHEN, so an ordinary set being logged costs nothing.
drop trigger if exists gym_set_logs_correction_audit on public.gym_set_logs;
create trigger gym_set_logs_correction_audit
  after insert on public.gym_set_logs
  for each row when (new.revision_of is not null)
  execute function public.audit_gym_correction();

drop trigger if exists gym_session_logs_correction_audit on public.gym_session_logs;
create trigger gym_session_logs_correction_audit
  after insert on public.gym_session_logs
  for each row when (new.revision_of is not null)
  execute function public.audit_gym_correction();
