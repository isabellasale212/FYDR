-- 0133_rated_session_read_only.sql
--
-- What this does
--   A rated session is read-only at the database. PATTERN-S4 C4 (Isabella,
--   13 September 2026, batch B6) made a session with at least one rating
--   read-only on the session screen; 15 September extended it to the schedule
--   grid with the same sentence. Both are screens. The pre-deploy fix #2
--   (Isabella, 15 September): "A stale tab can still move a rated session,
--   which is the exact hole the ruling was about … The database is the last
--   line here the same way it is for injury and availability."
--
--   The sentence both screens show is the rule: "Ratings are tied to its date
--   and duration, so it cannot be changed." So the trigger refuses a change to
--   starts_at or duration_min on a session that has a LIVE rating (a
--   training_entries row with superseded_by null — the same population
--   fetchSessionDetail and the week grid count), and nothing else: the title,
--   the location, the type, the matchday offset and the status still change,
--   because a rating is not tied to them and the screens' "cancel it and
--   create a new one" needs the status write. A superseded rating with nothing
--   live in its place is no rating.
--
--   Loud, not silent: an exception, so a stale tab's publish reports it per
--   session (the grid's failed[] shape) instead of matching no row and reading
--   as done — the failure mode 0084's own header warned about.
--
-- Tests: supabase/tests/870_rated_session_read_only_test.sql (written first).

create or replace function public.sessions_rated_read_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.starts_at is distinct from old.starts_at or new.duration_min is distinct from old.duration_min)
     and exists (
       select 1 from public.training_entries te
        where te.session_id = old.id
          and te.superseded_by is null
     ) then
    raise exception 'session_rated_read_only' using errcode = 'P0001',
      hint = 'Ratings are tied to the session''s date and duration. Cancel it and create a new one if the details are wrong.';
  end if;
  return new;
end;
$$;

comment on function public.sessions_rated_read_only() is
  'Refuses a change to starts_at or duration_min on a session with a live rating '
  '(PATTERN-S4 C4 / B6, held at the table since 0133). Everything else on the row still moves.';

drop trigger if exists sessions_rated_read_only on public.sessions;
create trigger sessions_rated_read_only
  before update on public.sessions
  for each row execute function public.sessions_rated_read_only();
