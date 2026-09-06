-- Recording attendance narrows to the sport scientist and the coach.
--
-- The timetable page opened to every staff role in the same change, and those
-- two facts belong together: /schedule already showed all five roles the same
-- sessions, so the page's old coach-or-medic redirect was an artefact of the
-- four-role model. Opening a page hands a WRITE to whoever can see it unless the
-- write is gated on its own, which is what this migration does.
--
-- THIS NARROWS THE MEDIC, deliberately. That role can record attendance today
-- and cannot after this. It is the one behaviour change here that somebody could
-- notice and be surprised by, so it is stated rather than left to be discovered:
-- attendance is a session-management act, SESSION_EDIT is the set that owns
-- those, and G-33 already took scheduling off the medic.
--
-- SELECT IS DELIBERATELY LEFT ALONE, admitting all five. Reading who turned up
-- is the entire reason the page is now open to the S&C and the nutritionist; a
-- narrowing here would hand them a page with nothing on it.
--
-- The app hides the controls from roles this refuses (TimetableSessionCard's
-- canRecord). That is tidiness. This is the authorisation.

drop policy if exists session_attendance_staff_insert on public.session_attendance;
create policy session_attendance_staff_insert on public.session_attendance
  for insert to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])
  );

drop policy if exists session_attendance_staff_update on public.session_attendance;
create policy session_attendance_staff_update on public.session_attendance
  for update to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])
  );
