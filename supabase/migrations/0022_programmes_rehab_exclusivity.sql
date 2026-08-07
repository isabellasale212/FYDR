-- 0022_programmes_rehab_exclusivity.sql
--
-- What this does
--   Closes a real gap in 0021: found while writing that feature's own test file,
--   before it shipped, the same way migration 0020 closed one in
--   resolve_nutrition_targets. CLAUDE.md §5, migrations are additive.
--
-- The gap
--   screens/programme-builder.md's own role table gives coach "Full... any
--   programme of type gym, conditioning, nutrition" — three types, rehab
--   deliberately absent — and gives medical "Full authoring for programme_type =
--   'rehab'" only. Read that as medical-exclusive on rehab, the same shape
--   migration 0018 already gave rehab groups. 0021's write policies on
--   programmes, programme_blocks, programme_sessions, programme_exercises and
--   programme_assignments all wrote the coach branch as
--   auth_has_any_role(array['coach']) with no type condition at all — which
--   meant a coach could create or edit a rehab-type programme just as freely as
--   a gym one, the opposite of the exclusivity the medical branch was written to
--   express. The rehab branch's own restriction was correct; the coach branch's
--   absence of one was the bug.
--
-- The fix
--   The coach branch on every one of the five write policies now excludes
--   programme_type = 'rehab' (for the four tables that key off it directly) or
--   excludes it via the same join the medical branch already used (for the two
--   tables — programme_blocks and below — that reach programme_type through a
--   parent). Symmetric with the medical branch, not just narrower: exactly one
--   of "coach and not rehab" or "medical and rehab" is now satisfiable for any
--   given row, never both, never neither for a legitimate write.

drop policy programmes_write on public.programmes;
create policy programmes_write on public.programmes for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and (
      (auth_has_any_role(array['coach']::app_role[]) and programme_type <> 'rehab')
      or (auth_has_any_role(array['medical']::app_role[]) and programme_type = 'rehab')
    )
  );

drop policy programmes_update on public.programmes;
create policy programmes_update on public.programmes for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and (
      (auth_has_any_role(array['coach']::app_role[]) and programme_type <> 'rehab')
      or (auth_has_any_role(array['medical']::app_role[]) and programme_type = 'rehab')
    )
  );

drop policy programme_blocks_write on public.programme_blocks;
create policy programme_blocks_write on public.programme_blocks for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programmes p
      where p.id = programme_id
        and p.org_id = auth_org_id()
        and (
          (auth_has_any_role(array['coach']::app_role[]) and p.programme_type <> 'rehab')
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

drop policy programme_blocks_update on public.programme_blocks;
create policy programme_blocks_update on public.programme_blocks for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programmes p
      where p.id = programme_id
        and p.org_id = auth_org_id()
        and (
          (auth_has_any_role(array['coach']::app_role[]) and p.programme_type <> 'rehab')
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

drop policy programme_sessions_write on public.programme_sessions;
create policy programme_sessions_write on public.programme_sessions for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programme_blocks b join programmes p on p.id = b.programme_id
      where b.id = block_id
        and p.org_id = auth_org_id()
        and (
          (auth_has_any_role(array['coach']::app_role[]) and p.programme_type <> 'rehab')
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

drop policy programme_sessions_update on public.programme_sessions;
create policy programme_sessions_update on public.programme_sessions for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programme_blocks b join programmes p on p.id = b.programme_id
      where b.id = block_id
        and p.org_id = auth_org_id()
        and (
          (auth_has_any_role(array['coach']::app_role[]) and p.programme_type <> 'rehab')
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

drop policy programme_exercises_write on public.programme_exercises;
create policy programme_exercises_write on public.programme_exercises for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programme_sessions s
        join programme_blocks b on b.id = s.block_id
        join programmes p on p.id = b.programme_id
      where s.id = programme_session_id
        and p.org_id = auth_org_id()
        and (
          (auth_has_any_role(array['coach']::app_role[]) and p.programme_type <> 'rehab')
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

drop policy programme_exercises_update on public.programme_exercises;
create policy programme_exercises_update on public.programme_exercises for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programme_sessions s
        join programme_blocks b on b.id = s.block_id
        join programmes p on p.id = b.programme_id
      where s.id = programme_session_id
        and p.org_id = auth_org_id()
        and (
          (auth_has_any_role(array['coach']::app_role[]) and p.programme_type <> 'rehab')
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

drop policy programme_assignments_write on public.programme_assignments;
create policy programme_assignments_write on public.programme_assignments for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and assigned_by = auth_user_id()
    and exists (
      select 1 from programmes p
      where p.id = programme_id
        and p.org_id = auth_org_id()
        and (
          (auth_has_any_role(array['coach']::app_role[]) and p.programme_type <> 'rehab')
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

drop policy programme_assignments_update on public.programme_assignments;
create policy programme_assignments_update on public.programme_assignments for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programmes p
      where p.id = programme_id
        and p.org_id = auth_org_id()
        and (
          (auth_has_any_role(array['coach']::app_role[]) and p.programme_type <> 'rehab')
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );
