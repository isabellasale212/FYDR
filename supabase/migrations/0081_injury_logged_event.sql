-- The first event on every timeline, written where the injury is created.
--
-- 0080 gave stage_change a trigger and left injury_logged with no writer at all,
-- which would have meant every timeline opening mid-story: a proposal against an
-- injury with no recorded beginning. Same reasoning as the stage_change trigger
-- rather than an insert in createInjury -- injuries are created from the injury
-- form today, and would be created from an import or a fixture tomorrow, and the
-- log should not depend on which path was used.
--
-- Reuses 0080's role-resolution by calling the same function shape; the two
-- triggers are separate because AFTER INSERT has no OLD row to compare.

create or replace function public.injury_insert_writes_timeline_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  select r into v_role
  from unnest(ARRAY['medic','sport_scientist','coach','strength_conditioning','nutritionist']::public.app_role[]) r
  where public.auth_has_any_role(ARRAY[r])
  limit 1;

  insert into public.injury_timeline_event (org_id, injury_id, created_by, created_by_role, type, payload)
  values (
    new.org_id, new.id, public.auth_user_id(), coalesce(v_role, 'medic'::app_role), 'injury_logged',
    jsonb_build_object('body_area', new.body_area::text, 'side', new.side::text)
  );
  return new;
end;
$$;

create trigger injuries_insert_timeline
  after insert on public.injuries
  for each row execute function public.injury_insert_writes_timeline_event();
