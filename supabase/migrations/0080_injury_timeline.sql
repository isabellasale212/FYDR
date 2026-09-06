-- Injury <-> S&C programme link: one shared timeline per injury.
--
-- THE SHAPE OF THE DECISION, because the policies below only make sense with it
-- in view. The medic owns clinical authority; the S&C owns programme design.
-- Neither loses their tool. The S&C drafts an assignment against an open injury
-- and it sits at 'proposed', not live to the athlete, until the medic approves
-- it. Every step is recorded as an event.
--
-- WHO CAN READ THE TIMELINE: the medic, and only the medic. Decided 2026-09-06
-- as a general rule rather than a one-off. The reason is the `note` event type:
-- it is free text on an injury, and if the S&C could read the log it would
-- become a second channel for clinical detail alongside injury_clinical, which
-- is medic-only and enforced here rather than in the app. The S&C still writes
-- to the timeline (their proposal is an event) and still sees the state that
-- matters to them -- their assignment reads 'proposed' until it goes active --
-- from programme_assignments, which they already read.
--
-- APPEND-ONLY IN PRACTICE, WITHOUT A TRIGGER. authenticated gets SELECT and
-- INSERT and no UPDATE or DELETE policy at all, so no application path can edit
-- history. Deliberately NOT the statement-trigger approach audit_log uses:
-- that makes the table impossible to TRUNCATE, which is what stopped
-- reset-scratch dead until a guard was lifted by hand. Same guarantee where it
-- counts, without making a test database unrebuildable.
--
-- STAGE CHANGES ARE WRITTEN BY A TRIGGER, not by the application. The proposal
-- says an event is written "every time that field changes", and the only way to
-- mean that literally is to attach it to the column. An app-level write would
-- record the paths somebody remembered.

create type injury_timeline_event_type as enum (
  'injury_logged',
  'stage_change',
  'programme_proposed',
  'programme_signed_off',
  'note'
);

create table public.injury_timeline_event (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id),
  injury_id uuid not null references public.injuries(id) on delete cascade,
  created_by uuid references public.users(id),
  /* Snapshotted at write time, per the proposal: the log must still read
     correctly after somebody's roles change, or after they leave. */
  created_by_role app_role not null,
  type injury_timeline_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index injury_timeline_event_injury on public.injury_timeline_event (injury_id, created_at);

alter table public.injury_timeline_event enable row level security;

grant select, insert on public.injury_timeline_event to authenticated;

/* Read: the medic alone. See the note above on why this is not shared with the
   S&C even though they write to it. */
create policy injury_timeline_medic_select on public.injury_timeline_event
  for select to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(ARRAY['medic'::app_role]));

/* Write: both participants, and the role recorded must be the role they
   actually hold — so an event cannot be attributed to somebody else. */
create policy injury_timeline_staff_insert on public.injury_timeline_event
  for insert to authenticated
  with check (
    org_id = auth_org_id()
    and created_by = auth_user_id()
    and auth_has_any_role(ARRAY['medic'::app_role, 'strength_conditioning'::app_role])
    and auth_has_any_role(ARRAY[created_by_role])
  );


-- ---------------------------------------------------------------------------
-- The assignment side.
-- ---------------------------------------------------------------------------

/* Which injury this assignment was drafted against. Null for every ordinary
   assignment, which is why the rule below is scoped by it: nothing about
   non-injury programme work changes. */
alter table public.programme_assignments
  add column if not exists injury_id uuid references public.injuries(id);

create index if not exists programme_assignments_injury on public.programme_assignments (injury_id)
  where injury_id is not null;

/* Only the medic may make an injury-linked assignment live.
 *
 * Expressed in WITH CHECK against the NEW row, and scoped to injury_id being
 * present, because RLS cannot see the OLD row here and a blanket "only a medic
 * may set active" would stop the S&C activating ordinary programmes they have
 * always owned. So: an assignment with no injury behaves exactly as before; one
 * drafted against an injury can be moved to 'active' by the medic alone.
 *
 * The S&C can still edit their own draft while it sits at 'proposed', which is
 * what "medic requests changes -> S&C edits the same draft and re-saves" needs. */
drop policy if exists programme_assignments_update on public.programme_assignments;
create policy programme_assignments_update on public.programme_assignments
  for update to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY[
      'sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role,
      'strength_conditioning'::app_role, 'nutritionist'::app_role
    ])
  )
  with check (
    org_id = auth_org_id()
    and (
      injury_id is null
      or status <> 'active'::assignment_status
      or auth_has_any_role(ARRAY['medic'::app_role])
    )
  );


-- ---------------------------------------------------------------------------
-- stage_change, written by the column rather than by the caller.
-- ---------------------------------------------------------------------------

create or replace function public.injury_status_writes_timeline_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.auth_user_id();
  v_role  public.app_role;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  /* The acting role, medic first: the person changing a clinical stage is
     normally the medic, and where somebody holds several roles that is the one
     the log should name. Falls back to whatever they hold so a stage change is
     never lost for want of a label. */
  select r into v_role
  from unnest(ARRAY['medic','sport_scientist','coach','strength_conditioning','nutritionist']::public.app_role[]) r
  where public.auth_has_any_role(ARRAY[r])
  limit 1;

  insert into public.injury_timeline_event (org_id, injury_id, created_by, created_by_role, type, payload)
  values (
    new.org_id, new.id, v_actor, coalesce(v_role, 'medic'::app_role), 'stage_change',
    jsonb_build_object('from', old.status::text, 'to', new.status::text)
  );
  return new;
end;
$$;

create trigger injuries_status_timeline
  after update of status on public.injuries
  for each row execute function public.injury_status_writes_timeline_event();
