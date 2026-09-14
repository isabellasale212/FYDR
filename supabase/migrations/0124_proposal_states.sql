-- PATTERN-S3 C6 (Isabella, 13 September 2026): rehab programme proposals with
-- three states — Proposed, Approved, Returned — and a required return reason,
-- in one list the S&C and the medic both see.
--
-- WHAT EXISTED. 'proposed' (0079); the medic's sign-off set 'active' and
-- wrote a programme_signed_off timeline event — approval DOES assign, the
-- assignment is the same row and 'active' is what "Approved" stores. No
-- returned state: the medic's reason went into the injury timeline as a
-- note the S&C cannot read (injury_timeline_medic_select), and the
-- component's own header called reaching them in person "a deliberate limit
-- of this build".
--
-- WHAT THIS ADDS. 'returned' joins assignment_status. programme_assignments
-- carries who decided, when, and the return reason — on the row both roles
-- read, so the reason reaches the S&C where the proposal is. decide_proposal()
-- is the medic's one write for both outcomes: approve → active (as today,
-- with the timeline event), return → returned with a reason that may not be
-- empty (the timeline note as before, so the medic's log is unchanged). An
-- S&C re-proposes by assigning again; the returned row stays as the record.
-- The enum value cannot be used in the same transaction it is added in
-- (0079's lesson), so the function is created in the next migration-safe
-- way: it references the value as text and casts at run time.

alter type public.assignment_status add value if not exists 'returned';

alter table public.programme_assignments
  add column decided_by uuid references public.users(id),
  add column decided_at timestamptz,
  add column return_reason text;
comment on column public.programme_assignments.return_reason is
  'PATTERN-S3 C6: why the medic sent an injury-linked proposal back. Required on a return; shown in full to the S&C on the proposals list. 0124.';
comment on column public.programme_assignments.decided_by is
  'The medic who approved or returned an injury-linked proposal (0124). Null while proposed.';

create or replace function public.decide_proposal(p_assignment_id uuid, p_decision text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_row public.programme_assignments;
  v_name text;
begin
  if not public.auth_has_any_role(array['medic']::public.app_role[]) then
    raise exception 'deciding a proposal belongs to the medic' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'return') then
    raise exception 'decision must be approve or return' using errcode = '22023';
  end if;
  select * into v_row from public.programme_assignments where id = p_assignment_id and org_id = v_org;
  if v_row.id is null then
    raise exception 'no such proposal' using errcode = '42501';
  end if;
  if v_row.injury_id is null or v_row.status::text <> 'proposed' then
    raise exception 'not_a_proposal' using errcode = 'P0001';
  end if;
  select name into v_name from public.programmes where id = v_row.programme_id;

  if p_decision = 'approve' then
    update public.programme_assignments
       set status = 'active', decided_by = public.auth_user_id(), decided_at = now(), return_reason = null
     where id = v_row.id;
    insert into public.injury_timeline_event (org_id, injury_id, created_by, created_by_role, type, payload)
    values (v_org, v_row.injury_id, public.auth_user_id(), 'medic', 'programme_signed_off', jsonb_build_object('assignment_id', v_row.id, 'programme', v_name));
  else
    if p_reason is null or length(btrim(p_reason)) = 0 then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    update public.programme_assignments
       set status = 'returned'::public.assignment_status, decided_by = public.auth_user_id(), decided_at = now(), return_reason = btrim(p_reason)
     where id = v_row.id;
    insert into public.injury_timeline_event (org_id, injury_id, created_by, created_by_role, type, payload)
    values (v_org, v_row.injury_id, public.auth_user_id(), 'medic', 'note', jsonb_build_object('assignment_id', v_row.id, 'text', btrim(p_reason), 'kind', 'changes_requested'));
  end if;

  insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata)
  values (v_org, public.auth_user_id(), 'medic', case when p_decision = 'approve' then 'proposal.approved' else 'proposal.returned' end,
          'programme_assignment', v_row.id, v_row.athlete_id, jsonb_build_object('programme', v_name, 'injury_id', v_row.injury_id, 'reason', p_reason));
end;
$$;
revoke all on function public.decide_proposal(uuid, text, text) from public;
grant execute on function public.decide_proposal(uuid, text, text) to authenticated;
